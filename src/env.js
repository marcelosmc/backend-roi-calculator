const fs = require('node:fs');
const path = require('node:path');

function parseEnvLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
        return null;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
        return null;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) {
        return null;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }

    return { key, value };
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
        const parsed = parseEnvLine(line);
        if (!parsed) {
            continue;
        }

        if (process.env[parsed.key] === undefined) {
            process.env[parsed.key] = parsed.value;
        }
    }
}

function loadLocalEnv() {
    const cwd = process.cwd();
    const candidates = ['.env.local', '.env'];

    for (const fileName of candidates) {
        loadEnvFile(path.join(cwd, fileName));
    }
}

module.exports = {
    loadLocalEnv
};
