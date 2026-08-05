import {
  claimPackingJobs,
  claimPackingSearchAliasJobs,
  processPackingJob,
  processPackingSearchAliasJob,
} from './pipeline.ts'
import { createPackingServices } from './services.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

async function wakeSelf(): Promise<void> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('PACKING_FUNCTION_SECRET')
  if (!baseUrl || !secret) return
  await fetch(`${baseUrl}/functions/v1/packing-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-packing-secret': secret },
    body: '{}',
  })
}

async function runOnce(): Promise<void> {
  const services = createPackingServices()
  const [jobs, aliasJobs] = await Promise.all([
    claimPackingJobs(services),
    claimPackingSearchAliasJobs(services),
  ])
  await Promise.all([
    ...jobs.map(async (job) => {
      try {
        await processPackingJob(services, job)
      } catch (error) {
        console.error('packing_job_failed', { jobId: job.job_id, code: error instanceof Error ? error.message : 'unknown_error' })
      }
    }),
    ...aliasJobs.map(async (job) => {
      try {
        await processPackingSearchAliasJob(services, job)
      } catch (error) {
        console.error('packing_alias_job_failed', { jobId: job.job_id, code: error instanceof Error ? error.message : 'unknown_error' })
      }
    }),
  ])
  if (jobs.length > 0 || aliasJobs.length > 0) await wakeSelf()
}

Deno.serve((request) => {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname.endsWith('/health')) {
    return Response.json({ ok: true, runtime: 'supabase-edge-function' })
  }
  const expected = Deno.env.get('PACKING_FUNCTION_SECRET')
  if (!expected || request.headers.get('x-packing-secret') !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  EdgeRuntime.waitUntil(runOnce())
  return Response.json({ accepted: true }, { status: 202 })
})
