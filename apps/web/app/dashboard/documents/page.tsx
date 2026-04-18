"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import * as React from "react";
import {
  FileText as FilePdf,
  Image as FileImage,
  FileText,
  FileSpreadsheet,
  CloudUpload,
  Download,
  Trash2,
  MoreVertical,
  SquareDashedMousePointer,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  AppBar,
  DataCard,
  FAB,
  EmptyState,
  Skeleton,
  Alert,
  AlertDescription,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { cn } from "@repo/ui/lib/utils";
import { getDocuments, registerFileInDb } from "../../actions/documents";
import { UploadButton } from "../../../lib/uploadthing";
import { exportToExcel } from "../../../lib/export";

export default function DocumentVaultPage() {
  const { lang } = useLanguage();
  const { can } = usePermissions();
  const canWrite = can("documents:write");
  const [docs, setDocs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [mobileSearch, setMobileSearch] = React.useState("");

  React.useEffect(() => {
    async function loadDocs() {
      try {
        const data = await getDocuments();
        setDocs(data);
      } catch (err) {
        setLoadError(lang === "ar" ? "تعذّر تحميل الوثائق" : "Failed to load documents");
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, [lang]);

  const mobileCategories: { id: string; label: { ar: string; en: string } }[] = [
    { id: "all", label: { ar: "الكل", en: "All" } },
    { id: "BLUEPRINT", label: { ar: "مخططات", en: "Blueprints" } },
    { id: "LEGAL", label: { ar: "قانوني", en: "Legal" } },
    { id: "STRUCTURAL", label: { ar: "إنشائي", en: "Structural" } },
    { id: "COMMERCIAL", label: { ar: "تجاري", en: "Commercial" } },
    { id: "MARKETING", label: { ar: "تسويق", en: "Marketing" } },
    { id: "GENERAL", label: { ar: "عام", en: "General" } },
  ];

  const mobileFiltered = React.useMemo(() => {
    const base =
      activeCategory === "all"
        ? docs
        : docs.filter((d) => d.category === activeCategory);
    if (!mobileSearch) return base;
    const q = mobileSearch.toLowerCase();
    return base.filter((d) => (d.name ?? "").toLowerCase().includes(q));
  }, [docs, activeCategory, mobileSearch]);

  function pickFileIcon(type: string | null | undefined) {
    const t = (type ?? "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(t)) return FileImage;
    if (["xls", "xlsx", "csv"].includes(t)) return FileSpreadsheet;
    return FileText;
  }

  function formatSize(bytes: number | null | undefined) {
    if (!bytes || bytes <= 0) return "—";
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  // Hidden mobile upload trigger — clicks the UploadButton under the hood.
  const mobileUploadRef = React.useRef<HTMLDivElement | null>(null);
  function triggerMobileUpload() {
    const btn = mobileUploadRef.current?.querySelector<HTMLButtonElement>(
      'button, label[for]'
    );
    btn?.click();
  }

  const handleUploadComplete = async (res: any) => {
    setUploadError(null);
    try {
      // res is an array of uploaded files
      for (const file of res) {
        await registerFileInDb({
          name: file.name,
          url: file.url,
          type: file.name.split('.').pop() || "unknown",
          category: "GENERAL"
        });
      }
      // Refresh list
      const updatedData = await getDocuments();
      setDocs(updatedData);
    } catch (err) {
      setUploadError(lang === "ar" ? "فشل تسجيل الوثيقة" : "Failed to register document");
    }
  };

  const handleExportDocuments = async () => {
    setExporting(true);
    try {
    exportToExcel({
      data: docs,
      columns: [
        { header: lang === "ar" ? "اسم الوثيقة" : "Document Name", key: "name", width: 35 },
        { header: lang === "ar" ? "التصنيف" : "Category", key: "category", width: 20 },
        { header: lang === "ar" ? "النوع" : "Type", key: "type", width: 15 },
        { header: lang === "ar" ? "تاريخ الرفع" : "Uploaded Date", key: "createdAt", width: 20, render: (val: any) => val ? new Date(val).toLocaleDateString("en-CA") : "" },
        { header: lang === "ar" ? "رفع بواسطة" : "Uploaded By", key: "uploadedBy", width: 25, render: (val: any) => val?.name ?? val ?? "" },
      ],
      filename: lang === "ar" ? "سجل_الوثائق" : "documents_list",
      lang,
      title: lang === "ar" ? "سجل الوثائق — ميماريك" : "Document List — Mimaric",
    });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "المستندات" : "Documents"} lang={lang} />

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
            aria-hidden="true"
          />
          <Input
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            placeholder={
              lang === "ar" ? "ابحث باسم الملف..." : "Search by file name..."
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      {/* Type filter chip row */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-3 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
        role="tablist"
        aria-label={lang === "ar" ? "تصفية الفئة" : "Category filter"}
      >
        {mobileCategories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "min-h-[36px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {cat.label[lang]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-4 pb-24 pt-3">
        {loadError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {uploadError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && mobileFiltered.length === 0 && (
          <EmptyState
            icon={<CloudUpload className="h-10 w-10 text-primary" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد وثائق" : "No documents"}
            description={
              lang === "ar"
                ? "لم يتم العثور على وثائق. ارفع أول وثيقة للبدء."
                : "No documents yet. Upload one to get started."
            }
          />
        )}

        {!loading && mobileFiltered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4">
            {mobileFiltered.map((doc, idx) => {
              const Icon = pickFileIcon(doc.type);
              const uploader =
                doc.uploadedBy?.name ?? doc.uploadedBy ?? (lang === "ar" ? "غير معروف" : "Unknown");
              const date = doc.createdAt
                ? new Date(doc.createdAt).toLocaleDateString(
                    lang === "ar" ? "ar-SA" : "en-SA"
                  )
                : "—";
              return (
                <DataCard
                  key={doc.id}
                  icon={Icon}
                  iconTone="purple"
                  divider={idx !== mobileFiltered.length - 1}
                  title={<span className="truncate">{doc.name}</span>}
                  subtitle={[
                    formatSize(doc.size),
                    uploader,
                    date,
                  ]}
                  href={doc.url}
                />
              );
            })}
          </div>
        )}
      </div>

      {canWrite && (
        <>
          {/* Hidden uploader — FAB triggers it */}
          <div ref={mobileUploadRef} className="sr-only" aria-hidden="true">
            <UploadButton
              endpoint="blueprintUploader"
              onClientUploadComplete={handleUploadComplete}
              onUploadError={(error: Error) => {
                console.error(error);
                setUploadError(
                  lang === "ar"
                    ? "تعذّر رفع الملف. يُرجى المحاولة مرة أخرى."
                    : "We couldn't upload this file. Please try again."
                );
              }}
            />
          </div>
          <FAB
            icon={CloudUpload}
            label={lang === "ar" ? "رفع" : "Upload"}
            onClick={triggerMobileUpload}
          />
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <PageHeader
        className="px-2"
        title={lang === "ar" ? "خزنة الوثائق" : "Document Vault"}
        description={
          lang === "ar"
            ? "إدارة وتخزين كافة الوثائق الهندسية والقانونية للمشاريع."
            : "Manage and store all engineering and legal project documents."
        }
        actions={
          <>
            <Button variant="outline" size="sm" style={{ display: "inline-flex" }} onClick={handleExportDocuments} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? (lang === "ar" ? "جاري التصدير..." : "Exporting...") : (lang === "ar" ? "تصدير القائمة" : "Export List")}
            </Button>
            <UploadButton
              endpoint="blueprintUploader"
              onClientUploadComplete={handleUploadComplete}
              onUploadError={(error: Error) => {
                console.error(error);
                setUploadError(lang === "ar" ? "تعذّر رفع الملف. يُرجى المحاولة مرة أخرى." : "We couldn't upload this file. Please try again.");
              }}
              appearance={{
                button: "bg-secondary hover:bg-green-bright text-white text-sm font-bold gap-2 flex h-9 px-4 rounded-md",
                allowedContent: "hidden"
              }}
              content={{
                button: (
                  <div className="flex items-center gap-2">
                    <CloudUpload className="h-[18px] w-[18px]" />
                    {lang === "ar" ? "رفع وثيقة" : "Upload Document"}
                  </div>
                )
              }}
            />
          </>
        }
      />

      {/* Upload Error */}
      {uploadError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive flex-1">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="text-destructive/70 hover:text-destructive text-xs font-medium">
            {lang === "ar" ? "إغلاق" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-card rounded-md border border-border p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 font-latin">{lang === "ar" ? "التصنيفات" : "Categories"}</h2>
              <div className="space-y-1">
                 {[
                   { id: "all", label: { ar: "جميع الوثائق", en: "All Documents" } },
                   { id: "BLUEPRINT", label: { ar: "مخططات", en: "Blueprints" } },
                   { id: "LEGAL", label: { ar: "تصاريح قانونية", en: "Legal Permits" } },
                   { id: "STRUCTURAL", label: { ar: "مخططات إنشائية", en: "Structural Plans" } },
                   { id: "COMMERCIAL", label: { ar: "تجاري", en: "Commercial" } },
                   { id: "MARKETING", label: { ar: "تسويق", en: "Marketing" } },
                   { id: "GENERAL", label: { ar: "عام", en: "General" } },
                 ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "w-full text-start px-3 py-2 text-sm rounded-md transition-colors",
                        activeCategory === cat.id
                          ? "bg-secondary/10 text-secondary font-bold"
                          : "text-muted-foreground hover:bg-muted hover:text-primary"
                      )}
                    >
                       {cat.label[lang]}
                    </button>
                 ))}
              </div>
           </div>
           
           <div className="bg-primary-deep p-6 rounded-md text-white shadow-lg overflow-hidden relative">
              <FilePdf className="h-12 w-12 absolute -bottom-4 -end-4 opacity-10 rotate-12" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white font-latin">Storage Usage</p>
              <div className="mt-4 space-y-2">
                 <div className="h-1.5 w-full bg-card/10 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary w-3/4 rounded-full" />
                 </div>
                 <p className="text-[10px] text-white/50 text-end font-latin">7.2 GB / 10 GB</p>
              </div>
           </div>
        </div>

        {/* Document Grid */}
        <div className="lg:col-span-3 space-y-6">
           {/* Filters */}
           <div className="bg-card rounded-md border border-border p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
             <div className="relative w-full md:w-80 group">
                <Search className="h-[18px] w-[18px] absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-secondary transition-colors" />
                <input
                  type="text"
                  placeholder={lang === "ar" ? "بحث في الوثائق..." : "Search documents..."}
                  className="w-full bg-muted/30 border-transparent rounded py-2 pe-10 ps-4 text-sm outline-none focus:bg-card focus:border-border transition-all"
                />
             </div>
             <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="h-11 w-11 sm:h-8 sm:w-8 p-0" aria-label={lang === "ar" ? "تحديد" : "Select"}>
                   <SquareDashedMousePointer className="h-[18px] w-[18px]" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Badge variant="available" className="bg-secondary/5 text-secondary border-none">Recent</Badge>
             </div>
           </div>

           {/* Files Grid */}
           {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {[1, 2, 3, 4, 5, 6].map((i) => (
                 <div key={i} className="bg-card rounded-md border border-border p-5 animate-pulse">
                   <div className="flex items-start justify-between mb-4">
                     <div className="h-12 w-12 rounded bg-muted" />
                     <div className="h-5 w-5 rounded bg-muted" />
                   </div>
                   <div className="space-y-2">
                     <div className="h-4 bg-muted rounded w-3/4" />
                     <div className="h-3 bg-muted rounded w-1/3" />
                   </div>
                   <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                     <div className="h-4 bg-muted rounded w-16" />
                     <div className="h-8 w-8 rounded-full bg-muted" />
                   </div>
                 </div>
               ))}
             </div>
           ) : docs.filter((doc) => activeCategory === "all" || doc.category === activeCategory).length === 0 ? (
             <EmptyState
               icon={<CloudUpload className="h-12 w-12" aria-hidden="true" />}
               title={lang === "ar" ? "لا توجد وثائق بعد" : "No documents yet"}
               description={
                 lang === "ar"
                   ? "ارفع المخططات والعقود والمستندات في مكان واحد آمن."
                   : "Upload blueprints, contracts, and records in one safe place."
               }
               action={
                 canWrite ? (
                   <Button
                     onClick={triggerMobileUpload}
                     style={{ display: "inline-flex" }}
                     className="gap-2"
                   >
                     <CloudUpload className="h-[18px] w-[18px]" />
                     {lang === "ar" ? "رفع وثيقة" : "Upload document"}
                   </Button>
                 ) : undefined
               }
               helpHref="/dashboard/help#documents"
               helpLabel={lang === "ar" ? "تعرّف على خزنة الوثائق" : "Learn about the vault"}
             />
           ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {docs.filter((doc) => activeCategory === "all" || doc.category === activeCategory).map((doc) => (
                <div key={doc.id} className="bg-card rounded-md border border-border p-5 hover:shadow-md transition-all group relative border-b-4 border-b-transparent hover:border-b-secondary">
                   <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "h-12 w-12 rounded flex items-center justify-center",
                        ['pdf'].includes(doc.type?.toLowerCase()) ? "bg-destructive/10 text-destructive" : ['jpg', 'png', 'jpeg'].includes(doc.type?.toLowerCase()) ? "bg-info/10 text-info" : "bg-success/10 text-success"
                      )}>
                         {['pdf'].includes(doc.type?.toLowerCase()) ? <FilePdf className="h-7 w-7" /> : ['jpg', 'png', 'jpeg'].includes(doc.type?.toLowerCase()) ? <FileImage className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
                      </div>
                      <button className="h-11 w-11 sm:h-8 sm:w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label={lang === "ar" ? "المزيد" : "More"}>
                         <MoreVertical className="h-5 w-5" />
                      </button>
                   </div>
                   
                   <div className="space-y-1">
                      <h3 className="text-sm font-bold text-primary truncate">{doc.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-latin">{new Date(doc.createdAt).toLocaleDateString()}</p>
                   </div>

                   <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <Badge variant="available" className="text-[9px] bg-muted text-muted-foreground border-none">{doc.category}</Badge>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="h-11 w-11 sm:h-8 sm:w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-secondary transition-all">
                         <Download className="h-[18px] w-[18px]" />
                      </a>
                   </div>
                </div>
              ))}
           </div>
           )}
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
