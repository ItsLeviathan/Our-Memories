import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** 256 bits of CSPRNG output, base64url — 43 characters, unguessable. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check before any database lookup. */
export function isPlausibleShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

function key() {
  return Buffer.from(env().SHARE_TOKEN_ENCRYPTION_KEY, "base64");
}

/** AES-256-GCM; output is iv.ciphertext.tag (base64url). */
export function encryptShareToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, ciphertext, cipher.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

export function decryptShareToken(payload: string): string | null {
  try {
    const [iv, ciphertext, tag] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function shareUrl(token: string): string {
  return new URL(`/m/${token}`, env().APP_URL).toString();
}
