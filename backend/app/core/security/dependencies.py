from __future__ import annotations

import uuid
from collections.abc import Callable, Iterable

from fastapi import Depends, HTTPException, Path, Request, status

from app.core.middleware.audit import set_actor
from app.core.security.auth import Actor, actor_from_request
from app.shared.enums import Role


def get_actor(request: Request) -> Actor:
    try:
        actor = actor_from_request(request)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    set_actor(actor.actor_id, [r.value for r in actor.roles])
    return actor


def get_fund_id(fund_id: uuid.UUID = Path(...)) -> uuid.UUID:
    return fund_id


def require_fund_access() -> Callable[[uuid.UUID, Actor], uuid.UUID]:
    def _dep(fund_id: uuid.UUID = Depends(get_fund_id), actor: Actor = Depends(get_actor)) -> uuid.UUID:
        if not actor.can_access_fund(fund_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden for this fund")
        return fund_id

    return _dep


def require_roles(required: Iterable[Role]) -> Callable[[Actor], Actor]:
    required_set = set(required)

    def _dep(actor: Actor = Depends(get_actor)) -> Actor:
        actor_roles = set(actor.roles)
        if Role.ADMIN in actor_roles:
            return actor
        if not actor_roles.intersection(required_set):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return _dep


def require_readonly_allowed() -> Callable[[Actor], Actor]:
    """Deny write endpoints for INVESTOR/AUDITOR by default."""

    def _dep(actor: Actor = Depends(get_actor)) -> Actor:
        if Role.ADMIN in set(actor.roles):
            return actor
        if Role.INVESTOR in set(actor.roles) or Role.AUDITOR in set(actor.roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Read-only role")
        return actor

    return _dep

