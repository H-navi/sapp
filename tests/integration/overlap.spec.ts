import { describe, it, expect, afterEach } from 'vitest'
import { createRequest } from '../../server/services/leave-request.service'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Request Overlap Prevention (Task 13)', () => {
  const activeRequestIds: string[] = []

  afterEach(async () => {
    while (activeRequestIds.length > 0) {
      const id = activeRequestIds.pop()
      await cleanupRequest(id)
    }
  })

  it('Dua pengajuan bertumpuk untuk pegawai yang sama -> yang kedua gagal dengan REQUEST_OVERLAP', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const auth = makeAuth(budi)

    // 1. Buat pengajuan pertama: 4 - 5 November 2026 (Rabu - Kamis)
    const first = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-04',
        endDate: '2026-11-05',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Pengajuan cuti pertama di bulan November',
        action: 'submit',
      },
      auth
    )

    expect(first).toBeDefined()
    expect(first.id).toBeDefined()
    activeRequestIds.push(first.id)

    // 2. Buat pengajuan kedua yang bertumpuk: 5 - 6 November 2026 (Kamis - Jumat)
    let overlapError: any = null
    try {
      const second = await createRequest(
        {
          leaveTypeId: cutiTahunan.id,
          startDate: '2026-11-05',
          endDate: '2026-11-06',
          startDayPart: 'FULL_DAY',
          endDayPart: 'FULL_DAY',
          reason: 'Pengajuan cuti kedua yang bertumpuk tanggal 5 Nov',
          action: 'submit',
        },
        auth
      )
      if (second?.id) activeRequestIds.push(second.id)
    } catch (err: any) {
      overlapError = err
    }

    expect(overlapError).toBeDefined()
    // Bisa berupa 409 REQUEST_OVERLAP (PostgreSQL EXCLUDE constraint) atau 422 RULE_BLOCKED (NO_OVERLAP_REQUEST)
    const isOverlapRejected =
      (overlapError.statusCode === 409 && overlapError.statusMessage === 'REQUEST_OVERLAP') ||
      (overlapError.statusCode === 422 && overlapError.statusMessage === 'RULE_BLOCKED' && overlapError.message.includes('bertumpuk'))

    expect(isOverlapRejected).toBe(true)
  })
})
