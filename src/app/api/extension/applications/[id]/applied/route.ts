import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/http";
import { assertWorker } from "@/lib/worker-auth";
import { preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

/** Called when you tell the extension you submitted the form. */
export async function POST(req: Request, ctx: RouteContext<"/api/extension/applications/[id]/applied">) {
  try {
    assertWorker(req);
    const { id } = await ctx.params;

    const { count } = await db.application.updateMany({
      where: { id, status: "APPROVED" },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        applyChannel: "extension",
        applyNote: "Submitted by you with the browser extension",
      },
    });
    if (count === 0) throw new AppError("That application is no longer approved", 409);

    return withCors(req, NextResponse.json({ ok: true }));
  } catch (err) {
    return withCors(req, handleError(err, "extension/applied"));
  }
}
