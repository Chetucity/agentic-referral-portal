/**
 * Who legally operates this service.
 *
 * Every legal page and the contact page read their identity details from here,
 * so there is exactly one file to edit rather than four documents to keep in
 * step with each other.
 *
 * ⚠️ These must be real before submitting to Google Play. A privacy policy that
 * names nobody and gives no address is rejected, and a reviewer does read it.
 *
 * The values below were carried over from the Personalise project, since the
 * same person operates both. Check them before submitting — in particular
 * whether `supportEmail` should be an address dedicated to this product rather
 * than one shared with another.
 *
 * Anything left starting with "TODO:" renders on the page as an amber "needs
 * filling in" badge rather than silently leaving a hole in a sentence. That is
 * deliberate — an unfinished policy otherwise reads perfectly well in review,
 * because the sentence around the blank is grammatical.
 */
export const LEGAL = {
  /** Registered business name, or the individual's full name if unincorporated. */
  operatorName: "Chetan Sharma",

  /** A mailbox a real person reads. It appears on every legal page. */
  supportEmail: "nirmata@koshcloud.com",

  /** Full postal address, including city, state and PIN code. */
  address: "Flat No. 524, Sector A6, Pocket 1, Narela, Delhi 110040, India",

  /** A number a user can actually reach, with country code. */
  phone: "+91 95600 84806",

  /** The date these documents were last reviewed, e.g. "19 September 2026". */
  lastUpdated: "19 September 2026",

  /** Where disputes are heard. */
  jurisdiction: "Delhi, India",
};

/** True when a value is still a placeholder. */
export function isTodo(value: string): boolean {
  return value.trim().toUpperCase().startsWith("TODO");
}

/** Every unfilled field, for the readiness check and the admin warning. */
export function outstandingLegalFields(): string[] {
  return Object.entries(LEGAL)
    .filter(([, v]) => typeof v === "string" && isTodo(v))
    .map(([k]) => k);
}
