import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_MODEL, scoreMatch } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { AppError, handleError } from "@/lib/http";
import { isProfileReady, sponsorshipFor, toProfileData } from "@/lib/profile";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/jobs/[id]/match">) {
  try {
    const { id } = await ctx.params;
    const { profile } = await getCurrentUser();

    const [job, full] = await Promise.all([
      db.job.findUnique({ where: { id } }),
      db.profile.findUniqueOrThrow({ where: { id: profile.id }, include: { workAuth: true } }),
    ]);
    if (!job) throw new AppError("Job not found", 404);

    const data = toProfileData(full);
    if (!isProfileReady(data))
      throw new AppError("Add skills and experience to your profile before scoring jobs.", 409);

    const result = await scoreMatch(data, job, sponsorshipFor(data, job.countryCode));
    const reasons = { summary: result.summary, strengths: result.strengths, gaps: result.gaps };

    const [match] = await db.$transaction([
      db.match.upsert({
        where: { profileId_jobId: { profileId: profile.id, jobId: job.id } },
        create: { profileId: profile.id, jobId: job.id, score: result.score, reasons, aiModel: AI_MODEL },
        update: { score: result.score, reasons, aiModel: AI_MODEL },
      }),
      // The model reads the whole post, so its explicit verdict replaces the regex guess
      ...(result.sponsorship === "NOT_MENTIONED"
        ? []
        : [db.job.update({
            where: { id: job.id },
            data: {
              offersSponsorship: result.sponsorship === "OFFERED",
              sponsorEvidence: result.sponsorshipEvidence?.slice(0, 500) ?? job.sponsorEvidence,
            },
          })]),
    ]);

    return NextResponse.json({ score: match.score, reasons, sponsorship: result.sponsorship });
  } catch (err) {
    return handleError(err, "jobs/match");
  }
}
