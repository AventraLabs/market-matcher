import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Use in Server Components / Actions that require a logged-in user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/** Use where a session is optional (e.g. the home page). */
export async function getOptionalUser() {
  const session = await auth();
  return session?.user ?? null;
}
