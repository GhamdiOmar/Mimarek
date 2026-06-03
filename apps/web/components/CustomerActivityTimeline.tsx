"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Phone,
  Mail,
  Users,
  MapPin,
  FileText,
  MessageCircle,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { Button, IconButton } from "@repo/ui";
import { useLanguage } from "./LanguageProvider";
import {
  addCustomerActivity,
  getCustomerActivities,
  deleteCustomerActivity,
} from "../app/actions/customers";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityType = "CALL" | "EMAIL" | "MEETING" | "SITE_VISIT" | "NOTE" | "WHATSAPP";

interface Activity {
  id: string;
  type: ActivityType;
  note: string;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(dateStr: string, lang: "ar" | "en"): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return lang === "ar" ? "للتو" : "Just now";
  if (hours < 24) return lang === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === "ar" ? "أمس" : "Yesterday";
  if (days < 30) return lang === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  SITE_VISIT: MapPin,
  NOTE: FileText,
  WHATSAPP: MessageCircle,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  CALL: "text-blue-600 bg-blue-50",
  EMAIL: "text-purple-600 bg-purple-50",
  MEETING: "text-amber-600 bg-amber-50",
  SITE_VISIT: "text-green-600 bg-green-50",
  NOTE: "text-gray-600 bg-gray-100",
  WHATSAPP: "text-emerald-600 bg-emerald-50",
};

const ACTIVITY_LABELS: Record<ActivityType, { ar: string; en: string }> = {
  CALL: { ar: "مكالمة", en: "Call" },
  EMAIL: { ar: "بريد إلكتروني", en: "Email" },
  MEETING: { ar: "اجتماع", en: "Meeting" },
  SITE_VISIT: { ar: "زيارة موقع", en: "Site Visit" },
  NOTE: { ar: "ملاحظة", en: "Note" },
  WHATSAPP: { ar: "واتساب", en: "WhatsApp" },
};

const ALL_TYPES: ActivityType[] = ["CALL", "EMAIL", "MEETING", "SITE_VISIT", "NOTE", "WHATSAPP"];

// ─── Component ────────────────────────────────────────────────────────────────

interface CustomerActivityTimelineProps {
  customerId: string;
}

export default function CustomerActivityTimeline({ customerId }: CustomerActivityTimelineProps) {
  const { lang } = useLanguage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>("NOTE");
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadActivities = async () => {
    setFetchLoading(true);
    setFetchError("");
    try {
      const data = await getCustomerActivities(customerId);
      setActivities(data as Activity[]);
    } catch {
      setFetchError(
        lang === "ar"
          ? "تعذّر تحميل سجل النشاطات. يرجى إعادة تحميل الصفحة."
          : "Failed to load activities. Please reload the page."
      );
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleSubmit = () => {
    if (!note.trim()) {
      setSubmitError(
        lang === "ar" ? "يرجى كتابة ملاحظة قبل الحفظ." : "Please write a note before saving."
      );
      return;
    }
    setSubmitError("");
    startTransition(async () => {
      try {
        await addCustomerActivity(customerId, { type: selectedType, note: note.trim() });
        setNote("");
        setShowForm(false);
        await loadActivities();
      } catch {
        setSubmitError(
          lang === "ar"
            ? "فشل في تسجيل النشاط. يرجى المحاولة مجدداً."
            : "Failed to log activity. Please try again."
        );
      }
    });
  };

  const handleDelete = async (activityId: string) => {
    const confirmed = window.confirm(
      lang === "ar"
        ? "هل أنت متأكد من حذف هذا النشاط؟"
        : "Are you sure you want to delete this activity?"
    );
    if (!confirmed) return;
    try {
      await deleteCustomerActivity(activityId);
      await loadActivities();
    } catch {
      // Show inline feedback via reload (silently reload to reflect state)
      await loadActivities();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-primary">
          {lang === "ar" ? "سجل النشاطات" : "Activity Log"}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitError("");
          }}
          className="gap-1.5 text-secondary hover:text-secondary/80"
          style={{ display: "inline-flex" }}
        >
          <Plus className="h-4 w-4" />
          {lang === "ar" ? "تسجيل نشاط" : "Log Activity"}
        </Button>
      </div>

      {/* Log Activity Form */}
      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Type selector */}
          {/* eslint-disable-next-line -- raw <button> intentional: these are toggle-selector pills with bespoke
              rounded-full + active/inactive bg classes that Button variants cannot reproduce without
              overriding the entire variant styling. Migrating to Button here would require className
              overrides that defeat the governance. Revisit if a Chip/TogglePill primitive ships. */}
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map((type) => {
              const Icon = ACTIVITY_ICONS[type];
              const isActive = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    isActive
                      ? "border-secondary bg-secondary text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-secondary/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ACTIVITY_LABELS[type][lang]}
                </button>
              );
            })}
          </div>

          {/* Note textarea */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              lang === "ar"
                ? "اكتب ملاحظاتك هنا..."
                : "Write your notes here..."
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:border-secondary transition-all"
          />

          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setNote("");
                setSubmitError("");
              }}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending}
              className="gap-2"
              style={{ display: "inline-flex" }}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "ar" ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Activity List */}
      {fetchLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "لا توجد نشاطات مسجّلة بعد."
              : "No activities logged yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
            const colorClass = ACTIVITY_COLORS[activity.type] ?? "text-gray-600 bg-gray-100";
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-card p-3 group hover:border-gray-200 transition-colors"
              >
                {/* Icon */}
                <div className={`mt-0.5 h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-primary">
                      {ACTIVITY_LABELS[activity.type][lang]}
                    </span>
                    {activity.createdBy?.name && (
                      <span className="text-xs text-muted-foreground">
                        · {activity.createdBy.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · {relativeDate(activity.createdAt, lang)}
                    </span>
                  </div>
                  {activity.note && (
                    <p className="text-sm text-foreground/80 leading-snug">{activity.note}</p>
                  )}
                </div>

                {/* Delete */}
                <IconButton
                  icon={Trash2}
                  aria-label={lang === "ar" ? "حذف النشاط" : "Delete activity"}
                  tooltip={lang === "ar" ? "حذف النشاط" : "Delete activity"}
                  variant="ghost"
                  onClick={() => handleDelete(activity.id)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 hover:text-destructive"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
