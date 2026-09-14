import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { RuleEvaluator } from '../types'

dayjs.extend(isoWeek)

export function getIsoWeekKey(dateStr: string): string {
  const d = dayjs(dateStr)
  const year = d.isoWeekYear()
  const week = String(d.isoWeek()).padStart(2, '0')
  return `${year}-W${week}`
}

export function getMonthKey(dateStr: string): string {
  return dayjs(dateStr).format('YYYY-MM')
}

export function getQuarterKey(dateStr: string): string {
  const d = dayjs(dateStr)
  const quarter = Math.ceil((d.month() + 1) / 3)
  return `${d.year()}-Q${quarter}`
}

export function getYearKey(dateStr: string): string {
  return String(dayjs(dateStr).year())
}

/**
 * MAX_DAYS_PER_REQUEST: Membatasi maksimal hari per satu pengajuan.
 */
export const maxDaysPerRequest: RuleEvaluator = (params, ctx) => {
  const maxDays = Number(params.max_days ?? 5)
  const requestedDays = ctx.request.totalDays
  const passed = requestedDays <= maxDays

  return {
    passed,
    context: {
      max_days: maxDays,
      requested_days: requestedDays,
    },
  }
}

/**
 * MIN_DAYS_PER_REQUEST: Batas minimal hari yang diajukan.
 */
export const minDaysPerRequest: RuleEvaluator = (params, ctx) => {
  const minDays = Number(params.min_days ?? 1)
  const requestedDays = ctx.request.totalDays
  const passed = requestedDays >= minDays

  return {
    passed,
    context: {
      min_days: minDays,
      requested_days: requestedDays,
    },
  }
}

/**
 * MAX_DAYS_PER_PERIOD: Batas hari per periode (WEEK/MONTH/QUARTER/YEAR).
 */
export const maxDaysPerPeriod: RuleEvaluator = (params, ctx) => {
  const maxDays = Number(params.max_days ?? 2)
  const period = String(params.period ?? 'WEEK').toUpperCase()

  // Kelompokkan hari dalam pengajuan berdasarkan periode
  const requestedByPeriod: Record<string, number> = {}

  for (const day of ctx.request.days) {
    // Jika jenis izin hanya menghitung hari kerja, lewati non-working day
    if (ctx.leaveType.countsWorkingDaysOnly && !day.isWorkingDay) {
      continue
    }

    let key = ''
    if (period === 'WEEK') key = getIsoWeekKey(day.date)
    else if (period === 'MONTH') key = getMonthKey(day.date)
    else if (period === 'QUARTER') key = getQuarterKey(day.date)
    else key = getYearKey(day.date)

    requestedByPeriod[key] = (requestedByPeriod[key] ?? 0) + day.dayValue
  }

  // Jika tidak ada hari yang tersentuh (misal totalDays 0), lolos
  if (Object.keys(requestedByPeriod).length === 0) {
    return {
      passed: true,
      context: { max_days: maxDays, period, current_days: 0, violating_period: '' },
    }
  }

  // Evaluasi tiap periode yang tersentuh
  for (const [periodKey, reqDays] of Object.entries(requestedByPeriod)) {
    let prevDays = 0
    if (period === 'WEEK') {
      prevDays = ctx.usage.daysByWeek[periodKey] ?? 0
    } else if (period === 'MONTH') {
      prevDays = ctx.usage.daysByMonth[periodKey] ?? 0
    } else if (period === 'YEAR') {
      prevDays = ctx.usage.daysThisYear
    } else {
      // QUARTER: jumlahkan bulan-bulan dalam kuartal dari daysByMonth
      const [y, qStr] = periodKey.split('-Q')
      const qNum = Number(qStr)
      const startMonth = (qNum - 1) * 3 + 1
      for (let m = startMonth; m < startMonth + 3; m++) {
        const mKey = `${y}-${String(m).padStart(2, '0')}`
        prevDays += ctx.usage.daysByMonth[mKey] ?? 0
      }
    }

    if (prevDays + reqDays > maxDays) {
      return {
        passed: false,
        context: {
          max_days: maxDays,
          period,
          current_days: prevDays,
          requested_in_period: reqDays,
          violating_period: periodKey,
        },
      }
    }
  }

  const firstKey = Object.keys(requestedByPeriod)[0] ?? ''
  const prevDays =
    firstKey && period === 'WEEK'
      ? ctx.usage.daysByWeek[firstKey] ?? 0
      : firstKey && period === 'MONTH'
        ? ctx.usage.daysByMonth[firstKey] ?? 0
        : ctx.usage.daysThisYear

  return {
    passed: true,
    context: {
      max_days: maxDays,
      period,
      current_days: prevDays,
      violating_period: '',
    },
  }
}

/**
 * MAX_REQUESTS_PER_PERIOD: Batas frekuensi pengajuan per periode (biasanya bulanan).
 */
export const maxRequestsPerPeriod: RuleEvaluator = (params, ctx) => {
  const maxRequests = Number(params.max_requests ?? 2)
  const currentCount = ctx.usage.requestsThisMonth
  const passed = currentCount + 1 <= maxRequests

  return {
    passed,
    context: {
      max_requests: maxRequests,
      period: params.period ?? 'MONTH',
      current_count: currentCount,
    },
  }
}

/**
 * MAX_PER_YEAR: Akumulasi hari izin dalam 1 tahun berjalan.
 */
export const maxPerYear: RuleEvaluator = (params, ctx) => {
  const maxDays = Number(params.max_days ?? 14)
  const usedDays = ctx.usage.daysThisYear
  const requestedDays = ctx.request.totalDays
  const passed = usedDays + requestedDays <= maxDays

  return {
    passed,
    context: {
      max_days: maxDays,
      used_days: usedDays,
      requested_days: requestedDays,
    },
  }
}
