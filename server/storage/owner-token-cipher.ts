import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export interface OwnerTokenCipher {
  readonly keyVersion: number;
  encrypt(ownerId: string, purpose: "access" | "refresh", value: string): string;
  decrypt(ownerId: string, purpose: "access" | "refresh", value: string): string;
}

function associatedData(ownerId: string, purpose: string, keyVersion: number): Buffer {
  return Buffer.from(`pikachubball\u0000${ownerId}\u0000${purpose}\u0000v${keyVersion}`);
}

function parseHexKey(value: string, name: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must contain exactly 64 hexadecimal characters`);
  }
  return Buffer.from(value, "hex");
}

/** The keys that may be in use: new writes use `keyVersion`, older rows may still use `keyVersion - 1`. */
export interface TokenKeyring {
  readonly currentVersion: number;
  readonly currentKey: string;
  readonly previousKey?: string | null;
}

/**
 * Encrypts with the current key and decrypts with whichever key the stored value's
 * version names, so a key can be rotated without making stored tokens unreadable.
 */
export class AesGcmOwnerTokenCipher implements OwnerTokenCipher {
  private readonly keys = new Map<number, Buffer>();
  private readonly currentKey: Buffer;

  constructor(
    key: Buffer,
    readonly keyVersion = 1,
    previousKey?: Buffer
  ) {
    if (key.length !== 32 || (previousKey && previousKey.length !== 32)) {
      throw new Error("Owner token encryption key must be 32 bytes");
    }
    if (!Number.isInteger(keyVersion) || keyVersion < 1) {
      throw new Error("Owner token key version must be a positive integer");
    }
    if (previousKey && keyVersion < 2) {
      throw new Error("ENCRYPTION_KEY_PREVIOUS needs ENCRYPTION_KEY_VERSION of 2 or more");
    }
    this.currentKey = key;
    this.keys.set(keyVersion, key);
    if (previousKey) {
      this.keys.set(keyVersion - 1, previousKey);
    }
  }

  static fromHex(value: string, keyVersion = 1): AesGcmOwnerTokenCipher {
    return new AesGcmOwnerTokenCipher(parseHexKey(value, "ENCRYPTION_KEY"), keyVersion);
  }

  static fromKeyring(keyring: TokenKeyring): AesGcmOwnerTokenCipher {
    return new AesGcmOwnerTokenCipher(
      parseHexKey(keyring.currentKey, "ENCRYPTION_KEY"),
      keyring.currentVersion,
      keyring.previousKey ? parseHexKey(keyring.previousKey, "ENCRYPTION_KEY_PREVIOUS") : undefined
    );
  }

  encrypt(ownerId: string, purpose: "access" | "refresh", value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.currentKey, iv);
    cipher.setAAD(associatedData(ownerId, purpose, this.keyVersion));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      `v${this.keyVersion}`,
      iv.toString("base64url"),
      ciphertext.toString("base64url"),
      tag.toString("base64url"),
    ].join(".");
  }

  decrypt(ownerId: string, purpose: "access" | "refresh", value: string): string {
    const [version, ivPart, ciphertextPart, tagPart, extra] = value.split(".");
    const storedVersion = /^v(\d+)$/.exec(version ?? "")?.[1];
    const keyVersion = storedVersion === undefined ? NaN : Number(storedVersion);
    const key = this.keys.get(keyVersion);
    if (!key || !ivPart || !ciphertextPart || !tagPart || extra) {
      throw new Error("Stored Yahoo credential is invalid");
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
      decipher.setAAD(associatedData(ownerId, purpose, keyVersion));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("Stored Yahoo credential could not be authenticated");
    }
  }
}
