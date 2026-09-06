import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Matcher",
  description: "Werbung wird zum Entertainment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased dark">
      <body className="flex min-h-full flex-col bg-black text-white font-sans">{children}</body>
    </html>
  );
}
