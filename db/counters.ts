import { db } from './client';
import { counters } from './schema';
import { eq } from 'drizzle-orm';

export interface RelationshipCounter {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  type: 'since' | 'until';
  icon?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const getDaysDifference = (targetDateStr: string, type: 'since' | 'until'): number => {
  if (!targetDateStr) return 0;
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = type === 'since'
    ? today.getTime() - target.getTime()
    : target.getTime() - today.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const getAllCounters = async (): Promise<RelationshipCounter[]> => {
  try {
    const list = await db.select().from(counters);
    return list.map(c => ({
      id: c.id,
      title: c.title,
      targetDate: c.targetDate,
      type: c.type as 'since' | 'until',
      icon: c.icon ?? undefined,
      createdAt: c.createdAt ?? undefined,
      updatedAt: c.updatedAt ?? undefined,
    }));
  } catch (err) {
    console.error('Error getting all counters:', err);
    return [];
  }
};

export const saveCounter = async (counter: RelationshipCounter): Promise<void> => {
  try {
    const now = Date.now();
    const existing = await db.select().from(counters).where(eq(counters.id, counter.id));
    if (existing.length > 0) {
      await db.update(counters).set({
        title: counter.title,
        targetDate: counter.targetDate,
        type: counter.type,
        icon: counter.icon ?? null,
        updatedAt: now,
      }).where(eq(counters.id, counter.id));
    } else {
      await db.insert(counters).values({
        id: counter.id,
        title: counter.title,
        targetDate: counter.targetDate,
        type: counter.type,
        icon: counter.icon ?? null,
        createdAt: counter.createdAt ?? now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('Error saving counter:', err);
  }
};

export const deleteCounter = async (id: string): Promise<void> => {
  try {
    await db.delete(counters).where(eq(counters.id, id));
  } catch (err) {
    console.error(`Error deleting counter ${id}:`, err);
  }
};

export const bulkSetCounters = async (list: RelationshipCounter[]): Promise<void> => {
  try {
    await db.delete(counters);
    for (const c of list) {
      await saveCounter(c);
    }
  } catch (err) {
    console.error('Error in bulkSetCounters:', err);
  }
};
