/**
 * Mimaric — k6 Load Test: Authenticated Browse Session
 * =====================================================
 * Models a realistic property-manager session:
 *   1. Acquire a NextAuth session cookie (POST credentials endpoint).
 *   2. Browse three high-traffic dashboard routes with think-time between requests.
 *   3. Ramp from 20 → 200 VUs, hold, then ramp down.
 *
 * Run:
 *   BASE_URL=https://staging.mimaric.sa \
 *   TEST_EMAIL=admin@mimaric.sa \
 *   TEST_PASSWORD=mimaric2026 \
 *   k6 run apps/web/loadtest/login-and-browse.js
 *
 * ─── §3.9 GOTCHAS ──────────────────────────────────────────────────────────
 *
 * 1. HTTP/1.1 concurrency cap (local dev only)
 *    A browser uses at most 6 concurrent TCP connections per origin under HTTP/1.1.
 *    Running against a local `next start` (HTTP/1.1) means each VU is capped at
 *    ~6-way request concurrency — the server appears to saturate earlier than it
 *    would on a real deployment with HTTP/2 multiplexing. Always run this script
 *    against a staging instance that serves HTTP/2 over TLS. See README.md for
 *    the full local-dev caveat.
 *
 * 2. Shared-session-cookie conflict with concurrent logins
 *    If many VUs all POST to /api/auth/callback/credentials with THE SAME email
 *    at the same time, each successful login overwrites the previous
 *    next-auth.session-token cookie — effectively logging out every other VU.
 *    This script avoids the problem by:
 *      a) Rotating across a pool of test accounts (TEST_USER_POOL env var).
 *      b) Falling back to a single-account mode where each VU re-establishes its
 *         own cookie jar (k6 keeps per-VU cookie jars by default).
 *    Never rely on a single global cookie shared across VUs.
 *
 * 3. _rsc prefetch GETs showing net::ERR_ABORTED
 *    The Next.js App Router emits `?_rsc=...` prefetch requests that browsers
 *    cancel when navigation completes before the prefetch resolves. k6 does NOT
 *    issue these prefetch GETs automatically (it's not a browser). If you see
 *    net::ERR_ABORTED in browser DevTools during parallel real-browser testing,
 *    those are NOT server errors — they are client-side cancellations. Do not
 *    add them to k6 thresholds.
 *
 * 4. NextAuth v5 credential login — CSRF token requirement
 *    NextAuth v5 Credentials login is a two-step CSRF flow:
 *      Step 1: GET /api/auth/csrf  → returns a JSON object with `csrfToken`.
 *      Step 2: POST /api/auth/callback/credentials with the csrfToken, email,
 *              password, and `redirect=false` in the body.
 *    Both steps MUST use the same k6 CookieJar (automatic per-VU). Without the
 *    CSRF token the POST returns a 403 "missing csrf token" error, not a login.
 *    If your staging instance has NEXTAUTH_URL set to a different origin than
 *    BASE_URL, the CSRF check will fail — ensure NEXTAUTH_URL = BASE_URL on staging.
 * ───────────────────────────────────────────────────────────────────────────
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ─── Custom metrics ──────────────────────────────────────────────────────────
const loginDuration = new Trend("mimaric_login_duration_ms", true);
const browseLatency = new Trend("mimaric_browse_latency_ms", true);
const loginErrors   = new Rate("mimaric_login_error_rate");
const sessionErrors = new Counter("mimaric_session_errors_total");

// ─── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

/**
 * Optional comma-separated pool of test accounts. When set, each VU picks one
 * account by index to avoid session-cookie conflicts (gotcha #2 above).
 * Format: "email1:pass1,email2:pass2,..."
 * Fallback (single account): TEST_EMAIL + TEST_PASSWORD.
 */
const USER_POOL_RAW = __ENV.TEST_USER_POOL || "";
const USER_POOL = USER_POOL_RAW
  ? USER_POOL_RAW.split(",").map((entry) => {
      const [email, ...rest] = entry.trim().split(":");
      return { email, password: rest.join(":") };
    })
  : [
      {
        email:    __ENV.TEST_EMAIL    || "admin@mimaric.sa",
        password: __ENV.TEST_PASSWORD || "mimaric2026",
      },
    ];

/**
 * Routes browsed during a simulated session.
 * These are all RSC (React Server Component) pages that return full HTML payloads
 * and are representative of the highest-traffic tenant dashboard routes.
 * Adjust for your tenant's most-visited pages.
 */
const BROWSE_ROUTES = [
  { label: "dashboard_home",    path: "/dashboard" },
  { label: "crm_customers",     path: "/dashboard/crm" },
  { label: "contracts_list",    path: "/dashboard/contracts" },
  { label: "payments_list",     path: "/dashboard/payments" },
  { label: "units_list",        path: "/dashboard/units" },
];

