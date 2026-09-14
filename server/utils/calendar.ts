import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Transaction } from '../database'
import { useDatabase } from '../database'

dayjs.extend(utc)
dayjs.extend(timezone)

export const APP_TZ = 'Asia/Jakarta'

export interface LeaveDay {
  date: string // 'YYYY-MM-DD'
  isWorkingDay: boolean
  isHoliday: boolean
  dayPart: 'FULL_DAY' | 'MORNING' | 'AFTERNOON'
  dayValue: number // 1 or 0.5
}

/**
 * Uraikan rentang tanggal menjadi baris per hari, lengkap dengan penanda hari kerja dan hari libur.
 */
export async function expandLeaveDays(
  db: ReturnType<typeof useDatabase> | Transaction,
  startDate: string,
  endDate: string,
  startDayPart: LeaveDay['dayPart'] = 'FULL_DAY',
  endDayPart: LeaveDay['dayPart'] = 'FULL_DAY'
): Promise<LeaveDay[]> {
  const rows = (await db.execute(sql`
    SELECT d::date AS tanggal,
           fn_is_working_day(d::date) AS hari_kerja,
           EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = d::date) AS libur
    FROM generate_series(${startDate}::date, ${endDate}::date, interval '1 day') AS d
    ORDER BY d
  `)) as any[]

  return rows.map((r, i) => {
    const isFirst = i === 0
    const isLast = i === rows.length - 1
    const dayPart =
      isFirst && startDayPart !== 'FULL_DAY'
        ? startDayPart
        : isLast && endDayPart !== 'FULL_DAY'
          ? endDayPart
          : 'FULL_DAY'

    let formattedDate = ''
    if (r.tanggal instanceof Date) {
      formattedDate = dayjs(r.tanggal).format('YYYY-MM-DD')
    } else {
      formattedDate = String(r.tanggal).substring(0, 10)
    }

    return {
      date: formattedDate,
      isWorkingDay: Boolean(r.hari_kerja),
      isHoliday: Boolean(r.libur),
      dayPart,
      dayValue: dayPart === 'FULL_DAY' ? 1.0 : 0.5,
    }
  })
}

/**
 * Hitung durasi hari kerja dan kalender.
 * counts_working_days_only menentukan apakah totalDays mengikuti hari kerja atau hari kalender.
 */
export function summarizeDays(days: LeaveDay[], workingDaysOnly: boolean) {
  const workingDays = days.filter((d) => d.isWorkingDay).reduce((acc, d) => acc + d.dayValue, 0)
  const calendarDays = days.reduce((acc, d) => acc + d.dayValue, 0)
  const totalDays = workingDaysOnly ? workingDays : calendarDays

  return {
    workingDays,
    calendarDays,
    totalDays,
  }
}
