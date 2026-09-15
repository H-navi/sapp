export interface TimelineEntry {
  id: string | number
  requestId: string
  requestNumber?: string
  createdAt: string | Date
  stepOrder?: number | null
  stepName?: string | null
  action: string
  actorType: 'USER' | 'SYSTEM' | 'ADMIN'
  actorEmployeeId?: string | null
  actorName?: string | null
  actorPosition?: string | null
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  reason?: string | null
  metadata?: Record<string, any> | null
}

export interface ActionDefinition {
  code: string
  defaultLabel: string
  color: 'slate' | 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'orange'
  badgeBg: string
  badgeText: string
  dotColor: string
  isSystem: boolean
}

export const TIMELINE_ACTIONS: Record<string, ActionDefinition> = {
  CREATED: {
    code: 'CREATED',
    defaultLabel: 'Draf dibuat',
    color: 'slate',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-400',
    isSystem: false,
  },
  SUBMITTED: {
    code: 'SUBMITTED',
    defaultLabel: 'Pengajuan dikirim',
    color: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    dotColor: 'bg-blue-500',
    isSystem: false,
  },
  RULE_CHECKED: {
    code: 'RULE_CHECKED',
    defaultLabel: 'Pemeriksaan aturan selesai',
    color: 'slate',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    dotColor: 'bg-slate-400',
    isSystem: true,
  },
  ASSIGNED: {
    code: 'ASSIGNED',
    defaultLabel: 'Tugas persetujuan diteruskan',
    color: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    dotColor: 'bg-blue-500',
    isSystem: true,
  },
  VIEWED: {
    code: 'VIEWED',
    defaultLabel: 'Dibuka dan ditinjau',
    color: 'slate',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    dotColor: 'bg-slate-300',
    isSystem: false,
  },
  REMINDER_SENT: {
    code: 'REMINDER_SENT',
    defaultLabel: 'Pengingat batas waktu SLA dikirim',
    color: 'amber',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    dotColor: 'bg-amber-500',
    isSystem: true,
  },
  APPROVED: {
    code: 'APPROVED',
    defaultLabel: 'Disetujui',
    color: 'emerald',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    dotColor: 'bg-emerald-600',
    isSystem: false,
  },
  REJECTED: {
    code: 'REJECTED',
    defaultLabel: 'Ditolak',
    color: 'rose',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    dotColor: 'bg-rose-600',
    isSystem: false,
  },
  AUTO_APPROVED: {
    code: 'AUTO_APPROVED',
    defaultLabel: 'Disetujui otomatis oleh sistem',
    color: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    dotColor: 'bg-purple-600',
    isSystem: true,
  },
  AUTO_REJECTED: {
    code: 'AUTO_REJECTED',
    defaultLabel: 'Ditolak otomatis oleh sistem',
    color: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    dotColor: 'bg-purple-600',
    isSystem: true,
  },
  ESCALATED: {
    code: 'ESCALATED',
    defaultLabel: 'Batas waktu terlewati, dieskalasi',
    color: 'orange',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    dotColor: 'bg-orange-500',
    isSystem: true,
  },
  DELEGATED: {
    code: 'DELEGATED',
    defaultLabel: 'Wewenang didelegasikan',
    color: 'blue',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    dotColor: 'bg-sky-500',
    isSystem: false,
  },
  REASSIGNED: {
    code: 'REASSIGNED',
    defaultLabel: 'Approver dialihkan oleh admin',
    color: 'orange',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    dotColor: 'bg-amber-500',
    isSystem: false,
  },
  EXTENDED: {
    code: 'EXTENDED',
    defaultLabel: 'Batas waktu SLA diperpanjang',
    color: 'orange',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    dotColor: 'bg-amber-500',
    isSystem: false,
  },
  REOPENED: {
    code: 'REOPENED',
    defaultLabel: 'Pengajuan dibuka kembali oleh admin',
    color: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    dotColor: 'bg-blue-600',
    isSystem: false,
  },
  CANCELLED: {
    code: 'CANCELLED',
    defaultLabel: 'Dibatalkan oleh pemohon',
    color: 'slate',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    dotColor: 'bg-slate-400',
    isSystem: false,
  },
  EXPIRED: {
    code: 'EXPIRED',
    defaultLabel: 'Kedaluwarsa tanpa keputusan',
    color: 'slate',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-500',
    isSystem: true,
  },
  ADMIN_OVERRIDE: {
    code: 'ADMIN_OVERRIDE',
    defaultLabel: 'Intervensi administrator',
    color: 'orange',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    dotColor: 'bg-amber-600',
    isSystem: false,
  },
}

/**
 * Memformat kalimat judul lini masa dalam bahasa Indonesia atau Inggris.
 */
