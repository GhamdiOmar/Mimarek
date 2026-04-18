"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import {
  UserPlus,
  Mail,
  ShieldCheck,
  Clock,
  Trash2,
  UserCog,
  X,
  User,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  AppBar,
  DataCard,
  FAB,
  EmptyState,
  ResponsiveDialog,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { getTeamMembers, inviteTeamMember, removeTeamMember } from "../../../actions/team";
import { hasPermission, CUSTOMER_ASSIGNABLE_ROLES } from "../../../../lib/permissions";
import { toast } from "sonner";

type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  SYSTEM_SUPPORT: "System Support",
  COMPANY_ADMIN: "Company Admin",
  // Backward compat
  SUPER_ADMIN: "Company Admin",
  DEV_ADMIN: "System Support",
  PROJECT_MANAGER: "Project Manager",
  SALES_MANAGER: "Sales Manager",
  SALES_AGENT: "Sales Agent",
  PROPERTY_MANAGER: "Property Manager",
  FINANCE_OFFICER: "Finance Officer",
  TECHNICIAN: "Technician",
  BUYER: "Buyer",
  TENANT: "Tenant",
  USER: "User",
};

// Only customer-assignable roles shown in invite dropdown
const inviteRoleOptions: { value: string; label: string }[] = CUSTOMER_ASSIGNABLE_ROLES.map((r) => ({
  value: r,
  label: roleLabels[r] ?? r,
}));

