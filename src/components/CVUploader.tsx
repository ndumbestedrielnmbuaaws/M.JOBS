"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ParsedCV } from "@/lib/schemas";
import { MAX_CV_BYTES } from "@/lib/constants";

export type UploadResult = {
  cv: { id: string; fileName: string; isPrimary: boolean; createdAt: string };
  parsed: ParsedCV;
};

type Status =
  | { state: "idle" }
  | { state: "processing"; fileName: string }
  | { state: "done"; fileName: string }
  | { state: "error"; message: string };

type Props = {
  profileId: string;
  onParsed: (result: UploadResult) => void;
};

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return "Choose a PDF or DOCX file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_CV_BYTES) return `File must be under ${MAX_CV_BYTES / 1024 / 1024} MB.`;
  return null;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {}
  if (res.status === 413) return "File is too large.";
  if (res.status === 504) return "Processing timed out. Try again.";
  return "The CV couldn't be processed.";
}

export default function CVUploader({ profileId, onParsed }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function upload(file: File) {
    const invalid = validate(file);
    if (invalid) {
      setStatus({ state: "error", message: invalid });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ state: "processing", fileName: file.name });

    const fd = new FormData();
    fd.append("file", file);
    fd.append("profileId", profileId);

    try {
      const res = await fetch("/api/cv/parse", { method: "POST", body: fd, signal: controller.signal });
      if (!res.ok) throw new Error(await readError(res));
      const result = (await res.json()) as UploadResult;
      setStatus({ state: "done", fileName: file.name });
      onParsed(result);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof TypeError
          ? "Network error. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      setStatus({ state: "error", message });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = status.state === "processing";

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) upload(file);
        }}
        className={[
          "flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-8 text-center",
          "focus-within:ring-2 focus-within:ring-spruce",
          dragging ? "border-spruce bg-spruce-soft" : "border-line bg-panel hover:border-muted",
          busy ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        <span className="font-semibold">
          {status.state === "processing" ? `Reading ${status.fileName}…` : "Drop your CV here or choose a file"}
        </span>
        <span className="text-sm text-muted">
          {busy ? "Extracting and structuring your CV. This can take up to 30 seconds." : "PDF or DOCX, up to 5 MB"}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </label>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm">
        {status.state === "done" && (
          <span className="text-spruce">Read {status.fileName}. Check the details below, then save your profile.</span>
        )}
        {status.state === "error" && <span className="text-brick">{status.message}</span>}
      </p>
    </div>
  );
}
