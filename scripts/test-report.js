const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_PORT = Number(process.env.TEST_REPORT_PORT || 4107);
const DEFAULT_PAYLOAD = path.join(projectRoot, 'examples', 'report-request.json');
const DEFAULT_OUTPUT = path.join(projectRoot, 'tmp', 'roi-business-case-report.pdf');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        mock: false,
        preview: false,
        payloadPath: DEFAULT_PAYLOAD,
        outputPath: DEFAULT_OUTPUT
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--mock') {
            parsed.mock = true;
            continue;
        }

        if (arg === '--preview') {
            parsed.preview = true;
            continue;
        }

        if (arg === '--payload' && args[index + 1]) {
            parsed.payloadPath = path.resolve(process.cwd(), args[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--output' && args[index + 1]) {
            parsed.outputPath = path.resolve(process.cwd(), args[index + 1]);
            index += 1;
            continue;
        }
    }

    return parsed;
}

async function waitForHealth(baseUrl, timeoutMs = 12000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) {
                return;
            }
        } catch {
            // Server not ready yet.
        }

        await sleep(250);
    }

    throw new Error(`Server did not become healthy within ${timeoutMs}ms.`);
}

function startServer({ port, mock }) {
    const env = {
        ...process.env,
        PORT: String(port)
    };

    if (mock) {
        env.REPORT_LLM_MODE = 'mock';
    }

    const server = spawn(process.execPath, ['src/server.js'], {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    server.stdout.on('data', (chunk) => {
        process.stdout.write(`[server] ${chunk.toString('utf8')}`);
    });

    server.stderr.on('data', (chunk) => {
        process.stderr.write(`[server] ${chunk.toString('utf8')}`);
    });

    return server;
}

async function callPreview(baseUrl, payload) {
    const response = await fetch(`${baseUrl}/api/reports/preview`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const bodyText = await response.text();
    if (!response.ok) {
        throw new Error(`Preview failed (${response.status}): ${bodyText}`);
    }

    const parsed = JSON.parse(bodyText);
    console.log('\n--- Report Preview ---\n');
    console.log(parsed.reportText);
}

async function callPdf(baseUrl, payload, outputPath) {
    const response = await fetch(`${baseUrl}/api/reports/pdf`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`PDF generation failed (${response.status}): ${bodyText}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, bytes);
    console.log(`\nPDF written to ${outputPath}`);
}

async function main() {
    const options = parseArgs();
    const payload = JSON.parse(fs.readFileSync(options.payloadPath, 'utf8'));
    const port = DEFAULT_PORT;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Starting local server on ${baseUrl}...`);
    const server = startServer({ port, mock: options.mock });

    try {
        await waitForHealth(baseUrl);
        console.log('Server is healthy.');

        if (options.preview) {
            await callPreview(baseUrl, payload);
        } else {
            await callPdf(baseUrl, payload, options.outputPath);
        }
    } finally {
        server.kill('SIGTERM');
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
