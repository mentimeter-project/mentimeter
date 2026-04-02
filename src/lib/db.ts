import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'mentimeter.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    created_by INTEGER NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    max_marks INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_text TEXT NOT NULL DEFAULT '',
    marks_awarded INTEGER DEFAULT NULL,
    reviewed INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, question_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    assessment_id INTEGER,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── SEED ADMIN ──
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');

if (!adminExists) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)')
    .run('admin', 'admin123');
}

// ── SEED STUDENTS (SHORT VERSION FOR TEST) ──
const students = [
  { name: 'Gagan G', usn: '1JB23AI015' }
];

const studentCount = (db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number }).count;

if (studentCount === 0) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO students (username, password, name, usn) VALUES (?, ?, ?, ?)'
  );

  const insertAll = db.transaction(() => {
    students.forEach(s => {
      const username = s.name.toLowerCase().replace(/\s+/g, '.');
      insert.run(username, s.usn, s.name, s.usn);
    });
  });

  insertAll();
}

export default db;