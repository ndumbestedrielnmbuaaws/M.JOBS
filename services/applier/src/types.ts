import { z } from "zod";

export const ApplyTaskSchema = z.object({
  id: z.string(),
  attempt: z.number(),
  subject: z.string().nullable(),
  coverLetter: z.string().nullable(),
  cv: z.object({ id: z.string(), fileName: z.string(), mimeType: z.string() }).nullable(),
  job: z.object({
    title: z.string(),
    company: z.string(),
    url: z.string(),
    applyIsDirect: z.boolean().nullable(),
    applyOptions: z.array(z.object({ publisher: z.string(), url: z.string(), isDirect: z.boolean().nullable() })),
  }),
  candidate: z.object({
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    location: z.string().nullable(),
    currentTitle: z.string().nullable(),
    currentCompany: z.string().nullable(),
  }),
});
export type ApplyTask = z.infer<typeof ApplyTaskSchema>;

export type Outcome = "submitted" | "needs_manual" | "failed" | "timeout";
export type TaskResult = { outcome: Outcome; channel: string; message: string };

/** Files prepared for upload. Either may be missing. */
export type UploadFiles = { cv: string | null; coverLetter: string | null };
