import type { Metadata } from "next";
import "./_styles/builder.css";
import "./_styles/portal.css";

export const metadata: Metadata = {
  title: "Resume builder — ReferIn",
  description:
    "Build an ATS-scored resume and attach it to a referral request, without leaving ReferIn.",
};

/**
 * The builder brings its own stylesheet, which is imported here rather than in
 * the root layout so it only loads for people who open this route.
 *
 * Every selector in that file sits under `.rb` (see
 * `scripts/scope-resume-css.mjs`), which is why this wrapper exists: it is the
 * hook the whole stylesheet hangs from. Without it the builder renders
 * unstyled, and with it the builder's rules — which restyle bare `input`,
 * `button` and `label` elements — cannot reach the rest of the portal.
 */
export default function ResumeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="rb">{children}</div>;
}
