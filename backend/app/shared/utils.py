from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import inspect


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def sa_model_to_dict(obj) -> dict:
    """Shallow column-only serialization for audit before/after snapshots."""
    mapper = inspect(obj)
    data: dict = {}
    for attr in mapper.mapper.column_attrs:
        key = attr.key
        val = getattr(obj, key)
        if isinstance(val, uuid.UUID):
            data[key] = str(val)
        elif isinstance(val, (dt.date, dt.datetime)):
            data[key] = val.isoformat()
        else:
            data[key] = val
    return data

