import type { RuleEvaluator } from '../types'

/**
 * QUOTA_SUFFICIENT: Memastikan kuota cuti mencukupi.
 * Bila jenis cuti tidak memotong kuota (ctx.quota === null), otomatis lolos.
 */
export const quotaSufficient: RuleEvaluator = (_params, ctx) => {
  if (ctx.quota === null) {
    return {
      passed: true,
      context: {
        balance: 'N/A',
        requested_days: ctx.request.totalDays,
      },
    }
  }

  const balance = Number(ctx.quota.balance)
  const requestedDays = ctx.request.totalDays
  const passed = balance >= requestedDays

  return {
    passed,
    context: {
      balance,
      requested_days: requestedDays,
    },
  }
}

/**
 * MAX_CONCURRENT_TEAM_ON_LEAVE: Batas maksimal anggota tim yang izin di tanggal yang sama.
 */
export const maxConcurrentTeamOnLeave: RuleEvaluator = (params, ctx) => {
  const maxPeople = Number(params.max_people ?? 2)
  const teamOnLeave = ctx.usage.teamOnLeaveByDate ?? {}

  const violatingDates: string[] = []
  let maxCount = 0

  for (const day of ctx.request.days) {
    const count = teamOnLeave[day.date] ?? 0
    if (count > maxCount) maxCount = count

    // + 1 karena pengajuan ini menambah 1 orang di tim
    if (count + 1 > maxPeople) {
      violatingDates.push(`${day.date} (${count} orang)`)
    }
  }

  return {
    passed: violatingDates.length === 0,
    context: {
      max_people: maxPeople,
      current_count: maxCount,
      violating_dates: violatingDates.join(', '),
    },
  }
}

/**
 * NO_OVERLAP_REQUEST: Pengajuan tidak boleh bertumpuk dengan pengajuan lain yang aktif.
 */
export const noOverlapRequest: RuleEvaluator = (_params, ctx) => {
  const conflict = ctx.usage.overlappingRequestNumber
  const passed = conflict === null || conflict === undefined

  return {
    passed,
    context: {
      conflict_request_number: conflict ?? '-',
    },
  }
}
