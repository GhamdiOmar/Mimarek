# Mimaric — k6 Load Test Baseline

Load-test scripts for Mimaric PropTech. This directory contains a self-contained
k6 test suite that is **not part of the TypeScript build** — k6 scripts are plain
JavaScript executed by the k6 Go binary, not by Node or the Next.js compiler.

---

## Prerequisites

k6 is a standalone Go binary. Install it separately — it is not an npm dependency.

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring \
         --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
         --keyserver hkp://keyserver.ubuntu.com:80 \
         --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
      https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Windows (winget):**
```powershell
winget install k6 --source winget
```

**Docker (no install):**
```bash
docker run --rm -i grafana/k6 run - < apps/web/loadtest/login-and-browse.js
```

Verify: `k6 version` should print `k6 v0.5x.x (go...)`.

---

## Running the baseline

```bash
# Against staging (recommended — HTTP/2, real DB pool)
BASE_URL=https://staging.mimaric.sa \
TEST_EMAIL=admin@mimaric.sa \
TEST_PASSWORD=mimaric2026 \
k6 run apps/web/loadtest/login-and-browse.js
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Full origin of the target instance. Must match `NEXTAUTH_URL` on the server exactly (CSRF check). |
| `TEST_EMAIL` | `admin@mimaric.sa` | Login email (single-account mode). |
| `TEST_PASSWORD` | `mimaric2026` | Login password (single-account mode). |
| `TEST_USER_POOL` | _(unset)_ | Comma-separated `email:password` pairs for multi-account mode. Use when `login_spike` scenario is enabled to avoid rate-limiter conflicts. Example: `a@x.sa:pass1,b@x.sa:pass2`. |

### Disabling the login_spike scenario

To run only the browse ramp (quieter, fewer logins):

```bash
k6 run --exclude-scenario login_spike \
  apps/web/loadtest/login-and-browse.js
