import { describe, it, expect } from 'vitest'
import { createMockWorkflowStep } from './helpers'

interface MockAssignee {
  id: string
  employeeId: string
  response: 'APPROVED' | 'REJECTED' | null
  respondedAt: Date | null
  responseNote: string | null
}

interface MockTask {
  id: string
  requestId: string
  stepOrder: number
  stepName: string
  approvalMode: 'ANY_ONE' | 'ALL' | 'QUORUM'
  quorumCount: number | null
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  actedBy: string | null
  actedAt: Date | null
  assignees: MockAssignee[]
}

function evaluateStepCompletion(task: MockTask): boolean {
  const approvedCount = task.assignees.filter((a) => a.response === 'APPROVED').length
  const pendingCount = task.assignees.filter((a) => a.response === null).length

  if (task.approvalMode === 'ANY_ONE') {
    return approvedCount >= 1
  }
  if (task.approvalMode === 'ALL') {
    return pendingCount === 0 && approvedCount === task.assignees.length
  }
  if (task.approvalMode === 'QUORUM') {
    const need = task.quorumCount ?? 1
    return approvedCount >= need
  }
  return false
}

function simulateActOnTask(
  task: MockTask,
  actorEmployeeId: string,
  action: 'APPROVE' | 'REJECT',
  note?: string
) {
  // 1. Check status
  if (task.status !== 'PENDING') {
    throw new Error('409: APPROVAL_TASK_CLOSED - Tugas ini sudah diproses.')
  }

  // 2. Check assignee
  const assignee = task.assignees.find((a) => a.employeeId === actorEmployeeId)
  if (!assignee) {
    throw new Error('403: AUTH_FORBIDDEN - Anda tidak memiliki wewenang untuk tugas ini.')
  }
  if (assignee.response !== null) {
    throw new Error('400: Anda sudah memberikan respons pada tugas ini.')
  }

  // 3. Check rejection note requirement (>= 10 chars)
  if (action === 'REJECT') {
    if (!note || note.trim().length < 10) {
      throw new Error('422: Catatan alasan penolakan wajib diisi (minimal 10 karakter).')
    }
    assignee.response = 'REJECTED'
    assignee.responseNote = note
    assignee.respondedAt = new Date()

    task.status = 'REJECTED'
    task.actedBy = actorEmployeeId
    task.actedAt = new Date()

    return {
      success: true,
      stepCompleted: true,
      requestStatus: 'REJECTED',
    }
  }

  // 4. Handle APPROVE
  assignee.response = 'APPROVED'
  assignee.responseNote = note ?? null
  assignee.respondedAt = new Date()

  const isCompleted = evaluateStepCompletion(task)
  if (isCompleted) {
    task.status = 'APPROVED'
    task.actedBy = actorEmployeeId
    task.actedAt = new Date()
    return {
      success: true,
      stepCompleted: true,
      requestStatus: 'IN_REVIEW_OR_FINAL',
    }
  }

  return {
    success: true,
    stepCompleted: false,
    requestStatus: 'IN_REVIEW',
  }
}

