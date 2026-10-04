import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { countryName } from "@/lib/constants";
import { isProfileReady, sponsorshipFor, toProfileData } from "@/lib/profile";
import type { MatchReasons } from "@/lib/schemas";
import JobActions from "@/components/JobActions";
import MatchScore from "@/components/MatchScore";
import SponsorTag from "@/components/SponsorTag";
import { postedAgo, salaryRange } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const { profile } = await getCurrentUser();

  const [job, full] = await Promise.all([
    db.job.findUnique({
      where: { id },
      include: {
        matches: { where: { profileId: profile.id } },
        applications: { where: { profileId: profile.id }, select: { id: true, status: true } },
      },
    }),
    db.profile.findUniqueOrThrow({ where: { id: profile.id }, include: { workAuth: true } }),
  ]);
  if (!job) notFound();

  const data = toProfileData(full);
  const match = job.matches[0];
  const reasons = match?.reasons as MatchReasons | undefined;
  const needsSponsor = sponsorshipFor(data, job.countryCode) === "REQUIRED";

  const meta = [
    job.location ?? countryName(job.countryCode),
    job.remote ? "Remote" : null,
    salaryRange(job.salaryMin, job.salaryMax, job.currency),
    postedAgo(job.postedAt?.toISOString() ?? null),
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <Link href="/jobs" className="text-sm text-muted hover:text-ink">Back to search</Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <h1 className="page-title">{job.title}</h1>
          <p className="mt-1 text-lg">{job.company}</p>
          <p className="text-muted">{meta.join(", ")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <SponsorTag offers={job.offersSponsorship} />
            {job.publisher && <span className="text-muted">Listed on {job.publisher}</span>}
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Original listing
            </a>
          </div>
        </div>
        <MatchScore score={match?.score ?? null} size="lg" />
      </header>

      {needsSponsor && job.offersSponsorship === false && (
        <p className="rounded-md bg-brick-soft px-4 py-3 text-sm text-brick">
          You need sponsorship in {countryName(job.countryCode)} and this post says the employer won&apos;t sponsor.
          {job.sponsorEvidence && <span className="mt-1 block text-ink">&ldquo;{job.sponsorEvidence}&rdquo;</span>}
        </p>
      )}

      <JobActions
        jobId={job.id}
        hasScore={!!match}
        profileReady={isProfileReady(data)}
        application={job.applications[0] ?? null}
      />

      {reasons && (
        <section className="grid gap-6 border-y border-line py-6 sm:grid-cols-2" aria-labelledby="fit-heading">
          <div className="sm:col-span-2">
            <h2 id="fit-heading" className="section-title">How you fit</h2>
            <p className="mt-1 max-w-2xl">{reasons.summary}</p>
          </div>
          <div>
            <h3 className="font-semibold text-spruce">Strengths</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {reasons.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-brick">Gaps</h3>
            {reasons.gaps.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {reasons.gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No significant gaps found.</p>
            )}
          </div>
          <p className="text-xs text-muted sm:col-span-2">
            Scored {match.updatedAt.toLocaleDateString()} with {match.aiModel}. Rescore after updating your profile.
          </p>
        </section>
      )}

      <section aria-labelledby="desc-heading">
        <h2 id="desc-heading" className="section-title mb-3">Job description</h2>
        <div className="max-w-[72ch] whitespace-pre-line text-[0.95rem] leading-relaxed">
          {job.description || "The listing has no description."}
        </div>
      </section>
    </div>
  );
}
