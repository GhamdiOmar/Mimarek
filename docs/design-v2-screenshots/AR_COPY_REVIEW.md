# Arabic Copy Review — `feat/audit-2026-04-mega`

## Summary

Reviewed **261 new Arabic UI strings** introduced across 21 files on branch `feat/audit-2026-04-mega` (dashboards for Finance, Leasing, Maintenance, Tickets, CommandPalette, DataTable, Saudi primitives, etc.). Overall quality is high — most labels are short, native-sounding MSA with a professional Saudi tone. **9 strings flagged** across four categories (Grammar, Tone/Naturalness, Consistency, Missing-AR). No grammatical disasters; the issues are mostly word-choice mismatches, one literal translation that doesn't sound Saudi, and one "pipeline" term that leaked in twice with two different Arabic renderings on the same screen. The rest passed review and are production-ready.

---

## FLAGGED — Grammar

### 1. `apps/web/app/dashboard/finance/page.tsx:126`
- **EN pair:** `"Collections and AR aging"`
- **AR:** `"التحصيل والأعمار الحسابية"`
- **Issue:** `الأعمار الحسابية` (literally "accounting ages") is not the established Saudi accounting term for AR aging. A Saudi accountant says `أعمار الذمم المدينة` or `أعمار المستحقات` — not `الأعمار الحسابية`. It reads as a literal translation. Note the same page uses the correct term `أعمار المستحقات` on line 228 for the chart title, so this is also a self-inconsistency.
- **Suggested replacement:** `"التحصيل وأعمار المستحقات"`

### 2. `apps/web/app/dashboard/finance/page.tsx:85`
- **EN pair:** `b.bucket + " d"` (e.g. "0-30 d", "31-60 d", "90+ d")
- **AR:** `b.bucket.replace("-", "–") + " يوم"` → renders `"0–30 يوم"`, `"31–60 يوم"`, `"90+ يوم"`
- **Issue:** Number-noun agreement. In Arabic, numbers 3–10 take the plural (`أيام`), not the singular (`يوم`). Every bucket here is a range ≥ 3 days, so it must be `أيام`. Current output reads broken to a Saudi speaker.
- **Suggested replacement:** `b.bucket.replace("-", "–") + " يومًا"` for ranges ending in 11+ (grammatically "tamyiz" accusative singular — works for all the bucket ranges on this page: 0–30, 31–60, 61–90, 90+), OR simply `" أيام"`. The cleanest Saudi-professional form is `" يومًا"`.

---

## FLAGGED — Tone / Naturalness

### 3. `apps/web/app/dashboard/leasing/page.tsx:261`
- **EN pair:** `"Pipeline Value"`
- **AR:** `"قيمة خط الأنابيب"`
- **Issue:** `خط الأنابيب` is a literal translation of "pipeline" and means a physical oil/water pipe. Sales pipeline in Saudi business Arabic is `مسار الصفقات` / `قائمة الفرص` / `خط المبيعات`. Reads as machine translation. Worse: four lines earlier (line 201) the same page correctly translates "Pipeline Funnel" as `"مسار التحويل"` — so the screen uses two different Arabic terms for "pipeline" side-by-side.
- **Suggested replacement:** `"قيمة المسار"` (matches the adjacent `مسار التحويل`) or more explicit `"قيمة الصفقات المحتملة"`.

### 4. `apps/web/app/dashboard/maintenance/page.tsx:127`
- **EN pair:** `"Tickets, resolution time, and SLA health"`
- **AR:** `"طلبات، زمن الحل، والتزامات اتفاقية الخدمة"`
- **Issue:** Two problems. (a) `زمن الحل` is awkward — Saudi FM/maintenance industry uses `وقت المعالجة` or `مدة الإنجاز`. `زمن` is literary/cosmic-scale time, not a business KPI. (b) `التزامات اتفاقية الخدمة` is a cumbersome literal rendering of SLA; in Saudi operations the loan-term `اتفاقية مستوى الخدمة (SLA)` is standard, and the KPI itself is usually just `مستوى الخدمة`.
- **Suggested replacement:** `"الطلبات، وقت المعالجة، ومستوى الخدمة"`

### 5. `apps/web/app/dashboard/maintenance/page.tsx:187`
- **EN pair:** KPI label `"SLA Breached"`
- **AR:** `"تخطّت الموعد"`
- **Issue:** `تخطّت` (feminine past verb with no clear subject) reads as a sentence fragment, not a KPI label. KPI labels should be noun phrases (per CLAUDE.md §6.8.4). Also loses the SLA semantics entirely — SLA is not just "a deadline."
- **Suggested replacement:** `"تجاوز مستوى الخدمة"` or the shorter `"طلبات متأخرة"` (noun phrase, matches the ticket-page KPI `"متأخرة"` on line 170 → consistency win).

