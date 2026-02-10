from __future__ import annotations

from dataclasses import dataclass

from app.core.security.auth import Actor
from app.shared.enums import Role


@dataclass(frozen=True)
class AIScope:
    allowed_root_folders: set[str] | None  # None => no restriction


AUDITOR_ALLOWED_ROOTS = {
    # EPIC 3C: auditor can only see Offering + Financial Statements.
    # Financial statements are typically stored under Audit in this dataroom taxonomy.
    "11 Offering Documents",
    "11 Audit",
}


def scope_for_actor(actor: Actor) -> AIScope:
    roles = set(actor.roles)
    if Role.ADMIN in roles or Role.GP in roles or Role.COMPLIANCE in roles:
        return AIScope(allowed_root_folders=None)
    if Role.INVESTMENT_TEAM in roles:
        return AIScope(allowed_root_folders=None)
    if Role.AUDITOR in roles:
        return AIScope(allowed_root_folders=set(AUDITOR_ALLOWED_ROOTS))
    # Investors do not get copilot access in EPIC 3C.
    return AIScope(allowed_root_folders=set())


def enforce_root_folder_scope(*, actor: Actor, requested_root_folder: str | None) -> None:
    scope = scope_for_actor(actor)
    if scope.allowed_root_folders is None:
        return
    if requested_root_folder is None:
        # Requesting "all roots" is not allowed if actor is restricted
        raise PermissionError("Root folder scope restricted")
    if requested_root_folder not in scope.allowed_root_folders:
        raise PermissionError("Root folder not permitted for this role")


def filter_hits_by_scope(*, actor: Actor, hits: list[object], get_root_folder) -> list[object]:
    """
    Post-filter search hits to avoid leaking cross-scope evidence.
    `get_root_folder(hit) -> str | None`
    """
    scope = scope_for_actor(actor)
    if scope.allowed_root_folders is None:
        return hits
    allowed = scope.allowed_root_folders
    return [h for h in hits if (get_root_folder(h) in allowed)]

