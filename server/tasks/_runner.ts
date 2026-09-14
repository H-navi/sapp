import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import * as schema from '../database/schema'

export interface TaskRunResult {
  result?: unknown
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
  processedCount: number
  message?: string
  durationMs: number
}

/**
 * Helper pembungkus eksekusi tugas terjadwal dengan advisory lock dan pencatatan audit job_executions.
 */
export async function runTaskWithLock(
  jobName: string,
  lockKey: number,
  taskFn: (db: ReturnType<typeof useDatabase>) => Promise<{ processedCount: number; details?: Record<string, any> }>
): Promise<TaskRunResult> {
  const db = useDatabase()
  const startTime = Date.now()

  // 1. Coba dapatkan advisory lock
  const lockResult = (await db.execute(sql`SELECT pg_try_advisory_lock(${lockKey}) AS locked`)) as any[]
  const isLocked = Boolean(lockResult[0]?.locked)

  if (!isLocked) {
    const skippedResult = {
      status: 'SKIPPED' as const,
      processedCount: 0,
      message: 'dilewati: instance lain sedang berjalan',
      durationMs: Date.now() - startTime,
    }
    return {
      ...skippedResult,
      result: skippedResult,
    }
  }

  let executionId: number | null = null

  try {
    // 2. Catat awal eksekusi ke job_executions
    const [execRow] = await db
      .insert(schema.jobExecutions)
      .values({
        jobName,
        status: 'RUNNING',
        startedAt: new Date(),
        processedCount: 0,
        details: {},
      })
      .returning({ id: schema.jobExecutions.id })

    executionId = execRow?.id ?? null

    // 3. Eksekusi tugas utama
    const { processedCount, details } = await taskFn(db)
    const durationMs = Date.now() - startTime

    // 4. Perbarui status menjadi COMPLETED
    if (executionId) {
      await db
        .update(schema.jobExecutions)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
          processedCount,
          details: { ...details, durationMs },
        })
        .where(eq(schema.jobExecutions.id, executionId))
    }

    const completedResult = {
      status: 'COMPLETED' as const,
      processedCount,
      durationMs,
    }
    return {
      ...completedResult,
      result: completedResult,
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime
    const errorMessage = err?.message || String(err)

    if (executionId) {
      await db
        .update(schema.jobExecutions)
        .set({
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage,
          details: { durationMs },
        })
        .where(eq(schema.jobExecutions.id, executionId))
    }

    const failedResult = {
      status: 'FAILED' as const,
      processedCount: 0,
      message: errorMessage,
      durationMs,
    }
    return {
      ...failedResult,
      result: failedResult,
    }
  } finally {
    // 5. Lepaskan advisory lock
    await db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`)
  }
}
