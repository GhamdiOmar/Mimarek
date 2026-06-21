import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeInvoiceHash } from "../src/hash";

const here = dirname(fileURLToPath(import.meta.url));
const read = (type: string, f: string): string => readFileSync(join(here, "golden", type, f), "utf8");

// Byte-match the ZATCA invoice hash vs the Fatoora SDK across document types (P0 gate).
describe.each(["standard", "simplified"])("computeInvoiceHash — %s invoice", (type) => {
  const expected = read(type, "hash.txt").trim();

  it("matches the SDK invoice hash for the unsigned invoice", () => {
    expect(computeInvoiceHash(read(type, "input.xml"))).toBe(expected);
  });

  it("matches after stripping signing artifacts from the signed invoice", () => {
    expect(computeInvoiceHash(read(type, "signed.xml"))).toBe(expected);
  });
});
