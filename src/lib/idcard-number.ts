// ID-card numbers (PRD IDC-1). No server-only imports, so the verify page and tests can use it.
import { randomBytes } from "crypto";

// Card numbers are random, not sequential, so the public verify page cannot be walked through
// to list every card holder. 8 characters from a 32-letter alphabet without I, L, O, U.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CARD_NUMBER = /^CB-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/;

export function newCardNumber(): string {
  const code = Array.from(randomBytes(8), (b) => ALPHABET[b % 32]).join("");
  return `CB-${new Date().getFullYear()}-${code}`;
}
