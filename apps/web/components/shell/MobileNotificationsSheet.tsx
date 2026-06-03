"use client";

import * as React from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { BottomSheet, Button } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../LanguageProvider";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "../../app/actions/notifications";

interface MobileNotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadChange?: (count: number) => void;
}

type Notif = {
  id: string;
  title: string;
  titleEn?: string | null;
  message: string;
  messageEn?: string | null;
  read: boolean;
  link?: string | null;
  createdAt: Date | string;
};

export function MobileNotificationsSheet({
  open,
  onOpenChange,
  onUnreadChange,
}: MobileNotificationsSheetProps) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [notifs, setNotifs] = React.useState<Notif[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMyNotifications(20)
      .then((r) => setNotifs(r as Notif[]))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, [open]);

  const unread = notifs.filter((n) => !n.read).length;

  async function handleTap(n: Notif) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      onUnreadChange?.(Math.max(0, unread - 1));
    }
    onOpenChange(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    await markAllAsRead();
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    onUnreadChange?.(0);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lang === "ar" ? "الإشعارات" : "Notifications"}
    >
      <div className="space-y-3">
        {unread > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium text-foreground tabular-nums">
              {lang === "ar" ? `${unread} غير مقروء` : `${unread} unread`}
            </span>
            <Button
              onClick={handleMarkAll}
              variant="link"
              size="sm"
              className="gap-1.5 text-primary"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {lang === "ar" ? "تحديد الكل" : "Mark all read"}
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {lang === "ar" ? "لا توجد إشعارات" : "No notifications"}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {lang === "ar"
                ? "ستظهر الإشعارات الجديدة هنا"
                : "New notifications will appear here"}
            </p>
          </div>
        )}

        {!loading && notifs.length > 0 && (
          <div className="space-y-2">
            {notifs.map((n) => (
              <Button
                key={n.id}
                onClick={() => handleTap(n)}
                variant="ghost"
                className={cn(
                  "w-full justify-start rounded-xl border border-border bg-card px-3 py-3 h-auto text-start hover:bg-muted/30 active:bg-muted/50",
                  !n.read && "bg-primary/5 border-primary/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      !n.read ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {lang === "ar" ? n.title : (n.titleEn || n.title)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {lang === "ar" ? n.message : (n.messageEn || n.message)}
                    </p>
                    <span className="mt-2 block text-[10px] text-muted-foreground/60 tabular-nums">
                      {new Date(n.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
