import type { PackingWorkerEnv } from './config.js'
import type { PackingExecutionContext } from './cloudflare.js'
import { claimPackingJobs, processPackingJob } from './pipeline.js'
import { createWorkerServices } from './services.js'

export async function runPackingBatch(environment: PackingWorkerEnv): Promise<number> {
  const services = createWorkerServices(environment)
  const jobs = await claimPackingJobs(services, services.config.PACKING_WORKER_BATCH_SIZE)
  await Promise.all(jobs.map(async (job) => {
    try {
      await processPackingJob(services, job)
    } catch (error) {
      console.error('packing_job_failed', {
        jobId: job.job_id,
        code: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }))
  return jobs.length
}

export default {
  async scheduled(_controller: unknown, environment: PackingWorkerEnv, context: PackingExecutionContext): Promise<void> {
    context.waitUntil(runPackingBatch(environment))
  },

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, runtime: 'cloudflare-workers' })
    }
    return new Response('Not found', { status: 404 })
  },
}
