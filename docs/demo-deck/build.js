#!/usr/bin/env node
// Generates mimaric-demo-ar.pptx — Arabic customer demo deck (7 slides)
// Run: node docs/demo-deck/build.js

const pptxgen = require('pptxgenjs');
const path = require('path');

const prs = new pptxgen();
prs.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"
prs.title = 'ميماريك — عرض تعريفي';
prs.author = 'Mimaric PropTech';

// ─── Constants ────────────────────────────────────────────────────────
const C = {
  navy:       '182840',
  purple:     '7339AC',
  purpleL:    '9E69D3',
  purpleDeep: '1A0D2E',
  green:      '297D54',
  gold:       'C4912A',
  offWhite:   'F5F5F7',
  white:      'FFFFFF',
  red:        'D93025',
  muted:      '8888AA',
  textNavy:   '1E2D45',
};

const SHOTS = path.join(__dirname, 'screenshots');
const BRAND = path.join(__dirname, '../../apps/web/public/assets/brand');
const LOGO_DARK  = path.join(BRAND, 'Mimaric_Official_Logo.png');
const LOGO_LIGHT = path.join(BRAND, 'Mimaric_Official_Logo_transparent.png');

const FONT = 'Arial';

// ─── Helpers ──────────────────────────────────────────────────────────
function txt(slide, text, opts) {
  slide.addText(text, { fontFace: FONT, rtlMode: true, ...opts });
}

function phoneFrame(slide, imgPath, x, y, w, h) {
  // Phone body
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: '111122' },
    line: { color: '334466', width: 3 },
    rectRadius: 0.35,
    shadow: { type: 'outer', blur: 12, offset: 4, angle: 45, color: '000000', opacity: 0.4 },
  });
  // Notch bar (top of phone)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x + w / 2 - 0.4, y: y + 0.1, w: 0.8, h: 0.12,
    fill: { color: '334466' },
    line: { color: '334466', width: 0 },
    rectRadius: 0.06,
  });
  // Screenshot inside
  const pad = 0.12;
  const topPad = 0.28;
  slide.addImage({
    path: imgPath,
    x: x + pad,
    y: y + topPad,
    w: w - pad * 2,
    h: h - topPad - pad,
    sizing: { type: 'contain', w: w - pad * 2, h: h - topPad - pad },
  });
}

function accentBar(slide, color) {
  // Left-edge accent bar
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.07, h: 7.5,
    fill: { color },
    line: { color, width: 0 },
  });
}

function stepRow(slide, num, arabic, x, y, w) {
  // Number badge
  slide.addShape(prs.ShapeType.ellipse, {
    x: x + w - 0.42, y: y + 0.03, w: 0.36, h: 0.36,
    fill: { color: C.purple },
    line: { color: C.purple, width: 0 },
  });
  slide.addText(num, {
    x: x + w - 0.42, y: y + 0.03, w: 0.36, h: 0.36,
    fontSize: 12, bold: true, color: C.white,
    align: 'center', valign: 'middle',
    fontFace: FONT,
  });
  // Step text
  txt(slide, arabic, {
    x, y, w: w - 0.52, h: 0.42,
    fontSize: 15, color: C.textNavy,
    align: 'right', valign: 'middle',
  });
}

// ─── Slide 0: مقدمة — INTRO (Dark hero) ──────────────────────────────
console.log('Building slide 0: intro…');
{
  const s = prs.addSlide();
  s.background = { color: C.navy };

  // Logo centred
  s.addImage({ path: LOGO_DARK, x: 3.92, y: 0.3, w: 5.5, h: 2.68 });

  // Headline
  txt(s, 'منصة ميماريك للعقارات', {
    x: 0.5, y: 3.2, w: 12.33, h: 0.9,
    fontSize: 40, bold: true, color: C.white,
    align: 'center',
  });

  // Subhead
  txt(s, 'إدارة عقارية ذكية — من البيع إلى الصيانة', {
    x: 0.5, y: 4.15, w: 12.33, h: 0.55,
    fontSize: 22, color: C.purpleL,
    align: 'center',
  });

  // USP pills
  const usps = ['متوافق مع رؤية 2030', 'عربي أولاً', 'تحكّم كامل من الهاتف'];
  const pillW = 3.0, pillH = 0.42, gap = 0.28;
  const totalW = pillW * 3 + gap * 2;
  const startX = (13.33 - totalW) / 2;
  usps.forEach((label, i) => {
    const px = startX + i * (pillW + gap);
    s.addShape(prs.ShapeType.roundRect, {
      x: px, y: 4.88, w: pillW, h: pillH,
      fill: { color: C.purple },
      line: { color: C.purple, width: 0 },
      rectRadius: 0.21,
    });
    txt(s, label, {
      x: px, y: 4.88, w: pillW, h: pillH,
      fontSize: 13, bold: true, color: C.white,
      align: 'center', valign: 'middle',
    });
  });

  // Who it's for
  txt(s, 'للمطورين العقاريين  ·  شركات التأجير  ·  مديري المشاريع', {
    x: 0.5, y: 5.52, w: 12.33, h: 0.4,
    fontSize: 14, color: C.muted,
    align: 'center',
  });

  // Tagline bottom
  txt(s, 'SAUDI PROPTECH  •  AUTOMATION & MANAGEMENT', {
    x: 0.5, y: 6.9, w: 12.33, h: 0.3,
    fontSize: 9, color: '444466',
    align: 'center', rtlMode: false,
  });
}

