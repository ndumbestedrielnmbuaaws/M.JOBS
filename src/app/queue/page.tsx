import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isClaimActive } from "@/lib/worker-auth";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { MatchReasons } from "@/lib/schemas";
import ApplicationReview, { type ReviewItem } from "@/components/ApplicationReview";

export const dynamic = "force-dynamic";

const VIEWS = {
  review: { label: "Waiting for review", statuses: ["PENDING_APPROVAL", "DRAFT"] },
  approved: { label: "Approved, not sent", statuses: ["APPROVED"] },
  sent: { label: "Sent", statuses: ["APPLIED", "INTERVIEWING", "OFFER"] },
  closed: { label: "Closed", statuses: ["REJECTED", "WITHDRAWN"] },
} satisfies Record<string, { label: string; statuses: ApplicationStatus[] }>;

type View = keyof typeof VIEWS;

const EMPTY: Record<View, string> = {
  review: "Nothing to review. Open a job and choose Draft application to add one.",
  approved: "No approved applications. Approve one from the review list first.",
  sent: "Applications you mark as sent appear here, so you can track interviews and offers.",
  closed: "Applications you decided against, or that were rejected, appear here.",
};

export default async function QueuePage(props: PageProps<"/queue">) {
  const { view: raw } = await props.searchParams;
  const view: View = typeof raw === "string" && raw in VIEWS ? (raw as View) : "review";
  const { profile } = await getCurrentUser();

  const [apps, counts] = await Promise.all([
    db.application.findMany({
      where: { profileId: profile.id, status: { in: VIEWS[view].statuses } },
      orderBy: { updatedAt: "desc" },
      include: {
        cv: { select: { fileName: true } },
        job: {
          select: {
            id: true, title: true, company: true, location: true, url: true,
            publisher: true, applyIsDirect: true, offersSponsorship: true,
            matches: { where: { profileId: profile.id }, select: { score: true, reasons: true } },
          },
        },
      },
    }),
    db.application.groupBy({ by: ["status"], where: { profileId: profile.id }, _count: true }),
  ]);

  const countFor = (v: View) =>
    counts.filter((c) => (VIEWS[v].statuses as ApplicationStatus[]).includes(c.status)).reduce((n, c) => n + c._count, 0);

  const items: ReviewItem[] = apps.map((a) => {
    const { matches, ...job } = a.job;
    const match = matches[0];
    return {
      id: a.id,
      status: a.status,
      subject: a.subject,
      coverLetter: a.coverLetter,
      notes: a.notes,
      usedFacts: Array.isArray(a.usedFacts) ? (a.usedFacts as string[]) : [],
      cvFileName: a.cv?.fileName ?? null,
      updatedAt: a.updatedAt.toISOString(),
      applier: {
        claimed: isClaimActive(a.claimedAt),
        channel: a.applyChannel,
        note: a.applyNote,
      },
      job,
      score: match?.score ?? null,
      gaps: (match?.reasons as MatchReasons | undefined)?.gaps ?? [],
    };
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="page-title">Approval queue</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Every application stops here. Read the letter, check the facts it uses, then approve it before anything is sent.
        </p>
      </header>

      <nav aria-label="Queue views" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {(Object.keys(VIEWS) as View[]).map((v) => {
          const active = v === view;
          return (
            <Link
              key={v}
              href={v === "review" ? "/queue" : `/queue?view=${v}`}
              aria-current={active ? "page" : undefined}
              className={[
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              ].join(" ")}
            >
              {VIEWS[v].label}
              <span className="tabular-nums text-muted">{countFor(v)}</span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p className="text-muted">{EMPTY[view]}</p>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <ApplicationReview key={`${item.id}-${item.updatedAt}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
