import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * The output format is: base64(salt + iv + auth_tag + ciphertext)
 */
export function encrypt(text: string, masterKey: string): string {
  if (!text) return text;
  if (!masterKey) throw new Error('Encryption key is required');

  // Generate salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive a 32-byte key using PBKDF2
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Extract the auth tag
  const authTag = cipher.getAuthTag();

  // Concatenate all parts and base64 encode
  // Format: [salt (16)] [iv (16)] [tag (16)] [encrypted...]
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  return payload.toString('base64');
}

/**
 * Decrypts a string previously encrypted with encrypt().
 */
export function decrypt(encryptedData: string, masterKey: string): string {
  if (!encryptedData) return encryptedData;
  if (!masterKey) throw new Error('Decryption key is required');

  try {
    const payload = Buffer.from(encryptedData, 'base64');

    // Extract parts
    const salt = payload.subarray(0, SALT_LENGTH);
    const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encryptedText = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive the key
    const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the text
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Failed to decrypt data. Invalid key or corrupted data.');
  }
}
