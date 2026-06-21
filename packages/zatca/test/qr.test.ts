import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { encodeQrTlv, decodeQrTlv, deterministicQrTags } from "../src/qr";

const here = dirname(fileURLToPath(import.meta.url));
const read = (type: string, f: string): string => readFileSync(join(here, "golden", type, f), "utf8");
const utf8 = (u: Uint8Array): string => Buffer.from(u).toString("utf8");

const DOC_TYPES = [
  "standard",
  "simplified",
  "credit-note-standard",
  "debit-note-standard",
  "credit-note-simplified",
  "debit-note-simplified",
] as const;

describe.each(DOC_TYPES)("QR-TLV codec — %s (byte-match vs SDK QR)", (type) => {
  const goldenQr = read(type, "qr.txt").trim();

  it("round-trips the SDK QR byte-for-byte (decode → encode)", () => {
    expect(encodeQrTlv(decodeQrTlv(goldenQr))).toBe(goldenQr);
  });

  it("decodes the canonical 9-tag structure", () => {
    expect(decodeQrTlv(goldenQr).map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("derives tags 1–6 from the invoice matching the SDK QR", () => {
    const ours = deterministicQrTags(read(type, "input.xml"));
    const sdk = decodeQrTlv(goldenQr).filter((t) => t.tag <= 6);
    expect(ours.map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const expected of sdk) {
      const o = ours.find((t) => t.tag === expected.tag);
      expect(o, `tag ${expected.tag} present`).toBeDefined();
      expect(utf8(o!.value), `tag ${expected.tag} value`).toBe(utf8(expected.value));
    }
  });
});
