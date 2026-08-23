// A fixed, visually distinct palette — deterministically assigned per person
// so the same family member always gets the same color across every device,
// with no need to store a color choice anywhere.
const MEMBER_PALETTE = [
  '#E85D75', // rose
  '#4C9F70', // green
  '#3F7FBF', // blue
  '#D98B3B', // amber
  '#8B5FBF', // purple
  '#3FA5A0', // teal
];

export function colorForMember(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MEMBER_PALETTE.length;
  return MEMBER_PALETTE[index];
}

/** The name to show for a family member — their chosen display name if
 * they've set one, falling back to the part of their email before the @
 * for accounts that haven't set a name yet. */
export function memberDisplayName(profile?: { email: string; displayName?: string } | null): string {
  if (!profile) return 'Someone';
  return profile.displayName?.trim() || profile.email.split('@')[0];
}
