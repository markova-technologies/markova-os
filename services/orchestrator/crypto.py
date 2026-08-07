import base64
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

SALT_LENGTH = 16
IV_LENGTH = 16
TAG_LENGTH = 16
ITERATIONS = 100000
KEY_LENGTH = 32

def get_master_key() -> str:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY environment variable is required and was not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return key

def decrypt(encrypted_data_b64: str, master_key: str = None) -> str:
    """
    Decrypts a base64 encoded string that was encrypted by the Node.js shared-auth/crypto.ts
    Format: base64( [salt (16)] [iv (16)] [tag (16)] [ciphertext] )
    """
    if not encrypted_data_b64:
        return encrypted_data_b64
        
    master_key = master_key or get_master_key()
    
    try:
        # Check if the string is actually JSON (plain text config) for backward compatibility
        if encrypted_data_b64.strip().startswith('{') or encrypted_data_b64.strip().startswith('['):
            return encrypted_data_b64
            
        payload = base64.b64decode(encrypted_data_b64)
        
        salt = payload[:SALT_LENGTH]
        iv = payload[SALT_LENGTH : SALT_LENGTH + IV_LENGTH]
        auth_tag = payload[SALT_LENGTH + IV_LENGTH : SALT_LENGTH + IV_LENGTH + TAG_LENGTH]
        ciphertext = payload[SALT_LENGTH + IV_LENGTH + TAG_LENGTH:]
        
        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=KEY_LENGTH,
            salt=salt,
            iterations=ITERATIONS,
            backend=default_backend()
        )
        key = kdf.derive(master_key.encode('utf-8'))
        
        # Python cryptography AESGCM expects the ciphertext + auth_tag together
        aesgcm = AESGCM(key)
        data = ciphertext + auth_tag
        decrypted = aesgcm.decrypt(iv, data, None)
        
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Failed to decrypt provider config: {e}")
        # If decryption fails, maybe it was just plaintext anyway
        return encrypted_data_b64

def encrypt(text: str, master_key: str = None) -> str:
    """
    Encrypts a string, matching the format expected by the Node.js shared-auth/crypto.ts
    """
    if not text:
        return text
        
    master_key = master_key or get_master_key()
    
    salt = os.urandom(SALT_LENGTH)
    iv = os.urandom(IV_LENGTH)
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=ITERATIONS,
        backend=default_backend()
    )
    key = kdf.derive(master_key.encode('utf-8'))
    
    aesgcm = AESGCM(key)
    # Encrypt returns ciphertext + auth_tag
    encrypted_data = aesgcm.encrypt(iv, text.encode('utf-8'), None)
    
    ciphertext = encrypted_data[:-TAG_LENGTH]
    auth_tag = encrypted_data[-TAG_LENGTH:]
    
    payload = salt + iv + auth_tag + ciphertext
    return base64.b64encode(payload).decode('utf-8')
