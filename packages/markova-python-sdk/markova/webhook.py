"""
Markova Webhook Signature Verification Module
"""

import hashlib
import hmac
from typing import Union


def compute_webhook_signature(raw_payload: Union[str, bytes], secret: str) -> str:
    """
    Compute HMAC-SHA256 hex digest for Markova webhook delivery.
    """
    if isinstance(raw_payload, str):
        payload_bytes = raw_payload.encode("utf-8")
    elif isinstance(raw_payload, (bytes, bytearray)):
        payload_bytes = bytes(raw_payload)
    else:
        raise TypeError("raw_payload must be str or bytes")

    digest = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_webhook_signature(raw_payload: Union[str, bytes], signature_header: str, secret: str) -> bool:
    """
    Verify Markova webhook signature from X-Markova-Signature header using constant-time comparison.

    :param raw_payload: Unmodified raw request body (str or bytes)
    :param signature_header: Value of header 'X-Markova-Signature' (e.g. 'sha256=abcdef...')
    :param secret: Webhook signing secret configured for tenant or call
    :return: True if signature matches, False otherwise
    """
    if not raw_payload or not signature_header or not secret:
        return False

    sig_clean = signature_header.strip()
    if sig_clean.startswith("sha256="):
        sig_hex = sig_clean[7:].strip()
    else:
        sig_hex = sig_clean

    expected_sig = compute_webhook_signature(raw_payload, secret)[7:]

    try:
        return hmac.compare_digest(sig_hex, expected_sig)
    except Exception:
        return False
