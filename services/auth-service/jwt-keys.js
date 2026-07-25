const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

class JwtKeyManager {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.ensureKeysExist();
  }

  ensureKeysExist() {
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
    }

    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
      this.privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
      this.publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
      console.log('✅ Loaded existing RSA keys for JWT');
    } else {
      this.generateKeys();
    }
  }

  generateKeys() {
    console.log('Generating new RSA keys for JWT...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    this.privateKey = privateKey;
    this.publicKey = publicKey;

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    
    // Ensure correct permissions
    try {
      fs.chmodSync(PRIVATE_KEY_PATH, 0o600);
      fs.chmodSync(PUBLIC_KEY_PATH, 0o644);
    } catch (err) {
      console.warn('Warning: Could not set strict permissions on key files.');
    }

    console.log('✅ Generated and saved new RSA keys for JWT');
  }

  getPrivateKey() {
    return this.privateKey;
  }

  getPublicKey() {
    return this.publicKey;
  }
}

module.exports = new JwtKeyManager();
