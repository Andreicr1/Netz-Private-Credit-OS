# AI Engine Data Contracts (Wave AI-1)

## Common Contract Rules
All response contracts include:
- `asOf` (required)
- `dataLatency` (optional)
- `dataQuality` (optional)

If `dataQuality != OK`, consumer blocks should display governance warning state (MessageStrip at UI layer).

## 1) Document Classification
`GET /api/ai/documents/classification?fund_id=<uuid>&path=<optional>`

Response:
- `asOf`
- `dataLatency`
- `dataQuality`
- `items[]`:
  - `documentId`
  - `versionId`
  - `title`
  - `rootFolder`
  - `folderPath`
  - `institutionalType`

Institutional types:
- `MARKETING_PROMOTIONAL`
- `LEGAL_BINDING`
- `REGULATORY_CIMA`
- `FINANCIAL_REPORTING`
- `OPERATIONAL_EVIDENCE`
- `INVESTMENT_COMMITTEE`
- `KYC_AML`
- `GOVERNANCE_BOARD`

## 2) Manager Profile
`GET /api/ai/managers/profile?fund_id=<uuid>&manager=<name>`

Response:
- `asOf`
- `dataLatency`
- `dataQuality`
- `item`:
  - `name`
  - `strategy`
  - `region`
  - `vehicleType`
  - `declaredTargetReturn` (optional, explicit only)
  - `reportingCadence`
  - `keyRisksDeclared[]`
  - `lastDocumentUpdate`
  - `sourceDocuments[]`

## 3) Obligation Register
`GET /api/ai/obligations/register?fund_id=<uuid>`

Response:
- `asOf`
- `dataLatency`
- `dataQuality`
- `items[]`:
  - `obligationId`
  - `source`
  - `obligationText`
  - `frequency`
  - `dueRule`
  - `responsibleParty`
  - `evidenceExpected`
  - `status` (`Open` | `Satisfied` | `MissingEvidence`)

## 4) Daily Governance Alerts
`GET /api/ai/alerts/daily?fund_id=<uuid>`

Response:
- `asOf`
- `dataLatency`
- `dataQuality`
- `items[]`:
  - `alertId`
  - `domain` (`Compliance` | `Risk` | `Provider` | `Reporting`)
  - `severity` (`Critical` | `Warning` | `Info`)
  - `entityRef`
  - `title`
  - `actionableNextStep`

## 5) Daily Cycle Trigger
`POST /api/ai/run-daily-cycle?fund_id=<uuid>`

Response:
- `asOf`
- `classifiedDocuments`
- `managerProfiles`
- `obligations`
- `alerts`
