"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/profile", label: "CV and profile" },
  { href: "/jobs", label: "Find jobs" },
  { href: "/queue", label: "Approval queue" },
];

export default function NavLinks({ pending }: { pending: number }) {
  const path = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="flex gap-1 md:flex-col">
        {LINKS.map((link) => {
          const active = path === link.href || path.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
                  active ? "bg-ink text-panel" : "text-muted hover:bg-paper hover:text-ink",
                ].join(" ")}
              >
                {link.label}
                {link.href === "/queue" && pending > 0 && (
                  <span
                    className={[
                      "rounded-full px-2 text-xs font-semibold tabular-nums",
                      active ? "bg-amber-soft text-ink" : "bg-amber-soft text-amber",
                    ].join(" ")}
                    aria-label={`${pending} waiting for review`}
                  >
                    {pending}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
