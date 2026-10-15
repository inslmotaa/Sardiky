/**
 * Modelo de permissões.
 * - admin (nutricionista): acesso total.
 * - staff (equipe): apenas as permissões concedidas pelo nutricionista.
 * - patient: somente os próprios dados, sempre derivados da sessão.
 */
export const STAFF_PERMISSIONS = {
  agenda: 'Agenda e agendamentos',
  cadastro: 'Dados cadastrais de pacientes',
  clinico: 'Dados clínicos (avaliações, planos, diário, formulários, mensagens)',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  site: 'Conteúdo do site e interessados',
} as const

export type Permission = keyof typeof STAFF_PERMISSIONS | 'config'
export type Role = 'admin' | 'staff' | 'patient'

export type PermissionSubject = { role: Role; permissions: string[] }

export function can(user: PermissionSubject | null | undefined, perm: Permission) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'staff') return perm !== 'config' && user.permissions.includes(perm)
  return false
}

export function isTeam(user: PermissionSubject | null | undefined) {
  return user?.role === 'admin' || user?.role === 'staff'
}
