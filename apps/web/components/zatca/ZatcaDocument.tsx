"use client";

/**
 * ZatcaDocument — D26: the human-readable ZATCA Phase-2 tax document.
 *
 * Renders the LOCKED `zatca-mockup/invoice.html` DOM/CSS structure from real
 * data props. Per D26 this is a LIGHT-ONLY print surface: it renders on a white
 * A4 card regardless of the app theme (light or dark), so it uses the LIGHT
 * values of the brand tokens *directly* (not the theme-flipping `var(--token)`,
 * which would darken the document under dark mode).
 *
 * D26 color mapping (mockup raw hex -> Mimarek token light value):
 *   teal         -> --primary        (185 100% 24%  = #00707A)
 *   navy         -> --primary-deep   (200 90% 12%   ; mockup #032833 is WRONG)
 *   status-green -> --success        (158 50% 32%)
 *   ink          -> --foreground     (202 45% 16%)
 *   muted        -> --muted-foreground (205 18% 40%)
 *   line         -> --border         (200 20% 88%)
 *   soft         -> --muted          (195 25% 93%)
 *
 * QR: no `qrcode` dependency is installed, and `qrBase64` here is the ZATCA
 * TLV base64 (NOT a PNG), so it is rendered as a bordered "ZATCA QR" placeholder
 * box with the raw TLV value shown in a mono caption.
 */

import { useLanguage } from "../LanguageProvider";

// ── D26 light-only token palette (HSL light values, applied directly so the
//    document never flips with the app theme). ──────────────────────────────
const C = {
  teal: "hsl(185 100% 24%)", // --primary
  navy: "hsl(200 90% 12%)", // --primary-deep
  ink: "hsl(202 45% 16%)", // --foreground
  muted: "hsl(205 18% 40%)", // --muted-foreground
  line: "hsl(200 20% 88%)", // --border
  soft: "hsl(195 25% 93%)", // --muted
  green: "hsl(158 50% 32%)", // --success
  greenBg: "hsl(158 50% 32% / 0.10)",
  greenBorder: "hsl(158 50% 32% / 0.30)",
  white: "#ffffff",
  zebra: "hsl(195 25% 93% / 0.45)", // even-row tint (mockup #fafcfc)
  thHeadEn: "hsl(185 100% 80%)", // English subtitle on the navy header (mockup #bcd3d8)
} as const;

export interface ZatcaDocumentLine {
  descAr?: string;
  descEn: string;
  qty: number;
  unitPrice: number;
  vatPercent: number;
  vatAmount: number;
  lineTotal: number;
}

export interface ZatcaDocumentProps {
  // Seller
  sellerNameAr: string;
  sellerNameEn: string;
  sellerVat: string;
  sellerCr?: string;
  sellerAddress: string;
  // Buyer
  buyerNameAr?: string;
  buyerNameEn: string;
  buyerVat?: string;
  buyerAddress?: string;
  // Document
  documentTypeLabel: { ar: string; en: string };
  invoiceNumber: string;
  uuid: string;
  icv: number | string;
  issueDateTime: string;
  supplyDate?: string;
  currency: string;
  // Lines + totals
  lines: ZatcaDocumentLine[];
  taxableTotal: number;
  vatTotal: number;
  grandTotal: number;
  // ZATCA stamp
  qrBase64?: string | null;
  status?: "CLEARED" | "REPORTED" | null;
  billingReferenceId?: string;
}

const NUM = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

/** Heuristic: is `qrBase64` an actual raster image (PNG/JPEG/GIF) we can <img>? */
function isRasterDataUri(value: string): boolean {
  // Common image magic-byte base64 prefixes: PNG "iVBOR", JPEG "/9j/", GIF "R0lGOD".
  return /^(data:image\/|iVBOR|\/9j\/|R0lGOD)/.test(value.trim());
}