export function formatTimelineTitle(entry: TimelineEntry, locale: 'id' | 'en' = 'id'): string {
  const meta = entry.metadata || {}
  const actor = entry.actorName || (locale === 'en' ? 'System' : 'Sistem')
  const step = entry.stepName ? `"${entry.stepName}"` : (locale === 'en' ? 'approval stage' : 'tahap persetujuan')

  if (locale === 'en') {
    switch (entry.action) {
      case 'CREATED':
        return 'Leave request draft created'
      case 'SUBMITTED':
        return `Request submitted by ${actor}`
      case 'RULE_CHECKED': {
        const passed = meta.passedCount ?? meta.passed_count ?? 0
        const failed = meta.failedCount ?? meta.failed_count ?? 0
        return `Rule evaluation: ${passed} passed, ${failed} failed`
      }
      case 'ASSIGNED': {
        const assignees = meta.assigneeNames || meta.approver_name || meta.assignees || actor
        return `Routed to ${step}: ${assignees}`
      }
      case 'VIEWED':
        return `Opened and reviewed by ${actor}`
      case 'REMINDER_SENT': {
        const n = meta.reminderCount ?? meta.reminder_count ?? 1
        const target = meta.targetName ?? meta.recipient_name ?? actor
        return `Reminder #${n} sent to ${target}`
      }
      case 'APPROVED':
        return `Approved by ${actor} (${entry.stepName || 'Approval'})`
      case 'REJECTED':
        return `Rejected by ${actor} (${entry.stepName || 'Approval'})`
      case 'AUTO_APPROVED':
        return 'Automatically approved by system'
      case 'AUTO_REJECTED':
        return 'Automatically rejected by system'
      case 'ESCALATED':
        return `Deadline for ${step} exceeded, escalated`
      case 'DELEGATED': {
        const from = meta.fromName || meta.delegator_name || 'Approver'
        const to = meta.toName || meta.delegate_name || actor
        return `Delegated from ${from} to ${to}`
      }
      case 'REASSIGNED': {
        const newApprover = meta.newApproverName || meta.target_name || 'New Approver'
        return `Approver for ${step} reassigned to ${newApprover} by Administrator`
      }
      case 'EXTENDED': {
        const hours = meta.addedHours || meta.hours || 'additional'
        return `SLA deadline for ${step} extended (+${hours} hrs) by Administrator`
      }
      case 'REOPENED':
        return `Request reopened by Administrator at stage ${step}`
      case 'CANCELLED':
        return `Cancelled by ${actor}`
      case 'EXPIRED':
        return 'Request expired without final decision'
      case 'ADMIN_OVERRIDE':
        return `Decided via Administrator intervention (${actor})`
      default:
        return entry.action
    }
  }

  // Bahasa Indonesia (default)
  switch (entry.action) {
    case 'CREATED':
      return 'Draf perizinan dibuat'
    case 'SUBMITTED':
      return `Pengajuan dikirim oleh ${actor}`
    case 'RULE_CHECKED': {
      const passed = meta.passedCount ?? meta.passed_count ?? 0
      const failed = meta.failedCount ?? meta.failed_count ?? 0
      return `Pemeriksaan aturan: ${passed} terpenuhi, ${failed} tidak`
    }
    case 'ASSIGNED': {
      const assignees = meta.assigneeNames || meta.approver_name || meta.assignees || actor
      return `Diteruskan ke ${step}: ${assignees}`
    }
    case 'VIEWED':
      return `Dibuka dan ditinjau oleh ${actor}`
    case 'REMINDER_SENT': {
      const n = meta.reminderCount ?? meta.reminder_count ?? 1
      const target = meta.targetName ?? meta.recipient_name ?? actor
      return `Pengingat ke-${n} dikirim ke ${target}`
    }
    case 'APPROVED':
      return `Disetujui oleh ${actor} (${entry.stepName || 'Approval'})`
    case 'REJECTED':
      return `Ditolak oleh ${actor} (${entry.stepName || 'Approval'})`
    case 'AUTO_APPROVED':
      return 'Disetujui otomatis oleh sistem'
    case 'AUTO_REJECTED':
      return 'Ditolak otomatis oleh sistem'
    case 'ESCALATED':
      return `Batas waktu ${step} terlewati, diteruskan`
    case 'DELEGATED': {
      const from = meta.fromName || meta.delegator_name || 'Approver'
      const to = meta.toName || meta.delegate_name || actor
      return `Didelegasikan dari ${from} ke ${to}`
    }
    case 'REASSIGNED': {
      const newApprover = meta.newApproverName || meta.target_name || 'Approver Baru'
      return `Approver tahap ${step} dialihkan ke ${newApprover} oleh Administrator`
    }
    case 'EXTENDED': {
      const hours = meta.addedHours || meta.hours || 'tambahan'
      return `Batas waktu SLA tahap ${step} diperpanjang (+${hours} jam) oleh Administrator`
    }
    case 'REOPENED':
      return `Pengajuan dibuka kembali oleh Administrator pada tahap ${step}`
    case 'CANCELLED':
      return `Dibatalkan oleh ${actor}`
    case 'EXPIRED':
      return 'Pengajuan kedaluwarsa tanpa keputusan akhir'
    case 'ADMIN_OVERRIDE':
      return `Diputuskan melalui intervensi Administrator (${actor})`
    default:
      return TIMELINE_ACTIONS[entry.action]?.defaultLabel || entry.action
  }
}
