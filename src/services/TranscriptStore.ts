import * as SQLite from 'expo-sqlite';
import { Meeting, TranscriptSegment } from '../types';

let db: SQLite.SQLiteDatabase;

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync('meetmind.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      topic TEXT,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      meetingId TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      language TEXT,
      isQuestion INTEGER DEFAULT 0,
      FOREIGN KEY (meetingId) REFERENCES meetings(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      meetingId TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (meetingId) REFERENCES meetings(id)
    );
  `);
}

export async function createMeeting(
  id: string,
  title: string,
  startTime: number,
  topic?: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO meetings (id, title, startTime, topic) VALUES (?, ?, ?, ?)',
    id, title, startTime, topic ?? null
  );
}

export async function addSegment(
  meetingId: string,
  segment: TranscriptSegment
): Promise<void> {
  await db.runAsync(
    'INSERT INTO segments (id, meetingId, text, timestamp, language, isQuestion) VALUES (?, ?, ?, ?, ?, ?)',
    segment.id, meetingId, segment.text, segment.timestamp,
    segment.language ?? null, segment.isQuestion ? 1 : 0
  );
}

export async function saveAnswer(
  meetingId: string,
  id: string,
  question: string,
  answer: string,
  timestamp: number
): Promise<void> {
  await db.runAsync(
    'INSERT INTO answers (id, meetingId, question, answer, timestamp) VALUES (?, ?, ?, ?, ?)',
    id, meetingId, question, answer, timestamp
  );
}

export async function endMeeting(
  meetingId: string,
  summary?: string
): Promise<void> {
  await db.runAsync(
    'UPDATE meetings SET endTime = ?, summary = ? WHERE id = ?',
    Date.now(), summary ?? null, meetingId
  );
}

export async function getMeetings(): Promise<Meeting[]> {
  const rows = await db.getAllAsync(
    'SELECT * FROM meetings ORDER BY startTime DESC'
  );
  return (rows as any[]).map(r => ({
    ...r,
    segments: [],
  }));
}

export async function getMeetingWithSegments(
  meetingId: string
): Promise<Meeting | null> {
  const meeting = await db.getFirstAsync(
    'SELECT * FROM meetings WHERE id = ?', meetingId
  );
  if (!meeting) return null;

  const segments = await db.getAllAsync(
    'SELECT * FROM segments WHERE meetingId = ? ORDER BY timestamp ASC',
    meetingId
  );

  return {
    ...(meeting as any),
    segments: (segments as any[]).map(s => ({
      ...s,
      isQuestion: s.isQuestion === 1,
    })),
  };
}

export async function getFullTranscript(meetingId: string): Promise<string> {
  const segments = await db.getAllAsync(
    'SELECT text FROM segments WHERE meetingId = ? ORDER BY timestamp ASC',
    meetingId
  );
  return (segments as { text: string }[]).map(s => s.text).join(' ');
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await db.runAsync('DELETE FROM segments WHERE meetingId = ?', meetingId);
  await db.runAsync('DELETE FROM answers WHERE meetingId = ?', meetingId);
  await db.runAsync('DELETE FROM meetings WHERE id = ?', meetingId);
}
