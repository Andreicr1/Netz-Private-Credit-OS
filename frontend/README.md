# Netz Fund OS — Frontend (SAP UI5 Offline)

This frontend is a self-hosted SAP UI5 application.

UI5 SDK resources are served locally from:

- `frontend/public/resources/`

## Run locally

From the repository root:

```bash
cd frontend
python -m http.server 8080
```

Then open:

- http://localhost:8080/webapp/index.html

## Fund ID (temporary)

Authentication is not implemented yet.

For now, the Data Room page uses a static fund id by default.
You can override it via query string:

- http://localhost:8080/webapp/index.html#/dataroom?fundId=YOUR_FUND_ID

Note: `fundId` must be a UUID string (backend path parameter).
