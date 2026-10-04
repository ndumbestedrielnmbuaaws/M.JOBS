import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, handleError, readJson } from "@/lib/http";
import { WorkerResultSchema } from "@/lib/schemas";
import { MAX_APPLY_ATTEMPTS, assertWorker } from "@/lib/worker-auth";

export async function POST(req: Request, ctx: RouteContext<"/api/worker/applications/[id]/result">) {
  try {
    const workerId = assertWorker(req);
    const { id } = await ctx.params;
    const result = WorkerResultSchema.parse(await readJson(req));

    const app = await db.application.findFirst({
      where: { id, claimedBy: workerId },
      select: { status: true, applyAttempts: true },
    });
    if (!app) throw new AppError("Application is not claimed by this worker", 404);

    // You may have moved it back to review while the browser was open: don't overwrite that
    if (app.status !== "APPROVED") {
      await db.application.update({ where: { id }, data: { claimedAt: null, claimedBy: null } });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const note = result.message || null;
    const base = { claimedAt: null, claimedBy: null, applyChannel: result.channel };

    const data =
      result.outcome === "submitted"
        ? { ...base, status: "APPLIED" as const, appliedAt: new Date(), applyNote: note ?? "Submitted by the applier" }
        : result.outcome === "needs_manual"
          ? { ...base, applyChannel: "manual", applyNote: note ?? "Apply on the site yourself." }
          : {
              ...base,
              applyNote:
                (note ?? "The applier couldn't finish.") +
                (app.applyAttempts >= MAX_APPLY_ATTEMPTS ? " No more automatic attempts; apply manually." : ""),
            };

    await db.application.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "worker/result");
  }
}
