import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/lib/http";
import { CLAIM_LEASE_MINUTES, MAX_APPLY_ATTEMPTS, assertWorker } from "@/lib/worker-auth";
import type { ApplyOption } from "@/lib/jobs/publishers";

/**
 * Hands the applier the oldest APPROVED application. Only approved items can ever be claimed,
 * so the approval queue stays the gate for anything the service touches.
 */
export async function POST(req: Request) {
  try {
    const workerId = assertWorker(req);
    const staleBefore = new Date(Date.now() - CLAIM_LEASE_MINUTES * 60_000);

    for (let tries = 0; tries < 3; tries++) {
      const candidate = await db.application.findFirst({
        where: {
          status: "APPROVED",
          applyAttempts: { lt: MAX_APPLY_ATTEMPTS },
          AND: [
            // `not` alone would also exclude NULL channels, which are exactly the fresh ones
            { OR: [{ applyChannel: null }, { applyChannel: { not: "manual" } }] },
            { OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
          ],
        },
        orderBy: { approvedAt: "asc" },
        select: { id: true, claimedAt: true },
      });
      if (!candidate) return new NextResponse(null, { status: 204 });

      // Conditional update: if another worker claimed it first, count is 0 and we try the next one
      const { count } = await db.application.updateMany({
        where: { id: candidate.id, status: "APPROVED", claimedAt: candidate.claimedAt },
        data: { claimedAt: new Date(), claimedBy: workerId, applyAttempts: { increment: 1 } },
      });
      if (count === 0) continue;

      const app = await db.application.findUniqueOrThrow({
        where: { id: candidate.id },
        include: {
          cv: { select: { id: true, fileName: true, mimeType: true } },
          job: { select: { title: true, company: true, url: true, applyIsDirect: true, applyOptions: true } },
          profile: {
            select: {
              fullName: true, email: true, phone: true, linkedinUrl: true, websiteUrl: true,
              location: true, headline: true,
              experience: true,
            },
          },
        },
      });

      const experience = Array.isArray(app.profile.experience)
        ? (app.profile.experience as { company?: string; isCurrent?: boolean }[])
        : [];

      return NextResponse.json({
        id: app.id,
        attempt: app.applyAttempts,
        subject: app.subject,
        coverLetter: app.coverLetter,
        cv: app.cv,
        job: {
          title: app.job.title,
          company: app.job.company,
          url: app.job.url,
          applyIsDirect: app.job.applyIsDirect,
          applyOptions: app.job.applyOptions as ApplyOption[],
        },
        candidate: {
          fullName: app.profile.fullName,
          email: app.profile.email,
          phone: app.profile.phone,
          linkedinUrl: app.profile.linkedinUrl,
          websiteUrl: app.profile.websiteUrl,
          location: app.profile.location,
          currentTitle: app.profile.headline,
          currentCompany: experience.find((e) => e.isCurrent)?.company ?? null,
        },
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err, "worker/claim");
  }
}
