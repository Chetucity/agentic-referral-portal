import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${env.appName} — referrals, without the guesswork`,
    template: `%s — ${env.appName}`,
  },
  description:
    "Find openings, see who inside the company can refer you, and track every referral end to end.",
  applicationName: env.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: env.appName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: env.appName,
    title: `${env.appName} — see who can refer you`,
    description:
      "Job boards show you a listing. This shows you the person inside who can put your name forward — and what happened next.",
  },
};

/**
 * Viewport and theme.
 *
 * `viewportFit: "cover"` lets the page paint under the notch and the gesture
 * bar, which is what makes the installed Android app look like an app rather
 * than a web page with grey strips top and bottom. Pages that need it read the
 * safe-area insets from CSS.
 *
 * Pinch-zoom is deliberately **not** disabled. `maximumScale: 1` is a common
 * default in app-like PWAs and Play's accessibility review flags it, because
 * it stops people enlarging text they cannot read.
 */
export const viewport: Viewport = {
  themeColor: "#05060c",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <NavBar user={user} />
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-brand-900/40 bg-ink-950">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <p className="text-sm text-slate-400">
              {env.appName} — openings, the people who can refer you, and where
              every request stands.
            </p>
            {/*
              Play requires a privacy policy and an account-deletion page that
              are reachable without signing in. A reviewer looks for them, and
              a footer link is where they look first.
            */}
            <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <Link href="/legal/privacy" className="hover:text-brand-300 hover:underline">
                Privacy
              </Link>
              <Link href="/legal/terms" className="hover:text-brand-300 hover:underline">
                Terms
              </Link>
              <Link href="/account/delete" className="hover:text-brand-300 hover:underline">
                Delete your account
              </Link>
              <Link href="/contact" className="hover:text-brand-300 hover:underline">
                Contact
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
