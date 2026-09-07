import { requireUser } from "@/lib/session";
import { getNotificationsForUser } from "@/lib/notification";
import { NotificationList } from "@/components/notification/notification-list";

// Phase 10: a real, standalone screen for this — previously notifications
// only showed up as a small block on /profile, which is exactly why a
// reminder could get lost: the Pitch goes live, disappears from Pitches,
// and if you also scroll past it in the Feed there was nowhere left to go
// find it again. This page is that "nowhere left to go" fix — every
// notification stays listed here (read or not) until the app is cleared out,
// same as any other app's activity/inbox screen.
export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotificationsForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Benachrichtigungen</h1>
      <NotificationList notifications={notifications} />
    </div>
  );
}
