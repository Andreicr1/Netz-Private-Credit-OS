#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot/backend
export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages
python3 -m alembic -c alembic.ini upgrade head
