import { describe, it, expect } from 'vitest'
import {
  TIMELINE_ACTIONS,
  formatTimelineTitle,
  type TimelineEntry,
} from '../../shared/timeline-labels'

describe('Timeline Labels & Formatting (Task 11)', () => {
  it('semua 18 action terdaftar dan memiliki konfigurasi visual yang valid', () => {
    const requiredActions = [
      'CREATED',
      'SUBMITTED',
      'RULE_CHECKED',
      'ASSIGNED',
      'VIEWED',
      'REMINDER_SENT',
      'APPROVED',
      'REJECTED',
      'AUTO_APPROVED',
      'AUTO_REJECTED',
      'ESCALATED',
      'DELEGATED',
      'REASSIGNED',
      'EXTENDED',
      'REOPENED',
      'CANCELLED',
      'EXPIRED',
      'ADMIN_OVERRIDE',
    ]

    for (const code of requiredActions) {
      const def = TIMELINE_ACTIONS[code]
      expect(def, `Aksi ${code} harus terdaftar`).toBeDefined()
      expect(def.code).toBe(code)
      expect(def.defaultLabel.length).toBeGreaterThan(0)
      expect(def.badgeBg).toBeDefined()
      expect(def.dotColor).toBeDefined()
    }
  })

  it('membedakan penanda sistem vs manusia secara akurat', () => {
    // Sistem
    expect(TIMELINE_ACTIONS.RULE_CHECKED.isSystem).toBe(true)
    expect(TIMELINE_ACTIONS.AUTO_APPROVED.isSystem).toBe(true)
    expect(TIMELINE_ACTIONS.AUTO_REJECTED.isSystem).toBe(true)
    expect(TIMELINE_ACTIONS.REMINDER_SENT.isSystem).toBe(true)
    expect(TIMELINE_ACTIONS.ESCALATED.isSystem).toBe(true)
    expect(TIMELINE_ACTIONS.EXPIRED.isSystem).toBe(true)

    // Manusia
    expect(TIMELINE_ACTIONS.SUBMITTED.isSystem).toBe(false)
    expect(TIMELINE_ACTIONS.APPROVED.isSystem).toBe(false)
    expect(TIMELINE_ACTIONS.REJECTED.isSystem).toBe(false)
    expect(TIMELINE_ACTIONS.ADMIN_OVERRIDE.isSystem).toBe(false)
    expect(TIMELINE_ACTIONS.REASSIGNED.isSystem).toBe(false)
  })

  it('memformat judul lini masa Indonesia dengan interpolasi metadata', () => {
    // 1. RULE_CHECKED
    const ruleEntry: TimelineEntry = {
      id: 1,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'RULE_CHECKED',
      actorType: 'SYSTEM',
      metadata: { passedCount: 4, failedCount: 1 },
    }
    expect(formatTimelineTitle(ruleEntry)).toBe('Pemeriksaan aturan: 4 terpenuhi, 1 tidak')

    // 2. ASSIGNED
    const assignEntry: TimelineEntry = {
      id: 2,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'ASSIGNED',
      actorType: 'SYSTEM',
      stepName: 'Kepala Divisi',
      metadata: { assigneeNames: 'Budi Santoso' },
    }
    expect(formatTimelineTitle(assignEntry)).toBe('Diteruskan ke "Kepala Divisi": Budi Santoso')

    // 3. REMINDER_SENT
    const reminderEntry: TimelineEntry = {
      id: 3,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'REMINDER_SENT',
      actorType: 'SYSTEM',
      metadata: { reminderCount: 2, targetName: 'Budi Santoso' },
    }
    expect(formatTimelineTitle(reminderEntry)).toBe('Pengingat ke-2 dikirim ke Budi Santoso')

    // 4. APPROVED
    const approvedEntry: TimelineEntry = {
      id: 4,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'APPROVED',
      actorType: 'USER',
      actorName: 'Andi Nugroho',
      stepName: 'Atasan Langsung',
    }
    expect(formatTimelineTitle(approvedEntry)).toBe('Disetujui oleh Andi Nugroho (Atasan Langsung)')

    // 5. REASSIGNED by Admin
    const reassignEntry: TimelineEntry = {
      id: 5,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'REASSIGNED',
      actorType: 'ADMIN',
      stepName: 'Manajer HRD',
      metadata: { newApproverName: 'Siti Rahma' },
    }
    expect(formatTimelineTitle(reassignEntry)).toContain('dialihkan ke Siti Rahma oleh Administrator')

    // 6. EXTENDED by Admin
    const extendEntry: TimelineEntry = {
      id: 6,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'EXTENDED',
      actorType: 'ADMIN',
      stepName: 'Direksi',
      metadata: { addedHours: 48 },
    }
    expect(formatTimelineTitle(extendEntry)).toContain('diperpanjang (+48 jam) oleh Administrator')

    // 7. AUTO_APPROVED
    const autoApproveEntry: TimelineEntry = {
      id: 7,
      requestId: 'req-1',
      createdAt: new Date().toISOString(),
      action: 'AUTO_APPROVED',
      actorType: 'SYSTEM',
    }
    expect(formatTimelineTitle(autoApproveEntry)).toBe('Disetujui otomatis oleh sistem')
  })
})
