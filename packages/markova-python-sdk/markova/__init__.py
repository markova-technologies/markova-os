"""
Markova AI Call Center — Official Python SDK
"""

from markova.client import MarkovaClient, AsyncMarkovaClient
from markova.exceptions import (
    MarkovaError,
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    WebhookVerificationError,
)
from markova.webhook import verify_webhook_signature, compute_webhook_signature

__version__ = "1.0.0"

__all__ = [
    "MarkovaClient",
    "AsyncMarkovaClient",
    "MarkovaError",
    "AuthenticationError",
    "PermissionDeniedError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "WebhookVerificationError",
    "verify_webhook_signature",
    "compute_webhook_signature",
]
