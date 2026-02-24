const http = require('node:http');
const { URL } = require('node:url');
const { loadLocalEnv } = require('./env');
const { buildReportContractFromPayload } = require('./roi');
const { generateBusinessCaseReport } = require('./report-llm');
const { buildBusinessCasePdf } = require('./report-pdf');

loadLocalEnv();

const PORT = Number(process.env.PORT || 4000);
const MAX_BODY_SIZE_BYTES = 1_000_000;

function applyCors(response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(response, statusCode, data) {
    applyCors(response);
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(data));
}

function sendPdf(response, pdfBuffer, filename) {
    applyCors(response);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', String(pdfBuffer.length));
    response.end(pdfBuffer);
}

function parseJsonBody(request, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;

        request.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                reject(new Error('Payload too large'));
                request.destroy();
                return;
            }

            chunks.push(chunk);
        });

        request.on('end', () => {
            if (chunks.length === 0) {
                resolve({});
                return;
            }

            try {
                const rawBody = Buffer.concat(chunks).toString('utf8');
                resolve(JSON.parse(rawBody));
            } catch {
                reject(new Error('Invalid JSON payload'));
            }
        });

        request.on('error', (error) => {
            reject(error);
        });
    });
}

function mapErrorToStatusCode(message) {
    if (message === 'Payload too large') {
        return 413;
    }

    if (message === 'Invalid JSON payload') {
        return 400;
    }

    if (message.startsWith('Invalid report payload')) {
        return 400;
    }

    if (message.startsWith('OPENAI_API_KEY is not configured')) {
        return 500;
    }

    if (message.startsWith('OpenAI request failed')) {
        return 502;
    }

    return 500;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatTimestampForReportFilename(date) {
    return [
        date.getFullYear(),
        '-',
        pad2(date.getMonth() + 1),
        '-',
        pad2(date.getDate()),
        '-',
        pad2(date.getHours()),
        ':',
        pad2(date.getMinutes())
    ].join('');
}

function sanitizeCompanyNameForFilename(companyName) {
    const normalized = String(companyName || '')
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/\s+/g, ' ');

    return normalized || 'company';
}

function buildReportFilename(companyName) {
    const timestamp = formatTimestampForReportFilename(new Date());
    const safeCompanyName = sanitizeCompanyNameForFilename(companyName);
    return `${timestamp}-${safeCompanyName}.pdf`;
}

function getContractHint() {
    return {
        acceptedInputShapes: [
            'Request body as RoiCalculationInput directly',
            '{ "calculationInput": RoiCalculationInput }',
            '{ "input": RoiCalculationInput }'
        ],
        optionalOutputShapes: ['{ "calculationResult": RoiCalculationResult }', '{ "result": RoiCalculationResult }'],
        requiredFields: [
            'investment.equipmentCost',
            'labour.fteReduced',
            'labour.fullyLoadedAnnualCostPerFte',
            'financial.timeHorizonYears'
        ],
        optionalContextShape: {
            reportContext: {
                objective: 'string',
                audience: 'string',
                constraints: 'string',
                additionalContext: 'string'
            }
        }
    };
}

async function buildReportFromPayload(payload) {
    const { errors, contract } = buildReportContractFromPayload(payload);

    if (errors.length > 0) {
        const error = new Error(`Invalid report payload: ${errors.join(' ')}`);
        error.details = errors;
        throw error;
    }

    const reportText = await generateBusinessCaseReport(contract);
    return { contract, reportText };
}

function buildPlaceholderGrants(queryParams) {
    return {
        generatedAt: new Date().toISOString(),
        filtersReceived: {
            industry: queryParams.get('industry') || null,
            country: queryParams.get('country') || null,
            region: queryParams.get('region') || null,
            companySize: queryParams.get('companySize') || null
        },
        grants: [
            {
                id: 'placeholder-grant-1',
                name: 'Automation Modernization Grant',
                provider: 'National Innovation Office',
                summary: 'Covers part of equipment and integration costs for technology adoption.',
                maxAmount: 50000,
                currency: 'USD',
                status: 'placeholder'
            },
            {
                id: 'placeholder-grant-2',
                name: 'AI Adoption Voucher',
                provider: 'Regional Digital Agency',
                summary: 'Supports pilot projects using AI to improve productivity in SMEs.',
                maxAmount: 15000,
                currency: 'USD',
                status: 'placeholder'
            }
        ]
    };
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const { pathname, searchParams } = requestUrl;
    const method = request.method || 'GET';

    if (method === 'OPTIONS') {
        applyCors(response);
        response.statusCode = 204;
        response.end();
        return;
    }

    if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, { status: 'ok', service: 'backend-roi-calculator' });
        return;
    }

    if (method === 'POST' && pathname === '/api/reports/pdf') {
        try {
            const payload = await parseJsonBody(request, MAX_BODY_SIZE_BYTES);
            const { contract, reportText } = await buildReportFromPayload(payload);
            const pdfBuffer = buildBusinessCasePdf(reportText, contract.companyName);
            const filename = buildReportFilename(contract.companyName);
            sendPdf(response, pdfBuffer, filename);
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const statusCode = mapErrorToStatusCode(message);
            sendJson(response, statusCode, {
                error: message,
                details: error && typeof error === 'object' && 'details' in error ? error.details : undefined,
                contractHint: statusCode === 400 ? getContractHint() : undefined
            });
            return;
        }
    }

    if (method === 'POST' && pathname === '/api/reports/preview') {
        try {
            const payload = await parseJsonBody(request, MAX_BODY_SIZE_BYTES);
            const { contract, reportText } = await buildReportFromPayload(payload);

            sendJson(response, 200, {
                companyName: contract.companyName,
                calculationInput: contract.calculationInput,
                calculationResult: contract.calculationResult,
                reportText
            });
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const statusCode = mapErrorToStatusCode(message);
            sendJson(response, statusCode, {
                error: message,
                details: error && typeof error === 'object' && 'details' in error ? error.details : undefined,
                contractHint: statusCode === 400 ? getContractHint() : undefined
            });
            return;
        }
    }

    if (method === 'GET' && pathname === '/api/grants') {
        sendJson(response, 200, buildPlaceholderGrants(searchParams));
        return;
    }

    sendJson(response, 404, {
        error: 'Not Found',
        message:
            'Available endpoints: GET /health, POST /api/reports/pdf, POST /api/reports/preview, GET /api/grants'
    });
});

server.listen(PORT, () => {
    console.log(`backend-roi-calculator listening on http://localhost:${PORT}`);
});