// ─── Slide 1: التحدي — PAIN (Light) ──────────────────────────────────
console.log('Building slide 1: pain…');
{
  const s = prs.addSlide();
  s.background = { color: C.offWhite };
  accentBar(s, C.red);

  txt(s, 'قبل ميماريك…', {
    x: 0.5, y: 0.5, w: 12.33, h: 0.85,
    fontSize: 38, bold: true, color: C.navy,
    align: 'right',
  });

  const pains = [
    'ملفات Excel متشعبة لا يمكن تتبّعها',
    'عقود ورقية تضيع وتتأخر',
    'المستأجرون يدفعون يدوياً بلا سجل',
    'لا تقارير، لا رؤية، لا تحكّم',
  ];

  pains.forEach((p, i) => {
    const y = 1.6 + i * 1.1;
    // red dot
    s.addShape(prs.ShapeType.ellipse, {
      x: 12.0, y: y + 0.12, w: 0.28, h: 0.28,
      fill: { color: C.red },
      line: { color: C.red, width: 0 },
    });
    // Pain text
    txt(s, p, {
      x: 0.6, y, w: 11.2, h: 0.55,
      fontSize: 22, color: C.textNavy,
      align: 'right',
    });
    // Separator line (except last)
    if (i < pains.length - 1) {
      s.addShape(prs.ShapeType.line, {
        x: 0.6, y: y + 0.65, w: 11.5, h: 0,
        line: { color: 'DDDDEE', width: 1 },
      });
    }
  });

  // Bottom CTA strip
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 6.6, w: 13.33, h: 0.9,
    fill: { color: C.purple },
    line: { color: C.purple, width: 0 },
  });
  txt(s, 'ميماريك تحل كل هذا — من شاشة واحدة', {
    x: 0, y: 6.6, w: 13.33, h: 0.9,
    fontSize: 20, bold: true, color: C.white,
    align: 'center', valign: 'middle',
  });
}

// ─── Slides 2–4: Task demos ────────────────────────────────────────────
const demos = [
  {
    title: 'كيف تضيف عقاراً',
    img: path.join(SHOTS, 'shot-units-list.png'),
    steps: [
      'افتح قسم الوحدات من القائمة السفلية',
      'اضغط على زر "+" لإضافة وحدة جديدة',
      'أدخل تفاصيل العقار والموقع والسعر',
      'احفظ — الوحدة تظهر في القائمة فوراً',
    ],
    color: C.purple,
  },
  {
    title: 'كيف تضيف عميلاً',
    img: path.join(SHOTS, 'shot-crm-list.png'),
    steps: [
      'افتح قسم العملاء من القائمة السفلية',
      'اضغط على زر "+" لإضافة عميل جديد',
      'أدخل الاسم ورقم الهوية الوطنية والهاتف',
      'احفظ — العميل محفوظ وجاهز للتواصل',
    ],
    color: C.green,
  },
  {
    title: 'كيف تحصّل دفعة',
    img: path.join(SHOTS, 'shot-payments.png'),
    steps: [
      'افتح قسم المالية من القائمة السفلية',
      'اختر العقد أو الوحدة المستحقة',
      'سجّل الدفعة والمبلغ وطريقة الدفع',
      'تم — سجل مالي تلقائي، لا ورق',
    ],
    color: C.gold,
  },
];

