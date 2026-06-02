import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Memoise the pg.Pool AND PrismaClient on globalThis so Next.js dev HMR
 * doesn't orphan connections every recompile. Without pool memoisation
 * each HMR rebuild creates a fresh pg.Pool whose old connections never
 * close — the Supabase pooler eventually starves and every auth /
 * server-action request hangs forever.
 */
const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in the environment.");
}

const pool =
  globalForPrisma.pgPool ??
  new pg.Pool({
    connectionString,
    // Conservative caps for Supabase pooler — dev mode spawns many
    // short-lived requests; idle connections recycle quickly.
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });

const adapter = new PrismaPg(pool);

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pool;
}

export * from "@prisma/client";
