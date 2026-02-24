const GRANTS_CATALOG_VERSION = '2026-02-24';

const HARDCODED_GRANTS = [
    {
        id: 'mb-innovation-growth-program',
        name: 'Innovation Growth Program (IGP)',
        provider: 'Government of Manitoba',
        jurisdiction: 'MB',
        country: 'CA',
        programType: 'grant',
        status: 'intake-based',
        value: {
            currency: 'CAD',
            maxAmount: 100000,
            costSharePercent: 50,
            summary: 'Up to 50% of approved project costs, to a maximum of $100,000.'
        },
        summary: 'Supports Manitoba SMEs with implementation of innovative projects.',
        eligibilityFocus: ['manitoba-sme', 'business-growth', 'innovation'],
        sourceUrls: ['https://www.gov.mb.ca/jec/busdev/financial/igp/index.html'],
        lastVerifiedAt: '2026-02-24'
    },
    {
        id: 'mb-export-development-program',
        name: 'Export Development Program (EDP)',
        provider: 'Government of Manitoba',
        jurisdiction: 'MB',
        country: 'CA',
        programType: 'grant',
        status: 'open',
        value: {
            currency: 'CAD',
            maxAmount: 50000,
            maxAmountPerEvent: 20000,
            costSharePercentMin: 50,
            costSharePercentMax: 75,
            summary:
                'Up to $20,000 per event and up to $50,000 per company per year; 75% for international exhibitor events or 50% for attendee events.'
        },
        summary: 'Supports participation in national and international trade events.',
        eligibilityFocus: ['manitoba-sme', 'export', 'trade-shows'],
        sourceUrls: ['https://www.gov.mb.ca/jec/busdev/financial/export/edp.html'],
        lastVerifiedAt: '2026-02-24'
    },
    {
        id: 'mb-incoming-buyer-program',
        name: 'Incoming Buyer Program (IBP)',
        provider: 'Government of Manitoba',
        jurisdiction: 'MB',
        country: 'CA',
        programType: 'grant',
        status: 'open',
        value: {
            currency: 'CAD',
            maxAmount: 5000,
            costSharePercent: 50,
            summary: 'Up to $5,000 or 50% of approved costs, whichever is lower.'
        },
        summary: 'Supports hosting out-of-province or international buyers in Manitoba.',
        eligibilityFocus: ['manitoba-sme', 'export', 'business-development'],
        sourceUrls: ['https://www.gov.mb.ca/jec/busdev/financial/export/ibp.html'],
        lastVerifiedAt: '2026-02-24'
    },
    {
        id: 'ca-manitoba-job-grant',
        name: 'Canada-Manitoba Job Grant (CMJG)',
        provider: 'Government of Manitoba / Government of Canada',
        jurisdiction: 'MB',
        country: 'CA',
        programType: 'grant',
        status: 'closed',
        value: {
            currency: 'CAD',
            maxAmountPerTrainee: 10000,
            maxAmountPerEmployerPerYear: 10000,
            summary:
                'Up to $10,000 per trainee. Maximum annual grant to any one employer is $10,000.'
        },
        summary: 'Training grant to support workforce upskilling for employers.',
        eligibilityFocus: ['manitoba-employers', 'training', 'workforce-development'],
        sourceUrls: [
            'https://www.gov.mb.ca/wd/ites/is/cjg.html',
            'https://www.gov.mb.ca/wd/ites/is/cjg/Canada-Manitoba_Job_Grant_Employer_Fact_Sheet.pdf'
        ],
        lastVerifiedAt: '2026-02-24'
    },
    {
        id: 'ca-canexport-smes',
        name: 'CanExport SMEs',
        provider: 'Government of Canada',
        jurisdiction: 'Federal',
        country: 'CA',
        programType: 'grant',
        status: 'intake-window',
        value: {
            currency: 'CAD',
            minAmount: 10000,
            maxAmount: 50000,
            costSharePercent: 50,
            summary:
                'Contributions from $10,000 to $50,000 per project, covering up to 50% of eligible costs.'
        },
        summary: 'Supports SMEs entering new international markets.',
        eligibilityFocus: ['canadian-sme', 'export', 'market-development'],
        sourceUrls: ['https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes/applicants-guide-2026-27.html?wbdisable=true'],
        lastVerifiedAt: '2026-02-24',
        intakeWindow: {
            opens: '2026-02-04',
            closes: '2026-05-29'
        }
    },
    {
        id: 'ca-canexport-innovation',
        name: 'CanExport Innovation',
        provider: 'Government of Canada',
        jurisdiction: 'Federal',
        country: 'CA',
        programType: 'grant',
        status: 'intake-based',
        value: {
            currency: 'CAD',
            maxAmount: 37500,
            costSharePercent: 75,
            summary: 'Reimbursement of up to 75% of eligible costs to a maximum of $37,500.'
        },
        summary:
            'Supports Canadian organizations with international R&D collaboration and commercialization activities.',
        eligibilityFocus: ['canadian-business', 'innovation', 'rnd-collaboration'],
        sourceUrls: ['https://www.tradecommissioner.gc.ca/funding-financement/canexport/innovation/index.aspx?lang=eng'],
        lastVerifiedAt: '2026-02-24'
    }
];

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function uniqueByName(grants) {
    const seen = new Set();
    const unique = [];

    for (const grant of grants) {
        const key = normalizeText(grant.name);
        if (!key || seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(grant);
    }

    return unique;
}

function matchesFilter(grant, filters) {
    const country = normalizeText(filters.country);
    if (country && grant.country.toLowerCase() !== country) {
        return false;
    }

    const region = normalizeText(filters.region);
    if (region && grant.jurisdiction.toLowerCase() !== region) {
        return false;
    }

    const industry = normalizeText(filters.industry);
    if (industry) {
        const text = [
            grant.name,
            grant.summary,
            grant.programType,
            ...(Array.isArray(grant.eligibilityFocus) ? grant.eligibilityFocus : [])
        ]
            .join(' ')
            .toLowerCase();

        if (!text.includes(industry)) {
            return false;
        }
    }

    return true;
}

function buildHardcodedGrantsResponse(queryParams) {
    const filtersReceived = {
        industry: queryParams.get('industry') || null,
        country: queryParams.get('country') || null,
        region: queryParams.get('region') || null,
        companySize: queryParams.get('companySize') || null
    };

    const filtered = uniqueByName(HARDCODED_GRANTS).filter((grant) => matchesFilter(grant, filtersReceived));

    return {
        generatedAt: new Date().toISOString(),
        catalogVersion: GRANTS_CATALOG_VERSION,
        source: 'hardcoded-catalog',
        filtersReceived,
        grants: filtered
    };
}

module.exports = {
    HARDCODED_GRANTS,
    GRANTS_CATALOG_VERSION,
    buildHardcodedGrantsResponse
};
