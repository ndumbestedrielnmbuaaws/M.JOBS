export default function SponsorTag({ offers }: { offers: boolean | null }) {
  if (offers === true)
    return <span className="rounded bg-spruce-soft px-2 py-0.5 text-xs font-semibold text-spruce">Sponsorship mentioned</span>;
  if (offers === false)
    return <span className="rounded bg-brick-soft px-2 py-0.5 text-xs font-semibold text-brick">No sponsorship</span>;
  return null;
}
