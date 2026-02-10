from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from jwt import PyJWKClient
from starlette.requests import Request

from app.core.config import settings
from app.shared.enums import Env, Role


@dataclass(frozen=True)
class Actor:
    actor_id: str
    roles: tuple[Role, ...]
    fund_ids: tuple[uuid.UUID, ...]
    is_admin: bool = False

    @property
    def id(self) -> str:
        # Compatibility alias for domain routers/tests
        return self.actor_id

    def can_access_fund(self, fund_id: uuid.UUID) -> bool:
        return self.is_admin or fund_id in set(self.fund_ids)


def _parse_dev_actor_header(raw: str) -> Actor:
    """
    DEV ONLY: X-DEV-ACTOR header payload as JSON.

    Example:
      {"actor_id":"dev-user","roles":["ADMIN"],"fund_ids":["*"]}
    """
    payload = json.loads(raw)
    actor_id = str(payload["actor_id"])
    roles = tuple(Role(r) for r in payload.get("roles", []))

    fund_ids_raw = payload.get("fund_ids", [])
    is_admin = Role.ADMIN in roles or "*" in fund_ids_raw
    fund_ids: list[uuid.UUID] = []
    for v in fund_ids_raw:
        if v == "*":
            continue
        fund_ids.append(uuid.UUID(str(v)))

    return Actor(actor_id=actor_id, roles=roles, fund_ids=tuple(fund_ids), is_admin=is_admin)


def _get_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth:
        return None
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def _verify_entra_jwt(token: str) -> dict[str, Any]:
    """
    Production path: verify JWT signature with JWKS.
    This is intentionally a thin skeleton; it is wired for Entra ID but can be
    refined once tenant/audience details are finalized.
    """
    if not settings.oidc_jwks_url:
        raise NotImplementedError("OIDC JWKS URL is not configured")
    jwk_client = PyJWKClient(str(settings.oidc_jwks_url))
    signing_key = jwk_client.get_signing_key_from_jwt(token)

    options = {"verify_aud": bool(settings.oidc_audience), "verify_iss": bool(settings.oidc_issuer)}
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.oidc_audience,
        issuer=settings.oidc_issuer,
        options=options,
    )


def actor_from_request(request: Request) -> Actor:
    # DEV shortcut (only when ENV=dev)
    if settings.env == Env.dev:
        raw = request.headers.get(settings.dev_actor_header)
        if raw:
            return _parse_dev_actor_header(raw)

    token = _get_bearer_token(request)
    if not token:
        if settings.env == Env.prod:
            raise PermissionError("Missing bearer token")
        # In non-prod, allow missing auth (explicitly deny later per endpoint)
        raise PermissionError("Missing actor")

    claims = _verify_entra_jwt(token)

    actor_id = str(claims.get("oid") or claims.get("sub") or "unknown")

    # Roles/funds are tenant-specific; for scaffold we keep a safe default:
    # - ADMIN must be granted explicitly via app config/mapping later.
    roles: tuple[Role, ...] = (Role.INVESTOR,)
    fund_ids: tuple[uuid.UUID, ...] = tuple()
    return Actor(actor_id=actor_id, roles=roles, fund_ids=fund_ids, is_admin=False)

