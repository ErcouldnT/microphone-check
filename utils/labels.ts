import i18n from '@/i18n';
import { UserRole } from '@/db/settings';

export interface PersonLabels {
  me: string;
  partner: string;
  both: string;
}

/**
 * Display names for the two people in the room.
 *
 * Once names are set they are used on their own — "Erkut", not
 * "You (Erkut)" — and the generic role wording is only a fallback for a
 * profile that has not been filled in yet.
 */
export const getPersonLabels = (
  myRole: UserRole,
  myName?: string,
  partnerName?: string
): PersonLabels => ({
  me: myName?.trim() || String(i18n.t('forYou')),
  partner: partnerName?.trim() || String(i18n.t('forPartner')),
  both: String(i18n.t('forBoth')),
});

/** Which of the two people an event target refers to. */
export type TargetKind = 'me' | 'partner' | 'both';

export const resolveTarget = (target: string, myRole: UserRole): TargetKind => {
  if (target === 'both') return 'both';
  const partnerRole: UserRole = myRole === 'male' ? 'female' : 'male';
  if (target === 'partner' || target === partnerRole) return 'partner';
  return 'me';
};

/** Name to show on an event's assignee badge. */
export const labelForTarget = (
  target: string,
  myRole: UserRole,
  myName?: string,
  partnerName?: string
): string => {
  const labels = getPersonLabels(myRole, myName, partnerName);
  const kind = resolveTarget(target, myRole);
  return kind === 'both' ? labels.both : kind === 'partner' ? labels.partner : labels.me;
};

/** Accent colour per person, so the two are visually distinct everywhere. */
export const colorForTarget = (kind: TargetKind): string =>
  kind === 'both' ? '#FACC15' : kind === 'partner' ? '#FF007F' : '#00FFFF';
