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

export type UserRole = 'male' | 'female';

export const getMyRole = async (): Promise<UserRole> => {
  const role = await getSetting('my_role');
  if (role === 'female') return 'female';
  return 'male'; // Default
};

export const setMyRole = async (role: UserRole): Promise<void> => {
  await setSetting('my_role', role);
};

export const getMyName = async (): Promise<string> => {
  const name = await getSetting('my_name');
  return name || '';
};

export const setMyName = async (name: string): Promise<void> => {
  await setSetting('my_name', name);
};

export const getPartnerName = async (): Promise<string> => {
  const name = await getSetting('partner_name');
  return name || '';
};

export const setPartnerName = async (name: string): Promise<void> => {
  await setSetting('partner_name', name);
};

export const getApiKey = async (): Promise<string> => {
  const key = await getSetting('api_key');
  return key || process.env.EXPO_PUBLIC_API_KEY || 'mc_sec_2026_couple_prod';
};

export const setApiKey = async (apiKey: string): Promise<void> => {
  await setSetting('api_key', apiKey.trim());
};
