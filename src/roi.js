const REPORT_COMPANY_NAME = 'Southern Manitoba Tech Conference';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseNumberish(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function readRequiredNumber(source, key, label, errors) {
    const parsed = parseNumberish(source[key]);
    if (parsed === null) {
        errors.push(`${label} is required and must be a finite number.`);
        return 0;
    }

    return parsed;
}

function readOptionalNumber(source, key) {
    const parsed = parseNumberish(source[key]);
    return parsed === null ? undefined : parsed;
}

function readOptionalNumberArray(source, key) {
    const value = source[key];
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value
        .map((item) => parseNumberish(item))
        .filter((item) => item !== null);
}

function normalizeOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeRoiInput(rawInput, errors) {
    const input = asObject(rawInput);
    const investment = asObject(input.investment);
    const labour = asObject(input.labour);
    const productivity = asObject(input.productivity);
    const annualSavings = asObject(input.annualSavings);
    const annualCosts = asObject(input.annualCosts);
    const financial = asObject(input.financial);

    const normalizedInput = {
        optionName: normalizeOptionalString(input.optionName),
        investment: {
            equipmentCost: readRequiredNumber(investment, 'equipmentCost', 'investment.equipmentCost', errors),
            installationCost: readOptionalNumber(investment, 'installationCost'),
            integrationCost: readOptionalNumber(investment, 'integrationCost'),
            trainingCost: readOptionalNumber(investment, 'trainingCost'),
            downtimeCost: readOptionalNumber(investment, 'downtimeCost'),
            otherUpfrontCosts: readOptionalNumber(investment, 'otherUpfrontCosts'),
            additionalUpfrontCosts: readOptionalNumberArray(investment, 'additionalUpfrontCosts'),
            grantPercent: readOptionalNumber(investment, 'grantPercent'),
            grantAmount: readOptionalNumber(investment, 'grantAmount')
        },
        labour: {
            fteReduced: readRequiredNumber(labour, 'fteReduced', 'labour.fteReduced', errors),
            fullyLoadedAnnualCostPerFte: readRequiredNumber(
                labour,
                'fullyLoadedAnnualCostPerFte',
                'labour.fullyLoadedAnnualCostPerFte',
                errors
            )
        },
        productivity:
            Object.keys(productivity).length > 0
                ? {
                      annualProfitIncrease: readOptionalNumber(productivity, 'annualProfitIncrease'),
                      currentUnitsPerYear: readOptionalNumber(productivity, 'currentUnitsPerYear'),
                      productivityGainPercent: readOptionalNumber(productivity, 'productivityGainPercent'),
                      profitPerUnit: readOptionalNumber(productivity, 'profitPerUnit')
                  }
                : undefined,
        annualSavings:
            Object.keys(annualSavings).length > 0
                ? {
                      scrapSavings: readOptionalNumber(annualSavings, 'scrapSavings'),
                      overtimeSavings: readOptionalNumber(annualSavings, 'overtimeSavings'),
                      qualityWarrantySavings: readOptionalNumber(annualSavings, 'qualityWarrantySavings'),
                      otherSavings: readOptionalNumber(annualSavings, 'otherSavings'),
                      additionalSavings: readOptionalNumberArray(annualSavings, 'additionalSavings')
                  }
                : undefined,
        annualCosts:
            Object.keys(annualCosts).length > 0
                ? {
                      maintenanceCost: readOptionalNumber(annualCosts, 'maintenanceCost'),
                      softwareSubscription: readOptionalNumber(annualCosts, 'softwareSubscription'),
                      energyDelta: readOptionalNumber(annualCosts, 'energyDelta'),
                      otherAnnualCosts: readOptionalNumber(annualCosts, 'otherAnnualCosts'),
                      additionalAnnualCosts: readOptionalNumberArray(annualCosts, 'additionalAnnualCosts')
                  }
                : undefined,
        financial: {
            timeHorizonYears: readRequiredNumber(financial, 'timeHorizonYears', 'financial.timeHorizonYears', errors),
            discountRate: readOptionalNumber(financial, 'discountRate')
        }
    };

    return normalizedInput;
}

function normalizeReportContext(rawContext) {
    const context = asObject(rawContext);

    return {
        objective: normalizeOptionalString(context.objective),
        audience: normalizeOptionalString(context.audience),
        constraints: normalizeOptionalString(context.constraints),
        additionalContext: normalizeOptionalString(context.additionalContext)
    };
}

function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function nonNegative(value) {
    return Math.max(0, toNumber(value));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function sum(values) {
    let total = 0;
    for (const value of values) {
        total += toNumber(value);
    }

    return total;
}

function sumArray(values) {
    if (!Array.isArray(values)) {
        return 0;
    }

    return values.reduce((accumulator, value) => accumulator + toNumber(value), 0);
}

function sumPositiveArray(values) {
    if (!Array.isArray(values)) {
        return 0;
    }

    return values.reduce((accumulator, value) => accumulator + nonNegative(value), 0);
}

function normalizeOptionName(optionName) {
    const normalized = typeof optionName === 'string' ? optionName.trim() : '';
    return normalized ? normalized : null;
}

function normalizeTimeHorizonYears(rawYears, notes) {
    const years = Number.isFinite(rawYears) ? Math.floor(rawYears) : 0;
    if (years >= 1) {
        return years;
    }

    notes.push('timeHorizonYears must be at least 1. Defaulted to 1 year.');
    return 1;
}

function computeGrant(initialInvestment, grantPercentRaw, grantAmountRaw, notes) {
    const hasGrantPercent = isFiniteNumber(grantPercentRaw);
    const hasGrantAmount = isFiniteNumber(grantAmountRaw);

    if (hasGrantPercent && hasGrantAmount) {
        notes.push('Both grantPercent and grantAmount were provided. grantAmount was applied.');
    }

    if (hasGrantAmount) {
        const grantAmount = nonNegative(grantAmountRaw);
        const grantAppliedAmount = Math.min(initialInvestment, grantAmount);
        return {
            grantType: 'amount',
            grantAppliedAmount,
            effectiveInvestment: Math.max(0, initialInvestment - grantAppliedAmount)
        };
    }

    if (hasGrantPercent) {
        const rawPercent = toNumber(grantPercentRaw);
        const grantPercent = clamp(rawPercent, 0, 1);
        if (grantPercent !== rawPercent) {
            notes.push('grantPercent was clamped to the 0-1 range.');
        }

        const grantAppliedAmount = initialInvestment * grantPercent;
        return {
            grantType: 'percent',
            grantAppliedAmount,
            effectiveInvestment: Math.max(0, initialInvestment - grantAppliedAmount)
        };
    }

    return {
        grantType: 'none',
        grantAppliedAmount: 0,
        effectiveInvestment: initialInvestment
    };
}

function computeProductivity(productivity) {
    if (!productivity) {
        return {
            mode: 'direct',
            extraUnitsPerYear: null,
            annualProductivityProfit: 0
        };
    }

    if (isFiniteNumber(productivity.annualProfitIncrease)) {
        return {
            mode: 'direct',
            extraUnitsPerYear: null,
            annualProductivityProfit: toNumber(productivity.annualProfitIncrease)
        };
    }

    const currentUnitsPerYear = toNumber(productivity.currentUnitsPerYear);
    const productivityGainPercent = toNumber(productivity.productivityGainPercent);
    const profitPerUnit = toNumber(productivity.profitPerUnit);
    const extraUnitsPerYear = currentUnitsPerYear * productivityGainPercent;

    return {
        mode: 'units',
        extraUnitsPerYear,
        annualProductivityProfit: extraUnitsPerYear * profitPerUnit
    };
}

function computeRoiPercent(netProfit, effectiveInvestment, notes) {
    if (effectiveInvestment === 0) {
        notes.push('ROI is undefined because effectiveInvestment is zero.');
        return null;
    }

    return (netProfit / effectiveInvestment) * 100;
}

function normalizeDiscountRate(discountRateRaw, notes) {
    if (!isFiniteNumber(discountRateRaw)) {
        return null;
    }

    const discountRate = toNumber(discountRateRaw);
    if (discountRate <= -1) {
        notes.push('discountRate must be greater than -100%. NPV was not calculated.');
        return null;
    }

    return discountRate;
}

function computeNpv(effectiveInvestment, netAnnualBenefit, years, discountRate) {
    let npv = -effectiveInvestment;

    for (let year = 1; year <= years; year += 1) {
        npv += netAnnualBenefit / Math.pow(1 + discountRate, year);
    }

    return npv;
}

function buildCumulativeCashFlow(effectiveInvestment, netAnnualBenefit, years, discountRate) {
    const points = [];
    let cumulativeCashFlow = -effectiveInvestment;
    let discountedCumulativeCashFlow = -effectiveInvestment;

    points.push({
        year: 0,
        cumulativeCashFlow,
        discountedCumulativeCashFlow: discountRate === null ? null : discountedCumulativeCashFlow
    });

    for (let year = 1; year <= years; year += 1) {
        cumulativeCashFlow += netAnnualBenefit;

        if (discountRate !== null) {
            discountedCumulativeCashFlow += netAnnualBenefit / Math.pow(1 + discountRate, year);
        }

        points.push({
            year,
            cumulativeCashFlow,
            discountedCumulativeCashFlow: discountRate === null ? null : discountedCumulativeCashFlow
        });
    }

    return points;
}

function findBreakevenYear(points) {
    const breakevenPoint = points.find((point) => point.year > 0 && point.cumulativeCashFlow >= 0);
    return breakevenPoint ? breakevenPoint.year : null;
}

function calculateRoi(input) {
    const notes = [];
    const optionName = normalizeOptionName(input.optionName);

    const years = normalizeTimeHorizonYears(input.financial.timeHorizonYears, notes);

    const initialInvestment = sum([
        nonNegative(input.investment.equipmentCost),
        nonNegative(input.investment.installationCost),
        nonNegative(input.investment.integrationCost),
        nonNegative(input.investment.trainingCost),
        nonNegative(input.investment.downtimeCost),
        nonNegative(input.investment.otherUpfrontCosts),
        sumPositiveArray(input.investment.additionalUpfrontCosts)
    ]);

    const grant = computeGrant(initialInvestment, input.investment.grantPercent, input.investment.grantAmount, notes);

    const annualLabourSavings =
        toNumber(input.labour.fteReduced) * toNumber(input.labour.fullyLoadedAnnualCostPerFte);

    const productivity = computeProductivity(input.productivity);

    const annualOtherSavings = sum([
        input.annualSavings && input.annualSavings.scrapSavings,
        input.annualSavings && input.annualSavings.overtimeSavings,
        input.annualSavings && input.annualSavings.qualityWarrantySavings,
        input.annualSavings && input.annualSavings.otherSavings,
        sumArray(input.annualSavings && input.annualSavings.additionalSavings)
    ]);

    const annualOperatingCosts = sum([
        input.annualCosts && input.annualCosts.maintenanceCost,
        input.annualCosts && input.annualCosts.softwareSubscription,
        input.annualCosts && input.annualCosts.energyDelta,
        input.annualCosts && input.annualCosts.otherAnnualCosts,
        sumArray(input.annualCosts && input.annualCosts.additionalAnnualCosts)
    ]);

    const annualTotalBenefits = annualLabourSavings + productivity.annualProductivityProfit + annualOtherSavings;
    const netAnnualBenefit = annualTotalBenefits - annualOperatingCosts;

    const paybackYears = netAnnualBenefit > 0 ? grant.effectiveInvestment / netAnnualBenefit : null;
    const paybackMonths = paybackYears === null ? null : Math.round(paybackYears * 12);
    const isAchievable = paybackYears !== null;

    if (!isAchievable) {
        notes.push('Payback is not achievable because net annual benefit is zero or negative.');
    }

    const totalNetBenefits = netAnnualBenefit * years;
    const netProfit = totalNetBenefits - grant.effectiveInvestment;
    const roiPercent = computeRoiPercent(netProfit, grant.effectiveInvestment, notes);

    const discountRate = normalizeDiscountRate(input.financial.discountRate, notes);
    const npvValue =
        discountRate === null ? null : computeNpv(grant.effectiveInvestment, netAnnualBenefit, years, discountRate);

    const cumulativeCashFlow = buildCumulativeCashFlow(
        grant.effectiveInvestment,
        netAnnualBenefit,
        years,
        discountRate
    );
    const breakevenYearFromCumulative = findBreakevenYear(cumulativeCashFlow);

    return {
        optionName,
        investment: {
            initialInvestment,
            effectiveInvestment: grant.effectiveInvestment,
            grantType: grant.grantType,
            grantAppliedAmount: grant.grantAppliedAmount
        },
        annual: {
            labourSavings: annualLabourSavings,
            productivityMode: productivity.mode,
            extraUnitsPerYear: productivity.extraUnitsPerYear,
            productivityProfit: productivity.annualProductivityProfit,
            otherSavings: annualOtherSavings,
            totalBenefits: annualTotalBenefits,
            operatingCosts: annualOperatingCosts,
            netAnnualBenefit
        },
        payback: {
            isAchievable,
            paybackYears,
            paybackMonths,
            breakevenYearFromCumulative
        },
        horizon: {
            years,
            totalNetBenefits,
            netProfit,
            roiPercent
        },
        npv: {
            discountRate,
            value: npvValue
        },
        cumulativeCashFlow,
        notes
    };
}

function buildReportContractFromPayload(rawPayload) {
    const payload = asObject(rawPayload);
    const inputCandidate = payload.calculationInput || payload.input || payload.roiInput || payload;
    const calculationResult =
        asObject(payload.calculationResult || payload.result || payload.roiResult || null) || null;

    const errors = [];
    const normalizedInput = normalizeRoiInput(inputCandidate, errors);
    if (errors.length > 0) {
        return {
            errors
        };
    }

    const computedResult = calculateRoi(normalizedInput);

    return {
        errors: [],
        contract: {
            companyName: REPORT_COMPANY_NAME,
            calculationInput: normalizedInput,
            calculationResult: computedResult,
            providedCalculationResult: Object.keys(calculationResult).length > 0 ? calculationResult : null,
            reportContext: normalizeReportContext(payload.reportContext || payload.context)
        }
    };
}

module.exports = {
    REPORT_COMPANY_NAME,
    buildReportContractFromPayload,
    calculateRoi
};
