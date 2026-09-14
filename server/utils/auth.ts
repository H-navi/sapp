import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { useDatabase, schema, type Transaction } from '../database'

export const SESSION_COOKIE = 'sapp_session'
const SESSION_TTL_HOURS = 12
const SLIDING_THRESHOLD_HOURS = 6
const MAX_FAILED_LOGIN = 5
const LOCK_MINUTES = 15

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12)
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash)
}

export interface AuthContext {
  userId: string
  employeeId: string | null
  username: string
  fullName: string
  departmentId: string | null
  positionLevel: number | null
  mustChangePassword: boolean
  roles: string[]
  permissions: string[]
}

interface RawAuthRow {
  user_id: string
  username: string
  must_change_password: boolean
  employee_id: string | null
  full_name: string
  department_id: string | null
  position_level: number | null
  roles: string[] | null
  permissions: string[] | null
}

/** Ambil profil + role + permission dalam satu query. */
export async function loadAuthContext(userId: string): Promise<AuthContext | null> {
  const db = useDatabase()
  const rows = await db.execute(sql`
    SELECT u.id                AS user_id,
           u.username,
           u.must_change_password,
           e.id                AS employee_id,
           COALESCE(e.full_name, u.username) AS full_name,
           e.department_id,
           p.level             AS position_level,
           COALESCE(array_agg(DISTINCT r.code)  FILTER (WHERE r.code  IS NOT NULL), '{}') AS roles,
           COALESCE(array_agg(DISTINCT pm.code) FILTER (WHERE pm.code IS NOT NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN employees e        ON e.id = u.employee_id
    LEFT JOIN positions p        ON p.id = e.position_id
    LEFT JOIN user_roles ur      ON ur.user_id = u.id
    LEFT JOIN roles r            ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions pm     ON pm.id = rp.permission_id
    WHERE u.id = ${userId} AND u.is_active = true
    GROUP BY u.id, u.username, u.must_change_password, e.id, e.full_name, e.department_id, p.level
  `)
  const row = (rows as unknown as RawAuthRow[])[0]
  if (!row) return null
  return {
    userId: row.user_id,
    employeeId: row.employee_id,
    username: row.username,
    fullName: row.full_name,
    departmentId: row.department_id,
    positionLevel: row.position_level != null ? Number(row.position_level) : null,
    mustChangePassword: Boolean(row.must_change_password),
    roles: Array.isArray(row.roles) ? row.roles : [],
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  }
}

export async function createSession(
  tx: Transaction,
  userId: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000)
  await tx.insert(schema.userSessions).values({
    userId,
    tokenHash: hashToken(token),
    ipAddress: ip ?? null,
    userAgent: userAgent ?? null,
    expiresAt,
  })
  return { token, expiresAt }
}

export async function resolveSession(token: string) {
  const db = useDatabase()
  const [session] = await db
    .select()
    .from(schema.userSessions)
    .where(
      and(
        eq(schema.userSessions.tokenHash, hashToken(token)),
        isNull(schema.userSessions.revokedAt),
        gt(schema.userSessions.expiresAt, new Date())
      )
    )
    .limit(1)
  if (!session) return null

  // sliding expiration
  const sisaJam = (session.expiresAt.getTime() - Date.now()) / 3600_000
  if (sisaJam < SLIDING_THRESHOLD_HOURS) {
    await db
      .update(schema.userSessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3600_000) })
      .where(eq(schema.userSessions.id, session.id))
  }
  return session
}

export async function revokeSession(token: string) {
  const db = useDatabase()
  await db
    .update(schema.userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.userSessions.tokenHash, hashToken(token)))
}

export const loginLimits = { MAX_FAILED_LOGIN, LOCK_MINUTES }
