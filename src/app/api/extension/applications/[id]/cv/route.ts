import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/http";
import { getObject } from "@/lib/storage";
import { assertWorker } from "@/lib/worker-auth";
import { preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

/** Serves the CV so the extension can attach it to a file input. */
export async function GET(req: Request, ctx: RouteContext<"/api/extension/applications/[id]/cv">) {
  try {
    assertWorker(req);
    const { id } = await ctx.params;

    const app = await db.application.findFirst({
      where: { id, status: "APPROVED" },
      select: { cv: { select: { storageKey: true, fileName: true, mimeType: true } } },
    });
    if (!app?.cv) throw new AppError("No CV on that application", 404);

    const file = await getObject(app.cv.storageKey);
    return withCors(
      req,
      new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": app.cv.mimeType,
          "Content-Disposition": `attachment; filename="${app.cv.fileName.replace(/["\\\r\n]/g, "")}"`,
          "Cache-Control": "no-store",
        },
      }),
    );
  } catch (err) {
    return withCors(req, handleError(err, "extension/cv"));
  }
}
