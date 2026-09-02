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
  /** Stable cross-device identity. A date may hold many notes. */
  noteId: string;
  date: string; // YYYY-MM-DD
  content: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface CalendarEvent {
  id: string;
  roomId?: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay: boolean;
  color: string;
  target: 'you' | 'partner' | 'both';
  /** Whether the plan has been carried out. */
  completed?: boolean;
  author?: string;
  updatedAt?: number;
}

export interface RelationshipCounter {
  id: string;
  roomId?: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  type: 'since' | 'until';
  icon?: string;
  updatedAt?: number;
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
  | { type: 'UPDATE_NOTE'; roomCode: string; noteId?: string; date: string; content: string; author?: string }
  | { type: 'DELETE_NOTE'; roomCode: string; noteId: string; date?: string; author?: string }
  | { type: 'UPDATE_EVENT'; roomCode: string; event: CalendarEvent; author?: string }
  | { type: 'DELETE_EVENT'; roomCode: string; eventId: string; author?: string }
  | { type: 'UPDATE_COUNTER'; roomCode: string; counter: RelationshipCounter; author?: string }
  | { type: 'DELETE_COUNTER'; roomCode: string; counterId: string; author?: string }
  | { type: 'PING' };

// Server to Client WebSocket Messages
export type ServerMessage =
  | { type: 'ROOM_JOINED'; roomCode: string; membersCount: number }
  | { type: 'SESSION_UPDATED'; date: string; count: number; author?: string; timestamp: number }
  | { type: 'NOTE_UPDATED'; noteId: string; date: string; content: string; author?: string; timestamp: number }
  | { type: 'NOTE_DELETED'; noteId: string; date?: string; author?: string; timestamp: number }
  | { type: 'EVENT_UPDATED'; event: CalendarEvent; author?: string; timestamp: number }
  | { type: 'EVENT_DELETED'; eventId: string; author?: string; timestamp: number }
  | { type: 'COUNTER_UPDATED'; counter: RelationshipCounter; author?: string; timestamp: number }
  | { type: 'COUNTER_DELETED'; counterId: string; author?: string; timestamp: number }
  | { type: 'SYNC_DATA'; entries: CalendarEntry[]; notes?: CalendarNote[]; events?: CalendarEvent[]; counters?: RelationshipCounter[] }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' };
