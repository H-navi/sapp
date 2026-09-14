import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { requireAuth, requirePermission, requireRole, assertCanViewEmployee } from '../../server/utils/guard'
import type { AuthContext } from '../../server/utils/auth'

describe('Permission & Authorization Integration (Task 13)', () => {
  const adminApiDir = path.resolve(process.cwd(), 'server/api/admin')

  function getAllTsFiles(dir: string): string[] {
    let results: string[] = []
    const list = fs.readdirSync(dir)
    for (const file of list) {
      const full = path.join(dir, file)
      const stat = fs.statSync(full)
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllTsFiles(full))
      } else if (file.endsWith('.ts')) {
        results.push(full)
      }
    }
    return results
  }

  it('Otomatis menelusuri seluruh endpoint di server/api/admin/ dan memastikan tidak ada yang lolos tanpa guard', () => {
    const files = getAllTsFiles(adminApiDir)
    expect(files.length).toBeGreaterThanOrEqual(50)

    const unprotectedFiles: string[] = []

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      // Harus menggunakan salah satu guard otentikasi / otorisasi
      const hasGuard =
        content.includes('requirePermission') ||
        content.includes('requireRole') ||
        content.includes('requireAuth') ||
        content.includes("auth.roles.includes('ADMIN')") ||
        content.includes('auth.roles.includes("ADMIN")')

      if (!hasGuard) {
        unprotectedFiles.push(path.relative(process.cwd(), file))
      }
    }

    expect(unprotectedFiles).toEqual([])
  })

  it('Panggilan tanpa login (anonim) dilempar 401 AUTH_REQUIRED', () => {
    const mockEvent = {
      context: {},
    } as any

    expect(() => requireAuth(mockEvent)).toThrowError(
      expect.objectContaining({ statusCode: 401, statusMessage: 'AUTH_REQUIRED' })
    )
    expect(() => requireRole(mockEvent, 'ADMIN')).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
    expect(() => requirePermission(mockEvent, 'settings.manage')).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
  })

  it('Pegawai biasa (PEGAWAI) memanggil endpoint admin dilempar 403 AUTH_FORBIDDEN', () => {
    const employeeAuth: AuthContext = {
      userId: 'u-pegawai-1',
      employeeId: 'e-pegawai-1',
      username: 'budi',
      fullName: 'Budi Santoso',
      departmentId: 'd-1',
      positionLevel: 1,
      mustChangePassword: false,
      roles: ['PEGAWAI'],
      permissions: ['request.create', 'request.view'],
    }

    const mockEvent = {
      context: { auth: employeeAuth },
    } as any

    // 1. Cek peran admin
    expect(() => requireRole(mockEvent, 'ADMIN')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )

    // 2. Cek permission admin
    expect(() => requirePermission(mockEvent, 'settings.manage')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )
    expect(() => requirePermission(mockEvent, 'user.manage')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )
    expect(() => requirePermission(mockEvent, 'workflow.manage')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )
    expect(() => requirePermission(mockEvent, 'policy.manage')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )
  })

  it('Admin dengan role ADMIN atau permission sesuai diizinkan lewat', () => {
    const adminAuth: AuthContext = {
      userId: 'u-admin-1',
      employeeId: 'e-admin-1',
      username: 'admin',
      fullName: 'Administrator',
      departmentId: null,
      positionLevel: 10,
      mustChangePassword: false,
      roles: ['ADMIN'],
      permissions: ['settings.manage', 'user.manage', 'workflow.manage', 'policy.manage', 'request.view.all'],
    }

    const mockEvent = {
      context: { auth: adminAuth },
    } as any

    expect(requireRole(mockEvent, 'ADMIN')).toBe(adminAuth)
    expect(requirePermission(mockEvent, 'settings.manage')).toBe(adminAuth)
    expect(requirePermission(mockEvent, 'workflow.manage')).toBe(adminAuth)
  })

  it('assertCanViewEmployee mencegah pegawai melihat data pegawai lain tanpa izin khusus', () => {
    const employeeAuth: AuthContext = {
      userId: 'u-pegawai-1',
      employeeId: 'e-pegawai-1',
      username: 'budi',
      fullName: 'Budi Santoso',
      departmentId: 'd-1',
      positionLevel: 1,
      mustChangePassword: false,
      roles: ['PEGAWAI'],
      permissions: ['request.create', 'request.view'],
    }

    // Melihat data diri sendiri -> lolos
    expect(() => assertCanViewEmployee(employeeAuth, 'e-pegawai-1')).not.toThrow()

    // Melihat data pegawai lain -> 403
    expect(() => assertCanViewEmployee(employeeAuth, 'e-pegawai-999')).toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN' })
    )

    // Pegawai dengan izin request.view.all -> lolos melihat pegawai lain
    const hrAuth: AuthContext = {
      ...employeeAuth,
      permissions: ['request.create', 'request.view', 'request.view.all'],
    }
    expect(() => assertCanViewEmployee(hrAuth, 'e-pegawai-999')).not.toThrow()
  })
})
