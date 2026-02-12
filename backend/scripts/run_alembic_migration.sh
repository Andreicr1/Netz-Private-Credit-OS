#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot/backend
export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages

if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == @Microsoft.KeyVault* ]]; then
	export DATABASE_URL
	DATABASE_URL=$(python3 - <<'PY'
import os
import re
from urllib.parse import urlparse

from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient


raw = os.environ.get("DATABASE_URL", "")
match = re.search(r"SecretUri=([^\)]+)", raw)
if not match:
		raise SystemExit("Invalid Key Vault reference format in DATABASE_URL")

secret_uri = match.group(1)
parsed = urlparse(secret_uri)
vault_url = f"{parsed.scheme}://{parsed.netloc}"
secret_name = parsed.path.strip("/").split("/")[1]

credential = DefaultAzureCredential(exclude_interactive_browser_credential=True)
client = SecretClient(vault_url=vault_url, credential=credential)
secret = client.get_secret(secret_name)
print(secret.value, end="")
PY
)
fi

python3 -m alembic -c alembic.ini upgrade head
