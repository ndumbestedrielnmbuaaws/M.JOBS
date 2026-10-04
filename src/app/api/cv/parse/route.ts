import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseCV } from "@/lib/ai";
import { assertOwnProfile } from "@/lib/auth";
import { AppError, fail, handleError } from "@/lib/http";
import { deleteObject, putObject } from "@/lib/storage";
import { CV_MIME, MAX_CV_BYTES, detectKind, extractText } from "@/lib/cv-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_CV_BYTES + 64_000) return fail("File too large (max 5 MB)", 413);

  let storageKey: string | null = null;
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new AppError("Expected multipart/form-data", 400);
    }

    const file = form.get("file");
    const profileId = z.string().min(1).max(40).parse(form.get("profileId"));
    if (!(file instanceof File)) throw new AppError("Missing file", 400);
    if (file.size === 0 || file.size > MAX_CV_BYTES) throw new AppError("File must be under 5 MB", 413);

    const profile = await assertOwnProfile(profileId);

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = detectKind(buf);
    if (!kind) throw new AppError("Only PDF and DOCX files are supported", 415);

    // Slow, failure-prone steps first; store only once parsing succeeded
    const rawText = await extractText(buf, kind);
    const parsed = await parseCV(rawText);

    storageKey = `cvs/${profile.userId}/${profile.id}/${randomUUID()}.${kind}`;
    await putObject(storageKey, buf, CV_MIME[kind]);

    const cv = await db.$transaction(async (tx) => {
      // Newest upload becomes the primary CV used for applications
      await tx.cV.updateMany({ where: { profileId: profile.id }, data: { isPrimary: false } });
      return tx.cV.create({
        data: {
          profileId: profile.id,
          storageKey: storageKey!,
          fileName: file.name.slice(0, 255),
          mimeType: CV_MIME[kind],
          rawText,
          parsedData: parsed,
          isPrimary: true,
        },
        select: { id: true, fileName: true, isPrimary: true, createdAt: true },
      });
    });

    return NextResponse.json({ cv, parsed }, { status: 201 });
  } catch (err) {
    if (storageKey) await deleteObject(storageKey).catch(() => {});
    return handleError(err, "cv/parse");
  }
}
