import Link from "next/link";
import { effectiveStatus, type ChallengeWithBrand } from "@/lib/challenge";
import { RespondButtons } from "@/components/challenge/respond-buttons";

const STATUS_LABEL: Record<string, string> = {
  pending: "Wartet auf Antwort",
  accepted: "Angenommen",
  declined: "Abgelehnt",
  expired: "Abgelaufen",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  accepted: "bg-green-500/10 text-green-400",
  declined: "bg-zinc-800 text-zinc-400",
  expired: "bg-zinc-800 text-zinc-500",
};

function StatusBadge({ status, battleId }: { status: string; battleId?: string | null }) {
  if (status === "accepted" && battleId) {
    return (
      <Link
        href={`/pitches/${battleId}`}
        className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400 hover:bg-orange-500/20"
      >
        Pitch ansehen →
      </Link>
    );
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "Noch 12 Tage" once there's more than a day left, "Noch 6h" once it's close. */
function timeLeftLabel(expiresAt: Date): string {
  const msLeft = Math.max(0, expiresAt.getTime() - Date.now());
  const hoursLeft = msLeft / (60 * 60 * 1000);
  if (hoursLeft >= 24) {
    return `Noch ${Math.ceil(hoursLeft / 24)} Tage`;
  }
  return `Noch ${Math.max(1, Math.ceil(hoursLeft))}h`;
}

function BrandChip({ brand }: { brand: ChallengeWithBrand["otherBrand"] }) {
  return (
    <Link href={`/brands/${brand.slug}`} className="flex items-center gap-2 hover:opacity-80">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
        <img src={brand.logoUrl} alt={brand.name} className="h-8 w-8 rounded-lg object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-zinc-500">
          {brand.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium text-white">{brand.name}</span>
    </Link>
  );
}

export function IncomingChallengeList({ challenges }: { challenges: ChallengeWithBrand[] }) {
  if (challenges.length === 0) {
    return <p className="text-sm text-zinc-500">Noch keine Einladungen erhalten.</p>;
  }
  return (
    <ul className="space-y-3">
      {challenges.map((c) => {
        const status = effectiveStatus(c);
        return (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
            <div>
              <BrandChip brand={c.otherBrand} />
              {status === "pending" ? (
                <p className="mt-1 text-xs text-zinc-500">{timeLeftLabel(c.expiresAt)} zum Antworten</p>
              ) : (
                <div className="mt-1">
                  <StatusBadge status={status} battleId={c.battleId} />
                </div>
              )}
            </div>
            {status === "pending" && <RespondButtons challengeId={c.id} />}
          </li>
        );
      })}
    </ul>
  );
}

export function OutgoingChallengeList({ challenges }: { challenges: ChallengeWithBrand[] }) {
  if (challenges.length === 0) {
    return <p className="text-sm text-zinc-500">Noch keine Einladungen gesendet.</p>;
  }
  return (
    <ul className="space-y-3">
      {challenges.map((c) => {
        const status = effectiveStatus(c);
        return (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
            <BrandChip brand={c.otherBrand} />
            <div className="text-right">
              <StatusBadge status={status} battleId={c.battleId} />
              {status === "pending" && <p className="mt-1 text-xs text-zinc-500">{timeLeftLabel(c.expiresAt)}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
