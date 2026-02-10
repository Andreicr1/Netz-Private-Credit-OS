## Netz Private Credit OS — Backend (MVP scaffold)

Backend institucional e audit-ready para o **Netz Private Credit Fund**, com **FastAPI + SQLAlchemy 2.0 + Alembic** e **multi-tenant por fund** (fund scoping obrigatório em todas as rotas de domínio).

### Stack
- **Python**: 3.11+
- **API**: FastAPI
- **ORM**: SQLAlchemy 2.0 (typed)
- **Migrations**: Alembic
- **DB (dev)**: Postgres via Docker Compose
- **Auth**: Abstração com `X-DEV-ACTOR` em dev e skeleton JWKS/OIDC para Entra em prod
- **Auditoria**: `audit_events` + `request_id` middleware + before/after snapshots
### Rodar local (Docker)

Subir Postgres + API:

```bash
docker-compose up --build
```

Endpoints principais:
- `GET /health`
- `GET /docs`
### Autenticação em DEV (`X-DEV-ACTOR`)

Todas as rotas de domínio ficam sob:
- `/funds/{fund_id}/...`

Em `ENV=dev`, envie o header **`X-DEV-ACTOR`** com JSON:

```json
{"actor_id":"dev-user","roles":["GP"],"fund_ids":["<fund_uuid>"]}
```

### Seed em DEV

Somente em `ENV=dev` existe um endpoint de conveniência para bootstrap:
- `POST /admin/dev/seed`

Ele cria `fund` + `user` + `user_fund_roles` e retorna um payload pronto para `X-DEV-ACTOR`.

### Dataroom Ingest (upload → ingest → search)

Rotas:
- `POST /api/dataroom/documents` (upload + registro)
- `POST /api/dataroom/documents/{document_id}/ingest?fund_id=...` (extrai texto, chunking, embeddings (se configurado), indexa no Azure AI Search)
- `GET /api/dataroom/search?fund_id=...&q=...` (consulta no `fund-documents-index`)

Exemplo (DEV):

```bash
# 1) Upload
curl -sS -X POST "http://localhost:8000/api/dataroom/documents" \
  -H "Content-Type: multipart/form-data" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}" \
  -F "fund_id=<fund_uuid>" \
  -F "title=COM FINAL - Netz Private Credit (Offering Memorandum)" \
  -F "file=@./docs/COM_FINAL.pdf"
```

```bash
# 2) Ingest (idempotente: reingest não duplica; upsert no Search por chave determinística)
curl -sS -X POST "http://localhost:8000/api/dataroom/documents/<document_uuid>/ingest?fund_id=<fund_uuid>&store_artifacts_in_evidence=true" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}"
```

```bash
# 3) Search (retorna chunks indexados)
curl -sS "http://localhost:8000/api/dataroom/search?fund_id=<fund_uuid>&q=bank%20service%20fees&top=5" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}"
```

Observações:
- O upload armazena o arquivo no container `dataroom`.
- Artefatos (texto extraído, manifest, embeddings quando aplicável) vão para o container `evidence`.
- Para embeddings, configure `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`.

### Cash Management (USD-only) com governança auditável

Workflow mínimo:
- `DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_ADMIN → EXECUTED`
- (ou `REJECTED / CANCELLED`)

Regras duras:
- **currency != USD** é bloqueado.
- **APPROVED só ocorre com 2 sign-offs de DIRECTOR** (registrados via endpoint).
- **INVESTMENT** exige `investment_memo_document_id` + **IC approvals >= 2** (regra interna 2/3).
- Campos críticos não têm endpoint de edição após `APPROVED` (somente transições).
- Ao aprovar, o sistema grava um **evidence bundle JSON** no container `evidence` + hash + audit events.

Rotas:
- `POST /api/cash/transactions` (cria DRAFT)
- `POST /api/cash/transactions/{id}/submit?fund_id=...` (DRAFT → PENDING_APPROVAL)
- `POST /api/cash/transactions/{id}/approve/director` (registra sign-off de diretor)
- `POST /api/cash/transactions/{id}/approve/ic` (somente INVESTMENT; registra IC approvals)
- `POST /api/cash/transactions/{id}/generate-instructions?fund_id=...` (gera HTML e salva em evidence)
- `POST /api/cash/transactions/{id}/mark-sent` (SENT_TO_ADMIN)
- `POST /api/cash/transactions/{id}/mark-executed` (EXECUTED)

Exemplo (EXPENSE):

```bash
# 1) Criar (DRAFT)
curl -sS -X POST "http://localhost:8000/api/cash/transactions" \
  -H "Content-Type: application/json" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}" \
  -d '{
    "fund_id": "<fund_uuid>",
    "type": "EXPENSE",
    "amount": 1250.00,
    "currency": "USD",
    "justification_text": "Bank service fees conforme OM.",
    "policy_basis": [
      {"document_id":"<om_doc_uuid>","section":"Expenses","excerpt":"... bank service fees ..."}
    ],
    "payment_reference": "Netz Private Credit Fund"
  }'
```

```bash
# 2) Submit
curl -sS -X POST "http://localhost:8000/api/cash/transactions/<tx_uuid>/submit?fund_id=<fund_uuid>" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}"
```

```bash
# 3) Aprovar (2 diretores)
curl -sS -X POST "http://localhost:8000/api/cash/transactions/<tx_uuid>/approve/director" \
  -H "Content-Type: application/json" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"director-1\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}" \
  -d '{"fund_id":"<fund_uuid>","approver_name":"Director 1","comment":"OK"}'

curl -sS -X POST "http://localhost:8000/api/cash/transactions/<tx_uuid>/approve/director" \
  -H "Content-Type: application/json" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"director-2\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}" \
  -d '{"fund_id":"<fund_uuid>","approver_name":"Director 2","comment":"OK"}'
```

```bash
# 4) Gerar pacote de instrução (HTML)
curl -sS -X POST "http://localhost:8000/api/cash/transactions/<tx_uuid>/generate-instructions?fund_id=<fund_uuid>" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"dev-user\",\"roles\":[\"GP\"],\"fund_ids\":[\"<fund_uuid>\"]}"
```

Exemplo (INVESTMENT): antes do 2º diretor, registre IC approvals (>=2):

```bash
curl -sS -X POST "http://localhost:8000/api/cash/transactions/<tx_uuid>/approve/ic" \
  -H "Content-Type: application/json" \
  -H "X-DEV-ACTOR: {\"actor_id\":\"ic-1\",\"roles\":[\"INVESTMENT_TEAM\"],\"fund_ids\":[\"<fund_uuid>\"]}" \
  -d '{"fund_id":"<fund_uuid>","approver_name":"IC Member 1","comment":"Approve"}'
```

### Testes

Os testes usam SQLite em memória (sem Docker) e validam:
- `/health`
- fund scoping (403 ao tentar acessar outra fund)
```bash
cd backend
pytest -q
```

