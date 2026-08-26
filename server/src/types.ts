export interface CalendarEntry {
  id?: string;
  roomId?: string;
  date: string; // YYYY-MM-DD
  count: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface CalendarNote {
  id?: string;
  roomId?: string;
  date: string; // YYYY-MM-DD
  content: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface Room {
  id: string;
  code: string;
  createdAt: number;
  lastActiveAt: number;
}

// Client to Server WebSocket Messages
export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; deviceId?: string }
  | { type: 'UPDATE_SESSION'; roomCode: string; date: string; count: number; delta?: number; author?: string }
  | { type: 'UPDATE_NOTE'; roomCode: string; date: string; content: string; author?: string }
  | { type: 'PING' };

// Server to Client WebSocket Messages
export type ServerMessage =
  | { type: 'ROOM_JOINED'; roomCode: string; membersCount: number }
  | { type: 'SESSION_UPDATED'; date: string; count: number; author?: string; timestamp: number }
  | { type: 'NOTE_UPDATED'; date: string; content: string; author?: string; timestamp: number }
  | { type: 'SYNC_DATA'; entries: CalendarEntry[]; notes?: CalendarNote[] }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' };
