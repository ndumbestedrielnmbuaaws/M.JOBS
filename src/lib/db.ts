import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

// Reuse one client across hot reloads so dev doesn't exhaust connections
const g = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };
export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
