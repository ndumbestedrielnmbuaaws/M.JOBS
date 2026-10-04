import type { ApplicationStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/applications";

const TONE_CLASS = {
  neutral: "bg-line/60 text-muted",
  pending: "bg-amber-soft text-amber",
  good: "bg-spruce-soft text-spruce",
  bad: "bg-brick-soft text-brick",
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[STATUS_TONE[status]]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
