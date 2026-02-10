from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import structlog
from structlog import contextvars


@dataclass(frozen=True)
class ActorContext:
    actor_id: str
    roles: tuple[str, ...]


def set_request_id(request_id: str) -> None:
    contextvars.bind_contextvars(request_id=request_id)


def set_actor(actor_id: str, roles: Iterable[str]) -> None:
    contextvars.bind_contextvars(actor_id=actor_id, actor_roles=list(roles))


def get_request_id() -> str | None:
    ctx = contextvars.get_contextvars()
    v = ctx.get("request_id")
    return str(v) if v is not None else None


def get_actor_id() -> str | None:
    ctx = contextvars.get_contextvars()
    v = ctx.get("actor_id")
    return str(v) if v is not None else None


def get_actor_roles() -> list[str]:
    ctx = contextvars.get_contextvars()
    roles = ctx.get("actor_roles")
    if isinstance(roles, list):
        return [str(r) for r in roles]
    return []


def get_logger():
    return structlog.get_logger()

