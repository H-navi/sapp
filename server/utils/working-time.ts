import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import * as schema from '../database/schema'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(customParseFormat)

export const TZ = 'Asia/Jakarta'

export interface WorkingDaySchedule {
  isWorkingDay: boolean
  start: string // 'HH:mm'
  end: string // 'HH:mm'
  breakStart: string | null // 'HH:mm'
  breakEnd: string | null // 'HH:mm'
}

export interface WorkingCalendar {
  /** ISO day 1 (Senin) - 7 (Minggu) */
  hours: Record<number, WorkingDaySchedule>
  /** Set of 'YYYY-MM-DD' */
  holidays: Set<string>
}

// In-memory cache selama 15 menit
let cachedCalendar: WorkingCalendar | null = null
let cacheExpiresAt = 0

/**
 * Muat kalender kerja dari database sekali per proses dengan refresh otomatis tiap 15 menit.
 */
export async function loadWorkingCalendar(forceRefresh = false): Promise<WorkingCalendar> {
  const now = Date.now()
  if (!forceRefresh && cachedCalendar && now < cacheExpiresAt) {
    return cachedCalendar
  }

  try {
    const db = useDatabase()

    const whRows = await db.select().from(schema.workingHours)
    const holidayRows = await db.select().from(schema.holidays)

    const hours: Record<number, WorkingDaySchedule> = {}
    for (const row of whRows) {
      hours[row.dayOfWeek] = {
        isWorkingDay: row.isWorkingDay,
        start: (row.startTime || '08:00').substring(0, 5),
        end: (row.endTime || '17:00').substring(0, 5),
        breakStart: row.breakStart ? row.breakStart.substring(0, 5) : null,
        breakEnd: row.breakEnd ? row.breakEnd.substring(0, 5) : null,
      }
    }

    const holidays = new Set<string>()
    for (const h of holidayRows) {
      holidays.add(h.holidayDate)
    }

    cachedCalendar = { hours, holidays }
    cacheExpiresAt = now + 15 * 60 * 1000
    return cachedCalendar
  } catch {
    // Fallback bawaan jika database belum terhubung
    return getDefaultWorkingCalendar()
  }
}

/**
 * Kalender kerja standar (Senin-Jumat 08:00-17:00, Istirahat 12:00-13:00, Sabtu-Minggu libur).
 */
export function getDefaultWorkingCalendar(): WorkingCalendar {
  const standardDay: WorkingDaySchedule = {
    isWorkingDay: true,
    start: '08:00',
    end: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
  }

  return {
    hours: {
      1: { ...standardDay },
      2: { ...standardDay },
      3: { ...standardDay },
      4: { ...standardDay },
      5: { ...standardDay },
      6: { isWorkingDay: false, start: '08:00', end: '12:00', breakStart: null, breakEnd: null },
      7: { isWorkingDay: false, start: '08:00', end: '12:00', breakStart: null, breakEnd: null },
    },
    holidays: new Set(),
  }
}

/**
 * Mengubah objek Date ke dayjs dengan timezone Asia/Jakarta.
 */
function toTz(date: Date | string): dayjs.Dayjs {
  return dayjs(date).tz(TZ)
}

/**
 * Mendapatkan ISO day (1 = Senin, ..., 7 = Minggu).
 */
function getIsoDay(d: dayjs.Dayjs): number {
  const dow = d.day()
  return dow === 0 ? 7 : dow
}

/**
 * Cek apakah sebuah tanggal adalah hari libur atau akhir pekan.
 */
export function isWorkingDate(d: dayjs.Dayjs, cal: WorkingCalendar): boolean {
  const dateStr = d.format('YYYY-MM-DD')
  if (cal.holidays.has(dateStr)) return false
  const isoDay = getIsoDay(d)
  return Boolean(cal.hours[isoDay]?.isWorkingDay)
}

/**
 * true bila waktu tersebut berada tepat dalam jam kerja (di luar istirahat dan bukan libur).
 */
export function isWithinWorkingHours(at: Date, cal: WorkingCalendar): boolean {
  const d = toTz(at)
  if (!isWorkingDate(d, cal)) return false

  const isoDay = getIsoDay(d)
  const schedule = cal.hours[isoDay]
  if (!schedule || !schedule.isWorkingDay) return false

  const timeStr = d.format('HH:mm:ss')
  const startStr = `${schedule.start}:00`
  const endStr = `${schedule.end}:00`

  if (timeStr < startStr || timeStr >= endStr) return false

  // Cek jam istirahat
  if (schedule.breakStart && schedule.breakEnd) {
    const breakStartStr = `${schedule.breakStart}:00`
    const breakEndStr = `${schedule.breakEnd}:00`
    if (timeStr >= breakStartStr && timeStr < breakEndStr) {
      return false
    }
  }

  return true
}

/**
 * Menemukan momen awal sesi kerja berikutnya (melewati malam, akhir pekan, atau jam istirahat).
 */
