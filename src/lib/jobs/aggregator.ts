import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { JobSearchInput } from "@/lib/schemas";
import { searchJSearch } from "./sources/jsearch";
import { findPublisherMatch, type ApplyOption } from "./publishers";

const CACHE_HOURS = 6;

/**
 * Searches JSearch (or reuses a recent identical search), stores jobs,
 * then applies publisher and sponsorship filters locally.
 */
export async function searchJobs(input: JobSearchInput, profileId: string) {
  const params = {
    query: input.query,
    location: input.location,
    country: input.country,
    datePosted: input.datePosted,
    remote: input.remote,
    pages: input.pages,
  };
  const key = createHash("sha256")
    .update(JSON.stringify({ ...params, query: params.query.toLowerCase(), location: params.location.toLowerCase() }))
    .digest("hex");

  const cached = await db.searchRun.findUnique({ where: { key } });
  const fresh = cached && Date.now() - cached.ranAt.getTime() < CACHE_HOURS * 3_600_000;

  let jobIds: string[];
  let fromCache = false;

  if (fresh && !input.refresh) {
    jobIds = cached.jobIds as string[];
    fromCache = true;
  } else {
    const found = await searchJSearch(params);
    const stored = await db.$transaction(
      found.map((job) => {
        // Keep sponsorship fields on refresh: match scoring may have corrected them
        const refreshable: Partial<typeof job> = { ...job };
        delete refreshable.offersSponsorship;
        delete refreshable.sponsorEvidence;
        return db.job.upsert({
          where: { source_externalId: { source: job.source, externalId: job.externalId } },
          create: job,
          update: { ...refreshable, fetchedAt: new Date() },
          select: { id: true },
        });
      }),
    );
    jobIds = stored.map((j) => j.id);
    await db.searchRun.upsert({
      where: { key },
      create: { key, params, jobIds },
      update: { params, jobIds, ranAt: new Date() },
    });
  }

  const jobs = await db.job.findMany({
    where: { id: { in: jobIds } },
    orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }],
    include: {
      matches: { where: { profileId }, select: { score: true } },
      applications: { where: { profileId }, select: { id: true, status: true } },
    },
  });

  const results = jobs.flatMap((job) => {
    if (input.hideNoSponsorship && job.offersSponsorship === false) return [];
    // Sponsorship is only known once the post mentions it, so this hides untested jobs too
    if (input.sponsorshipOnly && job.offersSponsorship !== true) return [];
    const via = input.publishers.length
      ? findPublisherMatch(
          { company: job.company, publisher: job.publisher, applyOptions: job.applyOptions as ApplyOption[] },
          input.publishers,
        )
      : null;
    if (input.publishers.length && !via) return [];

    return [{
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      countryCode: job.countryCode,
      remote: job.remote,
      publisher: job.publisher,
      postedAt: job.postedAt?.toISOString() ?? null,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      offersSponsorship: job.offersSponsorship,
      url: via?.url ?? job.url,
      via: via?.label ?? null,
      score: job.matches[0]?.score ?? null,
      application: job.applications[0] ?? null,
    }];
  });

  return { results, total: jobs.length, fromCache };
}

export type JobSearchResult = Awaited<ReturnType<typeof searchJobs>>["results"][number];