---

## FLAGGED — Consistency

### 6. "Maintenance ticket/request" — two different Arabic words used interchangeably
- **Files:** `apps/web/components/CommandPalette.tsx:97` uses `"تذكرة صيانة"` for "New ticket", while every other surface in the branch (nav `nav-items.ts:227`, maintenance dashboard `maintenance/page.tsx:84`, tickets page `tickets/page.tsx:143, 160, 177` etc.) uses `"طلب"` / `"طلبات الصيانة"` / `"طلب جديد"`.
- **Issue:** Same concept, two translations. `تذكرة` is a loanword-style rendering ("ticket") that Saudi users will find colder than `طلب` ("request"). Pick one. The rest of the app has chosen `طلب`.
- **Suggested replacement (CommandPalette.tsx:97):** `{ ar: "طلب صيانة جديد", en: "New ticket" }`

### 7. "Pipeline" rendered two ways on the same screen
- **File:** `apps/web/app/dashboard/leasing/page.tsx`
  - Line 201: `"مسار التحويل"` ✓
  - Line 261: `"قيمة خط الأنابيب"` ✗ (see item #3)
- **Issue:** Pick one term per screen. Addressed by fixing item #3.

### 8. "Dashboard/Overview" page-title pattern
- **Files:** `leasing/page.tsx:111` → `"لوحة التأجير"`; `maintenance/page.tsx:123` → `"لوحة الصيانة"`; but `finance/page.tsx:122` → `"المالية"` (no `لوحة` prefix); `admin/page.tsx` → `"إدارة المنصة"` (no `لوحة` prefix); `CommandPalette` groups follow no rule.
- **Issue:** Partial inconsistency. Leasing and Maintenance use `لوحة X` to mean "X dashboard"; Finance and Admin don't. Pick one pattern and apply it, or drop `لوحة` from all four (Saudi users understand the page IS a dashboard from context).
- **Suggested replacement:** Either (a) rename Finance header to `"لوحة المالية"` to match Leasing/Maintenance, or (b) drop `لوحة` from Leasing (`"التأجير"`) and Maintenance (`"الصيانة"` — already the ticket-page title on line 613). Option (b) is cleaner and matches the shorter English titles.

---

## FLAGGED — Missing AR

### 9. `apps/web/app/dashboard/finance/page.tsx:180`
- **Context:** KPI card for "Collected MTD" with a sub-value rendered as:
  ```
  lang === "ar" ? `من ${fmt(stats?.expectedMTD ?? 0)}` : `of ${fmt(...)}`
  ```
- **Issue:** Technically present in AR (`من`), but the bare `"من X"` without a unit reads as ambiguous — Arabic `من` means "of/from" and the user sees a naked number. The English version is equally terse, but the Arabic needs a currency hint because Saudis expect `ر.س` after finance numbers. Not strictly "missing AR" — more "incomplete AR." Flagging so a reviewer decides whether to append `ر.س` or rely on the `KPICard` unit prop.
- **Suggested replacement:** `` `من ${fmt(stats?.expectedMTD ?? 0)} ر.س` `` — or confirm the enclosing KPICard already appends the unit (in which case this is fine; worth a visual check).

---

## OK

The remaining **~252 Arabic strings** (nav labels, status enums for `ACTIVE/PENDING/CONFIRMED/SIGNED/CANCELLED/EXPIRED/OPEN/ASSIGNED/IN_PROGRESS/ON_HOLD/RESOLVED/CLOSED`, maintenance categories `HVAC/PLUMBING/ELECTRICAL/STRUCTURAL/FIRE_SAFETY/ELEVATOR/CLEANING/LANDSCAPING/PEST_CONTROL`, priority levels `LOW/MEDIUM/HIGH/URGENT`, DataTable chrome `بحث/الأعمدة/الكثافة/تصفية/مسح/السابق/التالي`, DateRangePicker presets `اليوم/الأسبوع/الشهر/الشهر الماضي/الربع/منذ بداية السنة/مخصص`, AddressPicker `المنطقة/المدينة/الحي`, HijriDatePicker `ميلادي/هجري/مسح`, Saudi primitives, aria-labels `إغلاق/حذف/تعديل/عرض/إزالة/السابق/التالي`, form validation `العنوان مطلوب / الوصف مطلوب / التصنيف مطلوب / الأولوية مطلوبة / الوحدة مطلوبة`, empty states, and retry labels) are grammatically correct, concise, tonally appropriate for a Saudi PropTech product, and internally consistent. No tashkeel leaked into labels. No hedging words (`قد`, `ربما`) appear anywhere. Ship it after fixing items 1–9.