describe('Approval Engine State Machine & Resolution', () => {
  it('ANY_ONE: Satu persetujuan langsung menyelesaikan tahap', () => {
    const task: MockTask = {
      id: 'task-1',
      requestId: 'req-1',
      stepOrder: 1,
      stepName: 'Atasan Langsung',
      approvalMode: 'ANY_ONE',
      quorumCount: null,
      status: 'PENDING',
      actedBy: null,
      actedAt: null,
      assignees: [
        { id: 'as-1', employeeId: 'emp-andi', response: null, respondedAt: null, responseNote: null },
        { id: 'as-2', employeeId: 'emp-budi', response: null, respondedAt: null, responseNote: null },
      ],
    }

    const result = simulateActOnTask(task, 'emp-andi', 'APPROVE', 'Disetujui')
    expect(result.stepCompleted).toBe(true)
    expect(task.status).toBe('APPROVED')
    expect(task.actedBy).toBe('emp-andi')
  })

  it('ALL: Membutuhkan seluruh approver menyetujui sebelum tahap selesai', () => {
    const task: MockTask = {
      id: 'task-2',
      requestId: 'req-2',
      stepOrder: 1,
      stepName: 'Komite Persetujuan',
      approvalMode: 'ALL',
      quorumCount: null,
      status: 'PENDING',
      actedBy: null,
      actedAt: null,
      assignees: [
        { id: 'as-1', employeeId: 'emp-andi', response: null, respondedAt: null, responseNote: null },
        { id: 'as-2', employeeId: 'emp-rina', response: null, respondedAt: null, responseNote: null },
      ],
    }

    // Approver 1 menyetujui -> belum selesai
    const res1 = simulateActOnTask(task, 'emp-andi', 'APPROVE')
    expect(res1.stepCompleted).toBe(false)
    expect(task.status).toBe('PENDING')

    // Approver 2 menyetujui -> tahap selesai
    const res2 = simulateActOnTask(task, 'emp-rina', 'APPROVE')
    expect(res2.stepCompleted).toBe(true)
    expect(task.status).toBe('APPROVED')
  })

  it('QUORUM: Selesai jika jumlah persetujuan memenuhi batas kuorum minimum', () => {
    const task: MockTask = {
      id: 'task-3',
      requestId: 'req-3',
      stepOrder: 1,
      stepName: 'Dewan Direksi (Kuorum 2 dari 3)',
      approvalMode: 'QUORUM',
      quorumCount: 2,
      status: 'PENDING',
      actedBy: null,
      actedAt: null,
      assignees: [
        { id: 'as-1', employeeId: 'emp-1', response: null, respondedAt: null, responseNote: null },
        { id: 'as-2', employeeId: 'emp-2', response: null, respondedAt: null, responseNote: null },
        { id: 'as-3', employeeId: 'emp-3', response: null, respondedAt: null, responseNote: null },
      ],
    }

    // Persetujuan 1: 1 dari 2 -> belum selesai
    const res1 = simulateActOnTask(task, 'emp-1', 'APPROVE')
    expect(res1.stepCompleted).toBe(false)

    // Persetujuan 2: 2 dari 2 -> kuorum tercapai, tahap selesai!
    const res2 = simulateActOnTask(task, 'emp-2', 'APPROVE')
    expect(res2.stepCompleted).toBe(true)
    expect(task.status).toBe('APPROVED')
  })

  it('REJECT: Wajib alasan minimal 10 karakter, langsung menggugurkan pengajuan', () => {
    const task: MockTask = {
      id: 'task-4',
      requestId: 'req-4',
      stepOrder: 1,
      stepName: 'Atasan Langsung',
      approvalMode: 'ANY_ONE',
      quorumCount: null,
      status: 'PENDING',
      actedBy: null,
      actedAt: null,
      assignees: [
        { id: 'as-1', employeeId: 'emp-andi', response: null, respondedAt: null, responseNote: null },
      ],
    }

    // Tolak dengan alasan terlalu pendek (< 10 char)
    expect(() => simulateActOnTask(task, 'emp-andi', 'REJECT', 'Kurang')).toThrow('minimal 10 karakter')

    // Tolak dengan alasan valid (>= 10 char)
    const result = simulateActOnTask(task, 'emp-andi', 'REJECT', 'Jadwal bentrok dengan deployment rilis utama')
    expect(result.stepCompleted).toBe(true)
    expect(result.requestStatus).toBe('REJECTED')
    expect(task.status).toBe('REJECTED')
  })

  it('409 Conflict: Tugas yang sudah diproses tidak dapat diproses ulang (race-condition safety)', () => {
    const task: MockTask = {
      id: 'task-5',
      requestId: 'req-5',
      stepOrder: 1,
      stepName: 'Atasan Langsung',
      approvalMode: 'ANY_ONE',
      quorumCount: null,
      status: 'APPROVED',
      actedBy: 'emp-andi',
      actedAt: new Date(),
      assignees: [
        { id: 'as-1', employeeId: 'emp-andi', response: 'APPROVED', respondedAt: new Date(), responseNote: null },
        { id: 'as-2', employeeId: 'emp-budi', response: null, respondedAt: null, responseNote: null },
      ],
    }

    expect(() => simulateActOnTask(task, 'emp-budi', 'APPROVE')).toThrow('409: APPROVAL_TASK_CLOSED')
  })

  it('403 Forbidden: Pegawai non-assignee dilarang memproses tugas', () => {
    const task: MockTask = {
      id: 'task-6',
      requestId: 'req-6',
      stepOrder: 1,
      stepName: 'Atasan Langsung',
      approvalMode: 'ANY_ONE',
      quorumCount: null,
      status: 'PENDING',
      actedBy: null,
      actedAt: null,
      assignees: [
        { id: 'as-1', employeeId: 'emp-andi', response: null, respondedAt: null, responseNote: null },
      ],
    }

    expect(() => simulateActOnTask(task, 'emp-intruder', 'APPROVE')).toThrow('403: AUTH_FORBIDDEN')
  })
})
