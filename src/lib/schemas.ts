import { z } from "zod";
import { PUBLISHER_IDS } from "./jobs/publishers";

/* ---------- CV parsing (OpenAI structured output) ---------- */

export const ExperienceSchema = z.object({
  role: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable().describe("YYYY-MM"),
  endDate: z.string().nullable().describe("YYYY-MM, null if current"),
  isCurrent: z.boolean(),
  highlights: z.array(z.string()),
});
export type Experience = z.infer<typeof ExperienceSchema>;

export const EducationSchema = z.object({
  institution: z.string(),
  qualification: z.string().nullable(),
  field: z.string().nullable(),
  endYear: z.number().int().nullable(),
});
export type Education = z.infer<typeof EducationSchema>;

export const LanguageSchema = z.object({
  language: z.string(),
  level: z.string().nullable(),
});
export type Language = z.infer<typeof LanguageSchema>;

export const ParsedCVSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  headline: z.string().nullable().describe("Current or target job title"),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  languages: z.array(LanguageSchema),
});
export type ParsedCV = z.infer<typeof ParsedCVSchema>;

/* ---------- Cover letter ---------- */

export const CoverLetterSchema = z.object({
  subject: z.string(),
  body: z.string(),
  usedFacts: z.array(z.string()).describe("Profile facts the letter relies on"),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

/* ---------- Match scoring ---------- */

export const MatchResultSchema = z.object({
  score: z.number().int().describe("0-100 fit between candidate and job"),
  summary: z.string().describe("One or two sentences explaining the score"),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  sponsorship: z
    .enum(["OFFERED", "NOT_OFFERED", "NOT_MENTIONED"])
    .describe("What the job post says about visa sponsorship"),
  sponsorshipEvidence: z.string().nullable().describe("Short quote supporting the sponsorship verdict"),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

export type MatchReasons = Pick<MatchResult, "summary" | "strengths" | "gaps">;

/* ---------- API input ---------- */

const trimmed = (max: number) => z.string().trim().max(max);

const optionalUrl = trimmed(300)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "must start with http:// or https://")
  .nullable();

export const ProfileUpdateSchema = z.object({
  fullName: trimmed(120).nullable(),
  email: trimmed(200)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "is not a valid email")
    .nullable(),
  phone: trimmed(40).nullable(),
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  headline: trimmed(160).nullable(),
  location: trimmed(120).nullable(),
  summary: trimmed(3000).nullable(),
  skills: z.array(trimmed(80)).max(150),
  certifications: z.array(trimmed(200)).max(50),
  experience: z.array(ExperienceSchema).max(40),
  education: z.array(EducationSchema).max(20),
  languages: z.array(LanguageSchema).max(20),
  workAuth: z
    .array(
      z.object({
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        sponsorship: z.enum(["NOT_REQUIRED", "REQUIRED", "UNKNOWN"]),
      }),
    )
    .max(30),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const JobSearchSchema = z.object({
  query: trimmed(120).min(2),
  location: trimmed(120).min(2),
  country: z.string().regex(/^[A-Z]{2}$/),
  datePosted: z.enum(["all", "today", "3days", "week", "month"]).default("week"),
  remote: z.boolean().default(false),
  pages: z.number().int().min(1).max(3).default(1),
  publishers: z.array(z.enum(PUBLISHER_IDS)).default([]),
  hideNoSponsorship: z.boolean().default(false),
  sponsorshipOnly: z.boolean().default(false),
  refresh: z.boolean().default(false),
});
export type JobSearchInput = z.infer<typeof JobSearchSchema>;

export const CreateApplicationSchema = z.object({
  jobId: z.string().min(1).max(40),
});

export const UpdateApplicationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    subject: trimmed(200),
    coverLetter: trimmed(8000),
    notes: trimmed(4000).nullable().optional(),
  }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("mark_applied") }),
  z.object({
    action: z.literal("set_outcome"),
    status: z.enum(["INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"]),
  }),
]);
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;

/* ---------- Applier service ---------- */

export const WorkerResultSchema = z.object({
  outcome: z.enum(["submitted", "needs_manual", "failed", "timeout"]),
  channel: trimmed(40),
  message: trimmed(1000).default(""),
});
export type WorkerResult = z.infer<typeof WorkerResultSchema>;
