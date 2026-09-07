import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";

export default async function BrandsPage() {
  const allBrands = await db.select().from(brands).orderBy(desc(brands.createdAt));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Marken entdecken</h1>

      {allBrands.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Marken registriert.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {allBrands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/brands/${brand.slug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center hover:border-zinc-600"
              >
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
                  <img src={brand.logoUrl} alt={brand.name} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-800 text-2xl font-bold text-zinc-500">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-white">{brand.name}</span>
                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
                  {brand.category}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
