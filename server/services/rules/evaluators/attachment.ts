import type { RuleEvaluator } from '../types'

/**
 * ATTACHMENT_REQUIRED: Wajib melampirkan minimal berkas pendukung.
 */
export const attachmentRequired: RuleEvaluator = (params, ctx) => {
  const minFiles = Number(params.min_files ?? 1)
  const actualFiles = ctx.request.attachmentCount
  const passed = actualFiles >= minFiles

  return {
    passed,
    context: {
      min_files: minFiles,
      actual_files: actualFiles,
    },
  }
}

/**
 * ATTACHMENT_REQUIRED_IF_DAYS_GTE: Wajib lampiran jika jumlah hari >= ambang batas tertentu.
 */
export const attachmentRequiredIfDaysGte: RuleEvaluator = (params, ctx) => {
  const thresholdDays = Number(params.days ?? 2)
  const minFiles = Number(params.min_files ?? 1)
  const requestedDays = ctx.request.totalDays
  const actualFiles = ctx.request.attachmentCount

  if (requestedDays >= thresholdDays) {
    const passed = actualFiles >= minFiles
    return {
      passed,
      context: {
        days: thresholdDays,
        min_files: minFiles,
        requested_days: requestedDays,
        actual_files: actualFiles,
      },
    }
  }

  // Jika di bawah ambang batas hari, tidak diwajibkan lampiran
  return {
    passed: true,
    context: {
      days: thresholdDays,
      min_files: minFiles,
      requested_days: requestedDays,
      actual_files: actualFiles,
    },
  }
}
