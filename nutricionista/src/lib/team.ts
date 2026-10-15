import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { can, type Permission } from './auth/permissions'
import { notifyUser } from './notify'

/** Notifica, dentro do sistema, os membros da equipe com a permissão indicada. */
export async function notifyTeam(perm: Permission, title: string, body?: string, link?: string) {
  const team = await db
    .select()
    .from(schema.users)
    .where(and(inArray(schema.users.role, ['admin', 'staff']), eq(schema.users.isActive, true)))
  for (const u of team) if (can(u, perm)) await notifyUser(u.id, title, body, link)
}
