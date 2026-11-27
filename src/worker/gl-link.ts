import type { GlUser } from "./gl";

/**
 * MarchOne user for a GL user. First GL login on a device that already has a MarchOne
 * session (guest or passkey) adopts that account, so the guest's journey continues.
 */
export async function localUserForGl(
  db: D1Database, gl: GlUser, currentSessionUserId: () => Promise<string | null>,
): Promise<string> {
  const linked = await db.prepare("SELECT user_id FROM gl_link WHERE gl_user_id = ?").bind(gl.id).first<{ user_id: string }>();
  if (linked) return linked.user_id;
  const currentUserId = await currentSessionUserId();

  const now = Date.now();
  const iso = new Date(now).toISOString();
  const name = (gl.nickname || gl.username || "여행자").slice(0, 40);

  if (currentUserId) {
    const taken = await db.prepare("SELECT 1 FROM gl_link WHERE user_id = ?").bind(currentUserId).first();
    if (!taken) {
      const res = await db
        .prepare("INSERT OR IGNORE INTO gl_link (gl_user_id, user_id, linked_at) VALUES (?, ?, ?)")
        .bind(gl.id, currentUserId, now)
        .run();
      if (res.meta.changes === 1) {
        await db.batch([
          db.prepare('UPDATE "user" SET "isAnonymous" = 0, name = ?, "updatedAt" = ? WHERE id = ?').bind(name, iso, currentUserId),
          // From now on this account is reached through GL; drop the old device session.
          db.prepare('DELETE FROM session WHERE "userId" = ?').bind(currentUserId),
        ]);
      }
      return (await db.prepare("SELECT user_id FROM gl_link WHERE gl_user_id = ?").bind(gl.id).first<{ user_id: string }>())!.user_id;
    }
  }

  const id = crypto.randomUUID();
  // Better Auth requires a unique email; GL's email can change, so store a stable internal one.
  await db.batch([
    db.prepare(
      'INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "isAnonymous", "homeCurrency") VALUES (?, ?, ?, 0, ?, ?, 0, ?)',
    ).bind(id, name, `gl-${gl.id}@users.marchone.local`, iso, iso, "KRW"),
    db.prepare("INSERT OR IGNORE INTO gl_link (gl_user_id, user_id, linked_at) VALUES (?, ?, ?)").bind(gl.id, id, now),
  ]);
  const row = (await db.prepare("SELECT user_id FROM gl_link WHERE gl_user_id = ?").bind(gl.id).first<{ user_id: string }>())!;
  // Lost a race with a concurrent first login: remove our orphan user.
  if (row.user_id !== id) await db.prepare('DELETE FROM "user" WHERE id = ?').bind(id).run();
  return row.user_id;
}
