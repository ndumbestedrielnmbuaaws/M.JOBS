import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export function handleError(err: unknown, context: string) {
  if (err instanceof AppError) return fail(err.message, err.status);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(`Invalid ${first?.path.join(".") || "input"}: ${first?.message}`, 400);
  }
  console.error(`[${context}]`, err);
  return fail("Something went wrong. Check the server logs.", 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("Expected a JSON body", 400);
  }
}
