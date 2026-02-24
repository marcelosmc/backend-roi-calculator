function escapePdfText(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function wrapLine(text, maxChars) {
    const words = String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return [''];
    }

    const lines = [];
    let current = words[0];

    for (let index = 1; index < words.length; index += 1) {
        const next = words[index];
        if (`${current} ${next}`.length <= maxChars) {
            current = `${current} ${next}`;
            continue;
        }

        lines.push(current);
        current = next;
    }

    lines.push(current);
    return lines;
}

function buildSimplePdf(lines) {
    const safeLines = lines.slice(0, 42);
    const textOperations = safeLines
        .map((line, index) => {
            const y = 770 - index * 18;
            return `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
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

function textToPdfLines(reportText, companyName, generatedAtIso) {
    const lines = ['Business Case Report', `Company: ${companyName}`, `Generated at: ${generatedAtIso}`, ''];
    const sections = String(reportText || '')
        .replace(/\r\n/g, '\n')
        .split('\n');

    for (const sectionLine of sections) {
        if (!sectionLine.trim()) {
            lines.push('');
            continue;
        }

        const wrapped = wrapLine(sectionLine, 95);
        lines.push(...wrapped);
    }

    if (lines.length > 42) {
        return [...lines.slice(0, 41), '[Report truncated for one-page PDF output]'];
    }

    return lines;
}

function buildBusinessCasePdf(reportText, companyName) {
    const generatedAtIso = new Date().toISOString();
    const lines = textToPdfLines(reportText, companyName, generatedAtIso);
    return buildSimplePdf(lines);
}

module.exports = {
    buildBusinessCasePdf
};
