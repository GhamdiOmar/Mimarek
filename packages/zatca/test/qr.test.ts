import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { encodeQrTlv, decodeQrTlv, deterministicQrTags } from "../src/qr";

const here = dirname(fileURLToPath(import.meta.url));
const golden = (f: string): string => readFileSync(join(here, "golden", "standard", f), "utf8");

const utf8 = (u: Uint8Array): string => Buffer.from(u).toString("utf8");

describe("QR-TLV codec — byte-match vs the SDK QR (P0)", () => {
  const goldenQr = golden("qr.txt").trim();

  it("round-trips the SDK QR byte-for-byte (decode → encode)", () => {
    expect(encodeQrTlv(decodeQrTlv(goldenQr))).toBe(goldenQr);
  });

  it("decodes the canonical 9-tag structure", () => {
    const tags = decodeQrTlv(goldenQr);
    expect(tags.map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("deterministicQrTags — tags 1–6 derived from the invoice match the SDK QR", () => {
  it("matches the SDK's tags 1–6 (seller, VAT, timestamp, totals, hash)", () => {
    const fromInvoice = deterministicQrTags(golden("input.xml"));
    const fromSdk = decodeQrTlv(golden("qr.txt").trim()).filter((t) => t.tag <= 6);

    expect(fromInvoice.map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const expected of fromSdk) {
      const ours = fromInvoice.find((t) => t.tag === expected.tag);
      expect(ours, `tag ${expected.tag}`).toBeDefined();
      expect(utf8(ours!.value), `tag ${expected.tag} value`).toBe(utf8(expected.value));
    }
  });
});