```

---

## What it measures

### Metrics

| Metric | What it tells you |
|---|---|
| `http_req_duration` p50/p95/p99 | **TTFB + transfer** — the full round-trip from k6's perspective. On a deployed instance this is almost entirely server-side rendering time (RSC). On local dev it includes HTTP/1.1 queuing (see below). |
| `mimaric_login_duration_ms` p95/p99 | Time for the full two-step NextAuth CSRF+credentials POST. Includes bcrypt compare (~80–120ms CPU). |
| `mimaric_browse_latency_ms` p95/p99 | Per-route latency for the five dashboard GET routes. |
| `http_req_failed` | Rate of HTTP errors (4xx/5xx). < 1% is the pass threshold. |
| `mimaric_login_error_rate` | Rate of failed login attempts. Should be 0% — any failure indicates a CSRF flow break, rate-limiter fire, or server overload. |
| `mimaric_session_errors_total` | Cumulative count of sessions that failed (login failure or browse error). |

### Thresholds (pass/fail)

| Threshold | Pass condition | Interpretation |
|---|---|---|
| `http_req_duration{scenario:browse_session}` p95 | < 800ms | 95% of dashboard renders under 0.8s |
| `http_req_duration{scenario:browse_session}` p99 | < 2 000ms | Pool-exhaustion early-warning. p99 > 2s before p95 > 800ms = DB connection pool saturating. |
| `mimaric_login_duration_ms` p95 | < 1 500ms | Login within 1.5s at load |
| `mimaric_login_duration_ms` p99 | < 3 000ms | Login within 3s at the 99th percentile |
| `http_req_failed` rate | < 1% | Server error budget |
| `mimaric_login_error_rate` rate | < 1% | Login success budget |
| `mimaric_browse_latency_ms` p95 | < 800ms | Browse latency per route |
| `mimaric_browse_latency_ms` p99 | < 2 000ms | Browse tail latency |

k6 exits with code **0** (pass) if all thresholds are met, **non-zero** (fail) otherwise.
This makes it directly usable in CI.

### Load profile

The `browse_session` scenario ramps from 20 → 200 VUs over 2 minutes, holds
peak load for 5 minutes, then ramps down to 0 over 30 seconds. Each VU models
one property manager tab — login → browse 5 routes with 3–8s think-time each →
repeat.

At 200 VUs × (1 login + 5 page GETs) with ~5s average think-time, the script
generates roughly **40 req/s** sustained at peak — a realistic daily-peak estimate
for a mid-size Mimaric tenant with ~50 concurrent staff users.

---

## Important caveats

### 1. Run against a deployed HTTP/2 instance, not local dev

Local `next start` (or `next dev`) serves HTTP/1.1 without TLS. HTTP/1.1 allows
at most **6 concurrent TCP connections per origin** per browser tab. k6 is not a
browser, but the same OS-level connection limit applies per VU. This means:

- At 200 VUs locally, each VU queues its 5 GET requests behind 6 slots.
- The server appears to saturate at ~1 200 concurrent connections, not 200 × real
  browser concurrency. Latency spikes earlier than it would in production.
- Throughput numbers are not comparable to production.

**Always run the baseline against a staging or production instance with HTTP/2
enabled (Vercel, AWS ALB, or Nginx with `http2` directive).** HTTP/2 multiplexes
all requests over a single connection — the 6-connection cap disappears.

### 2. Concurrent logins and session-cookie conflicts

If many VUs log in with the **same email address** simultaneously, each successful
`/api/auth/callback/credentials` POST returns a new `next-auth.session-token` cookie.
Because k6 maintains a per-VU cookie jar, this is safe **within a single VU**
(its jar always has the latest token). However, if you observe unexpected 401s
during the browse phase, it usually means:

- The `login_spike` scenario is running concurrently with `browse_session` using
  the same account, and a spike VU's login has invalidated a browse VU's token
  (only possible if you share a cookie jar across VUs — you should not).
- The server's rate-limiter (3-tier, see `auth.ts`) has fired because > 5 failed
  logins for the same email occurred within 30 seconds.

Fix: provide `TEST_USER_POOL` with ≥ 30 distinct test accounts when running the
`login_spike` scenario. Use `pnpm --filter @repo/db prisma db seed` to ensure the
seed accounts exist.

### 3. `_rsc` prefetch cancellations are not server errors

Next.js App Router emits `?_rsc=<token>` GET requests for route prefetching.
Browsers cancel these GETs when the user navigates before the prefetch resolves,
causing `net::ERR_ABORTED` in DevTools. **k6 does not issue `_rsc` prefetch GETs**
(it is not a browser). If you see `ERR_ABORTED` in real-browser performance
testing run alongside k6, those are client-side cancellations — not server errors.
Do not add them to k6 `check()` assertions or thresholds.

### 4. NextAuth v5 CSRF token requirement

NextAuth v5 uses a double-submit CSRF cookie pattern. The load test performs the
correct two-step flow: `GET /api/auth/csrf` → extract `csrfToken` →
`POST /api/auth/callback/credentials` with the token in the form body. If you
see `403` responses on the POST step, the most common causes are:

- `NEXTAUTH_URL` on the server does not match `BASE_URL` in the test (origin
  mismatch causes CSRF validation to reject the token).
- The GET and POST are not using the same k6 VU cookie jar (should never happen
  with default k6 settings, but can occur if you manually pass a `jar` option).
- Your staging instance has a reverse proxy that strips the `Cookie` header.

### 5. Mimaric login rate-limiter

`auth.ts` enforces a 3-tier progressive rate-limiter per email:

| Tier | Threshold | Cooldown |
|---|---|---|
| 1 | 5 failures in 30s | 30 seconds |
| 2 | 10 failures in 5min | 5 minutes |
| 3 | 20 failures in 15min | 15 minutes |

During a load test with valid credentials, the limiter should never fire. If it
does, it means your `TEST_PASSWORD` is wrong for that account, or `TEST_USER_POOL`
has malformed entries. Check `mimaric_login_error_rate` — if it's > 0%, inspect
the k6 output for `login not 302 to error` check failures.

---

## Interpreting results — what to look for

### Pool-exhaustion signature

```
mimaric_browse_latency_ms p95=450ms   ← healthy
mimaric_browse_latency_ms p99=3200ms  ← ALERT: p99 spiked while p95 is fine
```

p99 >> p95 with a ratio > 4× is the classic Prisma DB connection pool exhaustion
pattern: most requests queue and complete fast, but ~1% wait for a freed connection
slot. Investigate:

```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';
```

Increase `connection_limit` in `packages/db/src/index.ts` (Prisma datasource) or
deploy a PgBouncer sidecar. Supabase's built-in pooler (Transaction mode, port 6543)
is the zero-config fix for this deployment.

### Timeout/error signature

```
http_req_failed rate=8.3%   ← FAIL: exceeds 1% threshold
```

> 1% errors at sustained load means the server is dropping connections before
responding. Most common causes: Next.js worker OOM (increase memory limit),
Supabase connection pool exhausted (see above), or a cold-path server action
throwing an uncaught exception. Check Vercel/CloudWatch function logs for
`FUNCTION_INVOCATION_TIMEOUT` or `oom`.

### Login latency spike

```
mimaric_login_duration_ms p95=2800ms  ← FAIL: > 1 500ms threshold
```

bcrypt compare is CPU-bound (~100ms on a warm Node.js worker). If login p95
spikes under load, the Node.js event loop is saturated. Consider:
- Offloading bcrypt to a worker thread (already using `@node-rs/bcrypt` which
  runs in a native thread pool — check pool size).
- Separating the auth route onto a dedicated compute instance.
- Rate-limiting login attempts more aggressively to reduce concurrent bcrypt ops.

---

## CI integration

Add to your CI pipeline after `npm run build` and staging deploy:

```yaml
# .github/workflows/load-test.yml (example)
- name: Run k6 load test
  uses: grafana/k6-action@v0.3.1
  with:
    filename: apps/web/loadtest/login-and-browse.js
  env:
    BASE_URL:       ${{ secrets.STAGING_URL }}
    TEST_EMAIL:     ${{ secrets.LOAD_TEST_EMAIL }}
    TEST_PASSWORD:  ${{ secrets.LOAD_TEST_PASSWORD }}
    TEST_USER_POOL: ${{ secrets.LOAD_TEST_USER_POOL }}
```

k6 exits non-zero if any threshold fails — CI will mark the step failed and block
the deploy.

Set CI thresholds **2–3× higher** than production SLOs to account for slower CI
network paths (the GitHub Actions runner is in us-east-1; your staging may be in
me-south-1 Bahrain — add ~80ms baseline RTT).

---

## Related

- AGENTS.md §3.9 — Release-gate rule (preview verification before tagging)
- `future-plans/REMAINING-WORK.md` §3.9 — Load-test baseline task (this directory)
- Mimaric staging: https://staging.mimaric.sa (internal)
- k6 docs: https://grafana.com/docs/k6/latest/
- Grafana Cloud k6: https://app.k6.io (optional hosted runner + dashboards)
