import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'

describe('Notification Dispatcher & Retry Logic', () => {
  function computeNextRetry(attempt: number, retryAfterSeconds?: number, fromDate = new Date()): Date {
    if (retryAfterSeconds) {
      return dayjs(fromDate).add(retryAfterSeconds, 'second').toDate()
    }
    let backoffMinutes = 2
    if (attempt === 2) backoffMinutes = 10
    else if (attempt >= 3) backoffMinutes = 30
    return dayjs(fromDate).add(backoffMinutes, 'minute').toDate()
  }

  it('menghitung backoff 2 menit untuk percobaan pertama yang gagal', () => {
    const base = new Date('2026-03-02T10:00:00Z')
    const next = computeNextRetry(1, undefined, base)
    const diffMins = dayjs(next).diff(dayjs(base), 'minute')
    expect(diffMins).toBe(2)
  })

  it('menghitung backoff 10 menit untuk percobaan kedua yang gagal', () => {
    const base = new Date('2026-03-02T10:00:00Z')
    const next = computeNextRetry(2, undefined, base)
    const diffMins = dayjs(next).diff(dayjs(base), 'minute')
    expect(diffMins).toBe(10)
  })

  it('menghitung backoff 30 menit untuk percobaan ketiga yang gagal', () => {
    const base = new Date('2026-03-02T10:00:00Z')
    const next = computeNextRetry(3, undefined, base)
    const diffMins = dayjs(next).diff(dayjs(base), 'minute')
    expect(diffMins).toBe(30)
  })

  it('menggunakan retryAfterSeconds jika provider Telegram mengembalikan rate limit (429)', () => {
    const base = new Date('2026-03-02T10:00:00Z')
    const next = computeNextRetry(1, 45, base)
    const diffSecs = dayjs(next).diff(dayjs(base), 'second')
    expect(diffSecs).toBe(45)
  })

  it('mengidentifikasi event keputusan final yang harus melewati jam tenang', () => {
    const FINAL_DECISION_EVENTS = [
      'REQUEST_APPROVED',
      'REQUEST_REJECTED',
      'REQUEST_AUTO_APPROVED',
      'REQUEST_AUTO_REJECTED',
    ]

    function shouldBypassQuietHours(eventType: string): boolean {
      return FINAL_DECISION_EVENTS.includes(eventType)
    }

    expect(shouldBypassQuietHours('REQUEST_APPROVED')).toBe(true)
    expect(shouldBypassQuietHours('REQUEST_REJECTED')).toBe(true)
    expect(shouldBypassQuietHours('REQUEST_AUTO_APPROVED')).toBe(true)
    expect(shouldBypassQuietHours('APPROVAL_TASK_ASSIGNED')).toBe(false)
    expect(shouldBypassQuietHours('APPROVAL_REMINDER')).toBe(false)
  })
})
