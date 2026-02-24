const http = require('node:http');
const { URL } = require('node:url');

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

function escapePdfText(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
    const textOperations = lines
        .map((line, index) => {
            const y = 760 - index * 20;
            return `BT /F1 12 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
        })
        .join('\n');

    const stream = `${textOperations}\n`;

    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
        `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream\nendobj\n`,
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const objectText of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += objectText;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');

    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index <= objects.length; index += 1) {
        pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
}

function buildPlaceholderReportPdf(payload) {
    const payloadKeys = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 10) : [];
    const keysText = payloadKeys.length > 0 ? payloadKeys.join(', ') : 'none';

    const lines = [
        'ROI Report Placeholder',
        `Generated at: ${new Date().toISOString()}`,
        `Payload keys: ${keysText}`,
        'Replace this endpoint with LLM-powered report generation.'
    ];

    return buildSimplePdf(lines);
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
            const pdfBuffer = buildPlaceholderReportPdf(payload);
            sendPdf(response, pdfBuffer, 'roi-report-placeholder.pdf');
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const statusCode = message === 'Payload too large' ? 413 : 400;
            sendJson(response, statusCode, { error: message });
            return;
        }
    }

    if (method === 'GET' && pathname === '/api/grants') {
        sendJson(response, 200, buildPlaceholderGrants(searchParams));
        return;
    }

    sendJson(response, 404, {
        error: 'Not Found',
        message: 'Available endpoints: GET /health, POST /api/reports/pdf, GET /api/grants'
    });
});

server.listen(PORT, () => {
    console.log(`backend-roi-calculator listening on http://localhost:${PORT}`);
});
