import type { RuleEvaluator } from '../types'

/**
 * GENDER_RESTRICTION: Pembatasan jenis kelamin pegawai.
 */
export const genderRestriction: RuleEvaluator = (params, ctx) => {
  const allowedGender = String(params.gender ?? '').toUpperCase()
  const actualGender = ctx.employee.gender ?? null

  const passed = actualGender !== null && actualGender.toUpperCase() === allowedGender

  return {
    passed,
    context: {
      gender: allowedGender,
      actual_gender: actualGender ?? 'TIDAK_DIKETAHUI',
    },
  }
}

/**
 * MIN_EMPLOYMENT_MONTHS: Masa kerja minimal dalam bulan.
 */
export const minEmploymentMonths: RuleEvaluator = (params, ctx) => {
  const minMonths = Number(params.months ?? 12)
  const actualMonths = ctx.employee.employmentMonths

  const passed = actualMonths >= minMonths

  return {
    passed,
    context: {
      months: minMonths,
      actual_months: actualMonths,
    },
  }
}

/**
 * EMPLOYMENT_STATUS_ALLOWED: Status kepegawaian yang diizinkan (PERMANENT, CONTRACT, dll).
 */
export const employmentStatusAllowed: RuleEvaluator = (params, ctx) => {
  const allowedStatuses: string[] = Array.isArray(params.statuses)
    ? params.statuses.map((s) => String(s).toUpperCase())
    : []

  const currentStatus = String(ctx.employee.employmentStatus ?? '').toUpperCase()
  const passed = allowedStatuses.includes(currentStatus)

  return {
    passed,
    context: {
      statuses: allowedStatuses.join(', '),
      employment_status: currentStatus,
    },
  }
}

/**
 * ONCE_PER_EMPLOYMENT: Hanya boleh diajukan satu kali selama masa kerja pegawai.
 */
export const oncePerEmployment: RuleEvaluator = (_params, ctx) => {
  const passed = !ctx.usage.hasPreviousRequestEver

  return {
    passed,
    context: {
      previous_request_number: ctx.usage.previousRequestNumber ?? '-',
    },
  }
}
