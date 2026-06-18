"use client";

import * as React from "react";
import { ClipboardCopy, Clock, Mail, RotateCcw, Trash2, User, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  AppBar,
  Badge,
  Button,
  Card,
  CardContent,
  DataCard,
  DataTable,
  EmptyState,
  FAB,
  IconButton,
  Input,
  PageHeader,
  ResponsiveDialog,
  SelectField,
  type ColumnDef,
} from "@repo/ui";
import { useLanguage } from "../../../../components/LanguageProvider";
import { CUSTOMER_ASSIGNABLE_ROLES } from "../../../../lib/permissions";
import { getTeamMembers, removeTeamMember } from "../../../actions/team";
import { createInvitation, getOrgInvitations, resendInvitation, revokeInvitation } from "../../../actions/invitations";

type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string | Date;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  invitedBy?: { name: string | null } | null;
};

const roleLabels: Record<string, { ar: string; en: string }> = {
  ADMIN: { ar: "مدير", en: "Admin" },
  MANAGER: { ar: "مدير عمليات", en: "Manager" },
  LEASING: { ar: "مسؤول تأجير", en: "Leasing" },
  FINANCE: { ar: "مسؤول مالي", en: "Finance" },
  AGENT: { ar: "وكيل", en: "Agent" },
  TECHNICIAN: { ar: "فني صيانة", en: "Technician" },
  USER: { ar: "مستخدم", en: "User" },
};

const inviteRoleOptions = CUSTOMER_ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: roleLabels[role] ?? { ar: role, en: role },
}));

