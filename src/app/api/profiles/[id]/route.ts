import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertOwnProfile } from "@/lib/auth";
import { handleError, readJson } from "@/lib/http";
import { ProfileUpdateSchema } from "@/lib/schemas";

export async function PATCH(req: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  try {
    const { id } = await ctx.params;
    const profile = await assertOwnProfile(id);
    const data = ProfileUpdateSchema.parse(await readJson(req));

    // Last entry wins if the same country appears twice
    const workAuth = [...new Map(data.workAuth.map((w) => [w.countryCode, w])).values()];

    await db.$transaction([
      db.profile.update({
        where: { id: profile.id },
        data: {
          fullName: data.fullName || null,
          email: data.email || null,
          phone: data.phone || null,
          linkedinUrl: data.linkedinUrl || null,
          websiteUrl: data.websiteUrl || null,
          headline: data.headline || null,
          location: data.location || null,
          summary: data.summary || null,
          skills: [...new Set(data.skills.filter(Boolean))],
          certifications: data.certifications.filter(Boolean),
          experience: data.experience,
          education: data.education,
          languages: data.languages,
        },
      }),
      db.workAuthorization.deleteMany({ where: { profileId: profile.id } }),
      db.workAuthorization.createMany({
        data: workAuth.map((w) => ({ ...w, profileId: profile.id })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "profiles/patch");
  }
}
