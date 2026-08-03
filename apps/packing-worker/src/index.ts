import { loadConfig } from './config.js'
import { claimPackingJobs, processPackingJob } from './pipeline.js'
import { createWorkerServices } from './services.js'

const config = loadConfig()
const services = createWorkerServices(config)
let stopping = false

process.on('SIGTERM', () => { stopping = true })
process.on('SIGINT', () => { stopping = true })

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function run(): Promise<void> {
  while (!stopping) {
    try {
      const jobs = await claimPackingJobs(services, config.PACKING_WORKER_BATCH_SIZE)
      if (jobs.length === 0) {
        await wait(config.PACKING_WORKER_POLL_MS)
        continue
      }
      await Promise.all(jobs.map(async (job) => {
        try {
          await processPackingJob(services, job)
        } catch (error) {
          const code = error instanceof Error ? error.message : 'unknown_error'
          process.stderr.write(`packing job ${job.job_id} failed: ${code}\n`)
        }
      }))
    } catch (error) {
      const code = error instanceof Error ? error.message : 'worker_loop_error'
      process.stderr.write(`packing worker loop failed: ${code}\n`)
      await wait(config.PACKING_WORKER_POLL_MS)
    }
  }
}

void run()
