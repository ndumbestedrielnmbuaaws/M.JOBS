"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbDown = /ECONNREFUSED|DATABASE_URL|connect/i.test(error.message);
  return (
    <div className="panel max-w-xl p-6">
      <h1 className="section-title">This page couldn&apos;t load</h1>
      <p className="mt-2 text-muted">
        {dbDown
          ? "The database isn't reachable. Start Postgres (docker compose up -d) and check DATABASE_URL."
          : "An unexpected error stopped the page from rendering. Details are in the server logs."}
      </p>
      <button className="btn mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