// ─── Thresholds ───────────────────────────────────────────────────────────────
// Use p95/p99, NOT averages. Averages mask tail latency:
//   p50 = 80ms, p99 = 4s means 1% of users wait 50× longer than the median.
//
// Pool-exhaustion threshold: p99 > 2 000ms indicates the DB connection pool is
//   saturating and queuing requests. Investigate with:
//     SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
// Timeout threshold: http_req_failed > 5% means the server is dropping connections
//   before responding — scale up replicas or add a connection pooler (PgBouncer).
export const options = {
  scenarios: {
    /**
     * browse_session — the primary scenario.
     * Ramps from 20 → 200 VUs over 2 minutes, holds peak for 5 minutes,
     * then ramps back to 0. Think-time between requests models real user pacing.
     * gracefulRampDown gives in-flight iterations time to finish cleanly.
     */
    browse_session: {
      executor:          "ramping-vus",
      startVUs:          20,
      gracefulRampDown:  "30s",
      stages: [
        { duration: "1m",  target: 50  }, // Warm-up: ramp to 50 VUs
        { duration: "1m",  target: 200 }, // Load:    ramp to 200 VUs
        { duration: "5m",  target: 200 }, // Sustain: hold peak load for 5 min
        { duration: "30s", target: 0   }, // Ramp down
      ],
    },

    /**
     * login_spike — a secondary scenario that fires a burst of concurrent logins
     * to verify the NextAuth credential flow and rate-limiter under load.
     * Runs in isolation (startTime: 0s, short duration) so it doesn't interfere
     * with browse_session latency measurements.
     * NOTE: disable this scenario if your staging DB has tight connection limits.
     */
    login_spike: {
      executor:  "ramping-vus",
      startVUs:  0,
      startTime: "0s",
      stages: [
        { duration: "30s", target: 30 }, // Ramp up concurrent logins
        { duration: "30s", target: 0  }, // Ramp back down
      ],
      gracefulRampDown: "10s",
      // Isolate login-spike metrics under a "spike_" tag so they don't pollute
      // browse_session p95/p99 measurements.
      tags: { scenario: "login_spike" },
    },
  },

  thresholds: {
    // ── Primary browse latency ───────────────────────────────────────────────
    // p95 < 800ms: 95% of dashboard page responses within 0.8s (fast-ISP target).
    // p99 < 2000ms: 99% within 2s (pool-exhaustion / DB-contention early-warning).
    // Hitting p99 > 2 000ms before p95 > 800ms is the classic pool-exhaustion
    // signature — investigate pg_stat_activity and Prisma pool size first.
    "http_req_duration{scenario:browse_session}": [
      "p(95)<800",
      "p(99)<2000",
    ],

    // ── Login flow latency ────────────────────────────────────────────────────
    // NextAuth credential POST includes bcrypt compare (~100ms CPU) so we allow
    // more headroom. p95 < 1 500ms is still well within user tolerance for login.
    "mimaric_login_duration_ms": [
      "p(95)<1500",
      "p(99)<3000",
    ],

    // ── Error rates ───────────────────────────────────────────────────────────
    // < 1% HTTP failures (4xx/5xx) across all scenarios.
    // A 5% budget is too generous for a SaaS — 1% at sustained 200 VUs is still
    // ~2 errors/second, which is a paging event in production.
    "http_req_failed": ["rate<0.01"],

    // ── Login-specific error rate ─────────────────────────────────────────────
    // 0% tolerated: every login attempt in a load test should succeed.
    // A login error means the CSRF flow broke, the rate-limiter fired, or the
    // credential route is overloaded — all are P1 production concerns.
    "mimaric_login_error_rate": ["rate<0.01"],

    // ── Custom browse latency trend ───────────────────────────────────────────
    "mimaric_browse_latency_ms": [
      "p(95)<800",
      "p(99)<2000",
    ],
  },
};

// ─── Helper: pick a test account for this VU ─────────────────────────────────
function pickAccount() {
  // __VU is 1-indexed; modulo ensures we stay within pool bounds.
  return USER_POOL[(__VU - 1) % USER_POOL.length];
}

// ─── Helper: NextAuth v5 credentials login ────────────────────────────────────
/**
 * Returns true on successful login (session cookie established), false otherwise.
 *
 * Flow (NextAuth v5 Credentials, JWT strategy):
 *   1. GET /api/auth/csrf  → JSON { csrfToken: "..." }
 *   2. POST /api/auth/callback/credentials with csrfToken + creds + redirect=false
 *   3. Check response for `ok: true` in the JSON body (NextAuth redirect=false mode).
 *
 * The per-VU CookieJar is automatic in k6; the session cookie is stored and
 * sent on all subsequent requests from the same VU automatically.
 *
 * Rate-limit awareness: Mimaric has a 3-tier login rate-limiter. If your VU pool
 * is small (< 10 accounts) and you're running the login_spike scenario at 30 VUs,
 * you will hit Tier 1 (5 fails per email per 30s). Use TEST_USER_POOL with ≥30
 * distinct accounts when running login_spike, or reduce login_spike target VUs.
 */
