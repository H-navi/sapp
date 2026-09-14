import { describe, it, expect } from 'vitest'
import { resolveNotificationTemplate } from '../../server/services/notification/template-resolver'

describe('Notification Template Resolver', () => {
  it('mengembalikan template spesifik jika ditemukan oleh executor', async () => {
    const mockRow = {
      id: 'tpl-custom-1',
      code: 'TPL_CUSTOM_CUTI_TAHUNAN',
      name: 'Custom Cuti Tahunan',
      subjectTemplate: 'Subjek Kustom',
      bodyTemplate: 'Isi Kustom',
      parseMode: 'HTML',
      isDefault: false,
    }

    const mockExecutor = {
      execute: async () => [mockRow],
    }

    const result = await resolveNotificationTemplate(
      {
        eventType: 'APPROVAL_TASK_ASSIGNED',
        channel: 'EMAIL',
        targetAudience: 'APPROVER',
        leaveTypeId: 'lt-123',
      },
      mockExecutor
    )

    expect(result).not.toBeNull()
    expect(result?.id).toBe('tpl-custom-1')
    expect(result?.code).toBe('TPL_CUSTOM_CUTI_TAHUNAN')
    expect(result?.isDefault).toBe(false)
  })

  it('mengembalikan null jika tidak ada template yang cocok', async () => {
    const mockExecutor = {
      execute: async () => [],
    }

    const result = await resolveNotificationTemplate(
      {
        eventType: 'APPROVAL_TASK_ASSIGNED',
        channel: 'EMAIL',
        targetAudience: 'APPROVER',
      },
      mockExecutor
    )

    expect(result).toBeNull()
  })

  it('mengembalikan template bawaan (default) jika executor mengembalikan isDefault: true', async () => {
    const mockDefault = {
      id: 'tpl-def-1',
      code: 'TPL_TASK_ASSIGNED_EMAIL',
      name: 'Default Task Assigned',
      subjectTemplate: '[{{app_name}}] Default',
      bodyTemplate: 'Default Body',
      parseMode: 'TEXT',
      isDefault: true,
    }

    const mockExecutor = {
      execute: async () => [mockDefault],
    }

    const result = await resolveNotificationTemplate(
      {
        eventType: 'APPROVAL_TASK_ASSIGNED',
        channel: 'EMAIL',
        targetAudience: 'APPROVER',
      },
      mockExecutor
    )

    expect(result).not.toBeNull()
    expect(result?.isDefault).toBe(true)
    expect(result?.code).toBe('TPL_TASK_ASSIGNED_EMAIL')
  })
})
