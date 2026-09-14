import { sql, eq } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'
import { finalizeRequest } from '~~/server/services/approval/decision'
import { queueNotification } from '~~/server/services/notification/enqueue'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const isAdmin = auth.roles.includes('ADMIN')
  const hasPerm = auth.permissions.includes('admin.workflow.manage')
  if (!isAdmin && !hasPerm) {
    throw createError({ statusCode: 403, message: 'Akses ditolak.' })
  }
  const requestId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const db = useDatabase()

  if (!requestId) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib disertakan.' })
  }

  const { action, reason, newApproverEmployeeId, decision, hours = 24, targetStepOrder } = body || {}

  if (!reason || !String(reason).trim()) {
    throw createError({
      statusCode: 400,
      message: 'Alasan tindakan intervensi wajib diisi secara jelas.',
    })
  }

  // 1. Ambil data pengajuan
  const reqRows = (await db.execute(sql`
    SELECT r.id,
           r.request_number,
           r.employee_id,
           r.status,
           r.current_step_order,
           r.total_days::numeric AS total_days,
           r.start_date::text AS start_date,
           r.leave_type_id,
           e.full_name AS requester_name,
           e.email AS requester_email,
           lt.name AS leave_type_name,
           lt.deducts_quota
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
    WHERE r.id = ${requestId}::uuid
    LIMIT 1
  `)) as any[]

  if (reqRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  const req = reqRows[0]

  // 2. Proteksi: Admin tidak boleh mengintervensi pengajuannya sendiri
  if (auth.employeeId && auth.employeeId === req.employee_id) {
    throw createError({
      statusCode: 403,
      message: 'Anda tidak diperbolehkan melakukan intervensi administratif pada pengajuan Anda sendiri.',
    })
  }

  // Eksekusi intervensi dalam transaksi
  const result = await db.transaction(async (tx) => {
    switch (action) {
      case 'REASSIGN': {
        // Alihkan approver pada tugas aktif saat ini
        if (!newApproverEmployeeId) {
          throw createError({ statusCode: 400, message: 'Approver baru wajib dipilih.' })
        }

        const taskRows = (await tx.execute(sql`
          SELECT id, step_name, step_order
          FROM approvals.approval_tasks
          WHERE request_id = ${requestId}::uuid
            AND status = 'PENDING'
          LIMIT 1
        `)) as any[]

        if (taskRows.length === 0) {
          throw createError({ statusCode: 400, message: 'Tidak ada tugas approval aktif yang sedang menunggu.' })
        }

        const activeTask = taskRows[0]

        // Ambil nama approver baru
        const newAppRows = (await tx.execute(sql`
          SELECT id, full_name, email FROM org.employees WHERE id = ${newApproverEmployeeId}::uuid LIMIT 1
        `)) as any[]

        if (newAppRows.length === 0) {
          throw createError({ statusCode: 404, message: 'Data approver baru tidak ditemukan.' })
        }
        const newApp = newAppRows[0]

        // Ganti assignees pada task
        await tx.execute(sql`
          DELETE FROM approvals.approval_task_assignees WHERE task_id = ${activeTask.id}::uuid
        `)
        await tx.execute(sql`
          INSERT INTO approvals.approval_task_assignees (task_id, employee_id, can_approve, is_delegate)
          VALUES (${activeTask.id}::uuid, ${newApp.id}::uuid, true, false)
        `)

        // Catat di approval_histories
        await tx.execute(sql`
          INSERT INTO approvals.approval_histories (
            request_id, task_id, step_order, step_name, actor_employee_id, actor_type, action,
            from_status, to_status, note, reason, metadata
          ) VALUES (
            ${requestId}::uuid, ${activeTask.id}::uuid, ${activeTask.step_order}, ${activeTask.step_name},
            ${auth.employeeId ? auth.employeeId : null}::uuid, 'ADMIN', 'REASSIGNED',
            ${req.status}::approvals.request_status_enum, ${req.status}::approvals.request_status_enum,
            ${reason}, ${reason},
            ${JSON.stringify({ newApproverId: newApp.id, newApproverName: newApp.full_name })}::jsonb
          )
        `)

        // Antre notifikasi untuk approver baru
        await queueNotification(
          {
            eventType: 'APPROVAL_TASK_ASSIGNED',
            targetAudience: 'APPROVER',
            requestId,
            taskId: activeTask.id,
            recipientEmployeeId: newApp.id,
            extraVars: {
              step_name: activeTask.step_name,
            },
          },
          tx
        )

        return { message: `Approver berhasil dialihkan ke ${newApp.full_name}.` }
      }

      case 'FORCE_APPROVE_STEP': {
        // Paksa setujui tahap aktif
        const taskRows = (await tx.execute(sql`
          SELECT id, step_name, step_order
          FROM approvals.approval_tasks
          WHERE request_id = ${requestId}::uuid
            AND status = 'PENDING'
          LIMIT 1
        `)) as any[]

        if (taskRows.length === 0) {
          throw createError({ statusCode: 400, message: 'Tidak ada tahap aktif yang sedang menunggu persetujuan.' })
        }

        const activeTask = taskRows[0]

        // Update task jadi APPROVED
        await tx.execute(sql`
          UPDATE approvals.approval_tasks
          SET status = 'APPROVED', decided_at = NOW(), decided_by = ${auth.employeeId ? auth.employeeId : null}::uuid, updated_at = NOW()
          WHERE id = ${activeTask.id}::uuid
        `)

        // Catat riwayat
        await tx.execute(sql`
          INSERT INTO approvals.approval_histories (
            request_id, task_id, step_order, step_name, actor_employee_id, actor_type, action,
            from_status, to_status, note, reason, metadata
          ) VALUES (
            ${requestId}::uuid, ${activeTask.id}::uuid, ${activeTask.step_order}, ${activeTask.step_name},
            ${auth.employeeId ? auth.employeeId : null}::uuid, 'ADMIN', 'APPROVED',
            ${req.status}::approvals.request_status_enum, ${req.status}::approvals.request_status_enum,
            ${`[Intervensi Admin] ${reason}`}, ${reason},
            ${JSON.stringify({ overrideBy: auth.fullName })}::jsonb
          )
        `)

        // Cek apakah ada tahap berikutnya
        const nextTaskRows = (await tx.execute(sql`
          SELECT id, step_name, step_order
          FROM approvals.approval_tasks
          WHERE request_id = ${requestId}::uuid
            AND step_order > ${activeTask.step_order}
            AND status = 'WAITING'
          ORDER BY step_order ASC
          LIMIT 1
        `)) as any[]

        if (nextTaskRows.length > 0) {
          const nextTask = nextTaskRows[0]
          await tx.execute(sql`
            UPDATE approvals.approval_tasks
            SET status = 'PENDING', started_at = NOW(), updated_at = NOW()
            WHERE id = ${nextTask.id}::uuid
          `)
          await tx.execute(sql`
            UPDATE approvals.leave_requests
            SET current_step_order = ${nextTask.step_order}, updated_at = NOW()
            WHERE id = ${requestId}::uuid
          `)

          return { message: `Tahap "${activeTask.step_name}" disetujui oleh admin. Alur berlanjut ke tahap "${nextTask.step_name}".` }
        } else {
          // Tidak ada tahap lagi -> Finalize APPROVED
          await finalizeRequest(tx, requestId, 'APPROVED', 'ADMIN_OVERRIDE', reason, auth.employeeId)
          return { message: `Tahap terakhir disetujui oleh admin. Pengajuan resmi DISETUJUI.` }
        }
      }

      case 'FORCE_DECISION': {
        // Paksa keputusan akhir (APPROVED atau REJECTED)
        const finalStatus = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED'

        // Batalkan semua task pending
        await tx.execute(sql`
          UPDATE approvals.approval_tasks
          SET status = 'CANCELLED', updated_at = NOW()
          WHERE request_id = ${requestId}::uuid
            AND status IN ('PENDING', 'WAITING')
        `)

        await finalizeRequest(tx, requestId, finalStatus, 'ADMIN_OVERRIDE', reason, auth.employeeId)

        // Catat riwayat
        await tx.execute(sql`
          INSERT INTO approvals.approval_histories (
            request_id, step_order, step_name, actor_employee_id, actor_type, action,
            from_status, to_status, note, reason, metadata
          ) VALUES (
            ${requestId}::uuid, ${req.current_step_order}, 'Intervensi Administrator',
            ${auth.employeeId ? auth.employeeId : null}::uuid, 'ADMIN', 'ADMIN_OVERRIDE',
            ${req.status}::approvals.request_status_enum, ${finalStatus}::approvals.request_status_enum,
            ${reason}, ${reason},
            ${JSON.stringify({ decision: finalStatus, overrideBy: auth.fullName })}::jsonb
          )
        `)

        // Antre notifikasi keputusan ke pemohon
        const eventType = finalStatus === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED'
        await queueNotification(
          {
            eventType,
            targetAudience: 'REQUESTER',
            requestId,
            recipientEmployeeId: req.employee_id,
            extraVars: {
              decided_by: `Administrator (${auth.fullName})`,
              decision_reason: reason,
            },
          },
          tx
        )

        return { message: `Pengajuan ${req.request_number} berhasil diputuskan ${finalStatus} melalui intervensi administrator.` }
      }

      case 'EXTEND_DEADLINE': {
        // Perpanjang batas waktu SLA
        const addHours = Math.max(1, Number(hours || 24))

        // Update task aktif
        await tx.execute(sql`
          UPDATE approvals.approval_tasks
          SET due_at = due_at + (${addHours} || ' hours')::interval,
              updated_at = NOW()
          WHERE request_id = ${requestId}::uuid
            AND status = 'PENDING'
        `)

        // Update final deadline pada leave_requests
        await tx.execute(sql`
          UPDATE approvals.leave_requests
          SET final_deadline_at = final_deadline_at + (${addHours} || ' hours')::interval,
              updated_at = NOW()
          WHERE id = ${requestId}::uuid
        `)

        // Catat riwayat
        await tx.execute(sql`
          INSERT INTO approvals.approval_histories (
            request_id, step_order, step_name, actor_employee_id, actor_type, action,
            from_status, to_status, note, reason, metadata
          ) VALUES (
            ${requestId}::uuid, ${req.current_step_order}, 'Batas Waktu SLA',
            ${auth.employeeId ? auth.employeeId : null}::uuid, 'ADMIN', 'EXTENDED',
            ${req.status}::approvals.request_status_enum, ${req.status}::approvals.request_status_enum,
            ${reason}, ${reason},
            ${JSON.stringify({ addedHours: addHours, extendedBy: auth.fullName })}::jsonb
          )
        `)

        return { message: `Batas waktu SLA berhasil diperpanjang +${addHours} jam.` }
      }

      case 'REOPEN': {
        // Buka kembali pengajuan yang ditolak atau kedaluwarsa
        if (req.status !== 'REJECTED' && req.status !== 'EXPIRED') {
          throw createError({
            statusCode: 400,
            message: 'Hanya pengajuan dengan status DITOLAK atau KEDALUWARSA yang dapat dibuka kembali.',
          })
        }

        // Tentukan tahap yang diaktifkan kembali (default tahap 1)
        const reopenStepOrder = Math.max(1, Number(targetStepOrder || 1))

        // Jika jenis izin potong kuota, pesan kembali kuota (RESERVED)
        if (req.deducts_quota && Number(req.total_days) > 0) {
          const year = new Date(req.start_date).getFullYear()
          await tx.execute(sql`
            UPDATE leaves.leave_quotas
            SET reserved = reserved + ${Number(req.total_days)},
                updated_at = NOW()
            WHERE employee_id = ${req.employee_id}::uuid
              AND leave_type_id = ${req.leave_type_id}::uuid
              AND period_year = ${year}::smallint
          `)
        }

        // Reset status pengajuan menjadi IN_REVIEW
        await tx.execute(sql`
          UPDATE approvals.leave_requests
          SET status = 'IN_REVIEW',
              current_step_order = ${reopenStepOrder},
              decided_at = NULL,
              decided_by = NULL,
              decision_reason = NULL,
              decision_source = NULL,
              is_auto_decided = false,
              updated_at = NOW()
          WHERE id = ${requestId}::uuid
        `)

        // Reset task pada tahap terkait
        await tx.execute(sql`
          UPDATE approvals.approval_tasks
          SET status = CASE WHEN step_order = ${reopenStepOrder} THEN 'PENDING'::approvals.approval_task_status_enum ELSE 'WAITING'::approvals.approval_task_status_enum END,
              started_at = CASE WHEN step_order = ${reopenStepOrder} THEN NOW() ELSE NULL END,
              decided_at = NULL,
              decided_by = NULL,
              due_at = CASE WHEN step_order = ${reopenStepOrder} THEN NOW() + interval '24 hours' ELSE due_at END,
              updated_at = NOW()
          WHERE request_id = ${requestId}::uuid
            AND step_order >= ${reopenStepOrder}
        `)

        // Catat riwayat
        await tx.execute(sql`
          INSERT INTO approvals.approval_histories (
            request_id, step_order, step_name, actor_employee_id, actor_type, action,
            from_status, to_status, note, reason, metadata
          ) VALUES (
            ${requestId}::uuid, ${reopenStepOrder}, 'Pembukaan Kembali Pengajuan',
            ${auth.employeeId ? auth.employeeId : null}::uuid, 'ADMIN', 'REOPENED',
            ${req.status}::approvals.request_status_enum, 'IN_REVIEW'::approvals.request_status_enum,
            ${reason}, ${reason},
            ${JSON.stringify({ reopenStepOrder, reopenedBy: auth.fullName })}::jsonb
          )
        `)

        return { message: `Pengajuan ${req.request_number} berhasil dibuka kembali pada tahap ${reopenStepOrder}.` }
      }

      default:
        throw createError({ statusCode: 400, message: 'Tindakan intervensi tidak dikenali.' })
    }
  })

  // Catat audit log di system.audit_logs
  try {
    await db.execute(sql`
      INSERT INTO system.audit_logs (
        actor_user_id, actor_type, action, entity_type, entity_id, new_values
      ) VALUES (
        ${auth.userId}::uuid, 'ADMIN', ${`INTERVENE_${action}`}, 'LEAVE_REQUEST', ${requestId}::uuid,
        ${JSON.stringify({ action, reason, performedBy: auth.fullName })}::jsonb
      )
    `)
  } catch {}

  return { success: true, ...result }
})
