import { desc, sql } from 'drizzle-orm'
import { requireRole } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN', 'SUPERADMIN')
  const db = useDatabase()

  // 1. Ambil eksekusi terbaru per job
  const recentExecs = (await db.execute(sql`
    SELECT DISTINCT ON (job_name)
      id::text AS id,
      job_name,
      status,
      started_at,
      finished_at,
      processed_count,
      error_message,
      details
    FROM job_executions
    ORDER BY job_name, started_at DESC
  `)) as any[]

  const recentMap = new Map<string, any>()
  for (const r of recentExecs) {
    recentMap.set(r.job_name, r)
  }

  const jobs = [
    {
      id: 'approval:reminder',
      name: 'Pengingat Persetujuan SLA',
      cron: '*/5 * * * *',
      intervalDescription: 'Setiap 5 menit',
      description: 'Mengirimkan notifikasi pengingat ke approver hanya dalam jam operasional kerja.',
      lastExecution: recentMap.get('approval:reminder') || null,
    },
    {
      id: 'approval:escalation',
      name: 'Eskalasi Batas Waktu SLA',
      cron: '*/5 * * * *',
      intervalDescription: 'Setiap 5 menit',
      description: 'Menindaklanjuti tahap persetujuan yang melewati batas SLA (auto approve/reject/escalate/notify admin).',
      lastExecution: recentMap.get('approval:escalation') || null,
    },
    {
      id: 'approval:auto-decision',
      name: 'Keputusan Otomatis Pengajuan',
      cron: '*/5 * * * *',
      intervalDescription: 'Setiap 5 menit',
      description: 'Mengevaluasi ulang aturan kebijakan dan mengeksekusi keputusan akhir bila batas waktu total terlewati.',
      lastExecution: recentMap.get('approval:auto-decision') || null,
    },
    {
      id: 'maintenance:daily',
      name: 'Pemeliharaan Sistem Harian',
      cron: '0 1 * * *',
      intervalDescription: 'Setiap hari pukul 01:00 WIB',
      description: 'Pembersihan sesi kedaluwarsa, rotasi notifikasi/log lama, kadaluarsa carry-over kuota, dan kirim laporan ringkasan.',
      lastExecution: recentMap.get('maintenance:daily') || null,
    },
  ]

  // 2. Ambil 50 log eksekusi terbaru
  const rawLogs = (await db.execute(sql`
    SELECT id::text AS id,
           job_name AS "jobName",
           status,
           started_at AS "startedAt",
           finished_at AS "finishedAt",
           processed_count AS "processedCount",
           error_message AS "errorMessage",
           details
    FROM job_executions
    ORDER BY started_at DESC
    LIMIT 50
  `)) as any[]

  return {
    data: {
      jobs,
      executionLogs: rawLogs,
    },
  }
})
