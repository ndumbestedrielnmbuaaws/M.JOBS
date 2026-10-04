"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MatchScore from "./MatchScore";
import SponsorTag from "./SponsorTag";
import StatusBadge from "./StatusBadge";
import { apiError } from "./format";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { UpdateApplicationInput } from "@/lib/schemas";

export type ReviewItem = {
  id: string;
  status: ApplicationStatus;
  subject: string | null;
  coverLetter: string | null;
  notes: string | null;
  usedFacts: string[];
  cvFileName: string | null;
  updatedAt: string;
  applier: { claimed: boolean; channel: string | null; note: string | null };
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    url: string;
    publisher: string | null;
    applyIsDirect: boolean | null;
    offersSponsorship: boolean | null;
  };
  score: number | null;
  gaps: string[];
};

type Busy = UpdateApplicationInput["action"] | "redraft" | null;

/** Render with key={`${item.id}-${item.updatedAt}`} so edits reset when the server data changes. */
export default function ApplicationReview({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [subject, setSubject] = useState(item.subject ?? "");
  const [letter, setLetter] = useState(item.coverLetter ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty = subject !== (item.subject ?? "") || letter !== (item.coverLetter ?? "") || notes !== (item.notes ?? "");
  const reviewing = item.status === "PENDING_APPROVAL" || item.status === "DRAFT";

  async function patch(body: UpdateApplicationInput) {
    const res = await fetch(`/api/applications/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await apiError(res, "The change couldn't be saved."));
  }

  async function act(action: Busy, work: () => Promise<void>, done?: string) {
    setBusy(action);
    setMessage(null);
    try {
      await work();
      if (done) setMessage({ tone: "good", text: done });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  const save = () => patch({ action: "save", subject, coverLetter: letter, notes: notes || null });

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ tone: "bad", text: "Copy failed. Select the text and copy it manually." });
    }
  }

  return (
    <article className="panel overflow-hidden" aria-labelledby={`app-${item.id}`}>
      <header className="flex flex-wrap items-start gap-5 border-b border-line p-5">
        <MatchScore score={item.score} />
        <div className="min-w-0 flex-1">
          <h2 id={`app-${item.id}`} className="section-title">
            <Link href={`/jobs/${item.job.id}`} className="hover:underline">{item.job.title}</Link>
          </h2>
          <p className="text-sm">{item.job.company}{item.job.location ? `, ${item.job.location}` : ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <SponsorTag offers={item.job.offersSponsorship} />
            {item.cvFileName && <span className="text-xs text-muted">CV: {item.cvFileName}</span>}
          </div>
        </div>
      </header>

      {reviewing ? (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor={`subj-${item.id}`}>Subject</label>
              <input id={`subj-${item.id}`} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`letter-${item.id}`}>Cover letter</label>
              <textarea
                id={`letter-${item.id}`}
                rows={16}
                className="input font-[inherit]"
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted tabular-nums">{letter.trim().split(/\s+/).filter(Boolean).length} words</p>
            </div>
            <div>
              <label className="label" htmlFor={`notes-${item.id}`}>Private notes</label>
              <textarea id={`notes-${item.id}`} rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <aside className="space-y-5 text-sm">
            <div>
              <h3 className="font-semibold">Check these facts</h3>
              <p className="mb-2 text-xs text-muted">The letter relies on them. Fix anything that isn&apos;t true.</p>
              {item.usedFacts.length ? (
                <ul className="list-disc space-y-1 pl-4">
                  {item.usedFacts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              ) : (
                <p className="text-muted">No facts listed.</p>
              )}
            </div>
            {item.gaps.length > 0 && (
              <div>
                <h3 className="font-semibold">Gaps the match found</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                  {item.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
          </aside>
        </div>
      ) : (
        item.coverLetter && (
          <details className="border-b border-line px-5 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">Cover letter</summary>
            <p className="mt-2 whitespace-pre-wrap">{item.coverLetter}</p>
          </details>
        )
      )}

      <footer className="flex flex-wrap items-center gap-2 bg-paper/60 px-5 py-3">
        {reviewing && (
          <>
            <button
              type="button" className="btn btn-approve" disabled={busy !== null || !letter.trim()}
              onClick={() => act("approve", async () => { if (dirty) await save(); await patch({ action: "approve" }); })}
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button type="button" className="btn" disabled={busy !== null || !dirty} onClick={() => act("save", save, "Changes saved")}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button" className="btn" disabled={busy !== null}
              onClick={() => {
                if (dirty && !confirm("Redrafting replaces your edits. Continue?")) return;
                act("redraft", async () => {
                  const res = await fetch("/api/applications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobId: item.job.id }),
                  });
                  if (!res.ok) throw new Error(await apiError(res, "Redrafting failed."));
                }, "New draft written");
              }}
            >
              {busy === "redraft" ? "Writing…" : "Redraft letter"}
            </button>
            <button type="button" className="btn btn-quiet ml-auto text-muted" disabled={busy !== null} onClick={() => act("reject", () => patch({ action: "reject" }))}>
              Don&apos;t apply
            </button>
          </>
        )}

        {item.status === "APPROVED" && (
          <>
            {(item.applier.claimed || item.applier.note) && (
              <p className="w-full rounded-md bg-panel px-3 py-2 text-sm">
                {item.applier.claimed
                  ? "The applier has this open in its browser. Check the form there and submit it."
                  : item.applier.note}
              </p>
            )}
            <a href={item.job.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Open application page
            </a>
            <button type="button" className="btn" onClick={copyLetter} disabled={!letter}>
              {copied ? "Copied" : "Copy cover letter"}
            </button>
            <button type="button" className="btn btn-approve" disabled={busy !== null} onClick={() => act("mark_applied", () => patch({ action: "mark_applied" }))}>
              {busy === "mark_applied" ? "Saving…" : "I've applied"}
            </button>
            <button type="button" className="btn btn-quiet ml-auto text-muted" disabled={busy !== null} onClick={() => act("reopen", () => patch({ action: "reopen" }))}>
              Back to review
            </button>
            <p className="w-full text-xs text-muted">
              {item.applier.channel === "manual"
                ? "The applier can't fill this site. Apply there yourself, then mark it as applied."
                : item.job.applyIsDirect
                ? "The applier will fill this form for you, or apply yourself using the link."
                : `This link opens the listing${item.job.publisher ? ` on ${item.job.publisher}` : ""}. Apply there yourself, then mark it as applied.`}
            </p>
          </>
        )}

        {["APPLIED", "INTERVIEWING", "OFFER"].includes(item.status) && (
          <label className="flex items-center gap-2 text-sm">
            Update outcome
            <select
              className="input w-44"
              value=""
              disabled={busy !== null}
              onChange={(e) => {
                const status = e.target.value as "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN";
                if (status) act("set_outcome", () => patch({ action: "set_outcome", status }));
              }}
            >
              <option value="">Choose…</option>
              <option value="INTERVIEWING">Interviewing</option>
              <option value="OFFER">Offer</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </label>
        )}

        {item.status === "WITHDRAWN" && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => act("reopen", () => patch({ action: "reopen" }))}>
            Move back to review
          </button>
        )}

        <p role="status" aria-live="polite" className={`text-sm ${message?.tone === "bad" ? "text-brick" : "text-spruce"}`}>
          {message?.text}
        </p>
      </footer>
    </article>
  );
}
