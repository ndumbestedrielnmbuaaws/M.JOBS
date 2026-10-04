import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/http";
import { getObject } from "@/lib/storage";
import { assertWorker } from "@/lib/worker-auth";

export async function GET(req: Request, ctx: RouteContext<"/api/worker/applications/[id]/cv">) {
  try {
    const workerId = assertWorker(req);
    const { id } = await ctx.params;

    // Only the worker holding the claim may download the CV
    const app = await db.application.findFirst({
      where: { id, status: "APPROVED", claimedBy: workerId },
      select: { cv: { select: { storageKey: true, fileName: true, mimeType: true } } },
    });
    if (!app?.cv) throw new AppError("No claimed application with a CV", 404);

    const file = await getObject(app.cv.storageKey);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": app.cv.mimeType,
        "Content-Disposition": `attachment; filename="${app.cv.fileName.replace(/["\\\r\n]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err, "worker/cv");
  }
}
