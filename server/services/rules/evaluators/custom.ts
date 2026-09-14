import type { RuleEvaluator } from '../types'

const ALLOWED_FIELDS = [
  'totalDays',
  'workingDays',
  'attachmentCount',
  'employmentMonths',
  'gender',
  'employmentStatus',
] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]

/**
 * CUSTOM_EXPRESSION: Validasi dinamis ekspresi JSON tanpa eval().
 * Format parameter:
 * {
 *   expression: {
 *     field: "totalDays",
 *     op: "lte",
 *     value: 5
 *   }
 * }
 */
export const customExpression: RuleEvaluator = (params, ctx) => {
  let expr = params.expression
  if (typeof expr === 'string') {
    try {
      expr = JSON.parse(expr)
    } catch {
      return {
        passed: false,
        context: { error: 'Format JSON ekspresi kustom tidak valid' },
      }
    }
  }

  if (!expr || typeof expr !== 'object') {
    return {
      passed: false,
      context: { error: 'Definisi ekspresi kustom kosong' },
    }
  }

  const { field, op, value } = expr

  if (!ALLOWED_FIELDS.includes(field as AllowedField)) {
    return {
      passed: false,
      context: {
        error: `Field '${field}' tidak diizinkan. Field yang didukung: ${ALLOWED_FIELDS.join(', ')}`,
      },
    }
  }

  // Ambil nilai aktual dari RuleContext
  let actualValue: any
  switch (field as AllowedField) {
    case 'totalDays':
      actualValue = ctx.request.totalDays
      break
    case 'workingDays':
      actualValue = ctx.request.workingDays
      break
    case 'attachmentCount':
      actualValue = ctx.request.attachmentCount
      break
    case 'employmentMonths':
      actualValue = ctx.employee.employmentMonths
      break
    case 'gender':
      actualValue = ctx.employee.gender
      break
    case 'employmentStatus':
      actualValue = ctx.employee.employmentStatus
      break
  }

  let passed = false
  switch (String(op).toLowerCase()) {
    case 'eq':
      passed = actualValue === value
      break
    case 'neq':
      passed = actualValue !== value
      break
    case 'gt':
      passed = Number(actualValue) > Number(value)
      break
    case 'gte':
      passed = Number(actualValue) >= Number(value)
      break
    case 'lt':
      passed = Number(actualValue) < Number(value)
      break
    case 'lte':
      passed = Number(actualValue) <= Number(value)
      break
    case 'in':
      passed = Array.isArray(value) && value.includes(actualValue)
      break
    case 'nin':
      passed = Array.isArray(value) && !value.includes(actualValue)
      break
    default:
      return {
        passed: false,
        context: {
          field,
          op,
          value,
          actual_value: actualValue,
          error: `Operator '${op}' tidak didukung`,
        },
      }
  }

  return {
    passed,
    context: {
      field,
      op,
      value: Array.isArray(value) ? value.join(', ') : value,
      actual_value: actualValue ?? '-',
    },
  }
}
