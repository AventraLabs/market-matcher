"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed", icon: "🏠" },
  { href: "/pitches", label: "Pitches", icon: "🎤" },
  { href: "/brands", label: "Marken", icon: "🏢" },
] as const;

export function BottomNav({ isLoggedIn, unreadCount = 0 }: { isLoggedIn: boolean; unreadCount?: number }) {
  const pathname = usePathname();
  // Phase 10: a real destination for reminders/notifications, not just a
  // block buried in Profile — see /notifications.
  const notificationsTab = {
    href: isLoggedIn ? "/notifications" : "/login",
    label: "Erinnerungen",
    icon: "🔔",
  };
  const profileTab = { href: isLoggedIn ? "/profile" : "/login", label: isLoggedIn ? "Profil" : "Anmelden", icon: "👤" };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-white/10 bg-black/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {[...TABS, notificationsTab, profileTab].map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const showBadge = tab === notificationsTab && isLoggedIn && unreadCount > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active ? "text-orange-500" : "text-zinc-400"
            }`}
          >
            <span className="relative text-lg leading-none">
              {tab.icon}
              {showBadge && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
