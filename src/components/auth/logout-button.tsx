import { logoutUser } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutUser}>
      <button
        type="submit"
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
      >
        Abmelden
      </button>
    </form>
  );
}
