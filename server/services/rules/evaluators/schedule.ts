import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { RuleContext, RuleEvaluator } from '../types'

dayjs.extend(isoWeek)

/**
 * Cek apakah tanggal adalah hari kerja (deterministik tanpa DB).
 * 1. Jika ada di ctx.request.days, gunakan status isWorkingDay tersebut.
 * 2. Cek apakah akhir pekan (Sabtu / Minggu).
 * 3. Cek apakah ada di daftar hari libur (ctx.holidays).
 */
export function isDateWorkingDay(dateStr: string, ctx: RuleContext): boolean {
  const inReq = ctx.request.days.find((d) => d.date === dateStr)
  if (inReq) return inReq.isWorkingDay

  const d = dayjs(dateStr)
  const isoDay = d.isoWeekday() // 1 = Mon, 7 = Sun
  if (isoDay === 6 || isoDay === 7) return false

  if (ctx.holidays && ctx.holidays.includes(dateStr)) {
    return false
  }

  return true
}

/**
 * Hitung jumlah hari kerja eksklusif antara d1 dan d2 (d1 < c < d2).
 */
export function workingDaysBetween(d1: string, d2: string, ctx: RuleContext): number {
  let cur = dayjs(d1).add(1, 'day')
  const end = dayjs(d2)
  let count = 0

  while (cur.isBefore(end, 'day')) {
    if (isDateWorkingDay(cur.format('YYYY-MM-DD'), ctx)) {
      count++
    }
    cur = cur.add(1, 'day')
  }

  return count
}

/**
 * NO_CONSECUTIVE_DAYS: Hari izin tidak boleh berurutan pada hari kerja.
 */
export const noConsecutiveDays: RuleEvaluator = (params, ctx) => {
  const minGap = Number(params.min_gap_working_days ?? 1)
  const baru = ctx.request.days.filter((d) => d.isWorkingDay).map((d) => d.date)
  const approved = ctx.usage.approvedDates ?? []
  const semua = Array.from(new Set([...approved, ...baru])).sort()

  const pelanggaran: string[] = []
  for (let i = 1; i < semua.length; i++) {
    const d1 = semua[i - 1]
    const d2 = semua[i]
    if (!d1 || !d2) continue
    // Hanya periksa pasangan yang melibatkan tanggal dari pengajuan baru
    if (baru.includes(d1) || baru.includes(d2)) {
      const jarak = workingDaysBetween(d1, d2, ctx)
      if (jarak <= minGap - 1) {
        pelanggaran.push(`${d1} & ${d2}`)
      }
    }
  }

  return {
    passed: pelanggaran.length === 0,
    context: {
      min_gap_working_days: minGap,
      violating_dates: pelanggaran.join(', '),
    },
  }
}

/**
 * ALLOWED_WEEKDAYS: Hanya izinkan hari-hari tertentu (ISO weekdays 1-7).
 */
export const allowedWeekdays: RuleEvaluator = (params, ctx) => {
  const allowedList = Array.isArray(params.weekdays) ? params.weekdays.map(Number) : []
  const workingDays = ctx.request.days.filter((d) => d.isWorkingDay)

  const violatingDates: string[] = []
  for (const day of workingDays) {
    const isoDay = dayjs(day.date).isoWeekday()
    if (!allowedList.includes(isoDay)) {
      violatingDates.push(day.date)
    }
  }

  return {
    passed: violatingDates.length === 0,
    context: {
      weekdays: allowedList,
      violating_dates: violatingDates.join(', '),
    },
  }
}

/**
 * BLACKOUT_PERIOD: Melarang pengajuan cuti pada rentang tanggal tertentu.
 */
export const blackoutPeriod: RuleEvaluator = (params, ctx) => {
  const ranges: Array<{ from: string; to: string }> = Array.isArray(params.ranges) ? params.ranges : []
  const violatingDates: string[] = []
  let hitRangeStr = ''

  for (const day of ctx.request.days) {
    for (const r of ranges) {
      if (r.from && r.to && day.date >= r.from && day.date <= r.to) {
        violatingDates.push(day.date)
        if (!hitRangeStr) hitRangeStr = `${r.from} s.d. ${r.to}`
      }
    }
  }

  return {
    passed: violatingDates.length === 0,
    context: {
      blackout_range: hitRangeStr || '-',
      violating_dates: violatingDates.join(', '),
    },
  }
}

/**
 * MIN_NOTICE_DAYS: Jarak tanggal hari ini ke tanggal mulai izin minimal N hari.
 */
export const minNoticeDays: RuleEvaluator = (params, ctx) => {
  const minNotice = Number(params.min_notice_days ?? 3)
  const countMode = String(params.count ?? 'WORKING').toUpperCase()

  let actualNotice = 0
  const startDate = ctx.request.startDate
  const today = ctx.today

  if (startDate > today) {
    if (countMode === 'CALENDAR') {
      actualNotice = dayjs(startDate).diff(dayjs(today), 'day')
    } else {
      // Mode WORKING: hitung hari kerja d di mana today <= d < startDate
      let cur = dayjs(today)
      const target = dayjs(startDate)
      let count = 0
      while (cur.isBefore(target, 'day')) {
        if (isDateWorkingDay(cur.format('YYYY-MM-DD'), ctx)) {
          count++
        }
        cur = cur.add(1, 'day')
      }
      actualNotice = count
    }
  } else {
    actualNotice = 0
  }

  const passed = actualNotice >= minNotice

  return {
    passed,
    context: {
      min_notice_days: minNotice,
      actual_notice_days: actualNotice,
      count_mode: countMode,
    },
  }
}

/**
 * MAX_BACKDATE_DAYS: Batas hari mundur jika pengajuan di masa lampau.
 */
export const maxBackdateDays: RuleEvaluator = (params, ctx) => {
  const maxBackdate = Number(params.max_backdate_days ?? 0)
  const startDate = ctx.request.startDate
  const today = ctx.today

  let backdateDays = 0
  if (startDate < today) {
    backdateDays = dayjs(today).diff(dayjs(startDate), 'day')
  }

  const passed = backdateDays <= maxBackdate

  return {
    passed,
    context: {
      max_backdate_days: maxBackdate,
      backdate_days: backdateDays,
    },
  }
}
