// Shared by client and server. JSearch returns publisher names as free text,
// so filters match on patterns instead of exact values.
export const PUBLISHERS = [
  { id: "linkedin", label: "LinkedIn", patterns: [/linkedin/i] },
  { id: "indeed", label: "Indeed", patterns: [/indeed/i] },
  // Manpower is a staffing agency: its roles often list it as the employer, not the publisher
  { id: "manpower", label: "Manpower", patterns: [/manpower/i], matchCompany: true },
  { id: "seek", label: "SEEK", patterns: [/\bseek\b/i] },
  { id: "totaljobs", label: "Totaljobs", patterns: [/total\s?jobs/i] },
] as const;

export type PublisherId = (typeof PUBLISHERS)[number]["id"];
export const PUBLISHER_IDS = PUBLISHERS.map((p) => p.id) as [PublisherId, ...PublisherId[]];

export type ApplyOption = { publisher: string; url: string; isDirect: boolean | null };

type Listing = {
  company: string;
  publisher: string | null;
  applyOptions: ApplyOption[];
};

/** Returns the apply option for the first selected publisher the job is listed on, or null. */
export function findPublisherMatch(job: Listing, selected: readonly PublisherId[]) {
  for (const id of selected) {
    const def = PUBLISHERS.find((p) => p.id === id);
    if (!def) continue;
    const hit = (s: string | null | undefined) => !!s && def.patterns.some((re) => re.test(s));

    const option = job.applyOptions.find((o) => hit(o.publisher));
    if (option) return { id, label: def.label, url: option.url };
    if (hit(job.publisher)) return { id, label: def.label, url: null };
    if ("matchCompany" in def && def.matchCompany && hit(job.company))
      return { id, label: def.label, url: null };
  }
  return null;
}
