import { betterAuth } from "better-auth";
import { authOptions } from "./auth-options";
import type { Env } from "./env";

const DEV_SECRET = "marchone-local-dev-secret-not-for-production-0000";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(env: Env, request: Request) {
  const url = new URL(request.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const secret = env.BETTER_AUTH_SECRET ?? (local ? DEV_SECRET : undefined);
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");

  return betterAuth({
    ...authOptions({
      origin: url.origin,
      hostname: url.hostname,
      secret,
      onLinkAccount: (anonymousUserId, newUserId) => adoptGuestJourneys(env.DB, anonymousUserId, newUserId),
    }),
    database: env.DB,
  });
}

/**
 * A guest signed into an existing account on this device. Keep the guest's journey
 * only if the account has none; otherwise the guest is deleted with its data (cascade).
 */
async function adoptGuestJourneys(db: D1Database, fromUserId: string, toUserId: string) {
  const existing = await db
    .prepare("SELECT 1 FROM journey WHERE user_id = ? AND status = 'active' LIMIT 1")
    .bind(toUserId)
    .first();
  if (existing) return;
  await db.prepare("UPDATE journey SET user_id = ? WHERE user_id = ?").bind(toUserId, fromUserId).run();
}
