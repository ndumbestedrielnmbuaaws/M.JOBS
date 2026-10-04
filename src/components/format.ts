export function postedAgo(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${new Date(iso).toLocaleDateString()}`;
}

export function salaryRange(min: number | null, max: number | null, currency: string | null) {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", {
      style: currency ? "currency" : "decimal",
      currency: currency ?? undefined,
      maximumFractionDigits: 0,
      notation: n >= 100_000 ? "compact" : "standard",
    }).format(n);
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)} a year`;
  return `${fmt((min ?? max)!)} a year`;
}

export async function apiError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}
