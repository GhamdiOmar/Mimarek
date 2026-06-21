# Generates a sample ZATCA Phase-2 tax-invoice HTML (bilingual, RTL) with a real QR
# from a dummy payload. Dummy data — for layout preview only.
import io, base64, qrcode

# A dummy ZATCA-style QR payload (real TLV is base64; this is just a placeholder string
# so the QR scans to something, not a valid ZATCA stamp).
qr_payload = (
    "AQ5EdXJyYXQgQWwgUml5YWRoAg8zMTIzNDU2Nzg5MDAwMDMD"
    "FDIwMjYtMDYtMjBUMTM6NDU6MDArMDM6MDAECDU0MzM3LjUwBQc3MDg3LjUw"
)
qr = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
qr.add_data(qr_payload)
qr.make(fit=True)
img = qr.make_image(fill_color="#032833", back_color="white")
buf = io.BytesIO()
img.save(buf, format="PNG")
qr_datauri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

HTML = r"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Tax Invoice — فاتورة ضريبية</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root{
    --teal:#00707A; --navy:#032833; --ink:#16252b; --muted:#6b7c83;
    --line:#e4ebed; --soft:#f4f8f9; --green:#1f8a5b; --greenbg:#e8f6ef;
  }
  html,body{margin:0;padding:0;}
  body{
    font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;
    color:var(--ink); background:#fff; font-size:12px; line-height:1.5;
  }
  .page{ width:210mm; min-height:297mm; padding:14mm 13mm; margin:0 auto; }
  .en{ font-size:10px; color:var(--muted); direction:ltr; }
  .num{ direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; }
  .mono{ font-family:"IBM Plex Mono","Consolas",monospace; direction:ltr; unicode-bidi:isolate; }

  /* Header */
  .head{ display:flex; justify-content:space-between; align-items:flex-start;
         border-bottom:3px solid var(--teal); padding-bottom:14px; }
  .brand .mark{ font-size:26px; font-weight:800; letter-spacing:1px; color:var(--teal); line-height:1; }
  .brand .mark .navy{ color:var(--navy); }
  .brand .seller-ar{ font-size:15px; font-weight:700; margin-top:8px; color:var(--navy); }
  .brand .seller-en{ font-size:11px; color:var(--muted); direction:ltr; }
  .titlebox{ text-align:left; }
  .titlebox .t-ar{ font-size:22px; font-weight:800; color:var(--navy); line-height:1.1; }
  .titlebox .t-en{ font-size:12px; letter-spacing:2px; color:var(--teal); text-transform:uppercase; direction:ltr; }
  .badge{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; background:var(--greenbg);
          color:var(--green); border:1px solid #bfe6d2; border-radius:999px; padding:5px 11px;
          font-size:10.5px; font-weight:700; }
  .badge .dot{ width:8px;height:8px;border-radius:50%;background:var(--green); }

  /* Parties + meta grid */
  .grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
  .card{ border:1px solid var(--line); border-radius:10px; padding:12px 13px; background:#fff; }
  .card.meta{ background:var(--soft); }
  .card h3{ margin:0 0 9px; font-size:10px; font-weight:800; letter-spacing:.5px; color:var(--teal);
            text-transform:uppercase; }
  .card h3 .en{ font-weight:600; }
  .row{ display:flex; justify-content:space-between; gap:10px; padding:3px 0; }
  .row .k{ color:var(--muted); font-size:10.5px; white-space:nowrap; }
  .row .v{ font-weight:600; text-align:left; }
  .party .name-ar{ font-size:13.5px; font-weight:800; color:var(--navy); }
  .party .name-en{ direction:ltr; }
  .party .addr{ color:var(--muted); margin-top:4px; font-size:10.5px; }

  /* Items table */
  table{ width:100%; border-collapse:collapse; margin-top:16px; }
  thead th{ background:var(--navy); color:#fff; font-size:10px; font-weight:700; padding:9px 8px;
            text-align:center; }
  thead th .en{ color:#bcd3d8; font-weight:500; display:block; }
  tbody td{ border-bottom:1px solid var(--line); padding:9px 8px; vertical-align:top; }
  tbody tr:nth-child(even){ background:#fafcfc; }
  td.desc .d-ar{ font-weight:700; color:var(--navy); }
  td.desc .d-en{ direction:ltr; }
  td.c{ text-align:center; } td.l{ text-align:left; }

  /* Totals + QR */
  .bottom{ display:flex; justify-content:space-between; gap:16px; margin-top:16px; align-items:flex-start; }
  .qr{ border:1px solid var(--line); border-radius:10px; padding:11px; text-align:center; width:170px; }
  .qr img{ width:128px; height:128px; }
  .qr .cap{ font-size:9.5px; color:var(--muted); margin-top:7px; }
  .qr .cap .en{ display:block; }
  .totals{ width:300px; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .totals .tr{ display:flex; justify-content:space-between; padding:9px 13px; font-size:11.5px; }
  .totals .tr:nth-child(odd){ background:var(--soft); }
  .totals .grand{ background:var(--teal); color:#fff; font-weight:800; font-size:14px; padding:12px 13px; }
  .totals .k .en{ display:block; }

  .foot{ margin-top:22px; border-top:1px solid var(--line); padding-top:10px;
         display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:9.5px; }
  .stamp{ position:relative; }
  .sample{ position:fixed; top:46%; left:0; right:0; text-align:center; transform:rotate(-24deg);
           font-size:74px; font-weight:800; color:rgba(0,112,122,.06); letter-spacing:8px; z-index:0; }
  .page > *{ position:relative; z-index:1; }
</style>
</head>
<body>
<div class="page">
  <div class="sample">SAMPLE · نموذج</div>

  <!-- Header -->
  <div class="head">
    <div class="brand">
      <div class="mark">MI<span class="navy">MAREK</span></div>
      <div class="seller-ar">شركة درّة الرياض العقارية</div>
      <div class="seller-en">Durrat Al Riyadh Real Estate Co.</div>
    </div>
    <div class="titlebox">
      <div class="t-ar">فاتورة ضريبية</div>
      <div class="t-en">Tax Invoice</div>
      <div class="badge"><span class="dot"></span> تم الاعتماد من هيئة الزكاة والضريبة · Cleared by ZATCA</div>
    </div>
  </div>

  <!-- Seller / Buyer -->
  <div class="grid">
    <div class="card party">
      <h3>المورّد <span class="en">/ Seller</span></h3>
      <div class="name-ar">شركة درّة الرياض العقارية</div>
      <div class="name-en en">Durrat Al Riyadh Real Estate Co.</div>
      <div class="row"><span class="k">الرقم الضريبي · VAT No.</span><span class="v mono">312345678900003</span></div>
      <div class="row"><span class="k">السجل التجاري · CR</span><span class="v mono">1010234567</span></div>
      <div class="addr">حي العليا، شارع العليا، مبنى 2847، الرياض 12244 — رقم إضافي 3315<br>
        <span class="en">Al Olaya Dist., Olaya St., Bldg 2847, Riyadh 12244 — Add'l 3315</span></div>
    </div>
    <div class="card party">
      <h3>العميل <span class="en">/ Buyer</span></h3>
      <div class="name-ar">مؤسسة نجد التجارية</div>
      <div class="name-en en">Najd Trading Est.</div>
      <div class="row"><span class="k">الرقم الضريبي · VAT No.</span><span class="v mono">310987654300003</span></div>
      <div class="row"><span class="k">السجل التجاري · CR</span><span class="v mono">1010876543</span></div>
      <div class="addr">حي المغرزات، طريق الملك فهد، مبنى 1190، الرياض 11564<br>
        <span class="en">Al Mughrizat Dist., King Fahd Rd, Bldg 1190, Riyadh 11564</span></div>
    </div>
  </div>

  <!-- Invoice meta -->
  <div class="grid" style="margin-top:12px;">
    <div class="card meta">
      <div class="row"><span class="k">رقم الفاتورة · Invoice No.</span><span class="v mono">INV-RYD01-2026-00042</span></div>
      <div class="row"><span class="k">المعرّف الفريد · UUID</span><span class="v mono">3cf5a2e1-9b7d-4f6a-bc18-2e9d4a7f1c03</span></div>
      <div class="row"><span class="k">عدّاد الفاتورة · ICV</span><span class="v mono">42</span></div>
    </div>
    <div class="card meta">
      <div class="row"><span class="k">تاريخ الإصدار · Issue date</span><span class="v mono">2026-06-20 13:45 (+03:00)</span></div>
      <div class="row"><span class="k">تاريخ التوريد · Supply date</span><span class="v mono">2026-06-01</span></div>
      <div class="row"><span class="k">العملة · Currency</span><span class="v">SAR · ر.س</span></div>
    </div>
  </div>

  <!-- Line items -->
  <table>
    <thead>
      <tr>
        <th style="width:26px;">#</th>
        <th>البند<span class="en">Description</span></th>
        <th style="width:38px;">الكمية<span class="en">Qty</span></th>
        <th style="width:78px;">سعر الوحدة<span class="en">Unit price</span></th>
        <th style="width:54px;">الضريبة<span class="en">VAT %</span></th>
        <th style="width:78px;">مبلغ الضريبة<span class="en">VAT amount</span></th>
        <th style="width:88px;">الإجمالي<span class="en">Line total</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="c">1</td>
        <td class="desc">
          <div class="d-ar">إيجار وحدة تجارية — مكتب رقم 12B، الربع الثالث 2026</div>
          <div class="d-en en">Commercial unit lease — Office 12B, Q3 2026</div>
        </td>
        <td class="c num">1</td>
        <td class="l num">45,000.00</td>
        <td class="c num">15%</td>
        <td class="l num">6,750.00</td>
        <td class="l num">51,750.00</td>
      </tr>
      <tr>
        <td class="c">2</td>
        <td class="desc">
          <div class="d-ar">رسوم إدارة العقار</div>
          <div class="d-en en">Property management fee</div>
        </td>
        <td class="c num">1</td>
        <td class="l num">2,250.00</td>
        <td class="c num">15%</td>
        <td class="l num">337.50</td>
        <td class="l num">2,587.50</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals + QR -->
  <div class="bottom">
    <div class="qr">
      <img src="__QR__" alt="ZATCA QR">
      <div class="cap">رمز الاستجابة السريعة (هيئة الزكاة والضريبة)
        <span class="en">ZATCA QR — scan to verify</span></div>
    </div>
    <div class="totals">
      <div class="tr"><span class="k">الإجمالي الخاضع للضريبة <span class="en">Taxable amount</span></span><span class="num">47,250.00</span></div>
      <div class="tr"><span class="k">ضريبة القيمة المضافة (15%) <span class="en">VAT (15%)</span></span><span class="num">7,087.50</span></div>
      <div class="grand"><span>الإجمالي شامل الضريبة · Total incl. VAT</span><span class="num">54,337.50 ر.س</span></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="foot">
    <div>هذه فاتورة نموذجية ببيانات وهمية لغرض عرض التصميم فقط — ليست فاتورة ضريبية صحيحة.<br>
      <span class="en">Sample invoice with dummy data — for layout preview only. Not a valid tax invoice.</span></div>
    <div class="stamp">مُولّدة عبر منصة معمارك · Generated by Mimarek</div>
  </div>
</div>
</body>
</html>
"""

HTML = HTML.replace("__QR__", qr_datauri)
with open("invoice.html", "w", encoding="utf-8") as f:
    f.write(HTML)
print("invoice.html written (" + str(len(HTML)) + " bytes)")
