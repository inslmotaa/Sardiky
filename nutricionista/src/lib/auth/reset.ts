import 'server-only'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hashToken } from './tokens'

/** Valida o token de redefinição ou de convite (primeiro acesso). */
export async function findValidToken(token: string) {
  if (!token || token.length > 100) return null
  const [row] = await db
    .select({ token: schema.authTokens, user: schema.users })
    .from(schema.authTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
    .where(
      and(
        eq(schema.authTokens.id, hashToken(token)),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
  return row ?? null
}
