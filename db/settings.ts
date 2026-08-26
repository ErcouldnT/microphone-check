import { db } from './client';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

export const getSetting = async (key: string): Promise<string | null> => {
  try {
    const result = await db.select().from(settings).where(eq(settings.key, key));
    if (result.length > 0) {
      return result[0].value;
    }
    return null;
  } catch (e) {
    console.error(`Error getting setting ${key}:`, e);
    return null;
  }
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  try {
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  } catch (e) {
    console.error(`Error setting ${key}:`, e);
  }
};

export const removeSetting = async (key: string): Promise<void> => {
  try {
    await db.delete(settings).where(eq(settings.key, key));
  } catch (e) {
    console.error(`Error removing setting ${key}:`, e);
  }
};
