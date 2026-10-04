import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCoverLetter } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { AppError, handleError, readJson } from "@/lib/http";
import { isProfileReady, sponsorshipFor, toProfileData } from "@/lib/profile";
import { CreateApplicationSchema } from "@/lib/schemas";

export const maxDuration = 60;

/** Drafts (or redrafts) the cover letter and puts the application in the approval queue. */
export async function POST(req: Request) {
  try {
    const { jobId } = CreateApplicationSchema.parse(await readJson(req));
    const { profile } = await getCurrentUser();

    const [job, full, existing, primaryCv] = await Promise.all([
      db.job.findUnique({ where: { id: jobId } }),
      db.profile.findUniqueOrThrow({ where: { id: profile.id }, include: { workAuth: true } }),
      db.application.findUnique({ where: { profileId_jobId: { profileId: profile.id, jobId } } }),
      db.cV.findFirst({ where: { profileId: profile.id, isPrimary: true }, select: { id: true } }),
    ]);
    if (!job) throw new AppError("Job not found", 404);
    if (existing && !["DRAFT", "PENDING_APPROVAL", "WITHDRAWN"].includes(existing.status))
      throw new AppError("This application has already been approved or sent.", 409);

    const data = toProfileData(full);
    if (!isProfileReady(data))
      throw new AppError("Add skills and experience to your profile first.", 409);

    const letter = await generateCoverLetter(data, job, sponsorshipFor(data, job.countryCode));
    const fields = {
      status: "PENDING_APPROVAL" as const,
      subject: letter.subject,
      coverLetter: letter.body,
      usedFacts: letter.usedFacts,
      cvId: primaryCv?.id ?? null,
      approvedAt: null,
    };

    const application = await db.application.upsert({
      where: { profileId_jobId: { profileId: profile.id, jobId } },
      create: { profileId: profile.id, jobId, ...fields },
      update: fields,
      select: { id: true, status: true },
    });

    return NextResponse.json(application, { status: existing ? 200 : 201 });
  } catch (err) {
    return handleError(err, "applications/create");
  }
}
