# backend-roi-calculator

Minimal Node.js REST API placeholder service for:

- `POST /api/reports/pdf` - accepts calculation payload and returns a PDF file
- `GET /api/grants` - returns placeholder grants information

## Run

```bash
npm run start
```

Default port: `4000` (override with `PORT` env var).

## Endpoints

### Health

`GET /health`

### Placeholder PDF report

`POST /api/reports/pdf`

Request body: any JSON for now.

Returns: `application/pdf` (`roi-report-placeholder.pdf`).

Example:

```bash
curl -X POST http://localhost:4000/api/reports/pdf \
  -H 'Content-Type: application/json' \
  -d '{"option":"Robot","equipmentCost":100000}' \
  --output roi-report.pdf
```

### Placeholder grants

`GET /api/grants`

Optional query params accepted for now and echoed as metadata (e.g. `industry`, `country`).

Example:

```bash
curl 'http://localhost:4000/api/grants?industry=manufacturing&country=US'
```
