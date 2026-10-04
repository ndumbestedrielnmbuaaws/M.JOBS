type Props = {
  score: number | null;
  size?: "sm" | "lg";
};

function band(score: number) {
  if (score >= 80) return { label: "Strong fit", text: "text-spruce", fill: "bg-spruce" };
  if (score >= 60) return { label: "Good fit", text: "text-spruce", fill: "bg-spruce/70" };
  if (score >= 40) return { label: "Partial fit", text: "text-amber", fill: "bg-amber" };
  return { label: "Weak fit", text: "text-brick", fill: "bg-brick" };
}

/** The score as a large numeral over a ten-segment track. */
export default function MatchScore({ score, size = "sm" }: Props) {
  if (score === null) {
    return (
      <div className={size === "lg" ? "w-40" : "w-16"}>
        <span className={`font-display text-muted ${size === "lg" ? "text-5xl" : "text-2xl"}`}>–</span>
        <p className="text-xs text-muted">Not scored</p>
      </div>
    );
  }

  const b = band(score);
  const filled = Math.round(score / 10);

  return (
    <div className={size === "lg" ? "w-40" : "w-16"} role="img" aria-label={`Match score ${score} out of 100, ${b.label}`}>
      <span
        className={`font-display font-semibold tabular-nums leading-none tracking-tight ${b.text} ${
          size === "lg" ? "text-6xl" : "text-3xl"
        }`}
      >
        {score}
      </span>
      <div className={`mt-1.5 flex gap-[2px] ${size === "lg" ? "h-2" : "h-1"}`} aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`flex-1 rounded-[1px] ${i < filled ? b.fill : "bg-line"}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs ${size === "lg" ? "font-semibold " + b.text : "text-muted"}`}>{b.label}</p>
    </div>
  );
}
