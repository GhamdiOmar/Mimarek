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
  EmptyState,
  FAB,
  Input,
  PageHeader,
  ResponsiveDialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  AGENT: { ar: "وكيل", en: "Agent" },
  TECHNICIAN: { ar: "فني صيانة", en: "Technician" },
  USER: { ar: "مستخدم", en: "User" },
};

const inviteRoleOptions = CUSTOMER_ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: roleLabels[role] ?? { ar: role, en: role },
}));

export default function TeamManagementPage() {
  const { lang } = useLanguage();
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
      toast.error(lang === "ar" ? "تعذر تحميل الفريق" : "Could not load team");
    } finally {
      setLoading(false);
    }
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
        setInviteError(result.error ?? (lang === "ar" ? "تعذر إرسال الدعوة" : "Could not send invitation"));
        return;
      }
      setInviteFallbackUrl(result.emailSent ? null : result.inviteUrl ?? null);
      toast.success(result.emailSent ? (lang === "ar" ? "تم إرسال الدعوة" : "Invitation sent") : result.emailMessage);
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
      toast.success(lang === "ar" ? "تمت إزالة العضو" : "Team member removed");
      await fetchTeam();
    } catch {
      toast.error(lang === "ar" ? "تعذر إزالة العضو" : "Could not remove team member");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResend(invitationId: string) {
    setBusyId(invitationId);
    try {
      const result = await resendInvitation(invitationId);
      if (!result.success) {
        toast.error(result.error ?? (lang === "ar" ? "تعذر إعادة الإرسال" : "Could not resend invitation"));
        return;
      }
      setInviteFallbackUrl(result.emailSent ? null : result.inviteUrl ?? null);
      toast.success(result.emailSent ? (lang === "ar" ? "تم إرسال الدعوة مرة أخرى" : "Invitation resent") : result.emailMessage);
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
        toast.error(result.error ?? (lang === "ar" ? "تعذر إلغاء الدعوة" : "Could not revoke invitation"));
        return;
      }
      toast.success(lang === "ar" ? "تم إلغاء الدعوة" : "Invitation revoked");
      await fetchTeam();
    } finally {
      setBusyId(null);
    }
  }

  async function copyFallbackUrl() {
    if (!inviteFallbackUrl) return;
    try {
      await navigator.clipboard.writeText(inviteFallbackUrl);
      toast.success(lang === "ar" ? "تم نسخ رابط الدعوة" : "Invitation link copied");
    } catch {
      toast.error(lang === "ar" ? "تعذر نسخ رابط الدعوة" : "Could not copy the invitation link");
    }
  }

  const inviteForm = (
    <div className="space-y-4">
      {inviteError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>}
      {inviteFallbackUrl && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <p className="font-medium">{lang === "ar" ? "البريد غير مكتمل. استخدم الرابط مؤقتاً." : "Email is not configured. Use this fallback link for now."}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={copyFallbackUrl} style={{ display: "inline-flex" }}>
            <ClipboardCopy className="h-4 w-4" />
            {lang === "ar" ? "نسخ رابط الدعوة" : "Copy invite link"}
          </Button>
        </div>
      )}
      <label className="space-y-2 text-sm font-medium">
        {lang === "ar" ? "البريد الإلكتروني" : "Email"}
        <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} dir="ltr" placeholder="name@example.com" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        {lang === "ar" ? "الدور" : "Role"}
        <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">
          {inviteRoleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label[lang]}
            </option>
          ))}
        </select>
      </label>
      <Button className="min-h-[44px] w-full" onClick={handleInvite} disabled={inviting || !inviteEmail} loading={inviting} style={{ display: "inline-flex" }}>
        <Mail className="h-4 w-4" />
        {lang === "ar" ? "إرسال الدعوة" : "Send invitation"}
      </Button>
    </div>
  );

  const pendingInvitations = invitations.filter((invite) => invite.status === "PENDING_INVITE");

  return (
    <>
      <div className="md:hidden -m-4 flex min-h-dvh flex-col bg-background sm:-m-6" dir={dir}>
        <AppBar title={lang === "ar" ? "الفريق" : "Team"} subtitle={lang === "ar" ? "الأعضاء والدعوات" : "Members and invitations"} lang={lang} />
        <div className="flex-1 space-y-5 px-4 py-4 pb-28">
          {loading ? (
            <div className="py-12 text-center text-sm text-foreground animate-pulse">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
          ) : (
            <>
              <TeamList members={members} lang={lang} onRemove={(member) => setRemoveCandidate(member)} busyId={busyId} compact />
              <InvitationList invitations={pendingInvitations} lang={lang} onResend={handleResend} onRevoke={handleRevoke} busyId={busyId} />
            </>
          )}
        </div>
        <FAB icon={UserPlus} label={lang === "ar" ? "دعوة عضو" : "Invite member"} onClick={() => setShowInvite(true)} />
        <ResponsiveDialog open={showInvite} onOpenChange={setShowInvite} title={lang === "ar" ? "دعوة عضو جديد" : "Invite team member"} description={lang === "ar" ? "الدعوة ترسل عبر البريد ويقوم العضو بإنشاء كلمة المرور." : "The invite is sent by email and the member creates their own password."}>
          {inviteForm}
        </ResponsiveDialog>
      </div>

      <div className="hidden space-y-6 md:block" dir={dir}>
        <PageHeader
          title={lang === "ar" ? "إدارة فريق العمل" : "Team Management"}
          description={lang === "ar" ? "دعوات آمنة عبر البريد مع روابط قبول منتهية الصلاحية." : "Secure email invitations with expiring acceptance links."}
          actions={
            <Button size="sm" onClick={() => setShowInvite(true)} style={{ display: "inline-flex" }}>
              <UserPlus className="h-4 w-4" />
              {lang === "ar" ? "دعوة عضو جديد" : "Invite member"}
            </Button>
          }
        />

        {showInvite && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{lang === "ar" ? "دعوة عضو جديد" : "Invite team member"}</h2>
                <button type="button" onClick={() => setShowInvite(false)} aria-label={lang === "ar" ? "إغلاق" : "Close"} className="rounded-md p-2 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" dir="ltr" />
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
                  {inviteRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[lang]}
                    </option>
                  ))}
                </select>
                <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail} style={{ display: "inline-flex" }}>
                  <Mail className="h-4 w-4" />
                  {lang === "ar" ? "إرسال الدعوة" : "Send invitation"}
                </Button>
              </div>
              {inviteError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>}
              {inviteFallbackUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                  <span>{lang === "ar" ? "البريد غير مكتمل. استخدم الرابط مؤقتاً." : "Email is not configured. Use this fallback link for now."}</span>
                  <Button type="button" variant="secondary" size="sm" onClick={copyFallbackUrl} style={{ display: "inline-flex" }}>
                    <ClipboardCopy className="h-4 w-4" />
                    {lang === "ar" ? "نسخ الرابط" : "Copy link"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <TeamList members={members} lang={lang} onRemove={(member) => setRemoveCandidate(member)} busyId={busyId} loading={loading} />
        <InvitationList invitations={pendingInvitations} lang={lang} onResend={handleResend} onRevoke={handleRevoke} busyId={busyId} />
      </div>

      <ResponsiveDialog
        open={Boolean(removeCandidate)}
        onOpenChange={(open) => {
          if (!open) setRemoveCandidate(null);
        }}
        title={lang === "ar" ? "إزالة عضو الفريق" : "Remove team member"}
        description={
          lang === "ar"
            ? "سيتم إلغاء وصول هذا العضو إلى مساحة العمل. يمكن دعوته مرة أخرى لاحقاً."
            : "This removes the member's access to this workspace. You can invite them again later."
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{removeCandidate?.name ?? removeCandidate?.email}</p>
            <p className="text-foreground">{removeCandidate?.email}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRemoveCandidate(null)} style={{ display: "inline-flex" }}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
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
              {lang === "ar" ? "إزالة العضو" : "Remove member"}
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
}: {
  members: TeamMember[];
  lang: "ar" | "en";
  onRemove: (member: TeamMember) => void;
  busyId: string | null;
  loading?: boolean;
  compact?: boolean;
}) {
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
                <Button variant="secondary" size="icon" className="h-11 w-11" onClick={() => onRemove(member)} aria-label={lang === "ar" ? "إزالة" : "Remove"} style={{ display: "inline-flex" }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            }
            divider={index < members.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{lang === "ar" ? "العضو" : "Member"}</TableHead>
            <TableHead>{lang === "ar" ? "الدور" : "Role"}</TableHead>
            <TableHead>{lang === "ar" ? "تاريخ الانضمام" : "Joined"}</TableHead>
            <TableHead className="text-center">{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground animate-pulse">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</TableCell>
            </TableRow>
          ) : members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground">{lang === "ar" ? "لا يوجد أعضاء" : "No team members"}</TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{member.name ?? member.email}</p>
                      <p className="text-xs text-foreground">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{roleLabels[member.role]?.[lang] ?? member.role}</Badge></TableCell>
                <TableCell className="text-sm text-foreground">{new Date(member.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</TableCell>
                <TableCell className="text-center">
                  <Button variant="secondary" size="icon" onClick={() => onRemove(member)} loading={busyId === member.id} aria-label={lang === "ar" ? "إزالة" : "Remove"} style={{ display: "inline-flex" }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
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
                    {lang === "ar" ? "تنتهي في" : "Expires"} {new Date(invitation.expiresAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
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
