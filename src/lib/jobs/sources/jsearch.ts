import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/http";
import { detectSponsorship } from "../sponsorship";
import type { NormalizedJob } from "../types";

const HOST = "jsearch.p.rapidapi.com";

const Envelope = z.object({ data: z.array(z.unknown()) });

// Permissive: any field except the core ones may be missing
const JSearchJob = z.object({
  job_id: z.string(),
  job_title: z.string(),
  employer_name: z.string(),
  job_apply_link: z.string(),
  job_publisher: z.string().nullish(),
  job_apply_is_direct: z.boolean().nullish(),
  apply_options: z
    .array(z.object({ publisher: z.string(), apply_link: z.string(), is_direct: z.boolean().nullish() }))
    .nullish(),
  job_description: z.string().nullish(),
  job_is_remote: z.boolean().nullish(),
  job_city: z.string().nullish(),
  job_state: z.string().nullish(),
  job_country: z.string().nullish(),
  job_posted_at_datetime_utc: z.string().nullish(),
  job_min_salary: z.number().nullish(),
  job_max_salary: z.number().nullish(),
  job_salary_currency: z.string().nullish(),
  job_salary_period: z.string().nullish(),
});
type JSearchJob = z.infer<typeof JSearchJob>;

export type JSearchParams = {
  query: string;
  location: string;
  country: string; // ISO alpha-2
  datePosted: "all" | "today" | "3days" | "week" | "month";
  remote: boolean;
  pages: number;
};

export async function searchJSearch(p: JSearchParams): Promise<NormalizedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new AppError("RAPIDAPI_KEY is not set", 500);

  const url = new URL(`https://${HOST}/search`);
  url.search = new URLSearchParams({
    query: `${p.query} in ${p.location}`,
    country: p.country.toLowerCase(),
    date_posted: p.datePosted,
    page: "1",
    num_pages: String(p.pages),
    ...(p.remote ? { work_from_home: "true" } : {}),
  }).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    throw new AppError("Job search timed out. Try again.", 504);
  }

  if (res.status === 401 || res.status === 403)
    throw new AppError("JSearch rejected the API key. Check RAPIDAPI_KEY and your subscription.", 502);
  if (res.status === 429)
    throw new AppError("JSearch rate limit or monthly quota reached.", 429);
  if (!res.ok) throw new AppError(`JSearch returned ${res.status}`, 502);

  const body = Envelope.safeParse(await res.json().catch(() => null));
  if (!body.success) throw new AppError("Unexpected response from JSearch", 502);

  // Skip malformed jobs one by one instead of failing the whole page
  return body.data.data.flatMap((raw) => {
    const j = JSearchJob.safeParse(raw);
    return j.success ? [normalize(j.data)] : [];
  });
}

const safeInt = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;

function normalize(j: JSearchJob): NormalizedJob {
  // Store annual salaries only; hourly or monthly figures would mislead filters
  const yearly = j.job_salary_period?.toUpperCase() === "YEAR";
  const sponsor = detectSponsorship(j.job_description);
  const posted = j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : null;

  return {
    source: "JSEARCH",
    externalId: j.job_id,
    url: j.job_apply_link,
    title: j.job_title.trim(),
    company: j.employer_name.trim(),
    publisher: j.job_publisher ?? null,
    applyIsDirect: j.job_apply_is_direct ?? null,
    applyOptions: (j.apply_options ?? []).map((o) => ({
      publisher: o.publisher,
      url: o.apply_link,
      isDirect: o.is_direct ?? null,
    })),
    location: [j.job_city, j.job_state].filter(Boolean).join(", ") || null,
    countryCode: j.job_country?.toUpperCase() ?? null,
    remote: j.job_is_remote ?? false,
    description: (j.job_description ?? "").replace(/\u0000/g, ""),
    salaryMin: yearly ? safeInt(j.job_min_salary) : null,
    salaryMax: yearly ? safeInt(j.job_max_salary) : null,
    currency: yearly ? j.job_salary_currency ?? null : null,
    offersSponsorship: sponsor.offers,
    sponsorEvidence: sponsor.evidence,
    postedAt: posted && !isNaN(posted.getTime()) ? posted : null,
  };
}