export function nextWorkingMoment(from: Date, cal: WorkingCalendar): Date {
  let d = toTz(from)

  for (let step = 0; step < 60; step++) {
    const isoDay = getIsoDay(d)
    const schedule = cal.hours[isoDay]
    const isWorkDay = isWorkingDate(d, cal)

    if (isWorkDay && schedule && schedule.isWorkingDay) {
      const timeStr = d.format('HH:mm:ss')
      const startStr = `${schedule.start}:00`
      const endStr = `${schedule.end}:00`
      const breakStartStr = schedule.breakStart ? `${schedule.breakStart}:00` : null
      const breakEndStr = schedule.breakEnd ? `${schedule.breakEnd}:00` : null

      // Jika sebelum jam buka hari ini
      if (timeStr < startStr) {
        const [h = 0, m = 0] = schedule.start.split(':').map(Number)
        return d.hour(h).minute(m).second(0).millisecond(0).toDate()
      }

      // Jika saat jam istirahat
      if (breakStartStr && breakEndStr && timeStr >= breakStartStr && timeStr < breakEndStr) {
        const [h = 0, m = 0] = schedule.breakEnd!.split(':').map(Number)
        return d.hour(h).minute(m).second(0).millisecond(0).toDate()
      }

      // Jika masih dalam jam kerja (sebelum breakStart atau setelah breakEnd sebelum endStr)
      if (timeStr < endStr && (!breakStartStr || timeStr < breakStartStr || (breakEndStr && timeStr >= breakEndStr))) {
        return d.toDate()
      }
    }

    // Geser ke awal hari berikutnya jam 00:00
    d = d.add(1, 'day').startOf('day')
    const nextIso = getIsoDay(d)
    const nextSched = cal.hours[nextIso]
    if (isWorkingDate(d, cal) && nextSched && nextSched.isWorkingDay) {
      const [h = 0, m = 0] = nextSched.start.split(':').map(Number)
      return d.hour(h).minute(m).second(0).millisecond(0).toDate()
    }
  }

  return d.toDate()
}

/**
 * Tambahkan N jam KERJA ke sebuah waktu.
 * Memperhitungkan pergantian sesi, istirahat, akhir pekan, dan hari libur.
 */
export function addWorkingHours(from: Date, hours: number, cal: WorkingCalendar): Date {
  if (hours <= 0) return from

  let sisaMinutes = Math.round(hours * 60)
  let cursor = toTz(from)

  while (sisaMinutes > 0) {
    if (!isWithinWorkingHours(cursor.toDate(), cal)) {
      cursor = toTz(nextWorkingMoment(cursor.toDate(), cal))
    }

    const isoDay = getIsoDay(cursor)
    const schedule = cal.hours[isoDay]!
    const timeStr = cursor.format('HH:mm:ss')
    const breakStartStr = schedule.breakStart ? `${schedule.breakStart}:00` : null
    const breakEndStr = schedule.breakEnd ? `${schedule.breakEnd}:00` : null
    const endStr = `${schedule.end}:00`

    // Tentukan batas akhir sesi saat ini (apakah sesi pagi sebelum istirahat atau sesi sore)
    let sessionEndStr: string
    if (breakStartStr && timeStr < breakStartStr) {
      sessionEndStr = breakStartStr
    } else {
      sessionEndStr = endStr
    }

    const [endH = 0, endM = 0] = sessionEndStr.split(':').map(Number)
    const sessionEnd = cursor.hour(endH).minute(endM).second(0).millisecond(0)
    const availableMinutes = sessionEnd.diff(cursor, 'minute')

    if (availableMinutes <= 0) {
      // Pindah ke sesi berikutnya
      cursor = toTz(nextWorkingMoment(cursor.toDate(), cal))
      continue
    }

    if (availableMinutes >= sisaMinutes) {
      return cursor.add(sisaMinutes, 'minute').toDate()
    }

    sisaMinutes -= availableMinutes
    cursor = toTz(nextWorkingMoment(sessionEnd.toDate(), cal))
  }

  return cursor.toDate()
}

/**
 * Selisih jam kerja antara dua waktu (untuk menampilkan "sisa jam kerja").
 */
export function workingHoursBetween(from: Date, to: Date, cal: WorkingCalendar): number {
  if (to <= from) return 0

  let cursor = toTz(from)
  const target = toTz(to)
  let totalMinutes = 0

  while (cursor.isBefore(target)) {
    if (!isWithinWorkingHours(cursor.toDate(), cal)) {
      cursor = toTz(nextWorkingMoment(cursor.toDate(), cal))
      if (cursor.isSameOrAfter(target)) break
    }

    const isoDay = getIsoDay(cursor)
    const schedule = cal.hours[isoDay]!
    const timeStr = cursor.format('HH:mm:ss')
    const breakStartStr = schedule.breakStart ? `${schedule.breakStart}:00` : null
    const endStr = `${schedule.end}:00`

    const sessionEndStr = breakStartStr && timeStr < breakStartStr ? breakStartStr : endStr
    const [endH = 0, endM = 0] = sessionEndStr.split(':').map(Number)
    const sessionEnd = cursor.hour(endH).minute(endM).second(0).millisecond(0)

    const endPoint = target.isBefore(sessionEnd) ? target : sessionEnd
    const diff = endPoint.diff(cursor, 'minute')
    if (diff > 0) totalMinutes += diff

    cursor = toTz(nextWorkingMoment(sessionEnd.toDate(), cal))
  }

  return Math.round((totalMinutes / 60) * 100) / 100
}
