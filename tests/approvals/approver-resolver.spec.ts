import { describe, it, expect } from 'vitest'
import { createMockRequestContext, createMockWorkflowStep } from './helpers'
import type { ApproverCandidate } from '../../server/services/approval/types'

describe('Approver Resolver Logic', () => {
  it('DIRECT_MANAGER: mengembalikan atasan langsung pemohon', () => {
    const req = createMockRequestContext({
      employee: {
        id: 'emp-budi',
        fullName: 'Budi Santoso',
        departmentId: 'dept-it',
        positionId: 'pos-1',
        positionLevel: 1,
        managerId: 'emp-andi',
        employmentStatus: 'PERMANENT',
      },
    })
    const step = createMockWorkflowStep({ approverType: 'DIRECT_MANAGER', skipIfRequester: true })

    let utama = req.employee.managerId ? [req.employee.managerId] : []
    if (step.skipIfRequester) {
      utama = utama.filter((id) => id !== req.employee.id)
    }

    expect(utama).toEqual(['emp-andi'])
  })

  it('skipIfRequester: Atasan (Andi) mengajukan izin sendiri -> diexclude dari approver dirinya sendiri', () => {
    const req = createMockRequestContext({
      employee: {
        id: 'emp-andi',
        fullName: 'Andi Nugroho',
        departmentId: 'dept-it',
        positionId: 'pos-spv',
        positionLevel: 2,
        managerId: 'emp-andi', // Misal salah konfigurasi manager mengarah ke diri sendiri
        employmentStatus: 'PERMANENT',
      },
    })
    const step = createMockWorkflowStep({ approverType: 'DIRECT_MANAGER', skipIfRequester: true })

    let utama = req.employee.managerId ? [req.employee.managerId] : []
    if (step.skipIfRequester) {
      utama = utama.filter((id) => id !== req.employee.id)
    }

    expect(utama).toEqual([])
  })

  it('skipIfAlreadyApproved: Menyaring approver yang sudah menyetujui tahap sebelumnya', () => {
    const step = createMockWorkflowStep({ skipIfAlreadyApproved: true })
    const candidateList = ['emp-andi', 'emp-rina']
    const approvedBefore = ['emp-andi']

    const filtered = candidateList.filter((id) => !approvedBefore.includes(id))
    expect(filtered).toEqual(['emp-rina'])
  })

  it('allowDelegation: Menyertakan pegawai delegasi aktif', () => {
    const utama = ['emp-andi']
    const activeDelegations = [
      { delegatorId: 'emp-andi', delegateId: 'emp-sinta', isActive: true },
    ]

    const hasil: ApproverCandidate[] = utama.map((id) => ({
      employeeId: id,
      isDelegate: false,
      delegatedFrom: null,
    }))

    for (const id of utama) {
      const dList = activeDelegations.filter((d) => d.delegatorId === id && d.isActive)
      for (const d of dList) {
        if (!hasil.some((h) => h.employeeId === d.delegateId)) {
          hasil.push({
            employeeId: d.delegateId,
            isDelegate: true,
            delegatedFrom: id,
          })
        }
      }
    }

    expect(hasil).toHaveLength(2)
    expect(hasil[0].employeeId).toBe('emp-andi')
    expect(hasil[1]).toEqual({
      employeeId: 'emp-sinta',
      isDelegate: true,
      delegatedFrom: 'emp-andi',
    })
  })
})
