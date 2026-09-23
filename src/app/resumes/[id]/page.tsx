import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canReadResume, getResumeForViewing } from "@/lib/resume-access";
import {
  getStructuredData,
  buildResumeHTML,
  isSplitTemplate,
  planSplitLayout,
} from "@/lib/resume/resumeData.js";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resume — ReferIn" };

/**
 * Read-only view of a resume.
 *
 * This is what a referrer opens when they are deciding whether to put their
 * name on someone, and what a recruiter opens when the referral reaches them.
 * It renders the same document the builder renders — `buildResumeHTML` is pure
 * string-building with no DOM access, so it runs here on the server and the
 * viewer never downloads the editor.
 *
 * Access is resolved through the referral, not the viewer's role: see
 * `lib/resume-access.ts`.
 */
export default async function ResumeViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  if (!(await canReadResume(id, user))) {
    // Deliberately the same answer as a resume that does not exist — a
    // distinguishable "forbidden" would confirm that a given id is real.
    notFound();
  }

  const row = await getResumeForViewing(id);
  if (!row) notFound();

  let doc: {
    form?: Record<string, string>;
    template?: string;
    accent?: string;
    sectionOrder?: string[];
    fontScale?: number | null;
    columnPins?: Record<string, string>;
    boldCerts?: boolean;
  };
  try {
    doc = JSON.parse(row.data);
  } catch {
    notFound();
  }

  const form = doc.form ?? {};
  const template = doc.template ?? "classic";
  const accent = doc.accent ?? "#2563eb";
  const data = getStructuredData(form);

  const html = buildResumeHTML(data, {
    template,
    accent,
    order: doc.sectionOrder,
    split: isSplitTemplate(template)
      ? planSplitLayout(data, doc.sectionOrder ?? [], doc.columnPins ?? {})
      : undefined,
  });

  const isOwner = row.ownerId === user.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {row.fullName || row.ownerName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {row.headline ? `${row.headline} · ` : ""}
            {row.title} · updated {formatDate(row.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {typeof row.atsScore === "number" && (
            <span className="pill bg-slate-100 text-slate-700 ring-slate-200">
              ATS {row.atsScore}/100
            </span>
          )}
          {isOwner && (
            <Link href={`/resume?id=${row.id}`} className="btn-secondary btn-sm">
              Edit
            </Link>
          )}
        </div>
      </div>

      {/*
        The document carries its own stylesheet from the builder, so it is
        wrapped in `.rb` exactly as the editor's preview is. `resume-paper`
        constrains it to a page-like column on this otherwise light page.
      */}
      <div className="rb rb-doc overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4 sm:p-6">
        <div
          className={`resume-page tpl-${template}${doc.boldCerts ? " certs-bold" : ""}`}
          style={
            {
              "--tpl-accent": accent,
              "--font-scale": doc.fontScale || 1,
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {!isOwner && (
        <p className="mt-4 text-xs text-slate-500">
          You can see this resume because {row.ownerName.split(" ")[0]} attached
          it to a referral involving you. It is not otherwise public.
        </p>
      )}
    </div>
  );
}
