/**
 * Sanitize any thrown error into a safe, bilingual, user-facing message.
 *
 * Resolves CX-012. AGENTS.md §6.11.4: never leak stack traces, status codes,
 * variable names, "undefined", or raw Zod/Prisma/SDK text to users. Deliberately
 * friendly messages thrown by server actions (e.g. Ejar/ZATCA business-rule copy)
 * are short + clean, so they pass through; anything that looks technical or
 * over-long collapses to a friendly bilingual fallback.
 *
 * Pure module (NOT "use server") — safe to import in client and server code.
 *
 * Usage (client):  toast.error(sanitizeError(err, lang))
 */

export type Lang = "ar" | "en";

/** Substrings that mark a message as leaked internals, never user copy. */
const TECHNICAL_MARKERS = [
  "Prisma", "prisma", "PrismaClient", "PrismaClientKnownRequestError",
  "Invalid `", "Argument ", "Unique constraint", "Foreign key constraint",
  "Zod", "ZodError", "invalid_type", "Expected ", "Received ", "at path",
  "TypeError", "ReferenceError", "SyntaxError", "is not a function",
  "Cannot read", "undefined", "null is not",
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "fetch failed", "socket hang up",
  "PostgresError", "relation \"", "column \"", "syntax error at",
  "\n  at ", "    at ", // stack-trace lines
];

const GENERIC: Record<Lang, string> = {
  ar: "تعذّر إكمال العملية. حدّث الصفحة وحاول مرة أخرى، وإذا تكرّر الأمر تواصل مع الدعم.",
  en: "Something went wrong. Refresh and try again — if it keeps happening, contact support.",
};

/** Friendly bilingual copy keyed by an error class we recognize. */
const MAP = {
  FORBIDDEN: {
    ar: "ليست لديك صلاحية لتنفيذ هذا الإجراء. راجِع مسؤول مؤسستك.",
    en: "You don't have permission to do that. Ask your organization admin.",
  },
  UNAUTHORIZED: {
    ar: "انتهت جلستك. سجّل الدخول من جديد للمتابعة.",
    en: "Your session expired. Sign in again to continue.",
  },
  NETWORK: {
    ar: "تعذّر الاتصال بالخادم. تأكّد من اتصالك بالإنترنت وحاول مجددًا.",
    en: "Couldn't reach the server. Check your connection and try again.",
  },
  UPLOAD: {
    ar: "تعذّر رفع الملف. تأكّد من نوعه وحجمه ثم حاول مجددًا.",
    en: "Couldn't upload the file. Check its type and size, then try again.",
  },
  VALIDATION: {
    ar: "تحقّق من الحقول المدخلة ثم حاول مجددًا.",
    en: "Please check the fields and try again.",
  },
} satisfies Record<string, Record<Lang, string>>;

function looksTechnical(msg: string): boolean {
  if (msg.length > 160) return true;
  return TECHNICAL_MARKERS.some((m) => msg.includes(m));
}

/**
 * Turn an unknown error into a user-safe bilingual string.
 * @param err  anything thrown / caught
 * @param lang current UI language
 */
export function sanitizeError(err: unknown, lang: Lang): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (raw) {
    // Class-match first (these often embed variable names we must hide).
    if (/forbidden|not allowed|permission/i.test(raw)) return MAP.FORBIDDEN[lang];
    if (/unauthorized|unauthenticated|session (has )?expired/i.test(raw)) return MAP.UNAUTHORIZED[lang];
    if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(raw)) return MAP.NETWORK[lang];
    if (/upload|uploadthing|file too large|invalid file/i.test(raw)) return MAP.UPLOAD[lang];
    if (/^invalid input/i.test(raw) || /zod/i.test(raw)) return MAP.VALIDATION[lang];

    // Otherwise trust short, clean, deliberately-thrown business messages.
    if (!looksTechnical(raw)) return raw;
  }

  return GENERIC[lang];
}
