// Lock an API key with a password, so the locked key can sit in a public page. The page holds only
// the ciphertext; the owner's password unlocks it in their own browser (PBKDF2 -> AES-GCM, WebCrypto).
// The ciphertext is public, so its safety is the password's: a long passphrase, never a short word.
const ITERATIONS = 600_000;
const enc = new TextEncoder();
const b64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** "salt.iv.ciphertext", each base64. */
export async function seal(secret: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await derive(password, salt), enc.encode(secret));
  return [b64(salt), b64(iv), b64(new Uint8Array(ct))].join(".");
}

/** The secret, or null for a wrong password or a damaged blob. */
export async function unseal(sealed: string, password: string): Promise<string | null> {
  try {
    const [salt, iv, ct] = sealed.split(".").map(unb64);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await derive(password, salt), ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
