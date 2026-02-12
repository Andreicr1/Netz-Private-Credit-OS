#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot/backend
export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages

if [[ -z "${DATABASE_URL:-}" || "${DATABASE_URL}" == @Microsoft.KeyVault* ]]; then
  DATABASE_URL=$(python3 - <<'PY'
from app.core.config import settings
print(settings.database_url, end="")
PY
)
  export DATABASE_URL
fi

python3 -m alembic -c alembic.ini upgrade head
