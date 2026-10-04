import type { JobSource } from "@/generated/prisma/enums";
import type { ApplyOption } from "./publishers";

export type NormalizedJob = {
  source: JobSource;
  externalId: string;
  url: string;
  title: string;
  company: string;
  publisher: string | null;
  applyIsDirect: boolean | null;
  applyOptions: ApplyOption[];
  location: string | null;
  countryCode: string | null;
  remote: boolean;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  offersSponsorship: boolean | null;
  sponsorEvidence: string | null;
  postedAt: Date | null;
};
