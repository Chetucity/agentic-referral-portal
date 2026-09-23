import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ReferIn — referrals, without the guesswork",
  description:
    "Find openings, see who inside the company can refer you, and track every referral end to end.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <NavBar user={user} />
        <main>{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
            ReferIn — a referral portal demo. Openings, the people who can refer
            you, and where every request stands.
          </div>
        </footer>
      </body>
    </html>
  );
}
