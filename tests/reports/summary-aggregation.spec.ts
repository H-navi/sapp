import { describe, it, expect } from 'vitest'

function calculateAutoDecidedPct(autoDecided: number, totalDecided: number): number {
  if (!totalDecided || totalDecided <= 0) return 0
  return Math.round((autoDecided / totalDecided) * 100)
}

function isYearEndLeaveRisk(balance: number, month: number): boolean {
  // Risiko penumpukan cuti Desember: sisa kuota >= 8 hari pada kuartal 4 (bulan >= 10)
  return balance >= 8 && month >= 10
}

function calculateAvgDaysPerEmployee(totalDays: number, employeeCount: number): number {
  const safeCount = Math.max(employeeCount, 1)
  return Math.round((totalDays / safeCount) * 10) / 10
}

describe('Summary Aggregation & Risk Logic (Task 11)', () => {
  it('menghitung persentase keputusan otomatis secara akurat dan aman dari bagi nol', () => {
    expect(calculateAutoDecidedPct(0, 0)).toBe(0)
    expect(calculateAutoDecidedPct(5, 20)).toBe(25)
    expect(calculateAutoDecidedPct(1, 3)).toBe(33)
    expect(calculateAutoDecidedPct(0, 10)).toBe(0)
    expect(calculateAutoDecidedPct(10, 10)).toBe(100)
  })

  it('mengidentifikasi risiko penumpukan cuti akhir tahun (Desember) pada Q4', () => {
    // Pada bulan September (bulan 9), belum berisiko meskipun sisa kuota besar
    expect(isYearEndLeaveRisk(12, 9)).toBe(false)
    expect(isYearEndLeaveRisk(8, 9)).toBe(false)

    // Pada bulan Oktober - Desember (bulan 10, 11, 12), berisiko jika balance >= 8
    expect(isYearEndLeaveRisk(8, 10)).toBe(true)
    expect(isYearEndLeaveRisk(12, 11)).toBe(true)
    expect(isYearEndLeaveRisk(9, 12)).toBe(true)

    // Tidak berisiko jika saldo tinggal sedikit di Q4
    expect(isYearEndLeaveRisk(7, 10)).toBe(false)
    expect(isYearEndLeaveRisk(3, 12)).toBe(false)
  })

  it('menghitung rata-rata hari cuti per pegawai dengan aman', () => {
    expect(calculateAvgDaysPerEmployee(25, 5)).toBe(5)
    expect(calculateAvgDaysPerEmployee(10, 3)).toBe(3.3)
    expect(calculateAvgDaysPerEmployee(0, 0)).toBe(0)
    expect(calculateAvgDaysPerEmployee(15, 0)).toBe(15)
  })
})