export default function TeamManagementPage() {
  const { t, lang } = useLanguage();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("AGENT");
  const [inviteFallbackUrl, setInviteFallbackUrl] = React.useState<string | null>(null);
  const [removeCandidate, setRemoveCandidate] = React.useState<TeamMember | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  const fetchTeam = React.useCallback(async () => {
    setLoading(true);
    try {
      const [teamData, inviteData] = await Promise.all([getTeamMembers(), getOrgInvitations()]);
      setMembers(teamData as TeamMember[]);
      setInvitations(inviteData as Invitation[]);
    } catch (error) {
      console.error(error);
      toast.error(t("تعذر تحميل الفريق", "Could not load team"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`; depending on `lang` keeps the callback stable while refreshing translations
  }, [lang]);

  React.useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);
    setInviteFallbackUrl(null);
    try {
      const result = await createInvitation({ email: inviteEmail, role: inviteRole });
      if (!result.success) {
        setInviteError(result.error ?? (t("تعذر إرسال الدعوة", "Could not send invitation")));
        return;
      }
      setInviteFallbackUrl(result.emailSent ? null : result.inviteUrl ?? null);
      toast.success(result.emailSent ? (t("تم إرسال الدعوة", "Invitation sent")) : result.emailMessage);
      setInviteEmail("");
      setInviteRole("AGENT");
      await fetchTeam();
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setBusyId(userId);
    try {
      await removeTeamMember(userId);
      toast.success(t("تمت إزالة العضو", "Team member removed"));
      await fetchTeam();
    } catch {
      toast.error(t("تعذر إزالة العضو", "Could not remove team member"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleResend(invitationId: string) {
    setBusyId(invitationId);
    try {
      const result = await resendInvitation(invitationId);
      if (!result.success) {
        toast.error(result.error ?? (t("تعذر إعادة الإرسال", "Could not resend invitation")));
        return;
      }
      setInviteFallbackUrl(result.emailSent ? null : result.inviteUrl ?? null);
      toast.success(result.emailSent ? (t("تم إرسال الدعوة مرة أخرى", "Invitation resent")) : result.emailMessage);
      await fetchTeam();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(invitationId: string) {
    setBusyId(invitationId);
    try {
      const result = await revokeInvitation(invitationId);
      if (!result.success) {
        toast.error(result.error ?? (t("تعذر إلغاء الدعوة", "Could not revoke invitation")));
        return;
      }
      toast.success(t("تم إلغاء الدعوة", "Invitation revoked"));
      await fetchTeam();
    } finally {
      setBusyId(null);
    }
  }

  async function copyFallbackUrl() {
    if (!inviteFallbackUrl) return;
    try {
      await navigator.clipboard.writeText(inviteFallbackUrl);
      toast.success(t("تم نسخ رابط الدعوة", "Invitation link copied"));
    } catch {
      toast.error(t("تعذر نسخ رابط الدعوة", "Could not copy the invitation link"));
    }
  }

  const inviteForm = (
    <div className="space-y-4">
      {inviteError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>}
      {inviteFallbackUrl && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <p className="font-medium">{t("البريد غير مكتمل. استخدم الرابط مؤقتاً.", "Email is not configured. Use this fallback link for now.")}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={copyFallbackUrl} style={{ display: "inline-flex" }}>
            <ClipboardCopy className="h-4 w-4" />
            {t("نسخ رابط الدعوة", "Copy invite link")}
          </Button>
        </div>
      )}
      <label className="space-y-2 text-sm font-medium">
        {t("البريد الإلكتروني", "Email")}
        <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} dir="ltr" placeholder="name@example.com" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        {t("الدور", "Role")}
        <SelectField aria-label={t("الدور", "Role")} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="h-11">
          {inviteRoleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label[lang]}
            </option>
          ))}
        </SelectField>
      </label>
      <Button className="min-h-[44px] w-full" onClick={handleInvite} disabled={inviting || !inviteEmail} loading={inviting} style={{ display: "inline-flex" }}>
        <Mail className="h-4 w-4" />
        {t("إرسال الدعوة", "Send invitation")}
      </Button>
    </div>
  );

  const pendingInvitations = invitations.filter((invite) => invite.status === "PENDING_INVITE");

  return (
    <>
      <div className="md:hidden -m-4 flex min-h-dvh flex-col bg-background sm:-m-6" dir={dir}>
        <AppBar title={t("الفريق", "Team")} subtitle={t("الأعضاء والدعوات", "Members and invitations")} lang={lang} />
        <div className="flex-1 space-y-5 px-4 py-4 pb-28">
          {loading ? (
            <div className="py-12 text-center text-sm text-foreground animate-pulse">{t("جاري التحميل...", "Loading...")}</div>
          ) : (
            <>
              <TeamList members={members} lang={lang} onRemove={(member) => setRemoveCandidate(member)} busyId={busyId} compact />
              <InvitationList invitations={pendingInvitations} lang={lang} onResend={handleResend} onRevoke={handleRevoke} busyId={busyId} />
            </>
          )}
        </div>
        <FAB icon={UserPlus} label={t("دعوة عضو", "Invite member")} onClick={() => setShowInvite(true)} />
        <ResponsiveDialog open={showInvite} onOpenChange={setShowInvite} title={t("دعوة عضو جديد", "Invite team member")} description={t("الدعوة ترسل عبر البريد ويقوم العضو بإنشاء كلمة المرور.", "The invite is sent by email and the member creates their own password.")}>
          {inviteForm}
        </ResponsiveDialog>
      </div>

      <div className="hidden space-y-6 md:block" dir={dir}>
        <PageHeader
          title={t("إدارة فريق العمل", "Team Management")}
          description={t("دعوات آمنة عبر البريد مع روابط قبول منتهية الصلاحية.", "Secure email invitations with expiring acceptance links.")}
          actions={
            <Button size="sm" onClick={() => setShowInvite(true)} style={{ display: "inline-flex" }}>
              <UserPlus className="h-4 w-4" />
              {t("دعوة عضو جديد", "Invite member")}
            </Button>
          }
        />

        {showInvite && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("دعوة عضو جديد", "Invite team member")}</h2>
                <IconButton
                  icon={X}
                  aria-label={t("إغلاق", "Close")}
                  variant="ghost"
                  onClick={() => setShowInvite(false)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" dir="ltr" />
                <SelectField aria-label={t("الدور", "Role")} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                  {inviteRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[lang]}
                    </option>
                  ))}
                </SelectField>
                <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail} style={{ display: "inline-flex" }}>
                  <Mail className="h-4 w-4" />
                  {t("إرسال الدعوة", "Send invitation")}
                </Button>
              </div>
              {inviteError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>}
              {inviteFallbackUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                  <span>{t("البريد غير مكتمل. استخدم الرابط مؤقتاً.", "Email is not configured. Use this fallback link for now.")}</span>
                  <Button type="button" variant="secondary" size="sm" onClick={copyFallbackUrl} style={{ display: "inline-flex" }}>
                    <ClipboardCopy className="h-4 w-4" />
                    {t("نسخ الرابط", "Copy link")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <TeamList members={members} lang={lang} onRemove={(member) => setRemoveCandidate(member)} busyId={busyId} loading={loading} onInvite={() => setShowInvite(true)} />
        <InvitationList invitations={pendingInvitations} lang={lang} onResend={handleResend} onRevoke={handleRevoke} busyId={busyId} />
      </div>

      <ResponsiveDialog
        open={Boolean(removeCandidate)}
        onOpenChange={(open) => {
          if (!open) setRemoveCandidate(null);
        }}
        title={t("إزالة عضو الفريق", "Remove team member")}
        description={
          t("سيتم إلغاء وصول هذا العضو إلى مساحة العمل. يمكن دعوته مرة أخرى لاحقاً.", "This removes the member's access to this workspace. You can invite them again later.")
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{removeCandidate?.name ?? removeCandidate?.email}</p>
            <p className="text-foreground">{removeCandidate?.email}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRemoveCandidate(null)} style={{ display: "inline-flex" }}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={Boolean(removeCandidate && busyId === removeCandidate.id)}
              onClick={async () => {
                if (!removeCandidate) return;
                await handleRemove(removeCandidate.id);
                setRemoveCandidate(null);
              }}
              style={{ display: "inline-flex" }}
            >
              <Trash2 className="h-4 w-4" />
              {t("إزالة العضو", "Remove member")}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}

function TeamList({
  members,
  lang,
  onRemove,
  busyId,
  loading = false,
  compact = false,
  onInvite,
}: {
  members: TeamMember[];
  lang: "ar" | "en";
  onRemove: (member: TeamMember) => void;
  busyId: string | null;
  loading?: boolean;
  compact?: boolean;
  onInvite?: () => void;
}) {
  const columns = React.useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        id: "member",
        accessorKey: "name",
        header: lang === "ar" ? "العضو" : "Member",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{row.original.name ?? row.original.email}</p>
              <p className="font-mono text-xs text-foreground" dir="ltr">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: lang === "ar" ? "الدور" : "Role",
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant="outline">{roleLabels[row.original.role]?.[lang] ?? row.original.role}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: lang === "ar" ? "تاريخ الانضمام" : "Joined",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {new Date(row.original.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <IconButton
            icon={Trash2}
            variant="ghost"
            className="text-destructive"
            aria-label={lang === "ar" ? "إزالة" : "Remove"}
            onClick={() => onRemove(row.original)}
            loading={busyId === row.original.id}
          />
        ),
      },
    ],
    [lang, onRemove, busyId],
  );

  if (compact) {
    if (!members.length) return <EmptyState icon={<User className="h-12 w-12" />} title={lang === "ar" ? "لا يوجد أعضاء" : "No team members"} description={lang === "ar" ? "ابدأ بإرسال دعوة." : "Start by sending an invitation."} />;
    return (
      <div className="rounded-lg border border-border bg-card px-4">
        {members.map((member, index) => (
          <DataCard
            key={member.id}
            icon={User}
            iconTone="purple"
            title={member.name || member.email}
            subtitle={[member.email]}
            trailing={
              <div className="flex items-center gap-2">
                <Badge variant="outline">{roleLabels[member.role]?.[lang] ?? member.role}</Badge>
                <IconButton
                  icon={Trash2}
                  variant="ghost"
                  className="h-11 w-11 text-destructive"
                  onClick={() => onRemove(member)}
                  aria-label={lang === "ar" ? "إزالة" : "Remove"}
                />
              </div>
            }
            divider={index < members.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={members}
      loading={loading}
      locale={lang === "ar" ? "ar" : "en"}
      pagination
      pageSize={10}
      getRowId={(r) => r.id}
      emptyIcon={<UserPlus className="h-12 w-12" aria-hidden="true" />}
      emptyTitle={lang === "ar" ? "لا يوجد أعضاء" : "No team members"}
      emptyDescription={lang === "ar" ? "ابدأ بإرسال دعوة." : "Start by sending an invitation."}
      emptyAction={
        onInvite ? (
          <Button
            onClick={onInvite}
            style={{ display: "inline-flex" }}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {lang === "ar" ? "دعوة عضو" : "Invite member"}
          </Button>
        ) : undefined
      }
      mobileCard={(member) => (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{member.name ?? member.email}</p>
              <p className="truncate font-mono text-xs text-foreground" dir="ltr">{member.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">{roleLabels[member.role]?.[lang] ?? member.role}</Badge>
            <IconButton
              icon={Trash2}
              variant="ghost"
              className="text-destructive"
              aria-label={lang === "ar" ? "إزالة" : "Remove"}
              onClick={() => onRemove(member)}
            />
          </div>
        </div>
      )}
    />
  );
}

function InvitationList({
  invitations,
  lang,
  onResend,
  onRevoke,
  busyId,
}: {
  invitations: Invitation[];
  lang: "ar" | "en";
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  busyId: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">{lang === "ar" ? "الدعوات المعلقة" : "Pending invitations"}</h2>
          <p className="text-sm text-foreground">{lang === "ar" ? "يمكن إعادة إرسال الدعوات أو إلغاؤها من هنا." : "Resend or revoke email invitations from here."}</p>
        </div>
        {invitations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-foreground">{lang === "ar" ? "لا توجد دعوات معلقة" : "No pending invitations"}</div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {lang === "ar" ? "تنتهي في" : "Expires"} {new Date(invitation.expiresAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{roleLabels[invitation.role]?.[lang] ?? invitation.role}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => onResend(invitation.id)} loading={busyId === invitation.id} style={{ display: "inline-flex" }}>
                    <RotateCcw className="h-4 w-4" />
                    {lang === "ar" ? "إعادة إرسال" : "Resend"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onRevoke(invitation.id)} loading={busyId === invitation.id} style={{ display: "inline-flex" }}>
                    <Trash2 className="h-4 w-4" />
                    {lang === "ar" ? "إلغاء" : "Revoke"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
