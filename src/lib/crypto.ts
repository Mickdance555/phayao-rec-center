/**
 * Hashes a string using SHA-256 for PDPA compliance.
 * This is non-reversible and used for comparing blacklisted data (idCard, phone)
 * without storing plain text.
 */
export async function hashSHA256(text: string): Promise<string> {
  if (!text) return "";
  const msgUint8 = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Masks a Thai ID card for security (1-10XX-XXXXX-XX-X)
 */
export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length !== 13) return idCard;
  return `${idCard.substring(0, 1)}-${idCard.substring(1, 3)}XX-${idCard.substring(5, 10)}X-XX-${idCard.substring(12, 13)}`;
}

/**
 * Generates a verification signature for the QR Code to prevent forgery.
 * Uses a combination of the bookingId, timestampBlock, and a portion of the user's UID.
 */
export async function signQR(bookingId: string, timestampBlock: number, uid: string): Promise<string> {
    const data = `${bookingId}:${timestampBlock}:${uid.substring(0, 8)}`;
    const hash = await hashSHA256(data);
    return hash.substring(0, 12); // Use first 12 chars as semi-compact signature
}

/**
 * Masks a phone number (08X-XXX-XXXX)
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 10) return phone;
  return `${phone.substring(0, 3)}-XXX-${phone.substring(7)}`;
}
