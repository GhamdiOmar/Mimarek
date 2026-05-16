export type FAQCategory =
  | "getting_started"
  | "sales_crm"
  | "property_management"
  | "finance"
  | "security_privacy"
  | "technical";

export type FAQItem = {
  id: string;
  question: { ar: string; en: string };
  answer: { ar: string; en: string };
  category: FAQCategory;
};

export type GuideItem = {
  id: string;
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  steps: { ar: string; en: string }[];
  module: string;
};

export const FAQ_CATEGORIES: { key: FAQCategory; label: { ar: string; en: string } }[] = [
  { key: "getting_started", label: { ar: "البدء", en: "Getting Started" } },
  { key: "sales_crm", label: { ar: "المبيعات والعملاء", en: "Sales & CRM" } },
  { key: "property_management", label: { ar: "إدارة العقارات", en: "Property Management" } },
  { key: "finance", label: { ar: "المالية", en: "Finance" } },
  { key: "security_privacy", label: { ar: "الأمان والخصوصية", en: "Security & Privacy" } },
  { key: "technical", label: { ar: "الدعم الفني", en: "Technical" } },
];

export const FAQ_ITEMS: FAQItem[] = [
  // Getting Started
  {
    id: "gs-1",
    question: { ar: "كيف أبدأ استخدام ميماريك؟", en: "How do I get started with Mimaric?" },
    answer: { ar: "بعد تسجيل الدخول، ستصل إلى لوحة التحكم الرئيسية. يمكنك البدء بإضافة عملاء من قسم CRM، ثم إضافة العقارات والوحدات من قسم العقارات، وإنشاء الصفقات والعقود.", en: "After logging in, you'll reach the main dashboard. Start by adding customers from the CRM section, then add properties and units from the Properties section, and create deals and contracts." },
    category: "getting_started",
  },
  {
    id: "gs-2",
    question: { ar: "ما هي الأدوار المتاحة في النظام؟", en: "What roles are available in the system?" },
    answer: { ar: "يوفر ميماريك 7 أدوار: مدير المنصة (SYSTEM_ADMIN)، دعم المنصة (SYSTEM_SUPPORT)، مدير (ADMIN) — يملك كامل الصلاحيات التشغيلية، مدير عمليات (MANAGER)، وكيل (AGENT) — للمبيعات وخدمة العملاء، فني صيانة (TECHNICIAN)، ومستخدم (USER). كل دور له صلاحيات محددة يمكن الاطلاع عليها من طلب الصلاحيات.", en: "Mimaric offers 7 roles: System Admin — platform-level only, System Support — platform-level only, Admin — full operational permissions, Manager — operations management, Agent — sales and customer service, Technician — maintenance only, and User — read-only. Each has specific permissions viewable from the Request Permissions section." },
    category: "getting_started",
  },
  {
    id: "gs-3",
    question: { ar: "كيف أطلب صلاحيات إضافية؟", en: "How do I request additional permissions?" },
    answer: { ar: "اذهب إلى صفحة المساعدة > طلب الصلاحيات. اختر الدور المطلوب واكتب سبب الطلب. سيراجع المدير طلبك ويوافق عليه أو يرفضه.", en: "Go to Help > Request Permissions. Select the desired role and write your reason. An admin will review and approve or decline your request." },
    category: "getting_started",
  },
  // Sales & CRM
  {
    id: "sc-1",
    question: { ar: "كيف أضيف عميلاً جديداً؟", en: "How do I add a new customer?" },
    answer: { ar: "من قسم العملاء، انقر على 'إضافة عميل'. أدخل بيانات العميل (الاسم، الهاتف، الهوية الوطنية). سيتم تشفير البيانات الشخصية تلقائياً.", en: "From the Customers section, click 'Add Customer'. Enter customer details (name, phone, national ID). Personal data is automatically encrypted." },
    category: "sales_crm",
  },
  {
    id: "sc-2",
    question: { ar: "ما الفرق بين عرض كانبان وعرض القائمة؟", en: "What's the difference between Kanban and List view?" },
    answer: { ar: "عرض كانبان يعرض العملاء في أعمدة حسب حالتهم (جديد، مهتم، مؤهل، معاينة، محجوز). عرض القائمة يعرضهم في جدول مع إمكانية الفرز والفلترة.", en: "Kanban view shows customers in columns by status (New, Interested, Qualified, Viewing, Reserved). List view shows them in a sortable, filterable table." },
    category: "sales_crm",
  },
  {
    id: "sc-3",
    question: { ar: "كيف أنشئ صفقة لعميل؟", en: "How do I create a deal for a customer?" },
    answer: { ar: "من قسم الصفقات، انقر 'صفقة جديدة'. اختر العميل، ثم اختر العقار والوحدة المناسبة. أكمل خطوات المعالج لتأكيد الحجز — ستتحدث حالة الوحدة تلقائياً إلى 'محجوز'.", en: "From the Deals section, click 'New Deal'. Select the customer, then choose the property and unit. Complete the wizard steps to confirm the reservation — the unit status will automatically update to 'Reserved'." },
    category: "sales_crm",
  },
  // Property Management
  {
    id: "pm-1",
    question: { ar: "كيف أتابع حالة الوحدات؟", en: "How do I track unit status?" },
    answer: { ar: "من قسم العقارات، يمكنك رؤية جميع الوحدات في شبكة بطاقات ملونة حسب الحالة (متاح، محجوز، مباع، مؤجر، صيانة). انقر زر التفاصيل على أي وحدة لفتح لوحة جانبية تعرض: النوع، الحالة، المساحة، أسعار التكلفة والبيع والإيجار، الملخص المالي (إيجار محصّل، إيراد البيع، تكاليف الصيانة، صافي الدخل)، العقد المرتبط (إن وُجد)، وطلبات الصيانة. حالة الوحدة تتحدث تلقائياً عند توقيع أو إلغاء العقود.", en: "From the Properties section, view all units in a color-coded card grid by status (Available, Reserved, Sold, Rented, Maintenance). Click the detail button on any unit to open a side panel showing: type, status, area, cost/selling/rental prices, financial summary (rent collected, sale revenue, maintenance costs, net income), linked contract (if any), and maintenance requests. Unit status updates automatically when contracts are signed or cancelled." },
    category: "property_management",
  },
  {
    id: "pm-2",
    question: { ar: "كيف أقدم طلب صيانة؟", en: "How do I submit a maintenance request?" },
    answer: { ar: "من قسم الصيانة، انقر على 'طلب جديد'. حدد الوحدة، الفئة (كهرباء، سباكة، تكييف...)، الأولوية، ووصف المشكلة.", en: "From Maintenance, click 'New Request'. Select the unit, category (electrical, plumbing, HVAC...), priority, and describe the issue." },
    category: "property_management",
  },
  {
    id: "pm-3",
    question: { ar: "ما هي الصيانة الوقائية؟", en: "What is preventive maintenance?" },
    answer: { ar: "الصيانة الوقائية هي جدولة أعمال صيانة دورية (يومية، أسبوعية، شهرية، سنوية) لمنع الأعطال. يتم إنشاء أوامر عمل تلقائياً حسب الجدول.", en: "Preventive maintenance schedules recurring work (daily, weekly, monthly, annual) to prevent breakdowns. Work orders are auto-generated per schedule." },
    category: "property_management",
  },
  // Finance
  {
    id: "fi-1",
    question: { ar: "كيف أتابع الأقساط المستحقة؟", en: "How do I track due installments?" },
    answer: { ar: "من قسم المدفوعات، يمكنك رؤية جميع الأقساط مع حالتها (مدفوع، غير مدفوع، متأخر). يمكنك تسجيل الدفعات من هناك. عند إنشاء عقد إيجار متوافق مع إيجار من قسم العقود، يُنشأ جدول الأقساط تلقائياً حسب دورية الدفع المحددة (شهري، ربع سنوي، نصف سنوي، سنوي) ويُربط بالعقد.", en: "From the Payments section, view all installments with status (Paid, Unpaid, Overdue). You can record payments from there. When creating an Ejar-compliant lease contract from the Contracts section, the installment schedule is auto-generated based on the specified payment frequency (monthly, quarterly, semi-annual, annual) and linked to the contract." },
    category: "finance",
  },
  {
    id: "fi-8",
    question: { ar: "كيف أتابع الملخص المالي للوحدة؟", en: "How do I view the financial summary for a unit?" },
    answer: { ar: "من قسم العقارات، افتح تفاصيل أي وحدة. قسم 'الملخص المالي' يعرض أربعة مؤشرات: إيجار محصّل (إجمالي الأقساط المدفوعة)، إيراد البيع (مبالغ عقود البيع الموقّعة)، تكاليف الصيانة (التكلفة الفعلية أو المقدّرة لطلبات الصيانة)، وصافي الدخل (الإيرادات ناقص التكاليف). المؤشرات تُحسب تلقائياً من بيانات العقود والإيجارات والصيانة.", en: "From the Properties section, open any unit's details. The 'Financial Summary' section shows four KPIs: Rent Collected (total paid installments), Sale Revenue (signed sale contract amounts), Maintenance Costs (actual or estimated maintenance request costs), and Net Income (revenue minus costs). KPIs are auto-calculated from contracts, leases, and maintenance data." },
    category: "finance",
  },
  {
    id: "fi-2",
    question: { ar: "هل النظام متوافق مع متطلبات هيئة الزكاة والضريبة (ZATCA)؟", en: "Is the system ZATCA compliant?" },
    answer: { ar: "نعم، يدعم ميماريك حساب ضريبة القيمة المضافة (15%) وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك. الفوترة الإلكترونية قيد التطوير.", en: "Yes, Mimaric supports VAT calculation (15%) per ZATCA requirements. E-invoicing integration is under development." },
    category: "finance",
  },
  {
    id: "fi-3",
    question: { ar: "كيف أصدر تقارير مالية؟", en: "How do I generate financial reports?" },
    answer: { ar: "من قسم التقارير، اختر نوع التقرير (مالي، إشغال، صيانة، إيجارات، عملاء...) وحدد نطاق التاريخ. يمكنك التصدير بصيغة Excel أو PDF.", en: "From Reports, select the report type (financial, occupancy, maintenance, leases, customers...) and date range. Export as Excel or PDF." },
    category: "finance",
  },
  // Security & Privacy
  {
    id: "sp-1",
    question: { ar: "كيف يتم حماية بيانات العملاء الشخصية؟", en: "How is customer personal data protected?" },
    answer: { ar: "يتم تشفير البيانات الشخصية (الهوية الوطنية، الهاتف، البريد الإلكتروني) بتقنية AES-256-GCM. فقط المستخدمون المصرح لهم يمكنهم عرض البيانات الكاملة.", en: "Personal data (national ID, phone, email) is encrypted with AES-256-GCM. Only authorized users can view full data." },
    category: "security_privacy",
  },
  {
    id: "sp-4",
    question: { ar: "كيف يعمل نظام الصلاحيات للعقود؟", en: "How does the contract permissions system work?" },
    answer: { ar: "يفصل ميماريك بين العمليات التقدمية والتدميرية للعقود. العمليات التقدمية (إنشاء، إرسال، توقيع) تتطلب صلاحية 'contracts:write' — متاحة للمدير (Admin) ومدير العمليات (Manager) والوكيل (Agent). العمليات التدميرية (إلغاء، إبطال، حذف) تتطلب صلاحية 'contracts:delete' — متاحة للمدير (Admin) فقط. الحذف متاح فقط للعقود في حالة 'مسودة'.", en: "Mimaric separates progressive and destructive contract operations. Progressive operations (create, send, sign) require 'contracts:write' — available to Admin, Manager, and Agent roles. Destructive operations (cancel, void, delete) require 'contracts:delete' — available to Admin only. Deletion is only allowed for Draft contracts." },
    category: "security_privacy",
  },
  {
    id: "sp-2",
    question: { ar: "ما هي سياسة كلمة المرور؟", en: "What is the password policy?" },
    answer: { ar: "يتطلب النظام كلمة مرور لا تقل عن 10 أحرف، ولا تحتوي على اسمك أو بريدك الإلكتروني، وليست من قائمة كلمات المرور الشائعة.", en: "The system requires a password of at least 10 characters, not containing your name or email, and not in a common password list." },
    category: "security_privacy",
  },
  {
    id: "sp-3",
    question: { ar: "هل يمكنني مراجعة سجل النشاطات؟", en: "Can I review the activity log?" },
    answer: { ar: "نعم، المديرون يمكنهم الوصول إلى سجل التدقيق من الإعدادات > سجل التدقيق. يتم تسجيل جميع عمليات الوصول والتعديل والتصدير.", en: "Yes, admins can access the audit trail from Settings > Audit Log. All access, modification, and export operations are logged." },
    category: "security_privacy",
  },
  // Technical
  {
    id: "te-1",
    question: { ar: "كيف أغير كلمة المرور؟", en: "How do I change my password?" },
    answer: { ar: "اذهب إلى الإعدادات > الأمان. أدخل كلمة المرور الحالية ثم الجديدة. يجب أن تستوفي كلمة المرور الجديدة سياسة الأمان.", en: "Go to Settings > Security. Enter your current password then the new one. The new password must meet the security policy." },
    category: "technical",
  },
  {
    id: "te-2",
    question: { ar: "هل يدعم النظام اللغة العربية والإنجليزية؟", en: "Does the system support Arabic and English?" },
    answer: { ar: "نعم، يدعم ميماريك اللغتين العربية والإنجليزية مع تخطيط RTL/LTR. يمكنك تغيير اللغة من الشريط العلوي.", en: "Yes, Mimaric supports both Arabic and English with RTL/LTR layout. Toggle the language from the top bar." },
    category: "technical",
  },
  {
    id: "te-3",
    question: { ar: "هل يدعم النظام التاريخ الهجري؟", en: "Does the system support Hijri dates?" },
    answer: { ar: "نعم، يعرض النظام التاريخ الهجري والميلادي معاً في جميع الأقسام.", en: "Yes, the system displays both Hijri and Gregorian dates across all sections." },
    category: "technical",
  },
  // Document Vault
  {
    id: "pm-6",
    question: { ar: "كيف أرفع وأدير المستندات؟", en: "How do I upload and manage documents?" },
    answer: { ar: "من قسم المستندات، انقر 'رفع مستند' لرفع ملفات PDF أو صور أو مستندات نصية. المستندات تُصنّف تلقائياً (مخططات، تصاريح قانونية، مخططات إنشائية، تجاري، تسويق). يمكنك البحث بالاسم، إنشاء مجلدات جديدة، وتحميل أي مستند. يعرض النظام مؤشر المساحة المستخدمة من إجمالي التخزين المتاح.", en: "From the Documents section, click 'Upload Document' to upload PDFs, images, or text files. Documents are categorized automatically (blueprints, legal permits, structural plans, commercial, marketing). You can search by name, create new folders, and download any document. The system shows a storage usage indicator of your total available space." },
    category: "property_management",
  },
  // Billing & Subscription
  {
    id: "fi-4",
    question: { ar: "كيف أدير اشتراكي؟", en: "How do I manage my subscription?" },
    answer: { ar: "من قسم الفوترة، يمكنك رؤية خطتك الحالية وحالتها (تجريبي، نشط، متأخر، ملغي)، دورة الفوترة (شهري، ربع سنوي، نصف سنوي، سنوي)، تاريخ الفاتورة التالية، وطرق الدفع المحفوظة. انقر 'تغيير الخطة' لعرض الخطط المتاحة والمقارنة بينها.", en: "From the Billing section, view your current plan and its status (trialing, active, past due, canceled), billing cycle (monthly, quarterly, semi-annual, annual), next billing date, and saved payment methods. Click 'Change Plan' to browse and compare available plans." },
    category: "finance",
  },
  {
    id: "fi-5",
    question: { ar: "كيف أستخدم كود الخصم (كوبون)؟", en: "How do I apply a coupon code?" },
    answer: { ar: "من صفحة الخطط (الفوترة > الخطط)، أدخل كود الخصم في حقل الكوبون وانقر 'تطبيق'. إذا كان الكود صالحاً، سيظهر الخصم (نسبة مئوية أو مبلغ ثابت) على أسعار الخطط مع عرض السعر الأصلي مشطوباً والسعر الجديد باللون الأخضر ومبلغ التوفير.", en: "From the Plans page (Billing > Plans), enter the discount code in the coupon field and click 'Apply'. If valid, the discount (percentage or fixed amount) appears on plan prices with the original price crossed out, the new price in green, and the savings amount displayed." },
    category: "finance",
  },
  {
    id: "fi-6",
    question: { ar: "ماذا يحدث عند تأخر سداد الاشتراك؟", en: "What happens when my subscription payment is overdue?" },
    answer: { ar: "عند تأخر السداد، تتحول حالة اشتراكك إلى 'متأخر' ويظهر شريط تنبيه مع زر 'تحديث الدفع'. لديك فترة سماح لتحديث طريقة الدفع قبل تعليق الخدمة. يمكنك مراجعة فواتيرك ومبالغها من صفحة الفواتير.", en: "When payment is overdue, your subscription status changes to 'Past Due' and a warning banner appears with an 'Update Payment' button. You have a grace period to update your payment method before service suspension. You can review your invoices and amounts from the Invoices page." },
    category: "finance",
  },
  {
    id: "fi-7",
    question: { ar: "كيف أتابع مدفوعات الإيجار؟", en: "How do I track and record rental payments?" },
    answer: { ar: "من قسم المدفوعات، تظهر لوحة بأربعة مؤشرات: إجمالي المستحق، المحصّل، المتأخر، والمعلق. الجدول يعرض كل قسط مع اسم المستأجر ورقم الوحدة والمبلغ وتاريخ الاستحقاق والحالة. انقر 'تسجيل دفعة' على أي قسط غير مدفوع لتسجيل التحصيل. النظام يحدّث الأقساط المتأخرة تلقائياً.", en: "From the Payments section, a dashboard shows four KPIs: Total Due, Collected, Overdue, and Pending. The table lists each installment with tenant name, unit number, amount, due date, and status. Click 'Record Payment' on any unpaid installment to record collection. The system automatically marks overdue installments." },
    category: "finance",
  },
  // Sales Contracts & Ejar/Wafi Compliance
  {
    id: "sc-4",
    question: { ar: "كيف أتابع عقود المبيعات؟", en: "How do I track sales contracts?" },
    answer: { ar: "من قسم العقود، يعرض النظام جدولاً بجميع العقود مع بيانات العميل (الاسم والهاتف)، الوحدة (الرقم والمبنى)، نوع العقد (بيع أو إيجار)، المبلغ بالريال، التاريخ بالهجري والميلادي، والحالة. يمكنك تصفية العقود حسب الحالة: مسودة، مُرسل، موقّع، ملغي. لكل عقد رقم فريد تلقائي (مثل SALE-2026-0001 أو LEASE-2026-0001). انقر 'عرض' لفتح تفاصيل أي عقد.", en: "From the Contracts section, the system shows a table of all contracts with customer info (name and phone), unit (number and building), contract type (sale or lease), amount in SAR, date in Hijri and Gregorian, and status. Filter contracts by status: Draft, Sent, Signed, Canceled. Each contract gets an auto-generated unique number (e.g., SALE-2026-0001 or LEASE-2026-0001). Click 'View' to open any contract's details." },
    category: "sales_crm",
  },
  {
    id: "sc-5",
    question: { ar: "ما هو نظام إيجار وكيف يتوافق ميماريك معه؟", en: "What is Ejar and how does Mimaric comply with it?" },
    answer: { ar: "إيجار هو النظام الإلكتروني لعقود الإيجار في المملكة العربية السعودية. يتوافق ميماريك مع متطلبات إيجار عند إنشاء عقد إيجار: تاريخ البدء والانتهاء (إلزامي)، دورية الدفع (شهري، ربع سنوي، نصف سنوي، سنوي)، مبلغ الضمان (بحد أقصى 5% من قيمة العقد)، التجديد التلقائي (يُفعّل تلقائياً للعقود أكثر من 3 أشهر)، مسؤولية الصيانة (المؤجر أو المستأجر)، وفترة الإشعار (60 يوماً افتراضياً). النظام ينشئ جدول أقساط تلقائياً ويربطه بالعقد.", en: "Ejar is Saudi Arabia's electronic rental contract system. Mimaric complies with Ejar requirements when creating a lease contract: start and end dates (mandatory), payment frequency (monthly, quarterly, semi-annual, annual), security deposit (maximum 5% of contract value), auto-renewal (automatically enabled for leases over 3 months), maintenance responsibility (landlord or tenant), and notice period (60 days default). The system auto-generates an installment schedule linked to the contract." },
    category: "sales_crm",
  },
  {
    id: "sc-7",
    question: { ar: "ما هي دورة حياة العقد في ميماريك؟", en: "What is the contract lifecycle in Mimaric?" },
    answer: { ar: "يمر العقد بثلاث حالات رئيسية: مسودة ← مُرسل ← موقّع، ويمكن إلغاء العقد أو إبطاله. المسودة يمكن إرسالها أو إلغاؤها أو حذفها. المُرسل يمكن توقيعه أو إلغاؤه. الموقّع يمكن إبطاله فقط (يتطلب صلاحية Admin). عند التوقيع: عقد البيع يحوّل الوحدة إلى 'مباع' والعميل إلى 'مُحوّل'. عقد الإيجار يحوّل الوحدة إلى 'مؤجر' ويفعّل جدول الأقساط. عند الإلغاء أو الإبطال: تعود الوحدة إلى 'متاح' تلقائياً.", en: "A contract goes through three main states: Draft → Sent → Signed, and can be Cancelled or Voided. Draft contracts can be sent, cancelled, or deleted. Sent contracts can be signed or cancelled. Signed contracts can only be voided (requires Admin permission). On signing: Sale contracts set unit to 'Sold' and customer to 'Converted'. Lease contracts set unit to 'Rented' and activate the installment schedule. On cancel/void: the unit automatically returns to 'Available'." },
    category: "sales_crm",
  },
  {
    id: "sc-8",
    question: { ar: "كيف أنشئ عقد إيجار متوافق مع إيجار؟", en: "How do I create an Ejar-compliant lease contract?" },
    answer: { ar: "من قسم العقود، انقر 'عقد جديد' واختر نوع 'إيجار'. ستظهر حقول إيجار: تاريخ البداية والنهاية، دورية الدفع (شهري/ربع سنوي/نصف سنوي/سنوي)، مبلغ الضمان (لا يتجاوز 5%)، التجديد التلقائي، مسؤولية الصيانة، والملاحظات. عند الحفظ، يُنشأ تلقائياً: عقد إيجار مع رقم فريد، جدول أقساط حسب الدورية، وعقد إيجار مربوط بجدول الأقساط.", en: "From the Contracts section, click 'New Contract' and select 'Lease' type. Ejar fields appear: start and end dates, payment frequency (monthly/quarterly/semi-annual/annual), security deposit (max 5%), auto-renewal, maintenance responsibility, and notes. On save, the system auto-creates: a contract with a unique number, an installment schedule based on frequency, and a linked lease record with the installment schedule." },
    category: "sales_crm",
  },
  {
    id: "sc-10",
    question: { ar: "من يمكنه إلغاء أو إبطال أو حذف العقود؟", en: "Who can cancel, void, or delete contracts?" },
    answer: { ar: "العمليات التدميرية (إلغاء، إبطال، حذف) تتطلب صلاحية 'contracts:delete' المتاحة للمدير (Admin) فقط. العمليات التقدمية (إرسال، توقيع) تتطلب صلاحية 'contracts:write' المتاحة للمدير (Admin) ومدير العمليات (Manager) والوكيل (Agent). مدير العمليات (Manager) يمكنه عرض العقود فقط بصلاحية contracts:read. الحذف متاح فقط للعقود في حالة 'مسودة'.", en: "Destructive operations (cancel, void, delete) require 'contracts:delete' permission, available to Admin only. Progressive operations (send, sign) require 'contracts:write', available to Admin, Manager, and Agent roles. Manager role can view contracts read-only. Deletion is only allowed for 'Draft' contracts." },
    category: "sales_crm",
  },
  {
    id: "sc-11",
    question: { ar: "كيف أرى العقد المرتبط بوحدة؟", en: "How do I see the contract linked to a unit?" },
    answer: { ar: "من قسم العقارات، انقر على زر التفاصيل لأي وحدة مباعة أو مؤجرة. في لوحة التفاصيل، ستجد قسم 'العقد المرتبط' الذي يعرض: نوع العقد (بيع/إيجار)، الحالة (مسودة/مُرسل/موقّع)، اسم العميل، رقم العقد، وزر 'عرض العقد' للانتقال مباشرة لتفاصيل العقد.", en: "From the Properties section, click the detail button for any sold or rented unit. In the detail panel, you'll find the 'Linked Contract' section showing: contract type (sale/lease), status (draft/sent/signed), customer name, contract number, and a 'View Contract' button to navigate directly to the contract details." },
    category: "sales_crm",
  },
  {
    id: "sc-12",
    question: { ar: "كيف أعرض تفاصيل عقد الإيجار (شروط إيجار)؟", en: "How do I view lease contract details (Ejar terms)?" },
    answer: { ar: "من صفحة تفاصيل العقد (نوع إيجار)، ستجد: القسم الأول — بيانات الأطراف (المؤجر والمستأجر)، القسم الثاني — بيانات الوحدة، القسم الثالث — القيمة المالية، القسم الرابع — شروط الإيجار (الفترة، دورية الدفع، مبلغ الضمان، التجديد التلقائي، مسؤولية الصيانة، فترة الإشعار)، والقسم الخامس — جدول الأقساط (رقم القسط، تاريخ الاستحقاق، المبلغ، الحالة).", en: "From the contract detail page (lease type), you'll find: Section 1 — party details (landlord and tenant), Section 2 — unit details, Section 3 — financial value, Section 4 — lease terms (period, payment frequency, security deposit, auto-renewal, maintenance responsibility, notice period), and Section 5 — payment schedule (installment number, due date, amount, status)." },
    category: "sales_crm",
  },
  {
    id: "sc-13",
    question: { ar: "كيف أعرض تفاصيل عقد البيع؟", en: "How do I view sale contract details?" },
    answer: { ar: "من صفحة تفاصيل العقد (نوع بيع)، ستجد: القسم الأول — بيانات الأطراف (البائع والمشتري)، القسم الثاني — بيانات الوحدة، القسم الثالث — القيمة المالية، والقسم الرابع — شروط البيع (تاريخ التسليم والملاحظات). الشريط الجانبي يعرض رقم العقد والقيمة والحالة.", en: "From the contract detail page (sale type), you'll find: Section 1 — party details (seller and buyer), Section 2 — unit details, Section 3 — financial value, and Section 4 — sale terms (delivery date and notes). The sidebar shows the contract number, value, and status." },
    category: "sales_crm",
  },
  // Onboarding / Getting Started
  {
    id: "gs-4",
    question: { ar: "كيف أُعدّ حسابي ومنشأتي في ميماريك؟", en: "How do I set up my account and organization in Mimaric?" },
    answer: { ar: "عند أول تسجيل دخول، يظهر معالج الإعداد المكوّن من 4 خطوات: (1) الانضمام لشركة قائمة أو المتابعة مستقلاً، (2) بيانات المنشأة (الاسم بالعربية والإنجليزية، السجل التجاري، الرقم الضريبي، نوع الكيان والشكل القانوني)، (3) بيانات التواصل (الجوال، المدينة، المنطقة)، (4) دعوة أعضاء الفريق عبر البريد الإلكتروني مع تحديد أدوارهم. يمكنك تخطي أي خطوة والعودة لإكمالها لاحقاً.", en: "On first login, a 4-step setup wizard appears: (1) Join an existing company or continue independently, (2) Organization details (Arabic and English names, CR number, VAT number, entity type, legal form), (3) Contact information (mobile, city, region), (4) Invite team members by email with role assignment. You can skip any step and complete it later." },
    category: "getting_started",
  },
  {
    id: "gs-5",
    question: { ar: "كيف أنضم لشركة قائمة في ميماريك؟", en: "How do I join an existing company in Mimaric?" },
    answer: { ar: "في الخطوة الأولى من الإعداد، اختر 'انضم لشركة'. أدخل رقم السجل التجاري المكوّن من 10 خانات وانقر 'بحث'. إذا وُجدت الشركة، ستظهر بياناتها ويمكنك إرسال طلب انضمام. سيراجع مدير الشركة طلبك ويوافق عليه.", en: "In the first setup step, choose 'Join a Company'. Enter the 10-digit CR number and click 'Search'. If the company is found, its details appear and you can send a join request. The company admin will review and approve your request." },
    category: "getting_started",
  },
  // Platform Administration
  {
    id: "te-4",
    question: { ar: "ما هي أدوات إدارة المنصة (للمسؤولين)؟", en: "What are the platform administration tools (for admins)?" },
    answer: { ar: "لوحة الإدارة تتيح للمسؤولين: إدارة خطط الاشتراك (إنشاء وتعديل الخطط والأسعار والميزات)، متابعة جميع الاشتراكات (نشط، تجريبي، متأخر، ملغي) مع إحصائيات شاملة، إنشاء وإدارة الكوبونات (كود الخصم، النسبة أو المبلغ، الحد الأقصى للاستخدام، الصلاحية)، وعرض جميع الفواتير والمدفوعات عبر المنصة مع إجمالي الإيرادات.", en: "The Admin panel lets administrators: manage subscription plans (create and edit plans, pricing, and features), monitor all subscriptions (active, trialing, past due, canceled) with comprehensive statistics, create and manage coupons (discount codes, percentage or fixed amount, max redemptions, validity), and view all invoices and payments across the platform with total revenue." },
    category: "technical",
  },
];

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "guide-2",
    title: { ar: "إدارة العقارات والوحدات", en: "Manage Properties & Units" },
    description: { ar: "كيفية إضافة وتعديل وعرض تفاصيل الوحدات العقارية", en: "How to add, edit, and view details of real estate units" },
    module: "properties",
    steps: [
      { ar: "اذهب إلى قسم العقارات من القائمة الجانبية — ستظهر شبكة بطاقات بجميع الوحدات مع حالتها", en: "Go to the Properties section from the sidebar — a card grid shows all units with their status" },
      { ar: "استخدم الفلاتر: البحث برقم الوحدة، تصفية حسب المشروع، تصفية حسب الحالة", en: "Use filters: search by unit number, filter by project, filter by status" },
      { ar: "انقر 'إضافة وحدة' وأدخل الرقم، النوع، المبنى، المساحة، وأسعار التكلفة والبيع والإيجار", en: "Click 'Add Unit' and enter number, type, building, area, and cost/selling/rental prices" },
      { ar: "يمكنك تعديل عدة وحدات معاً باستخدام التحديد المتعدد وشريط الإجراءات", en: "You can bulk-edit units using multi-select and the action bar" },
      { ar: "انقر زر التفاصيل للوحدة لعرض: المعلومات الأساسية، الملخص المالي، العقد المرتبط، وطلبات الصيانة", en: "Click the detail button to view: basic info, financial summary, linked contract, and maintenance requests" },
      { ar: "حالة الوحدة تتحدث تلقائياً: مباع عند توقيع عقد بيع، مؤجر عند توقيع عقد إيجار", en: "Unit status auto-updates: Sold when a sale contract is signed, Rented when a lease is signed" },
    ],
  },
  {
    id: "guide-3",
    title: { ar: "إنشاء عميل", en: "Create a Customer" },
    description: { ar: "إضافة عميل جديد إلى نظام إدارة العلاقات", en: "Add a new customer to the CRM system" },
    module: "customers",
    steps: [
      { ar: "اذهب إلى قسم العملاء", en: "Go to the Customers section" },
      { ar: "انقر 'إضافة عميل'", en: "Click 'Add Customer'" },
      { ar: "أدخل الاسم بالعربية والإنجليزية", en: "Enter the name in Arabic and English" },
      { ar: "أدخل رقم الهاتف ورقم الهوية الوطنية", en: "Enter phone number and national ID" },
      { ar: "اختر مصدر العميل (موقع، إحالة، معرض، إلخ)", en: "Select the customer source (website, referral, exhibition, etc.)" },
      { ar: "انقر 'حفظ' — سيتم تشفير البيانات الحساسة تلقائياً", en: "Click 'Save' — sensitive data is auto-encrypted" },
    ],
  },
  {
    id: "guide-4",
    title: { ar: "إنشاء عقد إيجار", en: "Create a Lease Contract" },
    description: { ar: "خطوات إنشاء عقد إيجار جديد مع جدول الأقساط وعقد مرتبط", en: "Steps to create a new lease with installment schedule and linked contract" },
    module: "contracts",
    steps: [
      { ar: "اذهب إلى قسم العقود من القائمة الجانبية", en: "Go to the Contracts section from the sidebar" },
      { ar: "انقر 'عقد جديد' واختر نوع 'إيجار'", en: "Click 'New Contract' and select 'Lease' type" },
      { ar: "اختر الوحدة والمستأجر (العميل)", en: "Select the unit and tenant (customer)" },
      { ar: "حدد تاريخ البدء والانتهاء، دورية الدفع، ومبلغ الضمان (لا يتجاوز 5%)", en: "Set start date, end date, payment frequency, and security deposit (max 5%)" },
      { ar: "انقر 'حفظ' — سيتم إنشاء جدول الأقساط تلقائياً ورقم عقد فريد", en: "Click 'Save' — the installment schedule is auto-generated with a unique contract number" },
      { ar: "تتبع مدفوعات الأقساط من قسم المدفوعات", en: "Track installment payments from the Payments section" },
    ],
  },
  {
    id: "guide-5",
    title: { ar: "تقديم طلب صيانة", en: "Submit a Maintenance Request" },
    description: { ar: "كيفية تقديم طلب صيانة لوحدة عقارية", en: "How to submit a maintenance request for a unit" },
    module: "maintenance",
    steps: [
      { ar: "اذهب إلى قسم الصيانة", en: "Go to the Maintenance section" },
      { ar: "انقر 'طلب صيانة جديد'", en: "Click 'New Maintenance Request'" },
      { ar: "اختر الوحدة المعنية", en: "Select the relevant unit" },
      { ar: "حدد الفئة (كهرباء، سباكة، تكييف، مصعد، إلخ) والأولوية", en: "Select category (electrical, plumbing, HVAC, elevator, etc.) and priority" },
      { ar: "اكتب وصفاً تفصيلياً للمشكلة", en: "Write a detailed description of the issue" },
      { ar: "انقر 'إرسال' — سيتم تعيين فني حسب الأولوية", en: "Click 'Submit' — a technician will be assigned by priority" },
    ],
  },
  {
    id: "guide-6",
    title: { ar: "تصدير التقارير", en: "Export Reports" },
    description: { ar: "كيفية إنشاء وتصدير التقارير بصيغة Excel أو PDF", en: "How to generate and export reports as Excel or PDF" },
    module: "reports",
    steps: [
      { ar: "اذهب إلى قسم التقارير", en: "Go to the Reports section" },
      { ar: "اختر نوع التقرير (إشغال، مالي، صيانة، إيجارات، عملاء)", en: "Select report type (occupancy, financial, maintenance, leases, customers)" },
      { ar: "حدد نطاق التاريخ المطلوب", en: "Set the desired date range" },
      { ar: "انقر زر Excel (أخضر) أو PDF (أحمر) للتصدير", en: "Click Excel (green) or PDF (red) button to export" },
    ],
  },
  {
    id: "guide-7",
    title: { ar: "إدارة فريق العمل", en: "Manage Team Members" },
    description: { ar: "إضافة وإدارة أعضاء الفريق وتعيين الأدوار", en: "Add and manage team members and assign roles" },
    module: "settings",
    steps: [
      { ar: "اذهب إلى الإعدادات > إدارة الفريق", en: "Go to Settings > Team Management" },
      { ar: "انقر 'دعوة عضو جديد'", en: "Click 'Invite Member'" },
      { ar: "أدخل الاسم والبريد الإلكتروني وكلمة المرور", en: "Enter name, email, and password" },
      { ar: "اختر الدور المناسب: مدير (Admin)، مدير عمليات (Manager)، وكيل (Agent)، أو فني (Technician)", en: "Select the appropriate role: Admin, Manager, Agent, or Technician" },
      { ar: "انقر 'حفظ' — سيتمكن العضو من تسجيل الدخول فوراً", en: "Click 'Save' — the member can log in immediately" },
    ],
  },
  {
    id: "guide-8",
    title: { ar: "طلب صلاحيات", en: "Request Permissions" },
    description: { ar: "كيفية طلب ترقية صلاحياتك في النظام", en: "How to request a permission upgrade in the system" },
    module: "help",
    steps: [
      { ar: "اذهب إلى صفحة المساعدة من القائمة الجانبية", en: "Go to the Help page from the sidebar" },
      { ar: "انقر على تبويب 'طلب صلاحيات'", en: "Click the 'Request Permissions' tab" },
      { ar: "اختر الدور الذي تريد الترقية إليه", en: "Select the role you want to upgrade to" },
      { ar: "اكتب سبب الطلب بالتفصيل", en: "Write a detailed reason for the request" },
      { ar: "انقر 'إرسال الطلب' — سيتم إشعار المدير", en: "Click 'Submit Request' — the admin will be notified" },
      { ar: "تابع حالة طلبك من نفس الصفحة", en: "Track your request status from the same page" },
    ],
  },
  // Document Vault Guide
  {
    id: "guide-14",
    title: { ar: "رفع وإدارة المستندات", en: "Upload & Manage Documents" },
    description: { ar: "كيفية رفع الملفات وتصنيفها والبحث عنها في خزنة المستندات", en: "How to upload files, categorize them, and search in the document vault" },
    module: "documents",
    steps: [
      { ar: "اذهب إلى قسم المستندات من القائمة الجانبية", en: "Go to the Documents section from the sidebar" },
      { ar: "انقر زر 'رفع مستند' واختر ملفاً من جهازك (PDF، صورة، أو نص)", en: "Click 'Upload Document' and select a file from your device (PDF, image, or text)" },
      { ar: "سيتم رفع الملف وتصنيفه تلقائياً في الفئة المناسبة", en: "The file will be uploaded and automatically categorized" },
      { ar: "استخدم القائمة الجانبية للتصفية حسب الفئة (مخططات، تصاريح، إنشائية، تجاري، تسويق)", en: "Use the sidebar to filter by category (blueprints, legal permits, structural, commercial, marketing)" },
      { ar: "استخدم شريط البحث للعثور على أي مستند بالاسم", en: "Use the search bar to find any document by name" },
      { ar: "انقر زر التحميل على أي بطاقة مستند لتحميله إلى جهازك", en: "Click the download button on any document card to download it" },
    ],
  },
  // Sales Contracts Guides
  {
    id: "guide-15",
    title: { ar: "متابعة عقود المبيعات", en: "Track Sales Contracts" },
    description: { ar: "كيفية عرض وتصفية ومتابعة دورة حياة عقود البيع والإيجار", en: "How to view, filter, and track the lifecycle of sales and lease contracts" },
    module: "contracts",
    steps: [
      { ar: "اذهب إلى قسم العقود من القائمة الجانبية", en: "Go to the Contracts section from the sidebar" },
      { ar: "استخدم أزرار التصفية في الأعلى لاختيار الحالة (الكل، مسودة، مُرسل، موقّع، ملغي)", en: "Use the filter buttons at the top to select status (All, Draft, Sent, Signed, Canceled)" },
      { ar: "استعرض الجدول الذي يعرض بيانات العميل والوحدة ونوع العقد والمبلغ والتاريخ", en: "Browse the table showing customer info, unit, contract type, amount, and date" },
      { ar: "انقر 'عرض' لفتح صفحة تفاصيل العقد مع الشروط والأطراف", en: "Click 'View' to open the contract details page with terms and parties" },
      { ar: "تابع دورة حياة العقد: مسودة ← مُرسل ← موقّع. استخدم أزرار الإجراءات لتحريك العقد", en: "Follow the contract lifecycle: Draft → Sent → Signed. Use action buttons to advance the contract" },
    ],
  },
  {
    id: "guide-22",
    title: { ar: "إنشاء عقد إيجار (إيجار)", en: "Create an Ejar Lease Contract" },
    description: { ar: "خطوات إنشاء عقد إيجار متوافق مع نظام إيجار السعودي", en: "Steps to create a lease contract compliant with the Saudi Ejar system" },
    module: "contracts",
    steps: [
      { ar: "اذهب إلى قسم العقود وانقر 'عقد جديد'", en: "Go to the Contracts section and click 'New Contract'" },
      { ar: "اختر نوع العقد: 'إيجار' — ستظهر حقول إيجار الإضافية", en: "Select contract type: 'Lease' — Ejar-specific fields will appear" },
      { ar: "اختر العميل (المستأجر) والوحدة، وأدخل مبلغ الإيجار الإجمالي", en: "Select the customer (tenant) and unit, and enter the total lease amount" },
      { ar: "حدد تاريخ البداية والنهاية — هذه حقول إلزامية لعقود الإيجار", en: "Set start and end dates — these are mandatory for lease contracts" },
      { ar: "اختر دورية الدفع: شهري، ربع سنوي، نصف سنوي، أو سنوي", en: "Select payment frequency: monthly, quarterly, semi-annual, or annual" },
      { ar: "أدخل مبلغ الضمان (اختياري — لا يتجاوز 5% من قيمة العقد حسب نظام إيجار)", en: "Enter security deposit (optional — max 5% of contract value per Ejar regulation)" },
      { ar: "حدد التجديد التلقائي (نعم/لا) ومسؤولية الصيانة (المؤجر/المستأجر)", en: "Set auto-renewal (yes/no) and maintenance responsibility (landlord/tenant)" },
      { ar: "انقر 'إنشاء' — يُنشأ العقد مع جدول أقساط تلقائي ورقم عقد فريد", en: "Click 'Create' — the contract is created with an auto-generated installment schedule and unique contract number" },
    ],
  },
  {
    id: "guide-24",
    title: { ar: "إدارة دورة حياة العقد", en: "Manage Contract Lifecycle" },
    description: { ar: "كيفية تحريك العقد عبر مراحله: إرسال، توقيع، إلغاء، إبطال، حذف", en: "How to advance a contract through its stages: send, sign, cancel, void, delete" },
    module: "contracts",
    steps: [
      { ar: "افتح صفحة تفاصيل العقد من قسم العقود > عرض", en: "Open the contract detail page from the Contracts section > View" },
      { ar: "العقد 'مسودة': يمكنك النقر على 'إرسال' أو 'إلغاء' أو 'حذف' (يحتاج صلاحية حذف)", en: "For 'Draft': click 'Send', 'Cancel', or 'Delete' (delete requires delete permission)" },
      { ar: "العقد 'مُرسل': يمكنك النقر على 'توقيع' أو 'إلغاء'", en: "For 'Sent': click 'Sign' or 'Cancel'" },
      { ar: "العقد 'موقّع': يمكنك النقر على 'إبطال' فقط (يعكس جميع التأثيرات)", en: "For 'Signed': only 'Void' is available (reverses all effects)" },
      { ar: "عند توقيع عقد بيع: الوحدة ← مباع، العميل ← مُحوّل، إيداع في الضمان", en: "When signing a sale contract: unit → Sold, customer → Converted, escrow deposit" },
      { ar: "عند توقيع عقد إيجار: الوحدة ← مؤجر، العميل ← مستأجر نشط، الإيجار ← نشط", en: "When signing a lease contract: unit → Rented, customer → Active Tenant, lease → Active" },
      { ar: "عند الإلغاء أو الإبطال: الوحدة ← متاح، العميل ← مؤهل (إن لم يكن له عقود أخرى)", en: "On cancel/void: unit → Available, customer → Qualified (if no other active contracts)" },
    ],
  },
  // Rental Payments Guide
  {
    id: "guide-16",
    title: { ar: "تسجيل مدفوعات الإيجار", en: "Record Rental Payments" },
    description: { ar: "كيفية متابعة أقساط الإيجار وتسجيل المدفوعات المحصّلة", en: "How to monitor rental installments and record collected payments" },
    module: "payments",
    steps: [
      { ar: "اذهب إلى قسم المدفوعات من القائمة الجانبية", en: "Go to the Payments section from the sidebar" },
      { ar: "راجع بطاقات المؤشرات: إجمالي المستحق، المحصّل، المتأخر، والمعلق", en: "Review the KPI cards: Total Due, Collected, Overdue, and Pending" },
      { ar: "استعرض جدول الأقساط مع بيانات المستأجر والوحدة والمبلغ وتاريخ الاستحقاق", en: "Browse the installments table with tenant info, unit, amount, and due date" },
      { ar: "حدد القسط المطلوب تسجيله (غير مدفوع أو متأخر)", en: "Find the installment to record (unpaid or overdue)" },
      { ar: "انقر زر 'تسجيل دفعة' — سيتم تحديث الحالة تلقائياً إلى 'مدفوع'", en: "Click 'Record Payment' — the status will automatically update to 'Paid'" },
    ],
  },
  // Billing & Subscription Guide
  {
    id: "guide-17",
    title: { ar: "إدارة الاشتراك والفوترة", en: "Manage Subscription & Billing" },
    description: { ar: "كيفية اختيار خطة اشتراك وتطبيق كوبون ومراجعة الفواتير", en: "How to choose a subscription plan, apply a coupon, and review invoices" },
    module: "billing",
    steps: [
      { ar: "اذهب إلى الفوترة من القائمة الجانبية لعرض خطتك الحالية", en: "Go to Billing from the sidebar to view your current plan" },
      { ar: "انقر 'تغيير الخطة' لاستعراض الخطط المتاحة", en: "Click 'Change Plan' to browse available plans" },
      { ar: "بدّل بين الفوترة الشهرية والسنوية (وفّر 20% مع السنوية)", en: "Toggle between monthly and annual billing (save 20% with annual)" },
      { ar: "اختيارياً: أدخل كود خصم في حقل الكوبون وانقر 'تطبيق'", en: "Optionally: enter a discount code in the coupon field and click 'Apply'" },
      { ar: "انقر 'اختر الخطة' أو 'ابدأ التجربة المجانية' للاشتراك", en: "Click 'Choose Plan' or 'Start Free Trial' to subscribe" },
      { ar: "راجع فواتيرك من صفحة الفواتير (رقم الفاتورة، التاريخ، الحالة، المبلغ مع الضريبة)", en: "Review your invoices from the Invoices page (invoice number, date, status, amount with VAT)" },
    ],
  },
  // Onboarding Guide
  {
    id: "guide-19",
    title: { ar: "إكمال إعداد الحساب", en: "Complete Account Setup" },
    description: { ar: "خطوات إعداد الحساب والمنشأة ودعوة فريق العمل عند أول استخدام", en: "Steps to set up your account, organization, and invite your team on first use" },
    module: "onboarding",
    steps: [
      { ar: "الخطوة 1: اختر 'انضم لشركة' (أدخل رقم السجل التجاري) أو 'تابع مستقلاً'", en: "Step 1: Choose 'Join a Company' (enter CR number) or 'Continue Independently'" },
      { ar: "الخطوة 2: أدخل بيانات المنشأة (الاسم بالعربية والإنجليزية، السجل التجاري، الرقم الضريبي)", en: "Step 2: Enter organization details (Arabic and English name, CR number, VAT number)" },
      { ar: "اختر نوع الكيان (مؤسسة، شركة، فرع...) والشكل القانوني (ذ.م.م، مساهمة...)", en: "Select entity type (establishment, company, branch...) and legal form (LLC, joint stock...)" },
      { ar: "الخطوة 3: أدخل بيانات التواصل (رقم الجوال 05XXXXXXXX، المدينة، المنطقة)", en: "Step 3: Enter contact info (mobile 05XXXXXXXX, city, region)" },
      { ar: "الخطوة 4: أضف أعضاء الفريق عبر البريد الإلكتروني واختر دور كل عضو", en: "Step 4: Add team members by email and select each member's role" },
      { ar: "انقر 'إرسال الدعوات وإكمال الإعداد' — سيتمكن فريقك من الدخول فوراً", en: "Click 'Send Invitations & Complete Setup' — your team can log in immediately" },
    ],
  },
];