export function ZatcaDocument(props: ZatcaDocumentProps) {
  const { t, lang } = useLanguage();
  const {
    sellerNameAr,
    sellerNameEn,
    sellerVat,
    sellerCr,
    sellerAddress,
    buyerNameAr,
    buyerNameEn,
    buyerVat,
    buyerAddress,
    documentTypeLabel,
    invoiceNumber,
    uuid,
    icv,
    issueDateTime,
    supplyDate,
    currency,
    lines,
    taxableTotal,
    vatTotal,
    grandTotal,
    qrBase64,
    status,
    billingReferenceId,
  } = props;

  const showStatus = status === "CLEARED" || status === "REPORTED";
  const statusLabel =
    status === "REPORTED"
      ? {
          ar: "تم الإبلاغ لهيئة الزكاة والضريبة",
          en: "Reported to ZATCA",
        }
      : { ar: "تم الاعتماد من هيئة الزكاة والضريبة", en: "Cleared by ZATCA" };

  const mono = { fontFamily: "var(--font-ibm-plex-mono, \"IBM Plex Mono\", monospace)" };
  const ltrIsolate = {
    direction: "ltr" as const,
    unicodeBidi: "isolate" as const,
    fontVariantNumeric: "tabular-nums" as const,
  };
  const monoStyle = { ...mono, ...ltrIsolate };

  return (
    <div
      dir="rtl"
      lang="ar"
      data-zatca-document
      style={{
        // A4 portrait, light-only print surface. Forced white regardless of theme.
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "14mm 13mm",
        background: C.white,
        color: C.ink,
        fontFamily: 'var(--font-tajawal, "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif)',
        fontSize: "12px",
        lineHeight: 1.5,
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* ── 1. Header (teal bottom rule) ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          borderBottom: `3px solid ${C.teal}`,
          paddingBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 800,
              letterSpacing: "1px",
              color: C.teal,
              lineHeight: 1,
            }}
          >
            MI<span style={{ color: C.navy }}>MAREK</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "8px", color: C.navy }}>
            {sellerNameAr}
          </div>
          <div style={{ fontSize: "11px", color: C.muted, direction: "ltr" }}>{sellerNameEn}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>
            {documentTypeLabel.ar}
          </div>
          <div
            style={{
              fontSize: "12px",
              letterSpacing: "2px",
              color: C.teal,
              textTransform: "uppercase",
              direction: "ltr",
            }}
          >
            {documentTypeLabel.en}
          </div>
          {showStatus && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "10px",
                background: C.greenBg,
                color: C.green,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: "999px",
                padding: "5px 11px",
                fontSize: "10.5px",
                fontWeight: 700,
              }}
            >
              <span
                style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green }}
                aria-hidden
              />
              {`${statusLabel.ar} · ${statusLabel.en}`}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Seller / Buyer cards ──────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <PartyCard
          heading={
            <>
              المورّد <EnInline>/ Seller</EnInline>
            </>
          }
          nameAr={sellerNameAr}
          nameEn={sellerNameEn}
          vat={sellerVat}
          cr={sellerCr}
          address={sellerAddress}
          monoStyle={monoStyle}
        />
        <PartyCard
          heading={
            <>
              العميل <EnInline>/ Buyer</EnInline>
            </>
          }
          nameAr={buyerNameAr}
          nameEn={buyerNameEn}
          vat={buyerVat}
          cr={undefined}
          address={buyerAddress}
          monoStyle={monoStyle}
        />
      </div>

      {/* ── 3. Meta grid (No. / UUID / ICV · dates · currency) ───────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <MetaCard>
          <MetaRow k="رقم الفاتورة · Invoice No." v={invoiceNumber} monoStyle={monoStyle} />
          <MetaRow k="المعرّف الفريد · UUID" v={uuid} monoStyle={monoStyle} />
          <MetaRow k="عدّاد الفاتورة · ICV" v={String(icv)} monoStyle={monoStyle} />
          {billingReferenceId && (
            <MetaRow
              k="مرجع الفاتورة الأصلية · Billing reference"
              v={billingReferenceId}
              monoStyle={monoStyle}
            />
          )}
        </MetaCard>
        <MetaCard>
          <MetaRow k="تاريخ الإصدار · Issue date" v={issueDateTime} monoStyle={monoStyle} />
          {supplyDate && (
            <MetaRow k="تاريخ التوريد · Supply date" v={supplyDate} monoStyle={monoStyle} />
          )}
          <div style={rowStyle}>
            <span style={kStyle}>العملة · Currency</span>
            <span style={{ fontWeight: 600, textAlign: "left" }}>{currency}</span>
          </div>
        </MetaCard>
      </div>

      {/* ── 4. Line-items table ──────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
        <thead>
          <tr>
            <Th width="26px">#</Th>
            <Th>
              البند<EnBlock>Description</EnBlock>
            </Th>
            <Th width="38px">
              الكمية<EnBlock>Qty</EnBlock>
            </Th>
            <Th width="78px">
              سعر الوحدة<EnBlock>Unit price</EnBlock>
            </Th>
            <Th width="54px">
              الضريبة<EnBlock>VAT %</EnBlock>
            </Th>
            <Th width="78px">
              مبلغ الضريبة<EnBlock>VAT amount</EnBlock>
            </Th>
            <Th width="88px">
              الإجمالي<EnBlock>Line total</EnBlock>
            </Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={`${line.descEn}-${i}`}
              style={i % 2 === 1 ? { background: C.zebra } : undefined}
            >
              <Td center>{i + 1}</Td>
              <Td>
                {line.descAr && (
                  <div style={{ fontWeight: 700, color: C.navy }}>{line.descAr}</div>
                )}
                <div style={{ direction: "ltr", fontSize: "10px", color: C.muted }}>
                  {line.descEn}
                </div>
              </Td>
              <Td center num style={ltrIsolate}>
                {line.qty}
              </Td>
              <Td left num style={ltrIsolate}>
                {NUM(line.unitPrice)}
              </Td>
              <Td center num style={ltrIsolate}>
                {line.vatPercent}%
              </Td>
              <Td left num style={ltrIsolate}>
                {NUM(line.vatAmount)}
              </Td>
              <Td left num style={ltrIsolate}>
                {NUM(line.lineTotal)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 5. Bottom: totals box + QR card ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          marginTop: "16px",
          alignItems: "flex-start",
        }}
      >
        {/* QR card */}
        <div
          style={{
            border: `1px solid ${C.line}`,
            borderRadius: "10px",
            padding: "11px",
            textAlign: "center",
            width: "170px",
          }}
        >
          {qrBase64 && isRasterDataUri(qrBase64) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt={t("رمز الاستجابة السريعة من هيئة الزكاة والضريبة", "ZATCA QR")}
              width={128}
              height={128}
              style={{ width: "128px", height: "128px" }}
            />
          ) : (
            <div
              role="img"
              aria-label={t("رمز الاستجابة السريعة من هيئة الزكاة والضريبة", "ZATCA QR")}
              style={{
                width: "128px",
                height: "128px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px dashed ${C.line}`,
                borderRadius: "8px",
                background: C.soft,
                color: C.muted,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              ZATCA QR
            </div>
          )}
          <div style={{ fontSize: "9.5px", color: C.muted, marginTop: "7px" }}>
            رمز الاستجابة السريعة (هيئة الزكاة والضريبة)
            <span style={{ display: "block", direction: "ltr" }}>ZATCA QR — scan to verify</span>
          </div>
          {qrBase64 && !isRasterDataUri(qrBase64) && (
            <div
              style={{
                ...monoStyle,
                marginTop: "6px",
                fontSize: "7px",
                color: C.muted,
                wordBreak: "break-all",
                lineHeight: 1.3,
                textAlign: "left",
              }}
            >
              {qrBase64}
            </div>
          )}
        </div>

        {/* Totals box */}
        <div
          style={{
            width: "300px",
            border: `1px solid ${C.line}`,
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div style={{ ...totalsRowStyle, background: C.soft }}>
            <span>
              الإجمالي الخاضع للضريبة <EnInline>Taxable amount</EnInline>
            </span>
            <span style={ltrIsolate}>{NUM(taxableTotal)}</span>
          </div>
          <div style={totalsRowStyle}>
            <span>
              ضريبة القيمة المضافة (15%) <EnInline>VAT (15%)</EnInline>
            </span>
            <span style={ltrIsolate}>{NUM(vatTotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              background: C.teal,
              color: C.white,
              fontWeight: 800,
              fontSize: "14px",
              padding: "12px 13px",
            }}
          >
            <span>{t("الإجمالي شامل الضريبة · Total incl. VAT", "الإجمالي شامل الضريبة · Total incl. VAT")}</span>
            <span style={ltrIsolate}>
              {NUM(grandTotal)} {lang === "ar" ? "ر.س" : currency}
            </span>
          </div>
        </div>
      </div>

      {/* ── 6. Footer ────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: "22px",
          borderTop: `1px solid ${C.line}`,
          paddingTop: "10px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          color: C.muted,
          fontSize: "9.5px",
        }}
      >
        <div>مُولّدة عبر منصة معمارك · Generated by Mimarek</div>
      </div>
    </div>
  );
}

// ── Shared inline-style fragments ───────────────────────────────────────────
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  padding: "3px 0",
};
const kStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: "10.5px",
  whiteSpace: "nowrap",
};
const totalsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  padding: "9px 13px",
  fontSize: "11.5px",
};

// ── Small presentational helpers ────────────────────────────────────────────
function EnInline({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "10px", color: C.muted, direction: "ltr", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function EnBlock({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: "10px", color: C.thHeadEn, fontWeight: 500 }}>
      {children}
    </span>
  );
}

function Th({ children, width }: { children: React.ReactNode; width?: string }) {
  return (
    <th
      style={{
        background: C.navy,
        color: C.white,
        fontSize: "10px",
        fontWeight: 700,
        padding: "9px 8px",
        textAlign: "center",
        width,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
  left,
  num,
  style,
}: {
  children: React.ReactNode;
  center?: boolean;
  left?: boolean;
  num?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        borderBottom: `1px solid ${C.line}`,
        padding: "9px 8px",
        verticalAlign: "top",
        textAlign: center ? "center" : left ? "left" : undefined,
        ...(num ? { fontVariantNumeric: "tabular-nums" } : null),
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function PartyCard({
  heading,
  nameAr,
  nameEn,
  vat,
  cr,
  address,
  monoStyle,
}: {
  heading: React.ReactNode;
  nameAr?: string;
  nameEn: string;
  vat?: string;
  cr?: string;
  address?: string;
  monoStyle: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderRadius: "10px",
        padding: "12px 13px",
        background: C.white,
      }}
    >
      <h3
        style={{
          margin: "0 0 9px",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.5px",
          color: C.teal,
          textTransform: "uppercase",
        }}
      >
        {heading}
      </h3>
      {nameAr && <div style={{ fontSize: "13.5px", fontWeight: 800, color: C.navy }}>{nameAr}</div>}
      <div style={{ direction: "ltr", fontSize: "10px", color: C.muted }}>{nameEn}</div>
      {vat && (
        <div style={rowStyle}>
          <span style={kStyle}>الرقم الضريبي · VAT No.</span>
          <span style={{ ...monoStyle, fontWeight: 600, textAlign: "left" }}>{vat}</span>
        </div>
      )}
      {cr && (
        <div style={rowStyle}>
          <span style={kStyle}>السجل التجاري · CR</span>
          <span style={{ ...monoStyle, fontWeight: 600, textAlign: "left" }}>{cr}</span>
        </div>
      )}
      {address && (
        <div style={{ color: C.muted, marginTop: "4px", fontSize: "10.5px" }}>{address}</div>
      )}
    </div>
  );
}

function MetaCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderRadius: "10px",
        padding: "12px 13px",
        background: C.soft,
      }}
    >
      {children}
    </div>
  );
}

function MetaRow({
  k,
  v,
  monoStyle,
}: {
  k: string;
  v: string;
  monoStyle: React.CSSProperties;
}) {
  return (
    <div style={rowStyle}>
      <span style={kStyle}>{k}</span>
      <span style={{ ...monoStyle, fontWeight: 600, textAlign: "left" }}>{v}</span>
    </div>
  );
}

export default ZatcaDocument;
