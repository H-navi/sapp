import { z } from 'zod'

export const actOnTaskSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    note: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'REJECT') {
        return Boolean(data.note && data.note.trim().length >= 10)
      }
      return true
    },
    {
      message: 'Catatan alasan penolakan wajib diisi minimal 10 karakter.',
      path: ['note'],
    }
  )

export const delegationInputSchema = z.object({
  delegateEmployeeId: z.string().uuid('Pegawai delegasi wajib dipilih'),
  leaveTypeId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  reason: z.string().optional().nullable(),
})

export const inboxQuerySchema = z.object({
  filter: z.enum(['all', 'urgent', 'overdue']).default('all'),
})
