import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { markAllNotificationsRead } from "@/app/actions/referrals";
import { EmptyState, PageHeader } from "@/components/ui";
import { timeAgo, cn } from "@/lib/utils";

export const metadata = { title: "Notifications — ReferIn" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();

  const rows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .all();

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "All caught up"}
      >
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="btn-secondary btn-sm" type="submit">
              Mark all read
            </button>
          </form>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing yet."
          body="Referral updates and new requests land here."
          action={{ href: "/dashboard", label: "Back to dashboard" }}
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((n) => {
            const body = (
              <div
                className={cn(
                  "flex gap-3 p-4",
                  !n.read && "bg-brand-50/40",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.read ? "bg-slate-200" : "bg-brand-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="mt-0.5 text-sm text-slate-600">{n.body}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-400">
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
              </div>
            );

            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
