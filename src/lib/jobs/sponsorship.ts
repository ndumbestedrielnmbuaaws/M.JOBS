export type SponsorSignal = { offers: boolean | null; evidence: string | null };

// [^.\n] keeps each match inside one sentence
const NEGATIVE = [
  /\b(no|not|unable to|cannot|can't|won't|will not|do not|does not)\b[^.\n]{0,40}\bsponsor/i,
  /\bsponsorship\b[^.\n]{0,30}\b(not|isn't|unavailable)\b/i,
  /\bwithout (the )?(need for )?(visa )?sponsorship/i,
  /\bmust (already )?have (the )?(full |existing )?right to work/i,
];

const POSITIVE = [
  /\b(visa )?sponsorship (is |can be )?(available|offered|provided)/i,
  /\bwe (can|will|are able to) sponsor/i,
  /\b(skilled worker|tier 2|h-?1b|critical skills) (visa|sponsorship)/i,
  /\bcertificate of sponsorship\b/i,
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      return text
        .slice(Math.max(0, m.index - 60), m.index + m[0].length + 60)
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return null;
}

/** Cheap first pass at ingest time. Match scoring asks the model and overrides this. */
export function detectSponsorship(text: string | null | undefined): SponsorSignal {
  if (!text) return { offers: null, evidence: null };
  // Negatives first: "cannot offer Skilled Worker visa" must not count as positive
  const neg = firstMatch(text, NEGATIVE);
  if (neg) return { offers: false, evidence: neg };
  const pos = firstMatch(text, POSITIVE);
  if (pos) return { offers: true, evidence: pos };
  return { offers: null, evidence: null };
}
