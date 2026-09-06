"use client";

import { useActionState } from "react";
import { createBrand, type BrandFormState } from "@/app/actions/brand";
import { Field, FormError, SubmitButton } from "@/components/ui";
import { BrandCategories, BrandCountries } from "@/lib/validation";

const COUNTRY_LABELS: Record<(typeof BrandCountries)[number], string> = {
  AT: "Österreich",
  DE: "Deutschland",
  CH: "Schweiz",
  Other: "Andere",
};

export function CreateBrandForm() {
  const [state, action] = useActionState<BrandFormState, FormData>(createBrand, undefined);

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />

      <Field label="Markenname" name="name" errors={state?.errors?.name} />

      <div className="mb-4">
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-300">
          Beschreibung (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-orange-500"
        />
        {state?.errors?.description?.map((err) => (
          <p key={err} className="mt-1 text-sm text-red-400">
            {err}
          </p>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-zinc-300">
            Kategorie
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-orange-500"
          >
            <option value="" disabled>
              Wählen…
            </option>
            {BrandCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {state?.errors?.category?.map((err) => (
            <p key={err} className="mt-1 text-sm text-red-400">
              {err}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="country" className="mb-1 block text-sm font-medium text-zinc-300">
            Land
          </label>
          <select
            id="country"
            name="country"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-orange-500"
          >
            <option value="" disabled>
              Wählen…
            </option>
            {BrandCountries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
          {state?.errors?.country?.map((err) => (
            <p key={err} className="mt-1 text-sm text-red-400">
              {err}
            </p>
          ))}
        </div>
      </div>

      <Field label="Website (optional)" name="website" type="url" required={false} errors={state?.errors?.website} />

      <div className="mb-6">
        <label htmlFor="logo" className="mb-1 block text-sm font-medium text-zinc-300">
          Logo (optional, PNG/JPEG/WEBP/SVG, max. 2 MB)
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
        />
        {state?.errors?.logo?.map((err) => (
          <p key={err} className="mt-1 text-sm text-red-400">
            {err}
          </p>
        ))}
      </div>

      <SubmitButton>Marke veröffentlichen</SubmitButton>
    </form>
  );
}
