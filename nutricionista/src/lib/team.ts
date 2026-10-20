import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { can, type Permission } from './auth/permissions'
import { notifyUser } from './notify'

/**
 * Membros da equipe com a permissão. Quando o aviso é sobre um paciente, nutricionistas marcados
 * como “só os próprios pacientes” recebem apenas os dos pacientes sob sua responsabilidade.
 */
export async function teamFor(perm: Permission, patientId?: string | null) {
  const team = await db
    .select()
    .from(schema.users)
    .where(and(inArray(schema.users.role, ['admin', 'staff']), eq(schema.users.isActive, true)))
  let owner: string | null = null
  if (patientId) {
    const [row] = await db.select({ owner: schema.patients.nutritionistId }).from(schema.patients).where(eq(schema.patients.id, patientId))
    owner = row?.owner ?? null
  }
  return team.filter((u) => can(u, perm) && !(u.role === 'staff' && u.ownPatientsOnly && (!patientId || owner !== u.id)))
}

/** Notifica, dentro do sistema, os membros da equipe com a permissão indicada. */
export async function notifyTeam(perm: Permission, title: string, body?: string, link?: string, patientId?: string | null) {
  for (const u of await teamFor(perm, patientId)) await notifyUser(u.id, title, body, link)
}
