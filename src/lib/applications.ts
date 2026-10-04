import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { UpdateApplicationInput } from "./schemas";

type Action = UpdateApplicationInput["action"];

// Nothing reaches APPLIED without passing through APPROVED first.
const ALLOWED: Record<Action, ApplicationStatus[]> = {
  save: ["DRAFT", "PENDING_APPROVAL"],
  approve: ["PENDING_APPROVAL"],
  reject: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
  reopen: ["APPROVED", "WITHDRAWN"],
  mark_applied: ["APPROVED"],
  set_outcome: ["APPLIED", "INTERVIEWING", "OFFER"],
};

export const canTransition = (from: ApplicationStatus, action: Action) =>
  ALLOWED[action].includes(from);

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Waiting for review",
  APPROVED: "Approved, not sent",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const STATUS_TONE: Record<ApplicationStatus, "neutral" | "pending" | "good" | "bad"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "pending",
  APPROVED: "good",
  APPLIED: "good",
  INTERVIEWING: "good",
  OFFER: "good",
  REJECTED: "bad",
  WITHDRAWN: "neutral",
};
