const crypto = require('crypto');
const { promisify } = require('util');
const hkdf = promisify(crypto.hkdf);

class VaultInterface {
  async getSecret(companyId, keyName) { throw new Error('Not implemented'); }
  async setSecret(companyId, keyName, value) { throw new Error('Not implemented'); }
  async rotateSecret(companyId, keyName, newValue) { throw new Error('Not implemented'); }
  async deleteSecret(companyId, keyName) { throw new Error('Not implemented'); }
}

// In-Database Local Vault (AES-256-GCM)
class LocalVault extends VaultInterface {
  constructor(pool) {
    super();
    this.pool = pool;

    // 🔐 VAULT_MASTER_KEY must be set — fail hard in production if missing
    const rawKey = process.env.VAULT_MASTER_KEY;
    if (!rawKey) {
      throw new Error(
        'VAULT_MASTER_KEY environment variable is not set. ' +
        'Generate a 32-byte hex key and set it before starting the service.'
      );
    }
    const keyBuf = Buffer.from(rawKey, 'hex');
    if (keyBuf.length < 32) {
      throw new Error('VAULT_MASTER_KEY must be at least 32 bytes (64 hex characters).');
    }
    this.masterKey = keyBuf.slice(0, 32);
  }

  /**
   * Derives a per-tenant AES-256-GCM key using HKDF-SHA256.
   * This ensures Company A's secrets are encrypted with a key
   * that is cryptographically separate from Company B's.
   */
  async _deriveKey(companyId) {
    // info = 'markova-vault:' + companyId makes the derived key tenant-scoped
    const derived = await hkdf(
      'sha256',
      this.masterKey,
      Buffer.alloc(0),          // no salt (master key already random)
      `markova-vault:${companyId}`,
      32
    );
    return Buffer.from(derived);
  }

  async _encrypt(companyId, text) {
    const key = await this._deriveKey(companyId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
      encryptedValue: encrypted + ':' + authTag,
      iv: iv.toString('hex')
    };
  }

  async _decrypt(companyId, encryptedValue, ivHex) {
    const key = await this._deriveKey(companyId);
    const parts = encryptedValue.split(':');
    const encryptedText = parts[0];
    const authTag = Buffer.from(parts[1], 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getSecret(companyId, keyName) {
    const result = await this.pool.query(
      'SELECT encrypted_value, iv FROM secret_vault WHERE company_id = $1 AND key_name = $2',
      [companyId, keyName]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return this._decrypt(companyId, row.encrypted_value, row.iv);
  }

  async setSecret(companyId, keyName, value) {
    const { encryptedValue, iv } = await this._encrypt(companyId, value);
    await this.pool.query(
      `INSERT INTO secret_vault (company_id, key_name, encrypted_value, iv)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, key_name)
       DO UPDATE SET encrypted_value = $3, iv = $4, updated_at = CURRENT_TIMESTAMP`,
      [companyId, keyName, encryptedValue, iv]
    );
  }

  async rotateSecret(companyId, keyName, newValue, auditLogger = null, ctx = null) {
    // Optionally log before rotating
    if (auditLogger && ctx) {
      await auditLogger.logSecurityEvent(
        ctx,
        'SECRET_ROTATED',
        'secret_vault',
        keyName,
        `Key '${keyName}' rotated for tenant ${companyId}`
      );
    }
    return this.setSecret(companyId, keyName, newValue);
  }

  async deleteSecret(companyId, keyName) {
    await this.pool.query(
      'DELETE FROM secret_vault WHERE company_id = $1 AND key_name = $2',
      [companyId, keyName]
    );
  }
}

// Stubs for future Enterprise Vault integrations
class AWSVault extends VaultInterface { /* TODO: Implement AWS Secrets Manager SDK */ }
class AzureVault extends VaultInterface { /* TODO: Implement Azure Key Vault SDK */ }

module.exports = {
  VaultInterface,
  LocalVault,
  AWSVault,
  AzureVault
};