export default function TeamManagementPage() {
  const { lang } = useLanguage();
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteName, setInviteName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("SALES_AGENT");
  const [invitePassword, setInvitePassword] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  const fetchTeam = React.useCallback(() => {
    getTeamMembers()
      .then((data) => setMembers(data as TeamMember[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail || !invitePassword) return;
    setInviting(true);
    setInviteError(null);
    try {
      await inviteTeamMember({ name: inviteName, email: inviteEmail, role: inviteRole, password: invitePassword });
      setShowInvite(false);
      setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteRole("SALES_AGENT");
      fetchTeam();
    } catch (err: any) {
      setInviteError(
        err?.message ||
          (lang === "ar"
            ? "تعذّر إرسال الدعوة. يرجى التحقق من البيانات والمحاولة مرة أخرى."
            : "Could not send the invite. Please check the details and try again."),
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string, name: string | null) => {
    if (!confirm(`${lang === "ar" ? "هل أنت متأكد من حذف" : "Remove"} ${name}?`)) return;
    try {
      await removeTeamMember(userId);
      fetchTeam();
    } catch (err: any) {
      toast.error(
        lang === "ar"
          ? "تعذّر إزالة العضو. يُرجى المحاولة مرة أخرى."
          : "We couldn't remove the team member. Please try again.",
      );
      console.error(err);
    }
  };

  const inviteForm = (
    <div className="space-y-4">
      {inviteError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
          {inviteError}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "الاسم" : "Name"}
        </label>
        <Input
          className="h-11"
          placeholder={lang === "ar" ? "الاسم" : "Name"}
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "البريد الإلكتروني" : "Email"}
        </label>
        <Input
          type="email"
          className="h-11"
          placeholder={lang === "ar" ? "البريد الإلكتروني" : "Email"}
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          dir="ltr"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "كلمة المرور" : "Password"}
        </label>
        <Input
          type="password"
          className="h-11"
          placeholder={lang === "ar" ? "كلمة المرور" : "Password"}
          value={invitePassword}
          onChange={(e) => setInvitePassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "الدور" : "Role"}
        </label>
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {inviteRoleOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <Button
        className="w-full min-h-[44px]"
        onClick={handleInvite}
        disabled={inviting || !inviteName || !inviteEmail || !invitePassword}
        style={{ display: "inline-flex" }}
      >
        {inviting
          ? (lang === "ar" ? "جاري الإضافة..." : "Adding...")
          : (lang === "ar" ? "إضافة" : "Add Member")}
      </Button>
    </div>
  );

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar
          title={lang === "ar" ? "الفريق" : "Team"}
          subtitle={
            lang === "ar"
              ? "أعضاء الفريق والأدوار"
              : "Team members & roles"
          }
          lang={lang}
        />

        <div className="flex-1 px-4 py-4 pb-28">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              {lang === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={<User className="h-12 w-12" />}
              title={lang === "ar" ? "لا يوجد أعضاء" : "No team members"}
              description={
                lang === "ar"
                  ? "ابدأ بدعوة عضو جديد إلى فريقك."
                  : "Start by inviting a new member to your team."
              }
            />
          ) : (
            <div className="rounded-lg border border-border bg-card px-4">
              {members.map((member, idx) => (
                <DataCard
                  key={member.id}
                  icon={User}
                  iconTone="purple"
                  title={member.name || member.email}
                  subtitle={[
                    <span key="email" className="font-latin">{member.email}</span>,
                    <span key="joined" className="tabular-nums">
                      {new Date(member.createdAt).toLocaleDateString(
                        lang === "ar" ? "ar-SA" : "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </span>,
                  ]}
                  trailing={
                    <Badge variant="outline" size="sm">
                      {roleLabels[member.role] ?? member.role}
                    </Badge>
                  }
                  divider={idx < members.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        <FAB
          icon={UserPlus}
          label={lang === "ar" ? "دعوة عضو جديد" : "Invite member"}
          onClick={() => {
            setInviteError(null);
            setShowInvite(true);
          }}
        />

        <ResponsiveDialog
          open={showInvite}
          onOpenChange={(open) => {
            setShowInvite(open);
            if (!open) setInviteError(null);
          }}
          title={lang === "ar" ? "دعوة عضو جديد" : "Invite New Member"}
          description={
            lang === "ar"
              ? "أدخل بيانات العضو الجديد لإضافته إلى الفريق."
              : "Enter the new member's details to add them to the team."
          }
        >
          {inviteForm}
        </ResponsiveDialog>
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeader
          title={lang === "ar" ? "إدارة فريق العمل" : "Team Management"}
          description={lang === "ar" ? "دعوة الموظفين وتعيين الصلاحيات وإدارة أدوار الفريق." : "Invite staff, assign permissions, and manage team roles."}
          actions={
            <Button size="sm" className="gap-2 bg-secondary hover:bg-green-bright transition-colors" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-[18px] w-[18px]" />
              {lang === "ar" ? "دعوة عضو جديد" : "Invite Member"}
            </Button>
          }
        />

        {/* Invite Modal (desktop-inline) */}
        {showInvite && (
          <Card className="border-secondary/30 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{lang === "ar" ? "دعوة عضو جديد" : "Invite New Member"}</h3>
                <button onClick={() => setShowInvite(false)} aria-label={lang === "ar" ? "إغلاق" : "Close"}><X className="h-[18px] w-[18px] text-muted-foreground" /></button>
              </div>
              {inviteError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
                  {inviteError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder={lang === "ar" ? "الاسم" : "Name"} value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                <Input type="email" placeholder={lang === "ar" ? "البريد الإلكتروني" : "Email"} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <Input type="password" placeholder={lang === "ar" ? "كلمة المرور" : "Password"} value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded border border-border px-3 py-2 text-sm">
                  {inviteRoleOptions.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <Button className="bg-secondary" onClick={handleInvite} disabled={inviting}>
                {inviting ? "..." : (lang === "ar" ? "إضافة" : "Add Member")}
              </Button>
            </div>
          </Card>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          <Table className="text-start">
            <TableHeader>
              <TableRow>
                <TableHead className="font-latin">{lang === "ar" ? "العضو" : "Member"}</TableHead>
                <TableHead className="font-latin">{lang === "ar" ? "الدور" : "Role"}</TableHead>
                <TableHead className="font-latin">{lang === "ar" ? "تاريخ الانضمام" : "Joined"}</TableHead>
                <TableHead className="text-center font-latin">{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground text-sm animate-pulse">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</TableCell></TableRow>
              ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground text-sm">{lang === "ar" ? "لا يوجد أعضاء" : "No team members"}</TableCell></TableRow>
              ) : members.map((member) => (
                <TableRow key={member.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                        <span className="text-xs font-bold uppercase font-latin">{(member.name ?? "?").split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{member.name}</p>
                        <p className="text-[10px] text-muted-foreground font-latin">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground font-latin">{roleLabels[member.role] ?? member.role}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {hasPermission(member.role, "customers:read_pii") && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success">{lang === "ar" ? "بيانات شخصية" : "PII Access"}</span>
                        )}
                        {hasPermission(member.role, "customers:export") && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-info/15 text-info">{lang === "ar" ? "تصدير" : "Export"}</span>
                        )}
                        {hasPermission(member.role, "finance:read") && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning">{lang === "ar" ? "مالية" : "Finance"}</span>
                        )}
                        {hasPermission(member.role, "audit:read") && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary">{lang === "ar" ? "مراجعة" : "Audit"}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-latin">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="secondary" size="icon" className="h-11 w-11 sm:h-8 sm:w-8 rounded shadow-sm hover:text-destructive" onClick={() => handleRemove(member.id, member.name)} aria-label={lang === "ar" ? "إزالة" : "Remove"}>
                        <Trash2 className="h-[18px] w-[18px]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Help Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: { ar: "الأدوار والصلاحيات", en: "Roles & Permissions" }, desc: { ar: "إدارة من يمكنه رؤية البيانات الحساسة أو تعديل الأسعار.", en: "Manage who can see sensitive data or modify prices." }, icon: ShieldCheck },
            { title: { ar: "تقارير النشاط", en: "Activity Reports" }, desc: { ar: "تتبع نشاط الفريق والمهام المنجزة في النظام.", en: "Track team activity and completed tasks." }, icon: UserCog },
            { title: { ar: "نظام الدعوات", en: "Invitation System" }, desc: { ar: "دعوة آمنة عبر البريد الإلكتروني مع انتهاء تلقائي.", en: "Secure email invitations with auto-expiry." }, icon: Mail },
          ].map((item, i) => (
            <Card key={i} className="p-6 flex items-start gap-4 hover:border-secondary/20 transition-all">
              <div className="p-3 bg-secondary/10 rounded text-secondary">
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">{item.title[lang]}</h4>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.desc[lang]}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
