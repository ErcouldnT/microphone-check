import * as Localization from 'expo-localization';

/**
 * The device's IANA timezone, e.g. "Europe/Istanbul".
 *
 * Stored alongside a plan's wall-clock time so the server can resolve when it
 * actually starts, which matters when the two people are in different zones.
 */
export const getDeviceTimezone = (): string => {
  try {
    const fromCalendar = Localization.getCalendars()[0]?.timeZone;
    if (fromCalendar) return fromCalendar;
  } catch {
    /* fall through */
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
