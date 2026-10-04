import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./http";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The applier service authenticates with a shared bearer token. Returns the worker's id. */
export function assertWorker(req: Request): string {
  const token = process.env.WORKER_TOKEN;
  if (!token || token.length < 32)
    throw new AppError("Applier is disabled: set WORKER_TOKEN (32+ characters) on the app.", 503);

  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Compare fixed-length digests so timing doesn't leak the token length or prefix
  if (!given || !timingSafeEqual(digest(given), digest(token))) throw new AppError("Unauthorized", 401);

  const id = req.headers.get("x-worker-id")?.trim().slice(0, 60);
  return id || "applier";
}

export const CLAIM_LEASE_MINUTES = 30;
export const MAX_APPLY_ATTEMPTS = 3;

export const isClaimActive = (claimedAt: Date | null) =>
  !!claimedAt && Date.now() - claimedAt.getTime() < CLAIM_LEASE_MINUTES * 60_000;
