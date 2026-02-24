const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 34;
const CARD_X = PAGE_MARGIN;
const CARD_Y = PAGE_MARGIN;
const CARD_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CARD_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2;
const CARD_TOP = CARD_Y + CARD_HEIGHT;
const CONTENT_X = CARD_X + 28;
const CONTENT_WIDTH = CARD_WIDTH - 56;
const CONTENT_BOTTOM_Y = CARD_Y + 66;

const FIRST_PAGE_BANNER_HEIGHT = 82;
const CONTINUATION_PAGE_BANNER_HEIGHT = 54;
const FIRST_PAGE_CONTENT_START_Y = CARD_TOP - FIRST_PAGE_BANNER_HEIGHT - 58;
const CONTINUATION_CONTENT_START_Y = CARD_TOP - CONTINUATION_PAGE_BANNER_HEIGHT - 30;

const HEADING_LOOKUP = {
    'executive summary': 'Executive Summary',
    'financial case': 'Financial Case',
    'strategic impact': 'Strategic Impact',
    recommendation: 'Recommendation'
};

function formatNumber(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return Number(value.toFixed(2)).toString();
}

function sanitizePdfText(value) {
    return String(value || '')
        .replace(/\r?\n/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapePdfText(value) {
    return sanitizePdfText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function trimWithEllipsis(value, maxChars) {
    const safe = sanitizePdfText(value);
    if (safe.length <= maxChars) {
        return safe;
    }

    return `${safe.slice(0, maxChars - 3)}...`;
}

function estimateMaxCharsForWidth(maxWidth, fontSize) {
    return Math.max(16, Math.floor(maxWidth / (fontSize * 0.53)));
}

function wrapText(text, maxChars) {
    const safe = sanitizePdfText(text);
    if (!safe) {
        return [];
    }

    const words = safe.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }

    const lines = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            if (word.length <= maxChars) {
                current = word;
                continue;
            }

            for (let index = 0; index < word.length; index += maxChars) {
                lines.push(word.slice(index, index + maxChars));
            }
            continue;
        }

        const candidate = `${current} ${word}`;
        if (candidate.length <= maxChars) {
            current = candidate;
            continue;
        }

        lines.push(current);
        if (word.length <= maxChars) {
            current = word;
            continue;
        }

        for (let index = 0; index < word.length; index += maxChars) {
            const chunk = word.slice(index, index + maxChars);
            if (chunk.length === maxChars || index + maxChars < word.length) {
                lines.push(chunk);
            } else {
                current = chunk;
            }
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines;
}

function normalizeHeading(line) {
    const normalized = sanitizePdfText(line).toLowerCase().replace(/[:\s]+$/g, '').trim();
    return HEADING_LOOKUP[normalized] || null;
}

function buildContentTokens(reportText) {
    const rawLines = String(reportText || '')
        .replace(/\r\n/g, '\n')
        .split('\n');
    const tokens = [];

    for (const rawLine of rawLines) {
        const line = rawLine.trim();
        if (!line) {
            tokens.push({ type: 'spacer', height: 8 });
            continue;
        }

        const heading = normalizeHeading(line);
        if (heading) {
            tokens.push({ type: 'heading', text: heading, height: 24 });
            continue;
        }

        const wrapped = wrapText(line, estimateMaxCharsForWidth(CONTENT_WIDTH, 11));
        for (const wrappedLine of wrapped) {
            tokens.push({ type: 'paragraph', text: wrappedLine, height: 15 });
        }
    }

    const compacted = [];
    for (const token of tokens) {
        if (token.type === 'spacer') {
            const previous = compacted[compacted.length - 1];
            if (!previous || previous.type === 'spacer') {
                continue;
            }
        }

        compacted.push(token);
    }

    if (compacted.length === 0) {
        compacted.push({ type: 'paragraph', text: 'No report content available.', height: 15 });
    }

    return compacted;
}

function paginateTokens(tokens) {
    const pages = [[]];
    let pageIndex = 0;
    let y = FIRST_PAGE_CONTENT_START_Y;

    for (const token of tokens) {
        if (y - token.height < CONTENT_BOTTOM_Y) {
            pageIndex += 1;
            pages[pageIndex] = [];
            y = CONTINUATION_CONTENT_START_Y;
        }

        pages[pageIndex].push({
            ...token,
            y
        });
        y -= token.height;
    }

    return pages;
}

function opSetFillColor(red, green, blue) {
    return `${formatNumber(red)} ${formatNumber(green)} ${formatNumber(blue)} rg`;
}

function opSetStrokeColor(red, green, blue) {
    return `${formatNumber(red)} ${formatNumber(green)} ${formatNumber(blue)} RG`;
}

function opSetLineWidth(width) {
    return `${formatNumber(width)} w`;
}

function opFillRect(x, y, width, height) {
    return `${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re f`;
}

function opStrokeRect(x, y, width, height) {
    return `${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re S`;
}

function opStrokeLine(x1, y1, x2, y2) {
    return `${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`;
}

function opDrawText(fontName, fontSize, x, y, text) {
    return `BT /${fontName} ${formatNumber(fontSize)} Tf 1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm (${escapePdfText(text)}) Tj ET`;
}

function buildFirstPageMetadata(operations, companyName, generatedAtDisplay) {
    const boxGap = 12;
    const boxHeight = 34;
    const boxY = CARD_TOP - FIRST_PAGE_BANNER_HEIGHT - 44;
    const boxWidth = (CARD_WIDTH - 56 - boxGap) / 2;
    const leftBoxX = CONTENT_X;
    const rightBoxX = CONTENT_X + boxWidth + boxGap;

    operations.push(opSetFillColor(0.93, 0.95, 0.98));
    operations.push(opFillRect(leftBoxX, boxY, boxWidth, boxHeight));
    operations.push(opFillRect(rightBoxX, boxY, boxWidth, boxHeight));

    operations.push(opSetFillColor(0.2, 0.31, 0.49));
    operations.push(opDrawText('F2', 8.5, leftBoxX + 10, boxY + 21, 'COMPANY'));
    operations.push(opDrawText('F2', 8.5, rightBoxX + 10, boxY + 21, 'GENERATED'));

    operations.push(opSetFillColor(0.16, 0.19, 0.25));
    operations.push(opDrawText('F1', 9.5, leftBoxX + 10, boxY + 9, trimWithEllipsis(companyName, 52)));
    operations.push(opDrawText('F1', 9.5, rightBoxX + 10, boxY + 9, trimWithEllipsis(generatedAtDisplay, 46)));
}

function buildPageStream(placedTokens, pageNumber, totalPages, companyName, generatedAtDisplay) {
    const isFirstPage = pageNumber === 1;
    const bannerHeight = isFirstPage ? FIRST_PAGE_BANNER_HEIGHT : CONTINUATION_PAGE_BANNER_HEIGHT;
    const bannerY = CARD_TOP - bannerHeight;
    const contentStartY = isFirstPage ? FIRST_PAGE_CONTENT_START_Y : CONTINUATION_CONTENT_START_Y;

    const operations = [];

    operations.push(opSetFillColor(0.96, 0.97, 0.98));
    operations.push(opFillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT));

    operations.push(opSetFillColor(1, 1, 1));
    operations.push(opFillRect(CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT));
    operations.push(opSetStrokeColor(0.84, 0.87, 0.91));
    operations.push(opSetLineWidth(1));
    operations.push(opStrokeRect(CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT));

    operations.push(opSetFillColor(0.12, 0.24, 0.45));
    operations.push(opFillRect(CARD_X, bannerY, CARD_WIDTH, bannerHeight));
    operations.push(opSetFillColor(0.93, 0.64, 0.19));
    operations.push(opFillRect(CARD_X, CARD_TOP - 4, CARD_WIDTH, 4));

    operations.push(opSetFillColor(1, 1, 1));
    operations.push(
        opDrawText(
            'F2',
            isFirstPage ? 20 : 14,
            CONTENT_X,
            isFirstPage ? bannerY + 48 : bannerY + 31,
            isFirstPage ? 'Internal ROI Business Case' : 'Internal ROI Business Case (Continued)'
        )
    );
    operations.push(
        opDrawText(
            'F1',
            isFirstPage ? 10 : 9,
            CONTENT_X,
            isFirstPage ? bannerY + 30 : bannerY + 15,
            trimWithEllipsis(companyName, 70)
        )
    );

    if (isFirstPage) {
        buildFirstPageMetadata(operations, companyName, generatedAtDisplay);
    }

    operations.push(opSetStrokeColor(0.87, 0.9, 0.94));
    operations.push(opSetLineWidth(1));
    operations.push(opStrokeLine(CONTENT_X, contentStartY + 14, CONTENT_X + CONTENT_WIDTH, contentStartY + 14));

    for (const token of placedTokens) {
        if (token.type === 'spacer') {
            continue;
        }

        if (token.type === 'heading') {
            operations.push(opSetFillColor(0.14, 0.25, 0.45));
            operations.push(opDrawText('F2', 13, CONTENT_X, token.y, token.text));
            continue;
        }

        if (token.type === 'paragraph') {
            operations.push(opSetFillColor(0.19, 0.22, 0.27));
            operations.push(opDrawText('F1', 11, CONTENT_X, token.y, token.text));
        }
    }

    operations.push(opSetStrokeColor(0.87, 0.9, 0.94));
    operations.push(opStrokeLine(CONTENT_X, CARD_Y + 48, CONTENT_X + CONTENT_WIDTH, CARD_Y + 48));
    operations.push(opSetFillColor(0.37, 0.41, 0.47));
    operations.push(opDrawText('F1', 9, CONTENT_X, CARD_Y + 34, trimWithEllipsis(companyName, 58)));
    operations.push(opDrawText('F1', 9, CARD_X + CARD_WIDTH - 76, CARD_Y + 34, `Page ${pageNumber} of ${totalPages}`));

    return `${operations.join('\n')}\n`;
}

function buildPdfFromPageStreams(pageStreams) {
    const objects = [null];

    function addObject(content) {
        objects.push(content);
        return objects.length - 1;
    }

    const catalogObjectNumber = addObject('');
    const pagesObjectNumber = addObject('');

    const contentObjectNumbers = pageStreams.map((stream) =>
        addObject(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream`)
    );

    const regularFontObjectNumber = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontObjectNumber = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const pageObjectNumbers = contentObjectNumbers.map((contentObjectNumber) =>
        addObject(
            `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontObjectNumber} 0 R /F2 ${boldFontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
        )
    );

    objects[pagesObjectNumber] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((pageNumber) => `${pageNumber} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;
    objects[catalogObjectNumber] = `<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
        offsets[objectNumber] = Buffer.byteLength(pdf, 'utf8');
        pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');

    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';

    for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
        pdf += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
}

function formatGeneratedTimestamp(isoTimestamp) {
    return String(isoTimestamp)
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC');
}

function buildBusinessCasePdf(reportText, companyName) {
    const generatedAtIso = new Date().toISOString();
    const generatedAtDisplay = formatGeneratedTimestamp(generatedAtIso);

    const tokens = buildContentTokens(reportText);
    const placedPages = paginateTokens(tokens);
    const totalPages = placedPages.length;

    const pageStreams = placedPages.map((placedTokens, index) =>
        buildPageStream(placedTokens, index + 1, totalPages, companyName, generatedAtDisplay)
    );

    return buildPdfFromPageStreams(pageStreams);
}

module.exports = {
    buildBusinessCasePdf
};
