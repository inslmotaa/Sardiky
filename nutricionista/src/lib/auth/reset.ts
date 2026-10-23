import 'server-only'
import { and, eq, gt, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hashToken } from './tokens'

type TokenType = (typeof schema.tokenTypeEnum.enumValues)[number]

/** Valida o token de redefinição ou de convite (primeiro acesso); cada tipo de link só vale para a sua finalidade. */
export async function findValidToken(token: string, types: TokenType[] = ['reset', 'convite']) {
  if (!token || token.length > 100) return null
  const [row] = await db
    .select({ token: schema.authTokens, user: schema.users })
    .from(schema.authTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
    .where(
      and(
        eq(schema.authTokens.id, hashToken(token)),
        inArray(schema.authTokens.type, types),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
  return row ?? null
}
