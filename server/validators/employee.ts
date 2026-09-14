import { z } from 'zod'

export const employeeInputSchema = z.object({
  nip: z.string().trim().min(3, 'NIP minimal 3 karakter').max(30),
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(150),
  email: z.string().trim().email('Format email tidak valid').max(255),
  phone: z.string().trim().max(30).optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  departmentId: z.string().uuid('ID Departemen tidak valid').optional().nullable(),
  positionId: z.string().uuid('ID Jabatan tidak valid').optional().nullable(),
  managerId: z.string().uuid('ID Atasan tidak valid').optional().nullable(),
  employmentStatus: z.enum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'OUTSOURCE']),
  joinDate: z.string().min(1, 'Tanggal bergabung wajib diisi'),
  endDate: z.string().optional().nullable(),
  canSubmitRequest: z.boolean().default(true),
  telegramChatId: z.string().trim().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
})

export type EmployeeInput = z.infer<typeof employeeInputSchema>

export const employeeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.preprocess((val) => {
    if (val === 'true' || val === true) return true
    if (val === 'false' || val === false) return false
    return undefined
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
})
