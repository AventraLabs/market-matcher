import Link from "next/link";
import { getOptionalUser } from "@/lib/session";

export default async function Home() {
  const user = await getOptionalUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
        MARKET <span className="text-orange-500">MATCHER</span>
      </h1>
      <p className="mt-3 max-w-md text-lg text-zinc-400">Werbung wird zum Entertainment.</p>

      <div className="mt-8 flex gap-3">
        {user ? (
          <Link
            href="/profile"
            className="rounded-lg bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-500"
          >
            Zum Profil
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="rounded-lg bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-500"
            >
              Account erstellen
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold text-zinc-200 hover:border-zinc-500"
            >
              Anmelden
            </Link>
          </>
        )}
      </div>

      <Link href="/brands" className="mt-6 text-sm text-orange-500 hover:underline">
        Marken entdecken →
      </Link>

      <p className="mt-16 text-xs text-zinc-600">
        Phase 1-4 — Accounts, Marken, Video, Challenges.
      </p>
    </div>
  );
}
