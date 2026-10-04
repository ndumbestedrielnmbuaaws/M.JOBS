import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleError, readJson } from "@/lib/http";
import { JobSearchSchema } from "@/lib/schemas";
import { searchJobs } from "@/lib/jobs/aggregator";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { profile } = await getCurrentUser();
    const input = JobSearchSchema.parse(await readJson(req));
    return NextResponse.json(await searchJobs(input, profile.id));
  } catch (err) {
    return handleError(err, "jobs/search");
  }
}
