"use client";

import Link from "next/link";
import { useState } from "react";
import MatchScore from "./MatchScore";
import SponsorTag from "./SponsorTag";
import StatusBadge from "./StatusBadge";
import { apiError, postedAgo, salaryRange } from "./format";
import { countryName } from "@/lib/constants";
import type { JobSearchResult } from "@/lib/jobs/aggregator";

export default function JobCard({ job }: { job: JobSearchResult }) {
  const [score, setScore] = useState(job.score);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onScore() {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/match`, { method: "POST" });
      if (!res.ok) throw new Error(await apiError(res, "Scoring failed."));
      setScore((await res.json()).score);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed.");
    } finally {
      setScoring(false);
    }
  }

  const meta = [
    job.location ?? countryName(job.countryCode),
    job.remote ? "Remote" : null,
    salaryRange(job.salaryMin, job.salaryMax, job.currency),
    postedAgo(job.postedAt),
  ].filter(Boolean);

  return (
    <li className="grid grid-cols-[4.5rem_1fr] gap-4 py-5 sm:grid-cols-[4.5rem_1fr_auto]">
      <MatchScore score={score} />
      <div className="min-w-0">
        <Link href={`/jobs/${job.id}`} className="font-semibold hover:underline">
          {job.title}
        </Link>
        <p className="text-sm">{job.company}</p>
        <p className="mt-0.5 text-sm text-muted">{meta.join(", ")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {(job.via ?? job.publisher) && <span>Listed on {job.via ?? job.publisher}</span>}
          <SponsorTag offers={job.offersSponsorship} />
          {job.application && <StatusBadge status={job.application.status} />}
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
        <button type="button" className="btn" onClick={onScore} disabled={scoring}>
          {scoring ? "Scoring…" : score === null ? "Score match" : "Rescore"}
        </button>
        <Link href={`/jobs/${job.id}`} className="btn btn-quiet">View job</Link>
      </div>
    </li>
  );
}
