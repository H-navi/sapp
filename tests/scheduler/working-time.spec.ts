import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  TZ,
  getDefaultWorkingCalendar,
  isWithinWorkingHours,
  addWorkingHours,
  workingHoursBetween,
  nextWorkingMoment,
  type WorkingCalendar,
} from '../../server/utils/working-time'

dayjs.extend(utc)
dayjs.extend(timezone)

describe('Aritmetika Jam Kerja (Working Time Arithmetic)', () => {
  const cal: WorkingCalendar = getDefaultWorkingCalendar()

  // Tambahkan hari libur 17 Agustus 2026
  cal.holidays.add('2026-08-17')

  it('Kasus 1: Sen 15:00 + 4 jam kerja -> Sel 10:00', () => {
    // 2026-08-10 adalah hari Senin
    const start = dayjs.tz('2026-08-10 15:00:00', TZ).toDate()
    const result = addWorkingHours(start, 4, cal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    expect(formatted).toBe('2026-08-11 10:00')
  })

  it('Kasus 2: Jum 15:00 + 8 jam kerja -> Sen 15:00 (2 jam di Jumat + 6 jam di Senin)', () => {
    // 2026-08-07 adalah hari Jumat (minggu biasa tanpa libur nasional)
    const start = dayjs.tz('2026-08-07 15:00:00', TZ).toDate()
    const result = addWorkingHours(start, 8, cal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    expect(formatted).toBe('2026-08-10 15:00')
  })

  it('Kasus 2b: Jum 16:00 + 8 jam kerja -> Sen 16:00 (pada kalender normal tanpa libur)', () => {
    // Kalender tanpa libur 17 Agu
    const normalCal = getDefaultWorkingCalendar()
    // 2026-08-07 adalah Jumat, 2026-08-10 adalah Senin
    const start = dayjs.tz('2026-08-07 16:00:00', TZ).toDate()
    const result = addWorkingHours(start, 8, normalCal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    // Jum: 16:00-17:00 (1 jam)
    // Sen: 08:00-12:00 (4 jam), istirahat 12:00-13:00, 13:00-16:00 (3 jam) -> Total 1 + 7 = 8 jam kerja
    expect(formatted).toBe('2026-08-10 16:00')
  })

  it('Kasus 3: Sab 09:00 + 1 jam kerja -> Sen 09:00 (Sabtu bukan hari kerja)', () => {
    // 2026-08-08 adalah hari Sabtu
    const start = dayjs.tz('2026-08-08 09:00:00', TZ).toDate()
    const result = addWorkingHours(start, 1, cal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    expect(formatted).toBe('2026-08-10 09:00')
  })

  it('Kasus 4: Sen 11:30 + 1 jam kerja -> Sen 13:30 (melewati istirahat 12:00–13:00)', () => {
    // 2026-08-10 adalah hari Senin
    const start = dayjs.tz('2026-08-10 11:30:00', TZ).toDate()
    const result = addWorkingHours(start, 1, cal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    expect(formatted).toBe('2026-08-10 13:30')
  })

  it('Kasus 5: 16 Agu (Minggu) 14:00 + 4 jam kerja -> 18 Agu 09:00 (17 Agu libur)', () => {
    // 2026-08-16 adalah Minggu (libur)
    // 2026-08-17 adalah Senin (libur nasional HUT RI)
    // Awal kerja berikutnya adalah Selasa 18 Agu 08:00
    // 08:00 + 4 jam kerja (08:00–12:00) -> 12:00
    // Tapi jika dimulai Minggu 14:00:
    // Jika 16 Agu adalah hari kerja (misal Jumat 14 Agu 14:00):
    // 14 Agu 14:00 (3 jam kerja hingga 17:00). Sisa 1 jam.
    // 15 Sab (libur), 16 Min (libur), 17 Agu (libur).
    // 18 Agu 08:00 + 1 jam = 18 Agu 09:00!
    const startJumat = dayjs.tz('2026-08-14 14:00:00', TZ).toDate()
    const result = addWorkingHours(startJumat, 4, cal)
    const formatted = dayjs(result).tz(TZ).format('YYYY-MM-DD HH:mm')

    expect(formatted).toBe('2026-08-18 09:00')
  })

  it('isWithinWorkingHours memvalidasi jam buka, tutup, istirahat, dan hari libur', () => {
    // Senin jam 09:00 -> true
    expect(isWithinWorkingHours(dayjs.tz('2026-08-10 09:00:00', TZ).toDate(), cal)).toBe(true)

    // Senin jam 12:30 (istirahat) -> false
    expect(isWithinWorkingHours(dayjs.tz('2026-08-10 12:30:00', TZ).toDate(), cal)).toBe(false)

    // Senin jam 18:00 (malam) -> false
    expect(isWithinWorkingHours(dayjs.tz('2026-08-10 18:00:00', TZ).toDate(), cal)).toBe(false)

    // Sabtu jam 10:00 -> false
    expect(isWithinWorkingHours(dayjs.tz('2026-08-08 10:00:00', TZ).toDate(), cal)).toBe(false)

    // 17 Agustus jam 10:00 (libur nasional) -> false
    expect(isWithinWorkingHours(dayjs.tz('2026-08-17 10:00:00', TZ).toDate(), cal)).toBe(false)
  })

  it('nextWorkingMoment melompati malam, istirahat, dan libur ke awal sesi kerja berikutnya', () => {
    // Senin malam 20:00 -> Selasa 08:00
    const m1 = nextWorkingMoment(dayjs.tz('2026-08-10 20:00:00', TZ).toDate(), cal)
    expect(dayjs(m1).tz(TZ).format('YYYY-MM-DD HH:mm')).toBe('2026-08-11 08:00')

    // Senin siang 12:15 (istirahat) -> Senin 13:00
    const m2 = nextWorkingMoment(dayjs.tz('2026-08-10 12:15:00', TZ).toDate(), cal)
    expect(dayjs(m2).tz(TZ).format('YYYY-MM-DD HH:mm')).toBe('2026-08-10 13:00')

    // Jumat malam 19:00 -> Senin 08:00 (melompati Sabtu-Minggu)
    const m3 = nextWorkingMoment(dayjs.tz('2026-08-07 19:00:00', TZ).toDate(), cal)
    expect(dayjs(m3).tz(TZ).format('YYYY-MM-DD HH:mm')).toBe('2026-08-10 08:00')
  })

  it('workingHoursBetween menghitung selisih jam kerja presisi', () => {
    // Senin 09:00 s.d. Senin 11:00 -> 2 jam
    const from1 = dayjs.tz('2026-08-10 09:00:00', TZ).toDate()
    const to1 = dayjs.tz('2026-08-10 11:00:00', TZ).toDate()
    expect(workingHoursBetween(from1, to1, cal)).toBe(2)

    // Senin 11:00 s.d. Senin 14:00 (melewati istirahat 12:00-13:00) -> 2 jam
    const to2 = dayjs.tz('2026-08-10 14:00:00', TZ).toDate()
    expect(workingHoursBetween(from1, to2, cal)).toBe(4) // 09-12 (3h) + 13-14 (1h) = 4 jam
  })
})