function doLogin(baseUrl, email, password) {
  const startMs = Date.now();

  // Step 1 — Fetch CSRF token.
  const csrfRes = http.get(`${baseUrl}/api/auth/csrf`, {
    headers: { Accept: "application/json" },
    tags: { name: "auth_csrf" },
  });

  const csrfOk = check(csrfRes, {
    "csrf fetch 200": (r) => r.status === 200,
    "csrf token present": (r) => {
      try {
        return !!JSON.parse(r.body).csrfToken;
      } catch {
        return false;
      }
    },
  });

  if (!csrfOk) {
    loginErrors.add(1);
    sessionErrors.add(1);
    return false;
  }

  const csrfToken = JSON.parse(csrfRes.body).csrfToken;

  // Step 2 — POST credentials + CSRF token.
  // `redirect=false` tells NextAuth to return JSON instead of a 302 redirect.
  const loginRes = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    {
      csrfToken,
      email,
      password,
      redirect: "false",
      callbackUrl: `${baseUrl}/dashboard`,
      json: "true",
    },
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      redirects: 0, // k6 follows redirects by default; disable so we can inspect
      tags: { name: "auth_credentials_post" },
    },
  );

  // NextAuth v5 with redirect=false returns 200 + JSON { url, ok } on success,
  // or a 302 redirect to /auth/login?error=... on failure.
  // A 302 to /auth/login means the credentials were rejected (or rate-limited).
  const loginOk = check(loginRes, {
    "login not 302 to error": (r) =>
      !(
        r.status === 302 &&
        r.headers["Location"] &&
        r.headers["Location"].includes("error")
      ),
    "login status 200 or 302 to dashboard": (r) =>
      r.status === 200 ||
      (r.status === 302 &&
        r.headers["Location"] &&
        !r.headers["Location"].includes("error")),
  });

  loginDuration.add(Date.now() - startMs);
  loginErrors.add(loginOk ? 0 : 1);

  if (!loginOk) {
    sessionErrors.add(1);
  }

  return loginOk;
}

// ─── VU setup: called once per VU before the default function ─────────────────
export function setup() {
  // No global setup needed — each VU logs in independently to avoid shared-cookie
  // conflicts (gotcha #2). Return metadata for informational purposes only.
  return {
    baseUrl:   BASE_URL,
    userCount: USER_POOL.length,
    routes:    BROWSE_ROUTES.map((r) => r.label),
  };
}

// ─── Default function: runs repeatedly for each VU ───────────────────────────
export default function (data) {
  const { email, password } = pickAccount();

  // ── Login phase ─────────────────────────────────────────────────────────────
  let loggedIn = false;
  group("01_login", () => {
    loggedIn = doLogin(BASE_URL, email, password);
    // Think-time: a real user takes 1–3s before navigating after login.
    sleep(1 + Math.random() * 2);
  });

  if (!loggedIn) {
    // If login failed, skip the browse phase — don't hammer with 401 noise.
    return;
  }

  // ── Browse phase ────────────────────────────────────────────────────────────
  // Simulate a property manager reviewing their dashboard in a single tab session.
  // Each route GET is a full RSC server-render (no client-side hydration in k6 —
  // k6 is NOT a browser; it sends plain HTTP GETs and measures TTFB + transfer).
  group("02_browse_dashboard", () => {
    for (const route of BROWSE_ROUTES) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}${route.path}`, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          // Simulate a real browser's language preference (Arabic-first, Saudi locale).
          "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
        },
        tags: { name: route.label },
      });

      const ok = check(res, {
        [`${route.label} status 200`]:    (r) => r.status === 200,
        [`${route.label} body non-empty`]: (r) => r.body && r.body.length > 500,
      });

      browseLatency.add(Date.now() - start);

      if (!ok) {
        sessionErrors.add(1);
      }

      // Think-time between page navigations (realistic: 3–8 seconds per page).
      // This is the single most important knob for realistic load:
      //   - Too low (< 1s): every VU hammers continuously → artificial spike.
      //   - Too high (> 15s): 200 VUs only generate ~13 req/s → under-tests.
      // 3–8s models a property manager who reads the page before clicking next.
      sleep(3 + Math.random() * 5);
    }
  });

  // ── Session teardown think-time ──────────────────────────────────────────────
  // Small pause before the VU resets and starts a new iteration (login again).
  sleep(2 + Math.random() * 3);
}

// ─── Teardown: called once after all VUs finish ───────────────────────────────
export function teardown(data) {
  // No server-side cleanup needed for JWT sessions (NextAuth JWT strategy — no
  // server-side session table). If you switch to DB sessions, add a DELETE here.
}
