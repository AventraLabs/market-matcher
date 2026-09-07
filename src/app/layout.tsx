import type { Metadata } from "next";
import "./globals.css";
import { getOptionalUser } from "@/lib/session";
import { BottomNav } from "@/components/nav/bottom-nav";

export const metadata: Metadata = {
  title: "Market Matcher",
  description: "Werbung wird zum Entertainment.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getOptionalUser();

  return (
    <html lang="de" className="h-full antialiased dark">
      <body className="flex min-h-full flex-col bg-black text-white font-sans">
        {children}
        <BottomNav isLoggedIn={Boolean(user)} />
      </body>
    </html>
  );
}
