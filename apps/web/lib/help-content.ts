export type FAQCategory =
  | "getting_started"
  | "sales_crm"
  | "property_management"
  | "marketplace"
  | "subscription"
  | "finance"
  | "zatca"
  | "security_privacy"
  | "account_notifications"
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
  { key: "marketplace", label: { ar: "السوق العقاري", en: "Marketplace" } },
  { key: "subscription", label: { ar: "الاشتراك والفوترة", en: "Subscription & Billing" } },
  { key: "finance", label: { ar: "المالية", en: "Finance" } },
  { key: "zatca", label: { ar: "الفوترة الإلكترونية (زاتكا)", en: "E-Invoicing (ZATCA)" } },
  { key: "security_privacy", label: { ar: "الأمان والخصوصية", en: "Security & Privacy" } },
  { key: "account_notifications", label: { ar: "الحساب والتنبيهات", en: "Account & Notifications" } },
  { key: "technical", label: { ar: "الدعم الفني", en: "Technical" } },
];

export const FAQ_ITEMS: FAQItem[] = [
  // Getting Started
  {
    id: "gs-1",
    question: { ar: "كيف أبدأ استخدام معمارك؟", en: "How do I get started with Mimarek?" },
    answer: { ar: "بعد تسجيل الدخول تنتقل إلى لوحة التحكم الرئيسية. ابدأ بإضافة العملاء من قسم CRM، ثم أضف العقارات والوحدات من قسم العقارات، وأنشئ الحجوزات والعقود.", en: "After you log in, you land on the main dashboard. Start by adding customers in the CRM section, then add properties and units in the Properties section, and create your reservations and contracts from there." },
    category: "getting_started",
  },
  {
    id: "gs-2",
    question: { ar: "ما هي الأدوار المتاحة في النظام؟", en: "What roles are available in the system?" },
    answer: { ar: "في معمارك سبعة أدوار داخل المنشأة: مدير (Admin) بكامل الصلاحيات التشغيلية، مدير عمليات (Manager) لإدارة العمليات، مسؤول تأجير (Leasing) للإيجارات وخط الإيجار، مسؤول مالي (Finance) للمدفوعات والتقارير المالية، وكيل (Agent) للمبيعات وخدمة العملاء، فني صيانة (Technician) للصيانة، ومستخدم (User) للاطلاع فقط. ويوجد دوران إضافيان مخصصان لطاقم منصة معمارك للدعم الداخلي. ولكل دور صلاحياته الخاصة.", en: "There are seven organization roles: Admin (full operational permissions), Manager (operations management), Leasing (rentals and the leasing pipeline), Finance (payments and financial reports), Agent (sales and customer service), Technician (maintenance), and User (read-only). Two more roles are reserved for Mimarek's own platform-support staff. Each role gets its own set of permissions." },
    category: "getting_started",
  },
  {
    id: "gs-3",
    question: { ar: "كيف أطلب صلاحيات إضافية؟", en: "How do I request additional permissions?" },
    answer: { ar: "اذهب إلى صفحة المساعدة > طلب الصلاحيات. اختر الدور الذي تريده واكتب سبب الطلب. يراجع المدير طلبك ثم يوافق عليه أو يرفضه.", en: "Go to Help > Request Permissions. Pick the role you want and write your reason. An admin reviews it and either approves or declines." },
    category: "getting_started",
  },
  // Sales & CRM
  {
    id: "sc-1",
    question: { ar: "كيف أضيف عميلاً جديداً؟", en: "How do I add a new customer?" },
    answer: { ar: "من قسم العملاء، انقر 'إضافة عميل' وأدخل بيانات العميل (الاسم، الهاتف، الهوية الوطنية). تُشفّر البيانات الشخصية تلقائياً.", en: "In the Customers section, click 'Add Customer' and enter the customer's name, phone, and national ID. The system encrypts personal data for you." },
    category: "sales_crm",
  },
  {
    id: "sc-2",
    question: { ar: "ما الفرق بين عرض كانبان وعرض القائمة؟", en: "What's the difference between Kanban and List view?" },
    answer: { ar: "عرض كانبان يوزّع العملاء على أعمدة حسب مرحلتهم في خط البيع (جديد، تم التواصل، مؤهل، معاينة، تفاوض). وعرض القائمة يعرضهم في جدول قابل للفرز والتصفية.", en: "Kanban view puts customers in columns by pipeline stage (New, Contacted, Qualified, Viewing, Negotiation). List view shows the same customers in a table you can sort and filter." },
    category: "sales_crm",
  },
  {
    id: "sc-3",
    question: { ar: "كيف أنشئ حجزاً لعميل؟", en: "How do I create a reservation for a customer?" },
    answer: { ar: "من قسم الحجوزات، انقر 'حجز جديد'. اختر العميل، ثم العقار والوحدة المناسبة، وأكمل خطوات المعالج لتأكيد الحجز. تتحول حالة الوحدة تلقائياً إلى 'محجوز'.", en: "In the Reservations section, click 'New Reservation'. Pick the customer, then the property and unit. Finish the wizard to confirm the reservation, and the unit status switches to 'Reserved' on its own." },
    category: "sales_crm",
  },
  // Property Management
  {
    id: "pm-1",
    question: { ar: "كيف أتابع حالة الوحدات؟", en: "How do I track unit status?" },
    answer: { ar: "يعرض قسم العقارات جميع الوحدات في شبكة بطاقات ملوّنة حسب الحالة (متاح، محجوز، مباع، مؤجر، صيانة). انقر زر التفاصيل على أي وحدة لفتح لوحة جانبية تعرض: النوع، الحالة، المساحة، أسعار التكلفة والبيع والإيجار، الملخص المالي (إيجار محصّل، إيراد البيع، تكاليف الصيانة، صافي الدخل)، العقد المرتبط (إن وُجد)، وطلبات الصيانة. وتتحدث حالة الوحدة تلقائياً عند توقيع العقود أو إلغائها.", en: "The Properties section shows all units as cards, color-coded by status (Available, Reserved, Sold, Rented, Maintenance). Click the detail button on a unit to open a side panel with its type, status, area, cost/selling/rental prices, financial summary (rent collected, sale revenue, maintenance costs, net income), linked contract if there is one, and maintenance requests. Unit status updates on its own when a contract is signed or cancelled." },
    category: "property_management",
  },
  {
    id: "pm-2",
    question: { ar: "كيف أقدم طلب صيانة؟", en: "How do I submit a maintenance request?" },
    answer: { ar: "من قسم الصيانة، انقر 'طلب جديد'. حدد الوحدة والفئة (كهرباء، سباكة، تكييف...) والأولوية، ثم اكتب وصف المشكلة.", en: "In Maintenance, click 'New Request'. Pick the unit, category (electrical, plumbing, HVAC...), and priority, then describe the issue." },
    category: "property_management",
  },
  {
    id: "pm-3",
    question: { ar: "ما هي الصيانة الوقائية؟", en: "What is preventive maintenance?" },
    answer: { ar: "الصيانة الوقائية هي جدولة أعمال صيانة دورية (يومية، أسبوعية، شهرية، سنوية) لمنع الأعطال قبل وقوعها. وتُنشأ أوامر العمل تلقائياً حسب الجدول.", en: "Preventive maintenance schedules recurring work (daily, weekly, monthly, annual) so problems get caught before something breaks. The system creates the work orders for you on each schedule." },
    category: "property_management",
  },
  // Finance
  {
    id: "fi-1",
    question: { ar: "كيف أتابع الأقساط المستحقة؟", en: "How do I track due installments?" },
    answer: { ar: "يعرض قسم المدفوعات جميع الأقساط مع حالتها (مدفوع، مدفوع جزئياً، غير مدفوع، متأخر)، وتسجّل الدفعات من المكان نفسه. وعند إنشاء عقد إيجار متوافق مع إيجار من قسم العقود، يُنشأ جدول الأقساط تلقائياً حسب دورية الدفع المحددة (شهري، ربع سنوي، نصف سنوي، سنوي) ويُربط بالعقد.", en: "The Payments section lists every installment with its status (Paid, Partially Paid, Unpaid, Overdue), and you can record payments right there. When you create an Ejar-compliant lease contract in the Contracts section, the system builds the installment schedule from the payment frequency you set (monthly, quarterly, semi-annual, annual) and links it to the contract." },
    category: "finance",
  },
  {
    id: "fi-8",
    question: { ar: "كيف أتابع الملخص المالي للوحدة؟", en: "How do I view the financial summary for a unit?" },
    answer: { ar: "من قسم العقارات، افتح تفاصيل أي وحدة. يعرض قسم 'الملخص المالي' أربعة مؤشرات: إيجار محصّل (إجمالي الأقساط المدفوعة)، إيراد البيع (مبالغ عقود البيع الموقّعة)، تكاليف الصيانة (التكلفة الفعلية أو المقدّرة لطلبات الصيانة)، وصافي الدخل (الإيرادات ناقص التكاليف). وتُحسب هذه المؤشرات تلقائياً من بيانات العقود والإيجارات والصيانة.", en: "Open any unit's details from the Properties section. The 'Financial Summary' section shows four KPIs: Rent Collected (total paid installments), Sale Revenue (signed sale contract amounts), Maintenance Costs (actual or estimated maintenance request costs), and Net Income (revenue minus costs). The system calculates these from your contracts, leases, and maintenance data." },
    category: "finance",
  },
  {
    id: "fi-2",
    question: { ar: "هل النظام متوافق مع متطلبات هيئة الزكاة والضريبة (ZATCA)؟", en: "Is the system ZATCA compliant?" },
    answer: { ar: "نعم، يحسب معمارك ضريبة القيمة المضافة (15%) وفق متطلبات هيئة الزكاة والضريبة والجمارك. والفوترة الإلكترونية قيد التطوير.", en: "Yes. Mimarek calculates VAT (15%) per ZATCA requirements. E-invoicing integration is still under development." },
    category: "finance",
  },
  {
    id: "fi-3",
    question: { ar: "كيف أصدر تقارير مالية؟", en: "How do I generate financial reports?" },
    answer: { ar: "من قسم التقارير، اختر نوع التقرير (الإيرادات، الإشغال، تحصيل الإيجارات، الصيانة، تكاليف الصيانة) وحدد نطاق التاريخ، ثم صدّره بصيغة Excel أو PDF.", en: "In Reports, pick the report type (Revenue, Occupancy, Rent Collection, Maintenance, Maintenance Costs) and a date range, then export as Excel or PDF." },
    category: "finance",
  },
  // Security & Privacy
  {
    id: "sp-1",
    question: { ar: "كيف يتم حماية بيانات العملاء الشخصية؟", en: "How is customer personal data protected?" },
    answer: { ar: "تُشفّر البيانات الشخصية (الهوية الوطنية، الهاتف، البريد الإلكتروني) بتقنية AES-256-GCM، ولا يطّلع على البيانات الكاملة إلا المستخدمون المصرّح لهم.", en: "Personal data (national ID, phone, email) is encrypted with AES-256-GCM. Only authorized users can see it in full." },
    category: "security_privacy",
  },
  {
    id: "sp-4",
    question: { ar: "كيف يعمل نظام الصلاحيات للعقود؟", en: "How does the contract permissions system work?" },
    answer: { ar: "يفصل معمارك بين عمليات العقود التقدمية والتدميرية. العمليات التقدمية (إنشاء، إرسال، توقيع) تحتاج صلاحية 'contracts:write' المتاحة للمدير (Admin) ومدير العمليات (Manager) والوكيل (Agent). والعمليات التدميرية (إلغاء، إبطال، حذف) تحتاج صلاحية 'contracts:delete' المتاحة للمدير (Admin) فقط. والحذف لا يكون إلا للعقود في حالة 'مسودة'.", en: "Mimarek splits contract actions into progressive and destructive ones. Progressive actions (create, send, sign) need 'contracts:write', which Admin, Manager, and Agent roles have. Destructive actions (cancel, void, delete) need 'contracts:delete', which only Admin has. You can only delete a contract while it's still a Draft." },
    category: "security_privacy",
  },
  {
    id: "sp-2",
    question: { ar: "ما هي سياسة كلمة المرور؟", en: "What is the password policy?" },
    answer: { ar: "يجب ألا تقل كلمة المرور عن 10 أحرف، وألا تحتوي على اسمك أو بريدك الإلكتروني، وألا تكون من كلمات المرور الشائعة.", en: "Your password must be at least 10 characters. It can't contain your name or email, and it can't be one of the common passwords on the blocklist." },
    category: "security_privacy",
  },
  {
    id: "sp-3",
    question: { ar: "هل يمكنني مراجعة سجل النشاطات؟", en: "Can I review the activity log?" },
    answer: { ar: "نعم، يصل المديرون إلى سجل التدقيق من الإعدادات > سجل التدقيق، حيث تُسجَّل كل عمليات الاطلاع والتعديل والتصدير.", en: "Yes. Admins can open the audit trail from Settings > Audit Log. Every access, edit, and export is recorded there." },
    category: "security_privacy",
  },
  // Technical
  {
    id: "te-1",
    question: { ar: "كيف أغير كلمة المرور؟", en: "How do I change my password?" },
    answer: { ar: "اذهب إلى الإعدادات > الأمان، وأدخل كلمة المرور الحالية ثم الجديدة. ويجب أن تستوفي الكلمة الجديدة سياسة الأمان.", en: "Go to Settings > Security and enter your current password, then the new one. The new password has to meet the security policy." },
    category: "technical",
  },
  {
    id: "te-2",
    question: { ar: "هل يدعم النظام اللغة العربية والإنجليزية؟", en: "Does the system support Arabic and English?" },
    answer: { ar: "نعم، يعمل معمارك بالعربية والإنجليزية مع تخطيط RTL/LTR كامل. غيّر اللغة من الشريط العلوي.", en: "Yes. Mimarek runs in both Arabic and English with full RTL/LTR layout. Switch the language from the top bar." },
    category: "technical",
  },
  {
    id: "te-3",
    question: { ar: "هل يدعم النظام التاريخ الهجري؟", en: "Does the system support Hijri dates?" },
    answer: { ar: "نعم، يعرض معمارك التاريخ الهجري والميلادي معاً في كل الأقسام.", en: "Yes. The system shows both Hijri and Gregorian dates everywhere." },
    category: "technical",
  },
  // Document Vault
  {
    id: "pm-6",
    question: { ar: "كيف أرفع وأدير المستندات؟", en: "How do I upload and manage documents?" },
    answer: { ar: "من قسم المستندات، انقر 'رفع مستند' لرفع ملفات PDF أو صور أو مستندات نصية. تختار لكل مستند فئته عند الرفع — عام، قانوني، عقود، تسويق، أو مالي — وبعدها تبحث بالاسم وتصفّي القائمة حسب الفئة وتحمّل أي مستند.", en: "In the Documents section, click 'Upload Document' to upload PDFs, images, or text files. You pick each document's category as you upload it (General, Legal, Contract, Marketing, or Finance). From there you can search by name, filter the list by category, and download any document." },
    category: "property_management",
  },
  // Subscription & Billing
  {
    id: "fi-4",
    question: { ar: "كيف أدير اشتراكي؟", en: "How do I manage my subscription?" },
    answer: { ar: "يعرض قسم الفوترة خطتك الحالية وحالتها (تجريبي، نشط، متأخر، ملغي)، ودورة الفوترة (شهري، ربع سنوي، نصف سنوي، سنوي)، وتاريخ الفاتورة التالية، وطرق الدفع المحفوظة. انقر 'تغيير الخطة' لاستعراض الخطط المتاحة والمقارنة بينها.", en: "The Billing section shows your current plan and its status (trialing, active, past due, canceled), your billing cycle (monthly, quarterly, semi-annual, annual), the next billing date, and any saved payment methods. Click 'Change Plan' to browse and compare what's available." },
    category: "subscription",
  },
  {
    id: "sub-1",
    question: { ar: "ما الفرق بين الخطط وما الذي تتضمنه كل خطة؟", en: "What's the difference between the plans, and what does each include?" },
    answer: { ar: "تحدد خطتك ما يمكنك الوصول إليه وحدوده. تتدرّج الخطط (المبتدئ، الاحترافي، المؤسسات) في الحدود (عدد المستخدمين، الوحدات، العملاء، إعلانات السوق) وفي الميزات المتاحة (مثل المالية، الصيانة، النشر في السوق، الفوترة الإلكترونية المتقدمة). افتح الفوترة > الخطط لمقارنة الخطط واختيار ما يناسب منشأتك.", en: "Your plan determines what you can access and your limits. Plans (Starter, Professional, Enterprise) step up in limits (users, units, customers, marketplace listings) and in available features (such as Finance, Maintenance, marketplace publishing, advanced e-invoicing). Open Billing > Plans to compare plans and pick what fits your organization." },
    category: "subscription",
  },
  {
    id: "sub-2",
    question: { ar: "لماذا تظهر لي رسالة 'الميزة غير متاحة في خطتك' أو 'قم بالترقية'؟", en: "Why do I see a 'feature not in your plan' or 'upgrade your plan' message?" },
    answer: { ar: "هذا يعني أن خطتك الحالية لا تتضمّن تلك الميزة. ترقية الخطة تفتحها فوراً. انقر 'ترقية الخطة' في الرسالة، أو اذهب إلى الفوترة > الخطط لاختيار خطة أعلى. وبعض الميزات يمكن فتحها أيضاً عبر إضافة (انظر سؤال الإضافات).", en: "It means your current plan doesn't include that feature. Upgrading your plan unlocks it immediately. Click 'Upgrade plan' on the message, or go to Billing > Plans to choose a higher plan. Some features can also be unlocked with an add-on (see the add-ons question)." },
    category: "subscription",
  },
  {
    id: "sub-3",
    question: { ar: "كيف تعمل حدود الاستخدام، وأين أرى استهلاكي؟", en: "How do usage limits work, and where do I see my usage?" },
    answer: { ar: "بعض الموارد (المستخدمون، الوحدات، العملاء، إعلانات السوق) لها حد أقصى حسب خطتك. تعرض صفحة الفوترة مقياس 'الاستخدام مقابل خطتك' لكل مورد: يتحول إلى البرتقالي عند بلوغ 80% وإلى الأحمر عند 100%. وعند بلوغ الحد لن تتمكن من إضافة المزيد حتى ترفع الحد (بترقية الخطة أو شراء إضافة).", en: "Some resources (users, units, customers, marketplace listings) have a maximum based on your plan. The Billing page shows a 'Usage vs. your plan' meter for each: it turns orange at 80% and red at 100%. When you hit the limit you can't add more until you raise it — by upgrading your plan or buying an add-on." },
    category: "subscription",
  },
  {
    id: "sub-4",
    question: { ar: "ما هي الإضافات وكيف أشتريها أو ألغيها؟", en: "What are add-ons, and how do I buy or cancel them?" },
    answer: { ar: "الإضافات تعزّز خطتك دون تغييرها: ترفع حداً معيناً (مثل +50 وحدة أو +5 مستخدمين) أو تفتح ميزة. افتح الفوترة > الإضافات لاستعراض المتاح لخطتك، ثم انقر 'شراء'. يسري الأثر فوراً ويظهر في مقاييس الاستخدام، ويمكنك الإلغاء في أي وقت فيعود الحد إلى وضعه السابق.", en: "Add-ons boost your plan without changing it: they raise a specific limit (e.g. +50 units or +5 users) or unlock a feature. Open Billing > Add-ons to see what's available for your plan, then click 'Purchase'. It takes effect immediately and shows in your usage meters, and you can cancel anytime — the limit then reverts." },
    category: "subscription",
  },
  {
    id: "fi-5",
    question: { ar: "كيف أستخدم كود الخصم (كوبون)؟", en: "How do I apply a coupon code?" },
    answer: { ar: "من صفحة الخطط (الفوترة > الخطط)، أدخل كود الخصم في حقل الكوبون وانقر 'تطبيق'. إذا كان الكود صالحاً، ظهر الخصم (نسبة مئوية أو مبلغ ثابت) على أسعار الخطط: السعر الأصلي مشطوباً، والسعر الجديد باللون الأخضر، ومبلغ التوفير.", en: "On the Plans page (Billing > Plans), type the discount code in the coupon field and click 'Apply'. If the code works, the discount (percentage or fixed amount) shows up on plan prices: the original price is crossed out, the new price is in green, and you see how much you save." },
    category: "subscription",
  },
  {
    id: "fi-6",
    question: { ar: "ماذا يحدث عند تأخر سداد الاشتراك؟", en: "What happens when my subscription payment is overdue?" },
    answer: { ar: "عند تأخر السداد، تتحول حالة اشتراكك إلى 'متأخر' ويظهر شريط تنبيه في صفحة الفوترة. ولديك فترة سماح لتسوية الدفع قبل تعليق الخدمة — تواصل مع الدعم لتسوية دفعتك. وتجد فواتيرك ومبالغها في صفحة الفواتير.", en: "When a payment is overdue, your subscription status changes to 'Past Due' and a warning banner appears on the Billing page. You get a grace period to resolve it before the service is suspended — contact support to settle your payment. You can check your invoices and their amounts on the Invoices page." },
    category: "subscription",
  },
  {
    id: "fi-7",
    question: { ar: "كيف أتابع مدفوعات الإيجار؟", en: "How do I track and record rental payments?" },
    answer: { ar: "يبدأ قسم المدفوعات بثلاثة مؤشرات: المُحصَّل هذا الشهر، وإجمالي المتأخرات، والمتوقع خلال 30 يوماً. ويعرض الجدول كل قسط مع اسم المستأجر ورقم الوحدة والمبلغ وتاريخ الاستحقاق والحالة. انقر 'تسجيل دفعة' على أي قسط غير مدفوع لتسجيل التحصيل. وتُحدَّث الأقساط المتأخرة تلقائياً.", en: "The Payments section opens with three KPIs: Collected This Month, Total Overdue, and Expected Next 30 Days. The table lists each installment with the tenant name, unit number, amount, due date, and status. To record a collection, click 'Record Payment' on any unpaid installment. The system marks overdue installments for you." },
    category: "finance",
  },
  // Sales Contracts & Ejar Compliance
  {
    id: "sc-4",
    question: { ar: "كيف أتابع عقود المبيعات؟", en: "How do I track sales contracts?" },
    answer: { ar: "يعرض قسم العقود جدولاً بجميع العقود مع بيانات العميل (الاسم والهاتف)، والوحدة (الرقم والمبنى)، ونوع العقد (بيع أو إيجار)، والمبلغ بالريال، والتاريخ بالهجري والميلادي، والحالة. وتُصفّى العقود حسب الحالة: مسودة، مُرسل، موقّع، ملغي. ولكل عقد رقم فريد تلقائي يبدأ برمز خاص بمنشأتك (مثل ABC1-SALE-2026-0001 أو ABC1-LEASE-2026-0001). انقر 'عرض' لفتح تفاصيل أي عقد.", en: "The Contracts section lists every contract in a table with customer info (name and phone), unit (number and building), contract type (sale or lease), amount in SAR, date in Hijri and Gregorian, and status. You can filter by status: Draft, Sent, Signed, Canceled. Each contract gets its own number, prefixed with a short code for your organization (e.g., ABC1-SALE-2026-0001 or ABC1-LEASE-2026-0001). Click 'View' to open a contract's details." },
    category: "sales_crm",
  },
  {
    id: "sc-5",
    question: { ar: "ما هو نظام إيجار وكيف يتوافق معمارك معه؟", en: "What is Ejar and how does Mimarek comply with it?" },
    answer: { ar: "إيجار هو النظام الإلكتروني لعقود الإيجار في المملكة العربية السعودية. وعند إنشاء عقد إيجار يلتزم معمارك بمتطلبات إيجار: تاريخ البدء والانتهاء (إلزامي)، ودورية الدفع (شهري، ربع سنوي، نصف سنوي، سنوي)، ومبلغ الضمان (بحد أقصى 5% من قيمة العقد)، والتجديد التلقائي (يُفعّل تلقائياً للعقود التي تزيد على 3 أشهر)، ومسؤولية الصيانة (المؤجر أو المستأجر)، وفترة الإشعار (60 يوماً افتراضياً). ثم يُنشئ جدول الأقساط تلقائياً ويربطه بالعقد.", en: "Ejar is Saudi Arabia's electronic rental contract system. When you create a lease contract, Mimarek follows the Ejar rules: start and end dates (mandatory), payment frequency (monthly, quarterly, semi-annual, annual), security deposit (maximum 5% of contract value), auto-renewal (turned on automatically for leases over 3 months), maintenance responsibility (landlord or tenant), and notice period (60 days default). The system then builds an installment schedule and links it to the contract." },
    category: "sales_crm",
  },
  {
    id: "sc-7",
    question: { ar: "ما هي دورة حياة العقد في معمارك؟", en: "What is the contract lifecycle in Mimarek?" },
    answer: { ar: "يمر العقد بثلاث حالات رئيسية: مسودة ← مُرسل ← موقّع، ويمكن إلغاؤه أو إبطاله. المسودة تُرسل أو تُلغى أو تُحذف. والمُرسل يُوقّع أو يُلغى. والموقّع يُبطل فقط (ويتطلب صلاحية Admin). وعند التوقيع: عقد البيع يحوّل الوحدة إلى 'مباع' وتنتقل الصفقة المرتبطة إلى 'مكسوبة'؛ وعقد الإيجار يحوّل الوحدة إلى 'مؤجر' والعميل إلى 'مستأجر نشط' ويفعّل جدول الأقساط. وعند الإلغاء أو الإبطال: تعود الوحدة إلى 'متاح' ويُنهى عقد الإيجار المرتبط (إن وُجد).", en: "A contract moves through three main states, Draft → Sent → Signed, and can also be Cancelled or Voided. A Draft can be sent, cancelled, or deleted. A Sent contract can be signed or cancelled. A Signed contract can only be voided (which requires Admin permission). When you sign a Sale contract, the unit becomes 'Sold' and the linked deal moves to 'Won'. When you sign a Lease contract, the unit becomes 'Rented', the customer becomes an 'Active Tenant', and the installment schedule goes live. If you cancel or void, the unit goes back to 'Available' and the linked lease, if there is one, is terminated." },
    category: "sales_crm",
  },
  {
    id: "sc-8",
    question: { ar: "كيف أنشئ عقد إيجار متوافق مع إيجار؟", en: "How do I create an Ejar-compliant lease contract?" },
    answer: { ar: "من قسم العقود، انقر 'عقد جديد' واختر نوع 'إيجار'. تظهر حينها حقول إيجار: تاريخ البداية والنهاية، ودورية الدفع (شهري/ربع سنوي/نصف سنوي/سنوي)، ومبلغ الضمان (لا يتجاوز 5%)، والتجديد التلقائي، ومسؤولية الصيانة، والملاحظات. وعند الحفظ يُنشأ تلقائياً: عقد إيجار برقم فريد، وجدول أقساط حسب الدورية، وعقد إيجار مربوط بجدول الأقساط.", en: "In the Contracts section, click 'New Contract' and choose the 'Lease' type. The Ejar fields then appear: start and end dates, payment frequency (monthly/quarterly/semi-annual/annual), security deposit (max 5%), auto-renewal, maintenance responsibility, and notes. When you save, the system creates a contract with its own number, an installment schedule based on the frequency, and a linked lease record tied to that schedule." },
    category: "sales_crm",
  },
  {
    id: "sc-10",
    question: { ar: "من يمكنه إلغاء أو إبطال أو حذف العقود؟", en: "Who can cancel, void, or delete contracts?" },
    answer: { ar: "العمليات التدميرية (إلغاء، إبطال، حذف) تحتاج صلاحية 'contracts:delete' المتاحة للمدير (Admin) فقط. والعمليات التقدمية (إنشاء، إرسال، توقيع) تحتاج صلاحية 'contracts:write' المتاحة للمدير (Admin) ومدير العمليات (Manager) والوكيل (Agent) — أي أن مدير العمليات والوكيل ينشئان العقود ويرسلانها ويوقّعانها دون إلغائها أو إبطالها أو حذفها. والحذف لا يكون إلا للعقود في حالة 'مسودة'.", en: "Destructive operations (cancel, void, delete) need 'contracts:delete' permission, which only Admin has. Progressive operations (create, send, sign) need 'contracts:write', which Admin, Manager, and Agent have. So Manager and Agent can create, send, and sign contracts, but they can't cancel, void, or delete them. Deletion only works on 'Draft' contracts." },
    category: "sales_crm",
  },
  {
    id: "sc-11",
    question: { ar: "كيف أرى العقد المرتبط بوحدة؟", en: "How do I see the contract linked to a unit?" },
    answer: { ar: "من قسم العقارات، انقر زر التفاصيل لأي وحدة مباعة أو مؤجرة. تجد في لوحة التفاصيل قسم 'العقد المرتبط' الذي يعرض: نوع العقد (بيع/إيجار)، والحالة (مسودة/مُرسل/موقّع)، واسم العميل، ورقم العقد، وزر 'عرض العقد' للانتقال مباشرة إلى تفاصيل العقد.", en: "In the Properties section, click the detail button on any sold or rented unit. The detail panel has a 'Linked Contract' section that shows the contract type (sale/lease), status (draft/sent/signed), customer name, and contract number, plus a 'View Contract' button that takes you straight to the contract details." },
    category: "sales_crm",
  },
  {
    id: "sc-12",
    question: { ar: "كيف أعرض تفاصيل عقد الإيجار (شروط إيجار)؟", en: "How do I view lease contract details (Ejar terms)?" },
    answer: { ar: "صفحة تفاصيل عقد الإيجار مكوّنة من خمسة أقسام: الأول — بيانات الأطراف (المؤجر والمستأجر)، والثاني — بيانات الوحدة، والثالث — القيمة المالية، والرابع — شروط الإيجار (الفترة، ودورية الدفع، ومبلغ الضمان، والتجديد التلقائي، ومسؤولية الصيانة، وفترة الإشعار)، والخامس — جدول الأقساط (رقم القسط، وتاريخ الاستحقاق، والمبلغ، والحالة).", en: "The contract detail page for a lease has five sections. Section 1 covers the parties (landlord and tenant), Section 2 the unit details, Section 3 the financial value, Section 4 the lease terms (period, payment frequency, security deposit, auto-renewal, maintenance responsibility, notice period), and Section 5 the payment schedule (installment number, due date, amount, status)." },
    category: "sales_crm",
  },
  {
    id: "sc-13",
    question: { ar: "كيف أعرض تفاصيل عقد البيع؟", en: "How do I view sale contract details?" },
    answer: { ar: "صفحة تفاصيل عقد البيع مكوّنة من أربعة أقسام: الأول — بيانات الأطراف (البائع والمشتري)، والثاني — بيانات الوحدة، والثالث — القيمة المالية، والرابع — شروط البيع (تاريخ التسليم والملاحظات). ويعرض الشريط الجانبي رقم العقد والقيمة والحالة.", en: "The contract detail page for a sale has four sections. Section 1 covers the parties (seller and buyer), Section 2 the unit details, Section 3 the financial value, and Section 4 the sale terms (delivery date and notes). The sidebar shows the contract number, value, and status." },
    category: "sales_crm",
  },
  // Onboarding / Getting Started
  {
    id: "gs-4",
    question: { ar: "كيف أُعدّ حسابي ومنشأتي في معمارك؟", en: "How do I set up my account and organization in Mimarek?" },
    answer: { ar: "عند أول تسجيل دخول يظهر معالج الإعداد المكوّن من 4 خطوات: (1) الانضمام لشركة قائمة أو المتابعة بشكل مستقل، (2) بيانات المنشأة (الاسم بالعربية والإنجليزية، السجل التجاري، الرقم الضريبي، نوع الكيان والشكل القانوني)، (3) بيانات التواصل (الجوال، المدينة، المنطقة)، (4) دعوة أعضاء الفريق عبر البريد الإلكتروني مع تحديد أدوارهم. ويمكنك تخطي أي خطوة والعودة لإكمالها لاحقاً.", en: "The first time you log in, a 4-step setup wizard walks you through it: (1) join an existing company or continue independently, (2) organization details (Arabic and English names, CR number, VAT number, entity type, legal form), (3) contact information (mobile, city, region), and (4) inviting team members by email and assigning their roles. You can skip any step and come back to it later." },
    category: "getting_started",
  },
  {
    id: "gs-5",
    question: { ar: "كيف أنضم لشركة قائمة في معمارك؟", en: "How do I join an existing company in Mimarek?" },
    answer: { ar: "في الخطوة الأولى من الإعداد، اختر 'انضم لشركة'. أدخل رقم السجل التجاري المكوّن من 10 خانات وانقر 'بحث'. إذا وُجدت الشركة ظهرت بياناتها وأمكنك إرسال طلب انضمام، ثم يراجعه مدير الشركة ويوافق عليه.", en: "In the first setup step, choose 'Join a Company'. Type the 10-digit CR number and click 'Search'. If we find the company, its details show up and you can send a join request. The company admin then reviews and approves it." },
    category: "getting_started",
  },
  // Platform Administration
  {
    id: "te-4",
    question: { ar: "ما هي أدوات إدارة المنصة (للمسؤولين)؟", en: "What are the platform administration tools (for admins)?" },
    answer: { ar: "تتيح لوحة الإدارة للمسؤولين: إدارة خطط الاشتراك (إنشاء وتعديل الخطط والأسعار والميزات)، ومتابعة جميع الاشتراكات (نشط، تجريبي، متأخر، ملغي) مع إحصائيات شاملة، وإنشاء الكوبونات وإدارتها (كود الخصم، والنسبة أو المبلغ، والحد الأقصى للاستخدام، والصلاحية)، وعرض جميع الفواتير والمدفوعات عبر المنصة مع إجمالي الإيرادات.", en: "The Admin panel lets administrators manage subscription plans (create and edit plans, pricing, and features), watch all subscriptions (active, trialing, past due, canceled) with full stats, set up and manage coupons (discount codes, percentage or fixed amount, max redemptions, validity), and see every invoice and payment across the platform along with total revenue." },
    category: "technical",
  },
  // Marketplace
  {
    id: "mk-1",
    question: { ar: "كيف أتصفح العقارات وأرسل استفساراً في السوق العقاري؟", en: "How do I browse properties and send an inquiry on the Marketplace?" },
    answer: { ar: "افتح السوق العقاري وابقَ على تبويب 'تصفّح الإعلانات'. صفِّ النتائج حسب المدينة أو الحي أو نوع العقار أو السعر أو المساحة أو البائع. افتح أي إعلان لعرض تفاصيله، ثم انقر 'إبداء الاهتمام' وأدخل رقم جوال سعودي (إلزامي) مع اسم ورسالة اختياريين. يصل إشعار للبائع فيتواصل معك. وتابع استفساراتك من تبويب 'استفساراتي'، حيث يمكنك سحب أي استفسار مفتوح.", en: "Open the Marketplace and stay on the Browse Listings tab. Filter by city, district, property type, price, area, or seller. Open a listing to see its full details, then click 'Express Interest' and enter a Saudi mobile number (required), plus a name and message if you like. The seller gets notified and reaches out to you. To keep track, use the My Inquiries tab, where you can also withdraw any open inquiry." },
    category: "marketplace",
  },
  {
    id: "mk-2",
    question: { ar: "كيف أعرض وحدة للبيع في السوق العقاري؟", en: "How do I list a unit for sale on the Marketplace?" },
    answer: { ar: "ابدأ من وحدة في مخزونك وأنشئ لها إعلاناً في السوق — على أن تكون الوحدة متاحة، ولها مدينة وحي، وبدون عقد إيجار أو حجز أو إعلان قائم. يُنشأ الإعلان كـ'مسودة'. ومن السوق العقاري ← إعلاناتي، عدّل المسودة لإضافة العنوان والسعر والعنوان الوطني المختصر (4 أحرف + 4 أرقام، مثل RRRA2929)؛ وبإمكانك إضافة وصف ورقم رخصة إعلان وعمر المبنى. ثم انشر الإعلان ليظهر لجميع المنشآت.", en: "Start from a unit in your inventory and create a marketplace listing. The unit has to be Available, have a city and district, and have no active lease, reservation, or existing listing. That creates a Draft. In Marketplace → My Listings, edit the draft to set a title, price, and a National Address code (4 letters + 4 digits, e.g. RRRA2929); you can also add a description, ad license number, and building age. Then publish it so all organizations can see it." },
    category: "marketplace",
  },
  {
    id: "mk-3",
    question: { ar: "ماذا يحدث بعد أن يُبدي مشترٍ اهتمامه بإعلاني؟", en: "What happens after a buyer expresses interest in my listing?" },
    answer: { ar: "تظهر الاستفسارات الواردة أسفل إعلانك في 'إعلاناتي'. انقر 'تحويل لصفقة' لقبول استفسار — فيحجز ذلك الوحدة وينشئ حجزاً مبدئياً بين المنشأتين. وبعد توقيع عقد بيع للوحدة، انقر 'تسوية ونقل' لإتمام النقل: تُعلَّم الوحدة 'مباع' وتُضاف نسخة منها إلى مخزون المشتري. التسوية لا يمكن التراجع عنها، لذا تأكد من توقيع العقد أولاً.", en: "Incoming inquiries show up under your listing in My Listings. Click 'Convert to Deal' to accept one. That reserves the unit and creates a preliminary cross-organization reservation. Once the unit has a signed sale contract, click 'Settle & Transfer' to finish the handover: the unit is marked Sold and a copy lands in the buyer's inventory. You can't undo a settlement, so make sure the contract is signed first." },
    category: "marketplace",
  },
  {
    id: "mk-4",
    question: { ar: "من يمكنه استخدام السوق العقاري؟", en: "Who can use the Marketplace?" },
    answer: { ar: "المدير (Admin) ومدير العمليات (Manager) لهما كل الصلاحيات — التصفح ونشر الإعلانات وتحويل الاستفسارات حتى النقل. والوكيل (Agent) ومسؤول التأجير (Leasing) يتصفحان الإعلانات ويرسلان الاستفسارات. أما المسؤول المالي (Finance) والمستخدم (User) فلا صلاحية لهما للوصول إلى السوق العقاري.", en: "Admin and Manager can do everything: browse, publish listings, and take inquiries all the way through to transfer. Agent and Leasing can browse listings and send inquiries. The Finance and User roles don't have Marketplace access." },
    category: "marketplace",
  },
  // Account & Notifications
  {
    id: "an-1",
    question: { ar: "كيف تعمل التنبيهات (الإشعارات)؟", en: "How do notifications work?" },
    answer: { ar: "انقر أيقونة الجرس في الشريط العلوي (تظهر كلوحة سفلية على الجوال) لفتح إشعاراتك. وهي تغطي الفوترة والعقود والصيانة والتذاكر وتحديثات المنصة، وتُصفّى حسب: تنبيهات، أو تذكيرات، أو تحديثات. ويظهر عدد غير المقروء على الجرس؛ انقر أي إشعار لتعليمه مقروءاً والانتقال إلى العنصر المرتبط، أو استخدم 'تحديد الكل كمقروء'.", en: "Click the bell icon in the top bar (it opens as a bottom sheet on mobile) to see your notifications. They cover billing, contracts, maintenance, tickets, and platform updates, and you can filter them by Alerts, Reminders, or Updates. The bell shows an unread count; click a notification to mark it read and jump to the related item, or use 'Mark all read'." },
    category: "account_notifications",
  },
  {
    id: "an-2",
    question: { ar: "كيف أبحث بسرعة في معمارك؟", en: "How do I search quickly across Mimarek?" },
    answer: { ar: "اضغط Cmd+K (ماك) أو Ctrl+K (ويندوز) لفتح لوحة الأوامر — تعرض إجراءات سريعة (عميل جديد، عقد جديد…) وكل صفحة يمكنك الوصول إليها. ويبحث مربع البحث في الشريط العلوي عن العملاء والوحدات والعقود بالاسم أو الرقم أثناء الكتابة (بحرفين على الأقل). وعلى الجوال، انقر أيقونة البحث.", en: "Press Cmd+K (Mac) or Ctrl+K (Windows) to open the command palette. It lists quick actions (New customer, New contract…) and every page you can reach. The search box in the top bar finds customers, units, and contracts by name or number as you type (two characters minimum). On mobile, tap the search icon." },
    category: "account_notifications",
  },
  {
    id: "an-3",
    question: { ar: "أي لوحة تحكم سأرى حسب دوري؟", en: "Which dashboard will I see for my role?" },
    answer: { ar: "لوحتك تتبع دورك. فالمدير ومدير العمليات والمالك يرون اللوحة الرئيسية (المؤشر الأساسي: الإيرادات). ومسؤول التأجير والوكيل يريان لوحة التأجير (العقود الموقّعة). والمسؤول المالي يرى لوحة المالية (نسبة التحصيل). والفنيون يرون لوحة الصيانة (الطلبات المفتوحة). وتعرض كل لوحة المؤشرات والرسوم المناسبة لذلك الدور.", en: "Your dashboard depends on your role. Admin, Manager, and Owner see the main dashboard (North Star: Revenue). Leasing and Agent see the Leasing dashboard (Leases Signed). Finance sees the Finance dashboard (Collection Rate). Technicians see the Maintenance dashboard (Open Tickets). Each one shows the KPIs and charts that matter for that role." },
    category: "account_notifications",
  },
  // Security & Privacy — PII visibility
  {
    id: "sp-5",
    question: { ar: "من يمكنه رؤية البيانات الشخصية الكاملة للعملاء؟", en: "Who can see customers' full personal data?" },
    answer: { ar: "لا يرى البيانات الشخصية الكاملة (الهوية الوطنية، الهاتف، البريد) إلا أدوار المدير (Admin) ومدير العمليات (Manager) ومسؤول التأجير (Leasing). أما الوكيل (Agent) والمسؤول المالي (Finance) فيرونها مُقنّعة — تظهر الهوية والهاتف بآخر 4 أرقام فقط (مثل ‎***6789) ويظهر البريد بأول حرف فقط. وفي كل مرة يُطّلع فيها على البيانات الكاملة، يُسجَّل ذلك في سجل التدقيق كحدث READ_PII.", en: "Only the Admin, Manager, and Leasing roles see full personal data (national ID, phone, email). Agent and Finance see it masked: national IDs and phones show only the last 4 digits (e.g. ***6789) and emails show just the first character. Every time someone views full personal data, the audit log records it as a READ_PII event." },
    category: "security_privacy",
  },
  // Settings overview
  {
    id: "te-5",
    question: { ar: "ماذا يمكنني إدارته من الإعدادات؟", en: "What can I manage in Settings?" },
    answer: { ar: "تضم الإعدادات أربعة أقسام: المنشأة (اسم منشأتك، والسجل التجاري، والرقم الضريبي، وبيانات التواصل، والعنوان الوطني، والصفحة الافتتاحية الافتراضية)، والفريق (دعوة الأعضاء وتعيين الأدوار)، والأمان (تغيير كلمة المرور)، وسجل التدقيق (سجل بكل عملية — إنشاء، واطلاع، وتعديل، وحذف، ووصول للبيانات الشخصية، وتسجيل دخول — قابل للتصفية حسب العملية والمورد، ومتاح للمديرين).", en: "Settings has four areas: Organization (your org's name, commercial registration, VAT, contact details, national address, and default landing page), Team (invite members and assign roles), Security (change your password), and Audit Trail (a log of every action: create, view, update, delete, PII access, and login, filterable by action and resource, available to admins)." },
    category: "technical",
  },
  // E-Invoicing (ZATCA)
  {
    id: "za-1",
    question: { ar: "ما هي الفوترة الإلكترونية من هيئة الزكاة والضريبة؟", en: "What is ZATCA e-invoicing?" },
    answer: { ar: "الفوترة الإلكترونية نظام تفرضه هيئة الزكاة والضريبة والجمارك يُلزم المنشآت بإصدار الفواتير إلكترونياً وإرسالها للهيئة. يصدر معمارك الفاتورة الضريبية مختومة ومرسلة للهيئة تلقائياً عند تحصيل دفعة خاضعة للضريبة (إيجار تجاري أو رسوم)، بضريبة قيمة مضافة 15% ورمز QR. لا تحتاج إلى إصدار يدوي.", en: "ZATCA e-invoicing is a requirement from the Zakat, Tax and Customs Authority that businesses issue invoices electronically and submit them to the Authority. Mimarek issues the tax invoice — stamped and submitted to ZATCA automatically — when you collect a taxable payment (a commercial lease or fees), at 15% VAT and with a QR code. There's no manual issuing on your side." },
    category: "zatca",
  },
  {
    id: "za-2",
    question: { ar: "كيف أربط منشأتي بهيئة الزكاة والضريبة؟", en: "How do I connect my organization to ZATCA?" },
    answer: { ar: "اذهب إلى الإعدادات ← الفوترة الإلكترونية (زاتكا). يستخدم معمارك بيانات منشأتك المسجّلة (الاسم والسجل التجاري والعنوان الوطني)، فتُدخل الرقم الضريبي ورمز التحقق (OTP) من بوابة فاتورة، ثم ينشئ النظام شهادة التوقيع ويفعّل الربط. بعد ظهور الحالة 'نشط'، تبدأ الفواتير الضريبية بالصدور تلقائياً عند تحصيل الدفعات الخاضعة للضريبة.", en: "Go to Settings → E-Invoicing (ZATCA). Mimarek uses your registered organization details (name, CR number, national address), so you enter your VAT number and the OTP from the Fatoora portal, and the system generates the signing certificate and activates the link. Once the status reads 'Active', tax invoices start issuing automatically as you collect taxable payments." },
    category: "zatca",
  },
  {
    id: "za-3",
    question: { ar: "متى تصدر فاتورة ضريبية ومتى يصدر سند قبض؟", en: "When is a tax invoice issued vs. a receipt?" },
    answer: { ar: "الفاتورة الضريبية تصدر للدفعات الخاضعة لضريبة القيمة المضافة فقط: الإيجار التجاري والرسوم. أما الإيجار السكني وعقود البيع والتأمين (العربون) فلا تخضع للضريبة، فيصدر لها سند قبض (إيصال) لا يُرسل للهيئة. يحدد النظام النوع الصحيح تلقائياً حسب نوع الدفعة وإعدادات الضريبة لديك.", en: "A tax invoice is issued only for VAT-taxable payments: commercial leases and fees. Residential leases, sale contracts, and deposits aren't taxable, so they get a receipt instead — which is not submitted to ZATCA. The system picks the right type for you based on the payment type and your tax configuration." },
    category: "zatca",
  },
  {
    id: "za-4",
    question: { ar: "ماذا تعني حالات 'معتمد من زاتكا' و'مُخلّص' و'مُبلّغ' و'معلّق'؟", en: "What do 'Confirmed by ZATCA', Cleared, Reported, and Held mean?" },
    answer: { ar: "'مُخلّص' (Cleared): تم اعتماد الفاتورة الضريبية القياسية من الهيئة قبل تسليمها للمشتري. 'مُبلّغ' (Reported): تم إبلاغ الهيئة بالسند المبسّط (B2C) بعد إصداره. وكلاهما يظهر بشارة 'معتمد من زاتكا'. 'معلّق' (Held): الفاتورة تنتظر إكمال بيانات المشتري قبل اعتمادها. وسند القبض غير الضريبي لا تنطبق عليه هذه الحالات.", en: "Cleared: a standard tax invoice was approved by ZATCA before it's handed to the buyer. Reported: a simplified (B2C) document was reported to ZATCA after it was issued. Both show the 'Confirmed by ZATCA' badge. Held: the invoice is waiting on the buyer's data before it can be cleared. A non-taxable receipt doesn't go through any of these states." },
    category: "zatca",
  },
  {
    id: "za-5",
    question: { ar: "فاتورتي في حالة 'معلّق' — ماذا أفعل؟", en: "My invoice is 'Held' — what do I do?" },
    answer: { ar: "تظهر حالة 'معلّق' عندما تكون الفاتورة بحاجة إلى بيانات المشتري الضريبية قبل اعتمادها من الهيئة. افتح الفاتورة من قسم الفواتير، وانقر 'إكمال بيانات المشتري' لتنتقل إلى ملف العميل، ثم أدخل الرقم الضريبي ورقم السجل التجاري والعنوان الوطني للمشتري. بعد حفظ البيانات، ارجع إلى الفاتورة وانقر إعادة الإصدار لإرسالها للهيئة.", en: "An invoice goes 'Held' when it needs the buyer's tax data before ZATCA can clear it. Open the invoice from the Invoices section and click 'Complete buyer data' to jump to the customer's profile, then enter the buyer's VAT number, CR number, and national address. Once you save, return to the invoice and re-issue it to submit it to ZATCA." },
    category: "zatca",
  },
  {
    id: "za-6",
    question: { ar: "أين أجد فواتيري الإلكترونية ورمز QR؟", en: "Where do I find my e-invoices and the QR code?" },
    answer: { ar: "من قسم الفواتير تجد كل فاتورة ضريبية وسند قبض صدر تلقائياً. صفِّ القائمة حسب 'معتمد من زاتكا' أو 'بانتظار الاعتماد'، وافتح أي فاتورة لعرض تفاصيلها ورمز QR وتنزيلها بصيغة PDF.", en: "The Invoices section lists every tax invoice and receipt issued automatically. Filter the list by 'Confirmed by ZATCA' or 'Awaiting confirmation', and open any invoice to see its details, its QR code, and download it as a PDF." },
    category: "zatca",
  },
];

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "guide-2",
    title: { ar: "إدارة العقارات والوحدات", en: "Manage Properties & Units" },
    description: { ar: "كيفية إضافة وتعديل وعرض تفاصيل الوحدات العقارية", en: "How to add, edit, and view your property units" },
    module: "properties",
    steps: [
      { ar: "اذهب إلى قسم العقارات من القائمة الجانبية — تظهر شبكة بطاقات بجميع الوحدات مع حالتها", en: "Open the Properties section from the sidebar. A card grid shows all units with their status" },
      { ar: "استخدم الفلاتر: البحث برقم الوحدة، تصفية حسب الحالة", en: "Use filters: search by unit number, filter by status" },
      { ar: "انقر 'إضافة وحدة' وأدخل الرقم، النوع، المبنى، المساحة، وأسعار التكلفة والبيع والإيجار", en: "Click 'Add Unit' and enter number, type, building, area, and cost/selling/rental prices" },
      { ar: "يمكنك تعديل عدة وحدات معاً باستخدام التحديد المتعدد وشريط الإجراءات", en: "You can bulk-edit units using multi-select and the action bar" },
      { ar: "انقر زر التفاصيل للوحدة لعرض: المعلومات الأساسية، والملخص المالي، والعقد المرتبط، وطلبات الصيانة", en: "Click the detail button to see the basic info, financial summary, linked contract, and maintenance requests" },
      { ar: "تتحدث حالة الوحدة تلقائياً: مباع عند توقيع عقد بيع، ومؤجر عند توقيع عقد إيجار", en: "Unit status auto-updates: Sold when a sale contract is signed, Rented when a lease is signed" },
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
      { ar: "اختر مصدر العميل (الموقع، إحالة، معرض، إلخ)", en: "Select the customer source (website, referral, exhibition, etc.)" },
      { ar: "انقر 'حفظ' — تُشفّر البيانات الحساسة تلقائياً", en: "Click 'Save'. Sensitive data is encrypted for you" },
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
      { ar: "انقر 'حفظ' — يُنشأ جدول الأقساط تلقائياً مع رقم عقد فريد", en: "Click 'Save'. The installment schedule is generated for you, along with a unique contract number" },
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
      { ar: "انقر 'إرسال' — يُعيَّن فني حسب الأولوية", en: "Click 'Submit'. A technician is assigned based on priority" },
    ],
  },
  {
    id: "guide-6",
    title: { ar: "تصدير التقارير", en: "Export Reports" },
    description: { ar: "كيفية إنشاء وتصدير التقارير بصيغة Excel أو PDF", en: "How to generate and export reports as Excel or PDF" },
    module: "reports",
    steps: [
      { ar: "اذهب إلى قسم التقارير", en: "Go to the Reports section" },
      { ar: "اختر نوع التقرير (الإيرادات، الإشغال، تحصيل الإيجارات، الصيانة، تكاليف الصيانة)", en: "Select report type (Revenue, Occupancy, Rent Collection, Maintenance, Maintenance Costs)" },
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
      { ar: "اذهب إلى الإعدادات ← الفريق", en: "Go to Settings → Team" },
      { ar: "انقر 'دعوة عضو' وأدخل بريده الإلكتروني", en: "Click 'Invite member' and enter their email" },
      { ar: "اختر الدور: مدير، مدير عمليات، مسؤول تأجير، مسؤول مالي، وكيل، فني، أو مستخدم", en: "Choose the role: Admin, Manager, Leasing, Finance, Agent, Technician, or User" },
      { ar: "انقر 'إرسال الدعوة' — تصل دعوة بالبريد الإلكتروني أو يظهر رابط لنسخه ومشاركته", en: "Click 'Send invitation'. We email the invite, or show you a link you can copy and share" },
      { ar: "تابع الدعوات المعلقة من نفس الصفحة، وأعد الإرسال أو ألغِ الدعوة عند الحاجة", en: "Track pending invitations on the same page, and resend or revoke as needed" },
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
      { ar: "انقر 'إرسال الطلب' — يصل إشعار للمدير", en: "Click 'Submit Request'. The admin gets notified" },
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
      { ar: "اختر فئة المستند عند الرفع: عام، قانوني، عقود، تسويق، أو مالي", en: "Choose the document's category when uploading: General, Legal, Contract, Marketing, or Finance" },
      { ar: "استخدم أزرار الفئات للتصفية حسب الفئة (عام، قانوني، عقود، تسويق، مالي)", en: "Use the category buttons to filter the list by category (General, Legal, Contract, Marketing, Finance)" },
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
      { ar: "اختر نوع العقد: 'إيجار' — ستظهر حقول إيجار الإضافية", en: "Set the contract type to 'Lease'. The Ejar-specific fields then appear" },
      { ar: "اختر العميل (المستأجر) والوحدة، وأدخل مبلغ الإيجار الإجمالي", en: "Select the customer (tenant) and unit, and enter the total lease amount" },
      { ar: "حدد تاريخ البداية والنهاية — هذه حقول إلزامية لعقود الإيجار", en: "Set the start and end dates. These are mandatory for lease contracts" },
      { ar: "اختر دورية الدفع: شهري، ربع سنوي، نصف سنوي، أو سنوي", en: "Select payment frequency: monthly, quarterly, semi-annual, or annual" },
      { ar: "أدخل مبلغ الضمان (اختياري — لا يتجاوز 5% من قيمة العقد حسب نظام إيجار)", en: "Enter the security deposit (optional, max 5% of contract value per Ejar regulation)" },
      { ar: "حدد التجديد التلقائي (نعم/لا) ومسؤولية الصيانة (المؤجر/المستأجر)", en: "Set auto-renewal (yes/no) and maintenance responsibility (landlord/tenant)" },
      { ar: "انقر 'إنشاء' — يُنشأ العقد مع جدول أقساط تلقائي ورقم عقد فريد", en: "Click 'Create'. The contract is created with an installment schedule and a unique contract number, both generated for you" },
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
      { ar: "عند توقيع عقد بيع: الوحدة ← مباع، والصفقة المرتبطة ← مكسوبة", en: "When signing a sale contract: unit → Sold, and the linked deal → Won" },
      { ar: "عند توقيع عقد إيجار: الوحدة ← مؤجر، العميل ← مستأجر نشط، الإيجار ← نشط", en: "When signing a lease contract: unit → Rented, customer → Active Tenant, lease → Active" },
      { ar: "عند الإلغاء أو الإبطال: الوحدة ← متاح، ويُنهى عقد الإيجار المرتبط (إن وُجد)", en: "On cancel/void: unit → Available, and the linked lease (if any) is terminated" },
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
      { ar: "راجع بطاقات المؤشرات: المُحصَّل هذا الشهر، إجمالي المتأخرات، والمتوقع خلال 30 يوماً", en: "Review the KPI cards: Collected This Month, Total Overdue, and Expected Next 30 Days" },
      { ar: "استعرض جدول الأقساط مع بيانات المستأجر والوحدة والمبلغ وتاريخ الاستحقاق", en: "Browse the installments table with tenant info, unit, amount, and due date" },
      { ar: "حدد القسط المطلوب تسجيله (غير مدفوع أو متأخر)", en: "Find the installment to record (unpaid or overdue)" },
      { ar: "انقر زر 'تسجيل دفعة' — وتتحول الحالة تلقائياً إلى 'مدفوع'", en: "Click 'Record Payment'. The status switches to 'Paid' on its own" },
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
      { ar: "بدّل بين الفوترة الشهرية والسنوية لمقارنة السعر — الاشتراك السنوي عادةً أوفر", en: "Toggle between monthly and annual billing to compare pricing. Annual is usually the better value" },
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
      { ar: "انقر 'إرسال الدعوات وإكمال الإعداد' — ويتمكن فريقك من الدخول فوراً", en: "Click 'Send Invitations & Complete Setup'. Your team can log in right away" },
    ],
  },
  // Marketplace Guides
  {
    id: "guide-25",
    title: { ar: "التصفح والاستفسار في السوق العقاري", en: "Browse & Inquire on the Marketplace" },
    description: { ar: "كيفية تصفح الإعلانات وإرسال استفسار ومتابعته", en: "How to browse listings, send an inquiry, and track it" },
    module: "marketplace",
    steps: [
      { ar: "اذهب إلى السوق العقاري من القائمة الجانبية وابقَ على تبويب 'تصفّح الإعلانات'", en: "Go to the Marketplace from the sidebar and stay on the 'Browse Listings' tab" },
      { ar: "استخدم البحث والفلاتر (المدينة، الحي، نوع العقار، السعر، المساحة، البائع)", en: "Use search and the filters (city, district, property type, price, area, seller)" },
      { ar: "افتح أي إعلان لعرض التفاصيل والعنوان الوطني وحالة الامتثال", en: "Open any listing to view its details, national address, and compliance status" },
      { ar: "انقر 'إبداء الاهتمام' وأدخل رقم جوال سعودي (إلزامي) واسماً ورسالة اختياريين", en: "Click 'Express Interest' and enter a Saudi mobile number (required) plus an optional name and message" },
      { ar: "تابع استفساراتك من تبويب 'استفساراتي'، واسحب أي استفسار مفتوح عند الحاجة", en: "Track your inquiries under the 'My Inquiries' tab, and withdraw any open inquiry if needed" },
    ],
  },
  {
    id: "guide-26",
    title: { ar: "عرض وحدة في السوق العقاري", en: "List a Unit on the Marketplace" },
    description: { ar: "خطوات نشر إعلان عن وحدة وإتمام النقل", en: "Steps to publish a listing and complete the transfer" },
    module: "marketplace",
    steps: [
      { ar: "تأكد أن الوحدة متاحة ولها مدينة وحي وبدون عقد أو حجز قائم", en: "Make sure the unit is Available, has a city and district, and has no active contract or reservation" },
      { ar: "أنشئ إعلاناً للوحدة — يُنشأ كمسودة", en: "Create a listing for the unit. It starts as a Draft" },
      { ar: "من السوق العقاري ← إعلاناتي، عدّل المسودة وأضف العنوان والسعر والعنوان الوطني (4 أحرف + 4 أرقام)", en: "In Marketplace → My Listings, edit the draft and add a title, price, and National Address code (4 letters + 4 digits)" },
      { ar: "اختيارياً أضف وصفاً ورقم رخصة إعلان وعمر المبنى", en: "Optionally add a description, ad license number, and building age" },
      { ar: "انشر الإعلان ليظهر لجميع المنشآت", en: "Publish the listing to make it visible to all organizations" },
      { ar: "عند ورود استفسار، انقر 'تحويل لصفقة' لحجز الوحدة، ثم 'تسوية ونقل' بعد توقيع عقد البيع", en: "When an inquiry arrives, click 'Convert to Deal' to reserve the unit, then 'Settle & Transfer' once the sale contract is signed" },
    ],
  },
];
