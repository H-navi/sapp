import { requirePermission } from '~~/server/utils/guard'
import { workflowPreviewSchema } from '~~/server/validators/admin'
import { previewWorkflowSimulation } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const body = await readValidatedBody(event, workflowPreviewSchema.parse)
  const result = await previewWorkflowSimulation(body)
  return { data: result }
})
