import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeInvoiceHash } from "../src/hash";

const here = dirname(fileURLToPath(import.meta.url));
const golden = (f: string): string => readFileSync(join(here, "golden", "standard", f), "utf8");

describe("computeInvoiceHash — byte-match vs ZATCA Fatoora SDK (P0 gate)", () => {
  const expected = golden("hash.txt").trim();

  it("matches the SDK invoice hash for the unsigned standard invoice", () => {
    expect(computeInvoiceHash(golden("input.xml"))).toBe(expected);
  });

  it("matches after stripping signing artifacts from the signed invoice", () => {
    // Same canonical digest once UBLExtensions/Signature/QR are removed.
    expect(computeInvoiceHash(golden("signed.xml"))).toBe(expected);
  });
});
