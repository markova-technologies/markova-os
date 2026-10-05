"""
Markova Python SDK Exceptions
"""

from typing import Optional, Any


class MarkovaError(Exception):
    """Base exception for all Markova SDK errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body

    def __repr__(self) -> str:
        return f"MarkovaError(message={self.message!r}, status_code={self.status_code})"


class AuthenticationError(MarkovaError):
    """Raised when authentication credentials (API key or JWT) are invalid or missing."""
    pass


class PermissionDeniedError(MarkovaError):
    """Raised when tenant lacks permission for the requested resource."""
    pass


class NotFoundError(MarkovaError):
    """Raised when requested agent, call, or resource does not exist."""
    pass


class ConflictError(MarkovaError):
    """Raised when an idempotency collision occurs or resource already exists."""
    pass


class RateLimitError(MarkovaError):
    """Raised when tenant exceeds API rate limits."""
    pass


class WebhookVerificationError(MarkovaError):
    """Raised when webhook signature verification fails."""
    pass
