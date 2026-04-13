/**
 * Who may use this app. Change the suffix here if the firm domain changes.
 * Client + Firestore rules should stay aligned (see firestore.rules).
 */
const ALLOWED_EMAIL_SUFFIX = "@ramosjames.com";

export function isAllowedAppUser(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX);
}

export function allowedEmailDomainHint(): string {
  return ALLOWED_EMAIL_SUFFIX;
}
