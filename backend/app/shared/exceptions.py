from __future__ import annotations


class AppError(Exception):
    """Base error for domain/application exceptions."""


class NotAuthorized(AppError):
    """Raised when actor lacks permissions or fund access."""


class NotFound(AppError):
    """Raised when entity is missing or not visible within fund scope."""


class ValidationError(AppError):
    """Raised for domain-level validation beyond schema validation."""

