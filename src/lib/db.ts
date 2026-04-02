import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'mentimeter.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// ── CREATE ALL TABLES ──
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
    description TEXT DEFAULT '',
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
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
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
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_count INTEGER DEFAULT 1,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Enable foreign keys for CASCADE deletes
db.pragma('foreign_keys = ON');

// ── SEED ADMIN ──
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', 'admin123');
  console.log('✅ Admin seeded: admin / admin123');
}

// ── SEED ALL 67 STUDENTS ──
const ALL_STUDENTS = [
  { name: 'Abhinandan Mahaveer Patil', usn: '1JB24AI400' },
  { name: 'Adnan Ahmad',               usn: '1JB23AI001' },
  { name: 'Akshatha R',                usn: '1JB23AI002' },
  { name: 'Akshay R',                  usn: '1JB23AI003' },
  { name: 'Amrutha Deepa R',           usn: '1JB23AI004' },
  { name: 'Anantapur Aseen',           usn: '1JB23AI005' },
  { name: 'Ananya N H Rao',            usn: '1JB23AI006' },
  { name: 'Ananya S G',                usn: '1JB24AI401' },
  { name: 'Anish',                     usn: '1JB23AI007' },
  { name: 'Ankitha Rao Pawar G',       usn: '1JB23AI008' },
  { name: 'Anup Santhosh Patil',       usn: '1JB24AI402' },
  { name: 'C P Anushka Teju',          usn: '1JB24AI403' },
  { name: 'Chandana M',                usn: '1JB23AI009' },
  { name: 'Chitra M',                  usn: '1JB23AI010' },
  { name: 'Darshan G',                 usn: '1JB23AI011' },
  { name: 'Dattatri',                  usn: '1JB23AI012' },
  { name: 'Deepa P K',                 usn: '1JB23AI013' },
  { name: 'Divya Ramachandra Khatawakar', usn: '1JB23AI014' },
  { name: 'Gagan G',                   usn: '1JB23AI015' },
  { name: 'Gaurav Maddhanalli Umesh',  usn: '1JB23AI016' },
  { name: 'H J Suhas',                 usn: '1JB23AI017' },
  { name: 'Harsh Rai',                 usn: '1JB23AI018' },
  { name: 'Harsha D',                  usn: '1JB23AI019' },
  { name: 'Harshan P',                 usn: '1JB23AI020' },
  { name: 'Harshita Laxman Moger',     usn: '1JB23AI021' },
  { name: 'Havyas Gowda P',            usn: '1JB23AI022' },
  { name: 'Hithysh Gowda S',           usn: '1JB23AI023' },
  { name: 'Indushree G S',             usn: '1JB23AI024' },
  { name: 'Karthik R',                 usn: '1JB24AI404' },
  { name: 'Karthik Sadlapur',          usn: '1JB23AI026' },
  { name: 'Keerthana T C',             usn: '1JB23AI027' },
  { name: 'Lavanya R',                 usn: '1JB23AI028' },
  { name: 'Likhitha M',                usn: '1JB23AI029' },
  { name: 'Md Iquan Arshad',           usn: '1JB23AI031' },
  { name: 'Mithun R',                  usn: '1JB23AI032' },
  { name: 'Mohammed Abubakar Siddiqi A', usn: '1JB23AI033' },
  { name: 'Naksha C',                  usn: '1JB23AI034' },
  { name: 'Neha R',                    usn: '1JB23AI035' },
  { name: 'Neha Yadav R',              usn: '1JB23AI036' },
  { name: 'Param S N',                 usn: '1JB23AI037' },
  { name: 'Pramukh Hiremath P K',      usn: '1JB23AI038' },
  { name: 'Pramukh N',                 usn: '1JB23AI039' },
  { name: 'Prerana A',                 usn: '1JB23AI040' },
  { name: 'Puja Sharma',               usn: '1JB23AI041' },
  { name: 'Puneeth Gowda B',           usn: '1JB23AI042' },
  { name: 'Ranjitha M',                usn: '1JB23AI043' },
  { name: 'Risha L',                   usn: '1JB23AI044' },
  { name: 'Ritu Raj Kumar',            usn: '1JB23AI045' },
  { name: 'S Avaneesh',                usn: '1JB23AI046' },
  { name: 'Samarth R Kashyap',         usn: '1JB23AI047' },
  { name: 'Shivaan Gowda D',           usn: '1JB23AI048' },
  { name: 'Shivakumar B S',            usn: '1JB23AI049' },
  { name: 'Shreya T S',                usn: '1JB23AI050' },
  { name: 'Sneha G Gowda',             usn: '1JB23AI052' },
  { name: 'Snehakumari',               usn: '1JB23AI051' },
  { name: 'Sumukh Kashyap N K',        usn: '1JB23AI053' },
  { name: 'Syeda Sajva Khurram AB',    usn: '1JB23AI054' },
  { name: 'Taniesh S Kumar',           usn: '1JB23AI055' },
  { name: 'Tarun B G',                 usn: '1JB23AI056' },
  { name: 'Thanush Gowda S',           usn: '1JB23AI057' },
  { name: 'Tharun K N',                usn: '1JB23AI058' },
  { name: 'Thejas B U',                usn: '1JB23AI059' },
  { name: 'Uthsavi D U',              usn: '1JB23AI060' },
  { name: 'Vijay S',                   usn: '1JB24AI405' },
  { name: 'Vinesh Mullai G',           usn: '1JB23AI061' },
  { name: 'Yashas Rao Jadhav',         usn: '1JB23AI062' },
  { name: 'Yogesh Kumar',              usn: '1JB23AI063' },
];

const insertStudent = db.prepare(
  'INSERT OR IGNORE INTO students (username, password, name, usn) VALUES (?, ?, ?, ?)'
);

const seedStudents = db.transaction(() => {
  let seeded = 0;
  for (const s of ALL_STUDENTS) {
    const username = s.name.toLowerCase().replace(/\s+/g, '.');
    const result = insertStudent.run(username, s.usn, s.name, s.usn);
    if (result.changes > 0) seeded++;
  }
  if (seeded > 0) console.log(`✅ Seeded ${seeded} new students`);
});

seedStudents();

const count = (db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number }).count;
console.log(`📊 Total students in DB: ${count}`);

export default db;
