/**
 * @file src/worker/index.ts
 *
 * Standalone Worker process built on BullMQ.
 * Pulls evaluation payloads out of the queue and executes them via Piston.
 *
 * KEY: We pass `redisOptions` (not a pre-built ioredis instance) to the Worker.
 * BullMQ needs to create its own client + bclient internally to properly renew
 * job locks. Sharing a single ioredis connection causes lock starvation which
 * makes jobs stall and loop: queued → running → queued → ...
 */

import { Worker } from 'bullmq';
import { redisOptions } from '../queue';
import { processSubmission } from '../services/evaluation';
import { startSubmissionLog, failSubmissionLog } from '../lib/submission-log';

console.log('🚀 Piston Execution Worker initializing...');

const worker = new Worker('evaluations', async (job) => {
  const { logId, questionId, studentId } = job.data;
  console.log(`[Worker] Starting job ${job.id} for SubmissionLog ${logId} (Student: ${studentId}, Q: ${questionId})`);

  try {
    // Transition DB status: queued → running
    startSubmissionLog(logId);

    // Run the full evaluation pipeline (code assembly → Piston → DB write)
    await processSubmission(job.data);

    console.log(`[Worker] Job ${job.id} completed successfully.`);
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} failed unexpectedly:`, error);
    failSubmissionLog(logId, 'Worker execution crashed: ' + (error?.message ?? String(error)));
    // Re-throw so BullMQ marks the job as failed (not stalled)
    throw error;
  }
}, {
  connection: redisOptions,
  concurrency: 4,
  // Give jobs up to 5 minutes to finish before BullMQ considers them stalled.
  // Default lockDuration is 30s — too short for a Piston evaluation + DB write.
  lockDuration: 5 * 60 * 1000,        // 5 min
  stalledInterval: 60 * 1000,          // check for stalled jobs every 60s
  maxStalledCount: 1,                   // re-try a stalled job at most once
});

worker.on('completed', (job) => {
  console.log(`✅ [Job ${job.id}] marked completed.`);
});

worker.on('failed', (job, err) => {
  if (job) {
    console.error(`❌ [Job ${job.id}] failed: ${err.message}`);
  }
});

worker.on('stalled', (jobId) => {
  console.warn(`⚠️  [Job ${jobId}] was detected as stalled and will be retried.`);
});

worker.on('error', (err) => {
  console.error('❌ BullMQ internal error:', err);
});

console.log('✅ Worker active! Listening for jobs on `evaluations` queue...');

