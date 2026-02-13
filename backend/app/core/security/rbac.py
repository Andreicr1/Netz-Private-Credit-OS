from __future__ import annotations

from collections.abc import Iterable

from app.core.config import settings
from app.shared.enums import Role


READONLY_ROLES: set[Role] = {Role.INVESTOR, Role.AUDITOR}


def has_any_role(actor_roles: Iterable[Role], required: set[Role]) -> bool:
    role_set = set(actor_roles)
    return bool(role_set.intersection(required))


def require_role(allowed_roles: list[str]):
    """
    Compatibility dependency for domain routers.

    Accepts role names as strings (e.g. ["ADMIN", "INVESTMENT_TEAM"]).
    Returns the current Actor (from token or X-DEV-ACTOR).
    """

    # Avoid circular imports at module import time.
    from fastapi import Depends, HTTPException, status

    from app.core.security.dependencies import get_actor

    allowed = set(allowed_roles)

    def _inner(actor=Depends(get_actor)):
        if settings.AUTHZ_BYPASS_ENABLED:
            return actor
        # ADMIN short-circuit
        if Role.ADMIN in set(actor.roles):
            return actor
        actor_role_names = {r.value for r in actor.roles}
        if not actor_role_names.intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return _inner

