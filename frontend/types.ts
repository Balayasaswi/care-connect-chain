
export type Emotion = 'CRITICAL' | 'BAD' | 'NEUTRAL' | 'GOOD' | 'HAPPY';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionSummary {
  userid: string;
  start_time_stamp: string;
  end_time_stamp: string;
  keywords: string[];
  emotion: Emotion;
  summary: string;
}

export interface SessionRecord {
  id: string;
  summary: SessionSummary;
  history: ChatMessage[];
  status: 'active' | 'completed';
}

export type UserRole = 'student' | 'guardian';

export interface User {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  name?: string; // For guardians
  studentEmail?: string; // For guardians
  studentId?: string; // For guardians
}
