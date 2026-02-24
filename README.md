# backend-roi-calculator

Node.js backend service for ROI reporting:

- `POST /api/reports/pdf` - builds ROI contract from calculator input/output, calls ChatGPT, returns PDF
- `POST /api/reports/preview` - same flow, returns JSON report text for easier backend-only testing
- `GET /api/grants` - placeholder grants data

## Run

```bash
npm run start
```

Default port: `4000` (override with `PORT` env var).

## Environment Variables

Create a local secret file (not committed):

```bash
cp .env.example .env.local
```

Required for live LLM call:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `REPORT_LLM_MODE=mock` for offline/mock report text generation

## `/api/reports/pdf` Contract

Accepted request shapes:

1. Request body is `RoiCalculationInput` directly
2. `{ "calculationInput": RoiCalculationInput }`
3. `{ "input": RoiCalculationInput }`

Optional additional fields:

- `calculationResult` or `result` (`RoiCalculationResult`) for future iterations
- `reportContext`:
  - `objective`
  - `audience`
  - `constraints`
  - `additionalContext`

Required MVP fields:

- `investment.equipmentCost`
- `labour.fteReduced`
- `labour.fullyLoadedAnnualCostPerFte`
- `financial.timeHorizonYears`

Company name is currently hardcoded in report generation as:

- `Southern Manitoba Tech Conference`

## Test Without Frontend

Sample payload: `examples/report-request.json`

Mock/full flow (recommended first):

```bash
npm run test:report
```

Live OpenAI flow:

```bash
npm run test:report:live
```

Preview text only (no PDF):

```bash
npm run test:report:preview
```
