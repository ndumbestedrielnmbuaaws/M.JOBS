"use client";

import { useState } from "react";
import JobCard from "./JobCard";
import { apiError } from "./format";
import { COUNTRIES } from "@/lib/constants";
import { PUBLISHERS, type PublisherId } from "@/lib/jobs/publishers";
import type { JobSearchResult } from "@/lib/jobs/aggregator";
import type { JobSearchInput } from "@/lib/schemas";

type Form = Omit<JobSearchInput, "refresh">;
type SearchResponse = { results: JobSearchResult[]; total: number; fromCache: boolean };

export default function JobSearch({ defaults }: { defaults: Pick<Form, "query" | "location" | "country"> }) {
  const [form, setForm] = useState<Form>({
    ...defaults,
    datePosted: "week",
    remote: false,
    pages: 1,
    publishers: [],
    hideNoSponsorship: false,
    sponsorshipOnly: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const togglePublisher = (id: PublisherId) =>
    set("publishers", form.publishers.includes(id) ? form.publishers.filter((p) => p !== id) : [...form.publishers, id]);

  async function run(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, refresh }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Search failed."));
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  const hidden = data ? data.total - data.results.length : 0;

  return (
    <div>
      <form
        className="panel space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[2fr_1.5fr_1fr]">
          <div>
            <label className="label" htmlFor="q">Job title or keywords</label>
            <input id="q" className="input" required minLength={2} value={form.query} onChange={(e) => set("query", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="loc">City or region</label>
            <input id="loc" className="input" required minLength={2} value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <select id="country" className="input" value={form.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Only show jobs listed on</legend>
          <div className="flex flex-wrap gap-2">
            {PUBLISHERS.map((p) => {
              const on = form.publishers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePublisher(p.id)}
                  className={[
                    "rounded-full border px-3 py-1 text-sm font-medium",
                    on ? "border-ink bg-ink text-panel" : "border-line bg-panel text-ink hover:border-muted",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Leave all off to see every site. SEEK mostly lists Australia and New Zealand; Totaljobs lists the UK.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <label className="label" htmlFor="posted">Posted</label>
            <select id="posted" className="input w-40" value={form.datePosted} onChange={(e) => set("datePosted", e.target.value as Form["datePosted"])}>
              <option value="today">Today</option>
              <option value="3days">Last 3 days</option>
              <option value="week">Last week</option>
              <option value="month">Last month</option>
              <option value="all">Any time</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pages">Results</label>
            <select id="pages" className="input w-40" value={form.pages} onChange={(e) => set("pages", Number(e.target.value))}>
              <option value={1}>Up to 10</option>
              <option value={2}>Up to 20</option>
              <option value={3}>Up to 30</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.remote} onChange={(e) => set("remote", e.target.checked)} />
            Remote only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hideNoSponsorship}
              disabled={form.sponsorshipOnly}
              onChange={(e) => set("hideNoSponsorship", e.target.checked)}
            />
            Hide jobs that say they won&apos;t sponsor
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.sponsorshipOnly}
              onChange={(e) => set("sponsorshipOnly", e.target.checked)}
            />
            Only jobs that mention sponsorship
          </label>
          <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>
            {loading ? "Searching…" : "Search jobs"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Search a region by name, such as Scotland, to cover Edinburgh, Glasgow and Aberdeen at once.
          More results use more of your JSearch quota, and the same search is reused for 6 hours.
        </p>
      </form>

      <div role="status" aria-live="polite" className="mt-6">
        {error && <p className="text-brick">{error}</p>}
        {data && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
            <p>
              {data.results.length} {data.results.length === 1 ? "job" : "jobs"}
              {hidden > 0 && `, ${hidden} hidden by your filters`}
              {data.fromCache && ", from a search in the last 6 hours"}
            </p>
            {data.fromCache && (
              <button type="button" className="btn btn-quiet" disabled={loading} onClick={() => run(true)}>
                Fetch fresh results
              </button>
            )}
          </div>
        )}
      </div>

      {data && data.results.length === 0 && !error && (
        <p className="mt-4 text-muted">
          No jobs match. Widen the date range, turn off site filters or try a broader title.
        </p>
      )}

      {data && data.results.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {data.results.map((job) => <JobCard key={job.id} job={job} />)}
        </ul>
      )}
    </div>
  );
}
