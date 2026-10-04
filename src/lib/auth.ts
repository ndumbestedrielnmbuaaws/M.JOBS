import "server-only";
import { db } from "./db";
import { AppError } from "./http";

/**
 * Single-user mode: every request acts as one local user.
 * Replace with an Auth.js session lookup before exposing the app to other people.
 */
export async function getCurrentUser() {
  if (process.env.NODE_ENV === "production" && process.env.SINGLE_USER_MODE !== "true") {
    throw new AppError(
      "Authentication is not configured. Set SINGLE_USER_MODE=true only for private deployments.",
      503,
    );
  }

  const email = process.env.LOCAL_USER_EMAIL ?? "me@localhost";
  const user = await db.user.upsert({ where: { email }, create: { email }, update: {} });

  let profile = await db.profile.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  profile ??= await db.profile.create({ data: { userId: user.id, name: "Main profile" } });

  return { user, profile };
}

/** Throws 404 unless the profile belongs to the current user. */
export async function assertOwnProfile(profileId: string) {
  const { user } = await getCurrentUser();
  const profile = await db.profile.findFirst({ where: { id: profileId, userId: user.id } });
  if (!profile) throw new AppError("Profile not found", 404);
  return profile;
}
