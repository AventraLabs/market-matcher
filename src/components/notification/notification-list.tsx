"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markAllNotificationsRead } from "@/app/actions/notification";
import type { Notification } from "@/db/schema";

function timeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / (60 * 1000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `vor ${days}d`;
}

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const [isPending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.readAt);

  if (notifications.length === 0) {
    return <p className="text-sm text-zinc-500">Noch keine Benachrichtigungen — folge Marken, um nichts zu verpassen.</p>;
  }

  return (
    <div>
      {hasUnread && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => markAllNotificationsRead())}
          className="mb-3 text-xs font-medium text-orange-500 hover:underline disabled:opacity-50"
        >
          Alle als gelesen markieren
        </button>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => {
          const content = (
            <div
              className={
                "rounded-lg border p-3 text-sm transition-colors " +
                (n.readAt ? "border-zinc-800 text-zinc-400" : "border-orange-500/40 bg-orange-500/5 text-white")
              }
            >
              <p>{n.message}</p>
              <p className="mt-1 text-xs text-zinc-500">{timeAgo(n.createdAt)}</p>
            </div>
          );
          return (
            <li key={n.id}>
              {n.battleId ? (
                <Link href={`/battles/${n.battleId}`} className="block hover:opacity-80">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
