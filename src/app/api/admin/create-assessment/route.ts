import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

interface TestCaseInput {
  input: string;
  expected_output: string;
  marks: number;
}

interface QuestionInput {
  question_text: string;
  question_type?: 'text' | 'code';
  max_marks?: number;
  test_cases?: TestCaseInput[];
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { title, description, duration_minutes, questions } = await req.json() as {
    title: string;
    description?: string;
    duration_minutes?: number;
    questions: QuestionInput[];
  };

  if (!title || !questions?.length) return NextResponse.json({ error: 'Title and questions required' }, { status: 400 });

  const insertTestCase = db.prepare(
    'INSERT INTO test_cases (question_id, input, expected_output, marks) VALUES (?, ?, ?, ?)'
  );

  const result = db.transaction(() => {
    const assessment = db.prepare(
      'INSERT INTO assessments (title, description, duration_minutes, created_by) VALUES (?, ?, ?, ?)'
    ).run(title, description || '', duration_minutes || 30, session.userId);

    questions.forEach((q: QuestionInput, i: number) => {
      const qType = q.question_type || 'text';
      const qResult = db.prepare(
        'INSERT INTO questions (assessment_id, question_text, question_type, max_marks, order_index) VALUES (?, ?, ?, ?, ?)'
      ).run(assessment.lastInsertRowid, q.question_text, qType, q.max_marks || 10, i);

      // Insert test cases for coding questions
      if (qType === 'code' && Array.isArray(q.test_cases)) {
        for (const tc of q.test_cases) {
          if (tc.expected_output?.trim()) {
            insertTestCase.run(qResult.lastInsertRowid, tc.input || '', tc.expected_output.trim(), tc.marks || 1);
          }
        }
      }
    });

    return assessment.lastInsertRowid;
  })();

  return NextResponse.json({ success: true, assessmentId: result });
}