demos.forEach((demo, i) => {
  console.log(`Building slide ${i + 2}: ${demo.title}…`);
  const s = prs.addSlide();
  s.background = { color: C.white };
  accentBar(s, demo.color);

  // Slide title
  txt(s, demo.title, {
    x: 4.2, y: 0.35, w: 8.7, h: 0.7,
    fontSize: 30, bold: true, color: C.purple,
    align: 'right',
  });

  // Phone frame on left
  phoneFrame(s, demo.img, 0.4, 0.95, 3.4, 6.1);

  // Step rows on right
  demo.steps.forEach((step, j) => {
    stepRow(s, String(j + 1), step, 4.2, 1.5 + j * 1.18, 8.7);
    if (j < demo.steps.length - 1) {
      s.addShape(prs.ShapeType.line, {
        x: 4.3, y: 1.5 + j * 1.18 + 0.52, w: 8.5, h: 0,
        line: { color: 'E8E8F0', width: 1 },
      });
    }
  });

  // Accent tagline bottom right
  txt(s, 'جرّبه بنفسك في دقيقتين', {
    x: 4.2, y: 6.4, w: 8.7, h: 0.4,
    fontSize: 13, color: demo.color, italic: true,
    align: 'right',
  });
});

// ─── Slide 5: الأرقام — STATS (Dark) ─────────────────────────────────
console.log('Building slide 5: stats…');
{
  const s = prs.addSlide();
  s.background = { color: C.purpleDeep };

  txt(s, 'الأرقام تتحدث', {
    x: 0.5, y: 0.4, w: 12.33, h: 0.7,
    fontSize: 32, bold: true, color: C.white,
    align: 'center',
  });

  const stats = [
    { val: '٣٠٪',  label: 'توفير في وقت الإدارة',   color: C.purpleL },
    { val: '١٠٠٪', label: 'متوافق مع إيجار وزاتكا',  color: C.green },
    { val: '٢٤/٧', label: 'وصول من أي جهاز',          color: C.gold },
  ];

  const boxW = 3.6, boxH = 3.2, gap = 0.5;
  const totalW = boxW * 3 + gap * 2;
  const startX = (13.33 - totalW) / 2;

  stats.forEach((stat, i) => {
    const bx = startX + i * (boxW + gap);
    const by = 1.4;

    // Box background
    s.addShape(prs.ShapeType.roundRect, {
      x: bx, y: by, w: boxW, h: boxH,
      fill: { color: '2D1A4A' },
      line: { color: stat.color, width: 2 },
      rectRadius: 0.2,
    });

    // Big stat value
    txt(s, stat.val, {
      x: bx, y: by + 0.4, w: boxW, h: 1.4,
      fontSize: 56, bold: true, color: stat.color,
      align: 'center', valign: 'middle',
    });

    // Label
    txt(s, stat.label, {
      x: bx + 0.1, y: by + 2.0, w: boxW - 0.2, h: 0.9,
      fontSize: 16, color: C.white,
      align: 'center', valign: 'middle',
    });
  });

  // Bottom quote
  txt(s, '"نظام واحد يجمع كل عمليات العقار"', {
    x: 0.5, y: 5.0, w: 12.33, h: 0.6,
    fontSize: 18, italic: true, color: C.gold,
    align: 'center',
  });

  // Logo small bottom right
  s.addImage({ path: LOGO_DARK, x: 10.5, y: 6.5, w: 2.5, h: 1.22 });
}

// ─── Slide 6: ابدأ اليوم — CTA ────────────────────────────────────────
console.log('Building slide 6: CTA…');
{
  const s = prs.addSlide();
  s.background = { color: C.purple };

  // Large headline
  txt(s, 'جاهز تبدأ؟', {
    x: 0.5, y: 1.3, w: 12.33, h: 1.2,
    fontSize: 52, bold: true, color: C.white,
    align: 'center',
  });

  // Subhead
  txt(s, 'تواصل معنا وسنرتّب لك عرضاً تجريبياً مجانياً', {
    x: 0.5, y: 2.7, w: 12.33, h: 0.65,
    fontSize: 22, color: 'D4B8FF',
    align: 'center',
  });

  // CTA box
  s.addShape(prs.ShapeType.roundRect, {
    x: 4.67, y: 3.6, w: 4.0, h: 0.8,
    fill: { color: C.white },
    line: { color: C.white, width: 0 },
    rectRadius: 0.4,
  });
  txt(s, 'mimaric.sa', {
    x: 4.67, y: 3.6, w: 4.0, h: 0.8,
    fontSize: 22, bold: true, color: C.navy,
    align: 'center', valign: 'middle',
    rtlMode: false,
  });

  // Logo
  s.addImage({ path: LOGO_DARK, x: 4.17, y: 4.8, w: 5, h: 2.44 });
}

// ─── Save ─────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'mimaric-demo-ar.pptx');
prs.writeFile({ fileName: outPath }).then(() => {
  console.log(`\n✓ Saved: ${outPath}`);
}).catch(err => {
  console.error('Error saving PPTX:', err);
  process.exit(1);
});
