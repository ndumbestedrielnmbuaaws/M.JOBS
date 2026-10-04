import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canTransition } from "@/lib/applications";
import { AppError, handleError, readJson } from "@/lib/http";
import { UpdateApplicationSchema, type UpdateApplicationInput } from "@/lib/schemas";
import type { Prisma } from "@/generated/prisma/client";

function changesFor(input: UpdateApplicationInput): Prisma.ApplicationUpdateInput {
  switch (input.action) {
    case "save":
      return { subject: input.subject, coverLetter: input.coverLetter, notes: input.notes ?? undefined };
    case "approve":
      return { status: "APPROVED", approvedAt: new Date() };
    case "reject":
      return { status: "WITHDRAWN", approvedAt: null };
    case "reopen":
      // Reset applier state so a fresh approval gets fresh attempts
      return {
        status: "PENDING_APPROVAL", approvedAt: null,
        claimedAt: null, claimedBy: null, applyAttempts: 0, applyChannel: null, applyNote: null,
      };
    case "mark_applied":
      return { status: "APPLIED", appliedAt: new Date(), claimedAt: null, claimedBy: null };
    case "set_outcome":
      return { status: input.status };
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/applications/[id]">) {
  try {
    const { id } = await ctx.params;
    const input = UpdateApplicationSchema.parse(await readJson(req));
    const { profile } = await getCurrentUser();

    const app = await db.application.findFirst({ where: { id, profileId: profile.id } });
    if (!app) throw new AppError("Application not found", 404);
    if (!canTransition(app.status, input.action))
      throw new AppError(`Can't ${input.action.replace("_", " ")} an application that is ${app.status.toLowerCase()}.`, 409);
    if (input.action === "approve" && !app.coverLetter?.trim())
      throw new AppError("Add a cover letter before approving.", 409);

    // updateMany with the old status guards against double-clicks and stale tabs
    const { count } = await db.application.updateMany({
      where: { id: app.id, status: app.status },
      data: changesFor(input) as Prisma.ApplicationUpdateManyMutationInput,
    });
    if (count === 0) throw new AppError("This application changed in another tab. Reload and try again.", 409);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "applications/update");
  }
}
