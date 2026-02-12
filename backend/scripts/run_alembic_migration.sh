#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot/backend
export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages

if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == @Microsoft.KeyVault* ]]; then
	export DATABASE_URL
	DATABASE_URL=$(python3 - <<'PY'
import os
import re
import json
import urllib.request


raw = os.environ.get("DATABASE_URL", "")
match = re.search(r"SecretUri=([^\)]+)", raw)
if not match:
		raise SystemExit("Invalid Key Vault reference format in DATABASE_URL")

secret_uri = match.group(1)

token_req = urllib.request.Request(
	"http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net",
	headers={"Metadata": "true"},
)
with urllib.request.urlopen(token_req, timeout=10) as resp:
	token_payload = json.loads(resp.read().decode("utf-8"))

access_token = token_payload.get("access_token")
if not access_token:
	raise SystemExit("Failed to obtain managed identity token for Key Vault")

secret_req = urllib.request.Request(
	secret_uri,
	headers={"Authorization": f"Bearer {access_token}"},
)
with urllib.request.urlopen(secret_req, timeout=10) as resp:
	secret_payload = json.loads(resp.read().decode("utf-8"))

secret_value = secret_payload.get("value")
if not secret_value:
	raise SystemExit("Failed to resolve DATABASE_URL from Key Vault secret")

print(secret_value, end="")
PY
)
fi

python3 -m alembic -c alembic.ini upgrade head
