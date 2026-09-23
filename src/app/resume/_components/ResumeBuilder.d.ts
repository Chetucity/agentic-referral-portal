/**
 * Types for the ported resume builder.
 *
 * `ResumeBuilder.jsx` is JavaScript — it came across from the standalone Vite
 * app largely unchanged, and rewriting 400 lines of working editor logic in
 * TypeScript would have been churn rather than progress. This file gives the
 * one boundary that matters, the props the server page passes in, a real type,
 * so the two sides stay in step even though the component itself is untyped.
 */

export type ResumeListItem = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ResumeRow = {
  id: string;
  title: string;
  /** Serialised builder document. */
  data: string;
};

export type BuilderProfile = {
  name: string;
  email: string;
  headline: string | null;
  location: string | null;
  skills: string | null;
  linkedinUrl: string | null;
};

export type SaveResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string };

export type ResumeBuilderProps = {
  /** The user's saved resumes, newest edit first. */
  initialResumes: ResumeListItem[];
  /** The resume being opened, or null for a fresh one. */
  initialId: string | null;
  initialTitle: string;
  /** Parsed builder document, or null for a fresh one. */
  initialDoc: unknown;
  /** Portal profile used to prefill a brand-new resume. */
  profile: BuilderProfile | null;
  actions: {
    save: (input: unknown) => Promise<SaveResult>;
    load: (id: string) => Promise<ResumeRow | null>;
    remove: (id: string) => Promise<{ ok: true }>;
  };
};

declare function ResumeBuilder(props: ResumeBuilderProps): JSX.Element;
export default ResumeBuilder;
