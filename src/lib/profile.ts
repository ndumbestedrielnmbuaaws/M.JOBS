import "server-only";
import type { Profile, WorkAuthorization } from "@/generated/prisma/client";
import type { Education, Experience, Language, ProfileUpdate } from "./schemas";

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export type ProfileData = Omit<ProfileUpdate, "workAuth"> & {
  workAuth: ProfileUpdate["workAuth"];
};

/** Converts the Prisma row (Json columns) into typed profile data. */
export function toProfileData(profile: Profile & { workAuth: WorkAuthorization[] }): ProfileData {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    linkedinUrl: profile.linkedinUrl,
    websiteUrl: profile.websiteUrl,
    headline: profile.headline,
    location: profile.location,
    summary: profile.summary,
    skills: arr<string>(profile.skills),
    certifications: arr<string>(profile.certifications),
    experience: arr<Experience>(profile.experience),
    education: arr<Education>(profile.education),
    languages: arr<Language>(profile.languages),
    workAuth: profile.workAuth.map((w) => ({ countryCode: w.countryCode, sponsorship: w.sponsorship })),
  };
}

export function isProfileReady(p: ProfileData) {
  return p.skills.length > 0 && p.experience.length > 0;
}

export function sponsorshipFor(p: ProfileData, countryCode: string | null) {
  return p.workAuth.find((w) => w.countryCode === countryCode)?.sponsorship ?? "UNKNOWN";
}

/** The subset of the profile sent to the model: no contact details. */
export function profileForAI(p: ProfileData) {
  return {
    fullName: p.fullName,
    headline: p.headline,
    location: p.location,
    summary: p.summary,
    skills: p.skills,
    certifications: p.certifications,
    experience: p.experience,
    education: p.education,
    languages: p.languages,
  };
}
