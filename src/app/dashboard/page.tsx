import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isProfileReady, toProfileData } from "@/lib/profile";
import MatchScore from "@/components/MatchScore";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();

  const [full, cvCount, statusCounts, topMatches, recent] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { id: profile.id }, include: { workAuth: true } }),
    db.cV.count({ where: { profileId: profile.id } }),
    db.application.groupBy({ by: ["status"], where: { profileId: profile.id }, _count: true }),
    db.match.findMany({
      where: {
        profileId: profile.id,
        job: { applications: { none: { profileId: profile.id } } },
      },
      orderBy: { score: "desc" },
      take: 5,
      include: { job: { select: { id: true, title: true, company: true, location: true } } },
    }),
    db.application.findMany({
      where: { profileId: profile.id, status: { notIn: ["DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { job: { select: { id: true, title: true, company: true } } },
    }),
  ]);

  const data = toProfileData(full);
  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const pending = count("PENDING_APPROVAL");
  const approved = count("APPROVED");
  const sent = count("APPLIED") + count("INTERVIEWING") + count("OFFER");
  const interviewing = count("INTERVIEWING") + count("OFFER");

  const steps = [
    { done: cvCount > 0, text: "Upload your CV", href: "/profile" },
    { done: isProfileReady(data), text: "Check and save your profile", href: "/profile" },
    { done: data.workAuth.length > 0, text: "Add the countries you can work in", href: "/profile" },
  ];
  const setupDone = steps.every((s) => s.done);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="page-title">{data.fullName ? `Hello, ${data.fullName.split(" ")[0]}` : "Overview"}</h1>
        <p className="mt-1 text-muted">
          {pending > 0
            ? `${pending} ${pending === 1 ? "application is" : "applications are"} waiting for your review.`
            : "Nothing is waiting for review."}
        </p>
      </header>

      {!setupDone && (
        <section className="panel p-5" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="section-title">Finish setting up</h2>
          <p className="text-sm text-muted">Scoring and cover letters use your saved profile.</p>
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <li key={s.text} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                    s.done ? "bg-spruce text-white" : "border border-line bg-panel text-muted"
                  }`}
                  aria-hidden
                >
                  {s.done ? "✓" : i + 1}
                </span>
                {s.done ? (
                  <span className="text-muted line-through">{s.text}</span>
                ) : (
                  <Link href={s.href} className="font-semibold underline">{s.text}</Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-label="Application pipeline" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Waiting for review", value: pending, href: "/queue", tone: pending ? "text-amber" : "" },
          { label: "Approved, not sent", value: approved, href: "/queue?view=approved", tone: "" },
          { label: "Sent", value: sent, href: "/queue?view=sent", tone: "" },
          { label: "Interviews and offers", value: interviewing, href: "/queue?view=sent", tone: interviewing ? "text-spruce" : "" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="bg-panel p-4 hover:bg-paper">
            <span className={`font-display text-3xl font-semibold tabular-nums ${s.tone}`}>{s.value}</span>
            <span className="block text-sm text-muted">{s.label}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="top-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="top-heading" className="section-title">Best matches to act on</h2>
            <Link href="/jobs" className="text-sm font-semibold underline">Find jobs</Link>
          </div>
          {topMatches.length === 0 ? (
            <p className="text-sm text-muted">Scored jobs you haven&apos;t drafted an application for appear here.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {topMatches.map((m) => (
                <li key={m.id} className="flex items-center gap-4 py-3">
                  <MatchScore score={m.score} />
                  <div className="min-w-0">
                    <Link href={`/jobs/${m.job.id}`} className="font-semibold hover:underline">{m.job.title}</Link>
                    <p className="truncate text-sm text-muted">{m.job.company}{m.job.location ? `, ${m.job.location}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="recent-heading" className="section-title">Recent applications</h2>
            <Link href="/queue" className="text-sm font-semibold underline">Approval queue</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Draft an application from any job page to start.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${a.job.id}`} className="font-semibold hover:underline">{a.job.title}</Link>
                    <p className="truncate text-sm text-muted">{a.job.company}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
