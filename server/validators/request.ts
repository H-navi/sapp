import { z } from 'zod'

export const leaveRequestBaseSchema = z.object({
  leaveTypeId: z.string().uuid('Jenis izin tidak valid'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal mulai harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal selesai harus YYYY-MM-DD'),
  startDayPart: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON']).default('FULL_DAY'),
  endDayPart: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON']).default('FULL_DAY'),
  reason: z.string().trim().min(10, 'Alasan minimal 10 karakter').max(1000, 'Alasan maksimal 1000 karakter'),
  addressDuringLeave: z.string().trim().max(500).optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  delegateEmployeeId: z.string().uuid().optional().nullable(),
  action: z.enum(['draft', 'submit']).default('submit'),
})

export const leaveRequestInputSchema = leaveRequestBaseSchema.refine((v) => v.endDate >= v.startDate, {
  message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
  path: ['endDate'],
})

export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>

export const leaveRequestPatchSchema = leaveRequestBaseSchema.partial()

export const leaveRequestQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  leaveTypeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
})

export type LeaveRequestQuery = z.infer<typeof leaveRequestQuerySchema>

export const cancelRequestSchema = z.object({
  reason: z.string().trim().min(5, 'Alasan pembatalan minimal 5 karakter').max(500),
})

export type CancelRequestInput = z.infer<typeof cancelRequestSchema>
