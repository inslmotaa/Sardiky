import 'server-only'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { UserError } from './action'
import type { CurrentUser } from './auth/session'

/**
 * Equipe com vários nutricionistas: quem está marcado como “só os próprios pacientes”
 * vê apenas pacientes em que é o nutricionista responsável. Administrador e demais membros veem todos.
 */
export const isRestricted = (user: Pick<CurrentUser, 'role' | 'ownPatientsOnly'>) => user.role === 'staff' && user.ownPatientsOnly

export function canSeePatient(user: Pick<CurrentUser, 'id' | 'role' | 'ownPatientsOnly'>, patient: { nutritionistId: string | null }) {
  return !isRestricted(user) || patient.nutritionistId === user.id
}

/** Ids dos pacientes visíveis; null quando não há restrição. */
export async function visiblePatientIds(user: Pick<CurrentUser, 'id' | 'role' | 'ownPatientsOnly'>) {
  if (!isRestricted(user)) return null
  const rows = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.nutritionistId, user.id))
  return rows.map((r) => r.id)
}

/** Lança “não encontrado” (sem revelar que o paciente existe) se o usuário não pode ver o paciente. */
export async function assertPatientAccess(user: Pick<CurrentUser, 'id' | 'role' | 'ownPatientsOnly'>, patientId: string | null) {
  if (!patientId || !isRestricted(user)) return
  const [p] = await db.select({ n: schema.patients.nutritionistId }).from(schema.patients).where(eq(schema.patients.id, patientId))
  if (!p || p.n !== user.id) throw new UserError('Paciente não encontrado.')
}

/** Quem pode ser nutricionista responsável: administrador e membros da equipe com acesso clínico. */
export async function nutritionistOptions() {
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, permissions: schema.users.permissions, isActive: schema.users.isActive }).from(schema.users)
  return rows.filter((u) => u.isActive && (u.role === 'admin' || (u.role === 'staff' && u.permissions.includes('clinico')))).map((u) => ({ id: u.id, name: u.name }))
}
