import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000';

// Language map: language_id → Piston language name + version
const LANGUAGE_MAP: Record<number, { language: string; version: string }> = {
  71: { language: 'python',     version: '3.10.0'  },
  63: { language: 'javascript', version: '18.15.0' },
  62: { language: 'java',       version: '15.0.2'  },
  54: { language: 'c++',        version: '10.2.0'  },
  50: { language: 'c',          version: '10.2.0'  },
  60: { language: 'go',         version: '1.16.2'  },
  73: { language: 'rust',       version: '1.50.0'  },
};

function normalizeOutput(str: string): string {
  return (str || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line: string) => line.trimEnd())
    .join('\n')
    .trim();
}

const worker = new Worker(
  'code-execution',
  async (job) => {
    const { submissionId, source_code, language_id, expected_output, question_id, student_id, max_marks } = job.data;

    console.log(`Processing job ${job.id} for student ${student_id}, question ${question_id}`);

    const lang = LANGUAGE_MAP[language_id];
    if (!lang) {
      throw new Error(`Unsupported language_id: ${language_id}`);
    }

    // Execute via Piston
    const pistonRes = await fetch(`${PISTON_URL}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang.language,
        version: lang.version,
        files: [{ content: source_code }],
        stdin: '',
      }),
    });

    if (!pistonRes.ok) {
      throw new Error(`Piston returned ${pistonRes.status}`);
    }

    const pistonData = await pistonRes.json();
    const stdout = pistonData.run?.stdout || '';
    const stderr = pistonData.run?.stderr || '';
    const exitCode = pistonData.run?.code ?? 1;

    // Normalize and compare
    const normalizedActual = normalizeOutput(stdout);
    const normalizedExpected = normalizeOutput(expected_output || '');

    let isCorrect = false;
    if (exitCode === 0) {
      if (normalizedExpected === '') {
        isCorrect = true; // No expected output = any successful run counts
      } else {
        isCorrect = normalizedActual === normalizedExpected;
      }
    }

    const marksAwarded = isCorrect ? max_marks : 0;

    // Update code_submissions table
    await pool.query(
      `UPDATE code_submissions
       SET status = $1, stdout = $2, stderr = $3, is_correct = $4, marks_awarded = $5
       WHERE id = $6`,
      ['completed', stdout, stderr, isCorrect, marksAwarded, submissionId]
    );

    // Update responses table
    await pool.query(
      `INSERT INTO responses (student_id, question_id, answer_text, reviewed, marks_awarded)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (student_id, question_id)
       DO UPDATE SET answer_text = $3, reviewed = 1, marks_awarded = $4`,
      [student_id, question_id, source_code, marksAwarded]
    );

    console.log(`Job ${job.id} completed. Correct: ${isCorrect}, Marks: ${marksAwarded}`);
    return { isCorrect, marksAwarded };
  },
  {
    connection,
    concurrency: 4, // Match your CPU cores
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log('🚀 Worker started, waiting for jobs...');
