"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed", icon: "🏠" },
  { href: "/pitches", label: "Pitches", icon: "🎤" },
  { href: "/brands", label: "Marken", icon: "🏢" },
] as const;

export function BottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const profileTab = { href: isLoggedIn ? "/profile" : "/login", label: isLoggedIn ? "Profil" : "Anmelden", icon: "👤" };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-white/10 bg-black/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {[...TABS, profileTab].map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active ? "text-orange-500" : "text-zinc-400"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
