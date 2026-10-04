"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { apiError } from "./format";
import type { ApplicationStatus } from "@/generated/prisma/enums";

type Props = {
  jobId: string;
  hasScore: boolean;
  profileReady: boolean;
  application: { id: string; status: ApplicationStatus } | null;
};

export default function JobActions({ jobId, hasScore, profileReady, application }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"score" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(kind: "score" | "draft") {
    setBusy(kind);
    setError(null);
    try {
      const res =
        kind === "score"
          ? await fetch(`/api/jobs/${jobId}/match`, { method: "POST" })
          : await fetch("/api/applications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId }),
            });
      if (!res.ok) throw new Error(await apiError(res, kind === "score" ? "Scoring failed." : "Drafting failed."));
      if (kind === "draft") router.push("/queue");
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (!profileReady) {
    return (
      <p className="text-sm text-muted">
        <Link href="/profile" className="font-semibold text-ink underline">Complete your profile</Link> to score this job
        and draft an application.
      </p>
    );
  }

  const inQueue = application && application.status !== "WITHDRAWN";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={busy !== null} onClick={() => post("score")}>
          {busy === "score" ? "Scoring…" : hasScore ? "Rescore" : "Score match"}
        </button>
        {inQueue ? (
          <Link href="/queue" className="btn btn-primary">Open in approval queue</Link>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => post("draft")}>
            {busy === "draft" ? "Writing cover letter…" : "Draft application"}
          </button>
        )}
      </div>
      {application && (
        <p className="flex items-center gap-2 text-sm text-muted">
          Application: <StatusBadge status={application.status} />
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm text-brick">{error}</p>
    </div>
  );
}
