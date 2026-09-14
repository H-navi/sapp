import { describe, it, expect } from 'vitest'

function validateAdminIntervention(adminEmployeeId: string | null, requestEmployeeId: string, reason: string | null | undefined) {
  if (!reason || !reason.trim()) {
    throw new Error('Alasan tindakan intervensi wajib diisi secara jelas.')
  }
  if (adminEmployeeId && adminEmployeeId === requestEmployeeId) {
    throw new Error('Anda tidak diperbolehkan melakukan intervensi administratif pada pengajuan Anda sendiri.')
  }
  return true
}

function sanitizeAuditValues(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeAuditValues)

  const sanitized: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('hash')
    ) {
      sanitized[key] = '*** [DISAMARKAN] ***'
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeAuditValues(val)
    } else {
      sanitized[key] = val
    }
  }
  return sanitized
}

describe('Admin Intervention & Audit Security (Task 11)', () => {
  it('menolak intervensi jika alasan kosong atau hanya spasi', () => {
    expect(() => validateAdminIntervention('emp-admin', 'emp-user', '')).toThrow(
      'Alasan tindakan intervensi wajib diisi secara jelas.'
    )
    expect(() => validateAdminIntervention('emp-admin', 'emp-user', '   ')).toThrow(
      'Alasan tindakan intervensi wajib diisi secara jelas.'
    )
    expect(() => validateAdminIntervention('emp-admin', 'emp-user', undefined)).toThrow(
      'Alasan tindakan intervensi wajib diisi secara jelas.'
    )
  })

  it('mencegah administrator mengintervensi pengajuan perizinannya sendiri', () => {
    const selfEmployeeId = '00000000-0000-0000-0000-000000000001'
    expect(() =>
      validateAdminIntervention(selfEmployeeId, selfEmployeeId, 'Alasan intervensi mendesak')
    ).toThrow('Anda tidak diperbolehkan melakukan intervensi administratif pada pengajuan Anda sendiri.')
  })

  it('mengizinkan intervensi pada pengajuan pegawai lain jika alasan diisi', () => {
    const adminId = '00000000-0000-0000-0000-000000000001'
    const otherEmployeeId = '00000000-0000-0000-0000-000000000002'
    expect(
      validateAdminIntervention(adminId, otherEmployeeId, 'Approver cuti melahirkan tanpa pendelegasian')
    ).toBe(true)
  })

  it('menyaring field sensitif (password_hash, token_hash, secret) dari objek audit', () => {
    const rawAuditPayload = {
      username: 'admin',
      email: 'admin@perusahaan.co.id',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      telegram_token_hash: 'abc123secrettoken',
      nested: {
        api_secret: 'supersecret',
        role: 'ADMIN',
      },
    }

    const sanitized = sanitizeAuditValues(rawAuditPayload)

    expect(sanitized.username).toBe('admin')
    expect(sanitized.email).toBe('admin@perusahaan.co.id')
    expect(sanitized.password_hash).toBe('*** [DISAMARKAN] ***')
    expect(sanitized.telegram_token_hash).toBe('*** [DISAMARKAN] ***')
    expect(sanitized.nested.api_secret).toBe('*** [DISAMARKAN] ***')
    expect(sanitized.nested.role).toBe('ADMIN')
  })
})
