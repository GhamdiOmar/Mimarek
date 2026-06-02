"use client";

import * as React from "react";
import { Menu, Search, Bell, User } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button, IconButton } from "@repo/ui";
import { MimaricLogo } from "../brand/MimaricLogo";
import { useSession } from "../SimpleSessionProvider";
import { useLanguage } from "../LanguageProvider";
import { getUnreadCount } from "../../app/actions/notifications";
import { getOrgName } from "../../app/actions/organization";
import { MobileSearchSheet } from "./MobileSearchSheet";
import { MobileNotificationsSheet } from "./MobileNotificationsSheet";
import { MobileUserMenuSheet } from "./MobileUserMenuSheet";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  const { data: session } = useSession();
  const { lang } = useLanguage();

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [orgName, setOrgName] = React.useState<string | undefined>(undefined);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);

  React.useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  React.useEffect(() => {
    getOrgName()
      .then((org) => {
        if (org) setOrgName(org.nameArabic || org.nameEnglish || org.name);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border",
          "bg-card/95 backdrop-blur-md px-2 pt-safe-top"
        )}
      >
        {/* Leading: hamburger */}
        <IconButton
          icon={Menu}
          aria-label={lang === "ar" ? "فتح القائمة" : "Open menu"}
          onClick={onMenuClick}
          variant="ghost"
        />

        {/* Centered wordmark */}
        <div className="flex flex-1 items-center justify-center">
          <MimaricLogo width={96} />
        </div>

        {/* Trailing */}
        <div className="flex items-center gap-0.5">
          <IconButton
            icon={Search}
            aria-label={lang === "ar" ? "بحث" : "Search"}
            onClick={() => setShowSearch(true)}
            variant="ghost"
          />

          <span className="relative inline-flex">
            <IconButton
              icon={Bell}
              aria-label={lang === "ar" ? "الإشعارات" : "Notifications"}
              onClick={() => setShowNotifs(true)}
              variant="ghost"
            />
            {unreadCount > 0 && (
              <span
                className={cn(
                  "pointer-events-none absolute top-2 end-2 flex h-4 w-4 items-center justify-center rounded-full",
                  "bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-card tabular-nums"
                )}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>

          <Button
            onClick={() => setShowMenu(true)}
            variant="ghost"
            size="icon"
            aria-label={lang === "ar" ? "الملف الشخصي" : "Profile"}
            className="p-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              {session?.user?.name ? (
                <span className="text-xs font-semibold text-primary">
                  {session.user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
          </Button>
        </div>
      </header>

      <MobileSearchSheet open={showSearch} onOpenChange={setShowSearch} />
      <MobileNotificationsSheet
        open={showNotifs}
        onOpenChange={setShowNotifs}
        onUnreadChange={setUnreadCount}
      />
      <MobileUserMenuSheet open={showMenu} onOpenChange={setShowMenu} orgName={orgName} />
    </>
  );
}
