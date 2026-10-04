import { connection } from "next/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import NavLinks from "./NavLinks";

async function pendingCount() {
  try {
    const { profile } = await getCurrentUser();
    return await db.application.count({ where: { profileId: profile.id, status: "PENDING_APPROVAL" } });
  } catch {
    return null; // Pages show the database error; the nav shouldn't crash the layout
  }
}

export default async function Nav() {
  await connection();
  const pending = await pendingCount();

  return (
    <header className="border-b border-line bg-panel md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
      <div className="flex items-center gap-4 overflow-x-auto px-5 py-3 md:flex-col md:items-stretch md:gap-8 md:px-4 md:py-7">
        <Link href="/dashboard" className="shrink-0 font-display text-lg font-semibold tracking-tight md:px-3">
          Job Applier
        </Link>
        <NavLinks pending={pending ?? 0} />
      </div>
    </header>
  );
}
