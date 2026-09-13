import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const CURRENT_KEY_VERSION = 1;

export interface OwnerTokenCipher {
  readonly keyVersion: number;
  encrypt(ownerId: string, purpose: "access" | "refresh", value: string): string;
  decrypt(ownerId: string, purpose: "access" | "refresh", value: string): string;
}

function associatedData(ownerId: string, purpose: string, keyVersion: number): Buffer {
  return Buffer.from(`pikachubball\u0000${ownerId}\u0000${purpose}\u0000v${keyVersion}`);
}

export class AesGcmOwnerTokenCipher implements OwnerTokenCipher {
  readonly keyVersion = CURRENT_KEY_VERSION;

  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error("Owner token encryption key must be 32 bytes");
    }
  }

  static fromHex(value: string): AesGcmOwnerTokenCipher {
    if (!/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new Error("ENCRYPTION_KEY must contain exactly 64 hexadecimal characters");
    }
    return new AesGcmOwnerTokenCipher(Buffer.from(value, "hex"));
  }

  encrypt(ownerId: string, purpose: "access" | "refresh", value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
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
    if (version !== `v${this.keyVersion}` || !ivPart || !ciphertextPart || !tagPart || extra) {
      throw new Error("Stored Yahoo credential is invalid");
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(ivPart, "base64url"),
      );
      decipher.setAAD(associatedData(ownerId, purpose, this.keyVersion));
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
