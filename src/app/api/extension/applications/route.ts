import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/lib/http";
import { assertWorker } from "@/lib/worker-auth";
import { preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

/** Approved applications the browser extension can fill in for you. */
export async function GET(req: Request) {
  try {
    assertWorker(req);
    const apps = await db.application.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "asc" },
      take: 50,
      include: {
        cv: { select: { fileName: true } },
        job: { select: { title: true, company: true, url: true, location: true } },
        profile: {
          select: { fullName: true, email: true, phone: true, linkedinUrl: true, websiteUrl: true, location: true, headline: true },
        },
      },
    });

    return withCors(
      req,
      NextResponse.json(
        apps.map((a) => ({
          id: a.id,
          subject: a.subject,
          coverLetter: a.coverLetter,
          cvFileName: a.cv?.fileName ?? null,
          hasCv: !!a.cvId,
          job: a.job,
          candidate: {
            fullName: a.profile.fullName,
            email: a.profile.email,
            phone: a.profile.phone,
            linkedinUrl: a.profile.linkedinUrl,
            websiteUrl: a.profile.websiteUrl,
            location: a.profile.location,
            currentTitle: a.profile.headline,
          },
        })),
      ),
    );
  } catch (err) {
    return withCors(req, handleError(err, "extension/list"));
  }
}
