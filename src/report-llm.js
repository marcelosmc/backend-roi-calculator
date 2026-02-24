function formatMoney(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'N/A';
    }

    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0
    }).format(value);
}

function formatPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'N/A';
    }

    return `${value.toFixed(1)}%`;
}

function formatYears(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'N/A';
    }

    return `${value.toFixed(2)} years`;
}

function buildPromptData(contract) {
    const result = contract.calculationResult;

    return {
        companyName: contract.companyName,
        optionName: result.optionName || 'Automation Initiative',
        metrics: {
            effectiveInvestment: formatMoney(result.investment.effectiveInvestment),
            initialInvestment: formatMoney(result.investment.initialInvestment),
            netAnnualBenefit: formatMoney(result.annual.netAnnualBenefit),
            labourSavings: formatMoney(result.annual.labourSavings),
            totalAnnualBenefits: formatMoney(result.annual.totalBenefits),
            annualOperatingCosts: formatMoney(result.annual.operatingCosts),
            paybackYears: formatYears(result.payback.paybackYears),
            paybackMonths:
                typeof result.payback.paybackMonths === 'number' ? `${result.payback.paybackMonths} months` : 'N/A',
            roiPercent: formatPercent(result.horizon.roiPercent),
            npv: formatMoney(result.npv.value),
            timeHorizonYears: result.horizon.years
        },
        notes: result.notes,
        providedCalculationResult: contract.providedCalculationResult,
        reportContext: contract.reportContext
    };
}

function buildReportPrompt(contract) {
    const promptData = buildPromptData(contract);
    return [
        {
            role: 'system',
            content:
                'You write concise, formal business cases for internal capital approval. Return plain text only. Do not use markdown tables.'
        },
        {
            role: 'user',
            content: [
                'Create a persuasive but factual business case report for internal approval.',
                'Use this exact section order and titles:',
                'Executive Summary',
                'Financial Case',
                'Strategic Impact',
                'Recommendation',
                'Requirements:',
                '- Keep it under 220 words total.',
                '- Mention effective investment, annual net benefit, payback period, ROI, and NPV when available.',
                '- If a metric is unavailable, state that briefly without blocking recommendation.',
                '- Keep language formal, clear, and decision-ready.',
                `Data:\n${JSON.stringify(promptData, null, 2)}`
            ].join('\n')
        }
    ];
}

function buildMockReport(contract) {
    const result = contract.calculationResult;
    const paybackYears =
        typeof result.payback.paybackYears === 'number' ? `${result.payback.paybackYears.toFixed(2)} years` : 'N/A';
    const paybackMonths =
        typeof result.payback.paybackMonths === 'number' ? `${result.payback.paybackMonths} months` : 'N/A';
    const roi = typeof result.horizon.roiPercent === 'number' ? `${result.horizon.roiPercent.toFixed(1)}%` : 'N/A';
    const npv = formatMoney(result.npv.value);

    return [
        'Executive Summary',
        `${contract.companyName} can proceed with the proposed automation initiative to improve operating performance and financial resilience.`,
        '',
        'Financial Case',
        `Effective investment is ${formatMoney(result.investment.effectiveInvestment)}, with expected annual net benefit of ${formatMoney(result.annual.netAnnualBenefit)}. Estimated payback is ${paybackYears} (${paybackMonths}), ROI is ${roi}, and NPV is ${npv}.`,
        '',
        'Strategic Impact',
        'The initiative is expected to reduce labor pressure, improve process reliability, and support scalable growth while controlling recurring costs.',
        '',
        'Recommendation',
        'Approve the initiative with standard implementation controls and quarterly benefit tracking to confirm realization against the business case.'
    ].join('\n');
}

async function generateBusinessCaseReport(contract) {
    const mode = process.env.REPORT_LLM_MODE || 'live';
    if (mode === 'mock') {
        return buildMockReport(contract);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured. Add it to .env.local or environment variables.');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const endpoint = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: buildReportPrompt(contract)
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI request failed with ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenAI response did not contain report text.');
    }

    return content.trim();
}

module.exports = {
    generateBusinessCaseReport
};
