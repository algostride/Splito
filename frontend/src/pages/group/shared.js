/**
 * Group-specific lookups.
 *
 * Money formatting lives in utils/money instead; it is needed by pages outside
 * this folder. No components here, which is deliberate: `react-refresh` rejects
 * a module that exports both a component and a plain function (see the note in
 * eslint.config.js).
 */

/** `members` is the GET members/ payload, an array of Memberships. */
export const memberName = (members, userId) => {
  const membership = members?.find((m) => m.user.id === userId);
  return membership?.user?.name || membership?.user?.email || 'Unknown';
};
