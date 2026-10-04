// Shared by client and server code. Keep this file free of server-only imports.
export const MAX_CV_BYTES = 5 * 1024 * 1024;

export const COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "AE", name: "United Arab Emirates" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const countryName = (code: string | null | undefined) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code ?? "Unknown";

export const SPONSORSHIP_LABEL = {
  NOT_REQUIRED: "Right to work, no sponsorship needed",
  REQUIRED: "Needs visa sponsorship",
  UNKNOWN: "Not sure",
} as const;
