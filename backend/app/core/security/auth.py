from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from starlette.requests import Request

from app.core.config import settings
from app.core.db.models import User, UserFundRole
from app.core.db.session import get_session_local
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


def _get_forwarded_aad_token(request: Request) -> str | None:
    token = request.headers.get("X-MS-TOKEN-AAD-ACCESS-TOKEN")
    if token and token.strip():
        return token.strip()

    alt = request.headers.get("X-ZUMO-AUTH")
    if alt and alt.strip():
        return alt.strip()

    return None


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

    audiences = None
    if settings.oidc_audience:
        parsed = [value.strip() for value in str(settings.oidc_audience).replace(";", ",").split(",") if value.strip()]
        if len(parsed) == 1:
            audiences = parsed[0]
        elif parsed:
            audiences = parsed

    options = {"verify_aud": bool(audiences), "verify_iss": bool(settings.oidc_issuer)}
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audiences,
        issuer=settings.oidc_issuer,
        options=options,
    )


def _extract_claim_roles(claims: dict[str, Any]) -> set[Role]:
    role_values = claims.get("roles") or []
    out: set[Role] = set()
    for value in role_values:
        try:
            out.add(Role(str(value)))
        except Exception:
            continue

    admin_wids = {
        "62e90394-69f5-4237-9190-012177145e10",  # Global Administrator
        "194ae4cb-b126-40b2-bd5b-6091b380977d",  # Privileged Role Administrator
    }
    claim_wids = {str(value).lower() for value in (claims.get("wids") or [])}
    if any(value.lower() in claim_wids for value in admin_wids):
        out.add(Role.ADMIN)
    return out


def _load_user_context(actor_id: str, email: str | None) -> tuple[set[Role], set[uuid.UUID]]:
    session = get_session_local()()
    try:
        user = None
        if actor_id:
            user = session.execute(select(User).where(User.external_id == actor_id)).scalar_one_or_none()
        if user is None and email:
            user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            return set(), set()

        rows = session.execute(select(UserFundRole.role, UserFundRole.fund_id).where(UserFundRole.user_id == user.id)).all()
        roles: set[Role] = set()
        funds: set[uuid.UUID] = set()
        for role_value, fund_id in rows:
            try:
                roles.add(Role(str(role_value)))
            except Exception:
                continue
            if fund_id is not None:
                funds.add(fund_id)
        return roles, funds
    finally:
        session.close()


def actor_from_request(request: Request) -> Actor:
    # DEV shortcut (only when ENV=dev)
    if settings.env == Env.dev:
        raw = request.headers.get(settings.dev_actor_header)
        if raw:
            return _parse_dev_actor_header(raw)

    token = _get_bearer_token(request) or _get_forwarded_aad_token(request)
    if not token:
        if settings.env == Env.prod:
            raise PermissionError("Missing bearer token")
        # In non-prod, allow missing auth (explicitly deny later per endpoint)
        raise PermissionError("Missing actor")

    claims = _verify_entra_jwt(token)

    actor_id = str(claims.get("oid") or claims.get("sub") or "unknown")
    email = claims.get("email") or claims.get("preferred_username") or claims.get("upn")

    claim_roles = _extract_claim_roles(claims)
    db_roles, db_funds = _load_user_context(actor_id=actor_id, email=str(email) if email else None)

    effective_roles = claim_roles.union(db_roles)
    if not effective_roles:
        effective_roles = {Role.INVESTOR}

    is_admin = Role.ADMIN in effective_roles
    return Actor(
        actor_id=actor_id,
        roles=tuple(sorted(effective_roles, key=lambda value: value.value)),
        fund_ids=tuple(sorted(db_funds, key=str)),
        is_admin=is_admin,
    )

