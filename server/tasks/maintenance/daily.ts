import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { runTaskWithLock } from '../_runner'
import * as schema from '../../database/schema'
import { queueNotification } from '../../services/notification/enqueue'

export default defineTask({
  meta: {
    name: 'maintenance:daily',
    description: 'Pemeliharaan harian sistem: pembersihan sesi, log lama, kadaluarsa carry-over kuota, dan laporan harian',
  },
  async run() {
    return await runTaskWithLock('maintenance:daily', 8004, async (db) => {
      let processedCount = 0

      // 1. Hapus user_sessions yang sudah kadaluarsa > 7 hari
      const deleteSessionsRes = (await db.execute(sql`
        DELETE FROM user_sessions
        WHERE expires_at < NOW() - INTERVAL '7 days'
        RETURNING id
      `)) as any[]
      const deletedSessionsCount = deleteSessionsRes.length

      // 2. Bersihkan notifikasi SENT > 90 hari
      const deleteNotifRes = (await db.execute(sql`
        DELETE FROM notifications
        WHERE status = 'SENT'
          AND sent_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `)) as any[]
      const deletedNotifCount = deleteNotifRes.length

      // 3. Bersihkan job_executions > 30 hari
      const deleteJobsRes = (await db.execute(sql`
        DELETE FROM job_executions
        WHERE started_at < NOW() - INTERVAL '30 days'
        RETURNING id
      `)) as any[]
      const deletedJobsCount = deleteJobsRes.length

      // 4. Kadaluarsa carry-over kuota yang carry_over_expires_at < CURRENT_DATE
      const expiredQuotas = (await db.execute(sql`
        SELECT id, employee_id, leave_type_id, carried_over::numeric AS carried_over, balance::numeric AS balance
        FROM leave_quotas
        WHERE carry_over_expires_at IS NOT NULL
          AND carry_over_expires_at < CURRENT_DATE
          AND carried_over > 0
        FOR UPDATE
      `)) as any[]

      for (const q of expiredQuotas) {
        try {
          const expiredAmount = Number(q.carried_over)
          if (expiredAmount > 0) {
            await db.execute(sql`
              UPDATE leave_quotas
              SET carried_over = 0,
                  updated_at = NOW()
              WHERE id = ${q.id}::uuid
            `)

            await db.insert(schema.leaveQuotaLedger).values({
              quotaId: q.id,
              txnType: 'EXPIRY',
              amount: String(-expiredAmount),
              balanceAfter: String(Number(q.balance) - expiredAmount),
              note: `Kadaluarsa sisa kuota carry-over tahun lalu (${expiredAmount} hari)`,
            })

            processedCount++
          }
        } catch (err) {
          console.error(`Gagal memproses kadaluarsa carry-over kuota ${q.id}:`, err)
        }
      }

      // 5. Agregasi statistik harian untuk laporan admin
      const reqStats = (await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '24 hours')::int AS submitted_count,
          COUNT(*) FILTER (WHERE decided_at >= NOW() - INTERVAL '24 hours' AND status = 'APPROVED')::int AS approved_count,
          COUNT(*) FILTER (WHERE decided_at >= NOW() - INTERVAL '24 hours' AND status = 'REJECTED')::int AS rejected_count,
          COUNT(*) FILTER (WHERE decided_at >= NOW() - INTERVAL '24 hours' AND is_auto_decided = true)::int AS auto_decided_count
        FROM leave_requests
      `)) as any[]

      const overdueTasksRes = (await db.execute(sql`
        SELECT COUNT(*)::int AS overdue_count
        FROM approval_tasks
        WHERE status = 'PENDING'
          AND due_at IS NOT NULL
          AND due_at < NOW()
      `)) as any[]

      const stats = reqStats[0] || {
        submitted_count: 0,
        approved_count: 0,
        rejected_count: 0,
        auto_decided_count: 0,
      }
      const overdueCount = Number(overdueTasksRes[0]?.overdue_count ?? 0)
      const todayStr = dayjs().format('YYYY-MM-DD')

      // Antre laporan ke admin
      await queueNotification(
        {
          eventType: 'APPROVAL_ESCALATED',
          channel: 'EMAIL',
          recipientAddress: 'admin@perusahaan.co.id',
          subject: `[Laporan Harian Sistem] Ringkasan Perizinan Pegawai (${todayStr})`,
          body: `Laporan Ringkasan Pemeliharaan Harian Sistem (${todayStr}):\n\n- Pengajuan Masuk (24 jam): ${stats.submitted_count}\n- Pengajuan Disetujui: ${stats.approved_count}\n- Pengajuan Ditolak: ${stats.rejected_count}\n- Diputuskan Otomatis: ${stats.auto_decided_count}\n- Tugas Persetujuan Terlambat (Overdue): ${overdueCount}\n- Kuota Carry-over Kedaluwarsa: ${expiredQuotas.length}\n- Sesi Kedaluwarsa Dibersihkan: ${deletedSessionsCount}\n- Notifikasi Lama Dibersihkan: ${deletedNotifCount}\n- Riwayat Tugas Dibersihkan: ${deletedJobsCount}\n\nSistem beroperasi normal.`,
          dedupeKey: `daily_report:${todayStr}`,
          payload: {
            stats,
            overdueCount,
            deletedSessionsCount,
            deletedNotifCount,
            deletedJobsCount,
            expiredQuotasCount: expiredQuotas.length,
          },
        },
        db
      )

      processedCount += 1

      return {
        processedCount,
        details: {
          deletedSessionsCount,
          deletedNotifCount,
          deletedJobsCount,
          expiredQuotasCount: expiredQuotas.length,
          stats,
          overdueCount,
        },
      }
    })
  },
})
