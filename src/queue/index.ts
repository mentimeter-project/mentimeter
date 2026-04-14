/**
 * @file src/queue/index.ts
 *
 * BullMQ configuration and Queue instances.
 * Connects to local Redis (default port 6379, aligned with judge0-redis).
 *
 * IMPORTANT: BullMQ's Queue and Worker must each create their own internal
 * ioredis connections. Sharing a single connection across both causes Lua
 * script blocking (lock starvation), which manifests as jobs stalling and
 * re-entering the queue — the infinite "queued → running → queued" loop.
 *
 * We export a plain `redisOptions` object so every BullMQ consumer
 * instantiates its own connection independently.
 */

import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

/**
 * Plain Redis connection options — passed to BullMQ so it can manage its own
 * internal client + bclient connections without sharing state.
 */
export const redisOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * Dedicated ioredis instance for application-level operations
 * (rate limiting, health checks, etc.) that are NOT driven by BullMQ.
 * Never pass this to BullMQ Queue/Worker constructors.
 */
export const appRedis = new Redis(redisOptions);

export interface EvaluationJobData {
  logId: number;
  studentId: number;
  questionId: number;
  languageId: number;
  sourceCode: string;
}

// Instantiate the evaluations queue with its own isolated connection.
export const evaluationQueue = new Queue<EvaluationJobData>('evaluations', {
  connection: redisOptions,
});
