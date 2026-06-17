/**
 * Structured, no-PII security telemetry for read-path crypto anomalies (A2).
 * Emitted as a structured console log (NOT a DB AuditLog row) because it fires on
 * the PII read hot-path with no session context; log aggregation/alerting keys off
 * the stable "[security]" prefix + event code. The field NAME is logged, never the value.
 * Once the A1 DB CHECK constraint is live, PII_PLAINTEXT_DETECTED becomes impossible.
 */
export type SecurityEventCode = "PII_PLAINTEXT_DETECTED";
export function logSecurityEvent(code: SecurityEventCode, field: string): void {
  console.warn(`[security] ${code} field="${field}"`);
}
