"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCreditCost = calculateCreditCost;
exports.getCreditCalculationExplanation = getCreditCalculationExplanation;
const CREDIT_MULTIPLIERS = {
    length: {
        short: 1,
        medium: 1.5,
        long: 2
    },
    style: {
        casual: 1,
        friendly: 1.2,
        formal: 1.3,
        professional: 1.4
    },
    language: {
        en: 1, // English
        es: 1.5, // Spanish
        fr: 1.5, // French
        de: 1.5 // German
    },
    creativity: {
        low: 1, // 0-0.3
        medium: 1.2, // 0.4-0.7
        high: 1.5 // 0.8-1.0
    }
};
const BASE_COST = 1;
function calculateCreditCost(customerCount, options) {
    const { length, style, language, creativity = 0.7, hasProducts = false } = options;
    // Get multipliers with fallbacks
    const lengthMultiplier = CREDIT_MULTIPLIERS.length[length] || CREDIT_MULTIPLIERS.length.long;
    const styleMultiplier = CREDIT_MULTIPLIERS.style[style] || CREDIT_MULTIPLIERS.style.professional;
    const languageMultiplier = CREDIT_MULTIPLIERS.language[language] || CREDIT_MULTIPLIERS.language.en;
    // Determine creativity multiplier based on value
    let creativityMultiplier = CREDIT_MULTIPLIERS.creativity.medium; // default to medium
    if (creativity <= 0.3) {
        creativityMultiplier = CREDIT_MULTIPLIERS.creativity.low;
    }
    else if (creativity >= 0.8) {
        creativityMultiplier = CREDIT_MULTIPLIERS.creativity.high;
    }
    // Product multiplier (if customer has products, add 20% to cost)
    const productMultiplier = hasProducts ? 1.2 : 1;
    // Calculate raw total cost for all messages
    const rawTotal = BASE_COST *
        lengthMultiplier *
        styleMultiplier *
        languageMultiplier *
        creativityMultiplier *
        productMultiplier *
        customerCount;
    // Round the final total to avoid artificial inflation
    return Math.ceil(rawTotal);
}
function getCreditCalculationExplanation(customerCount, options) {
    const { length, style, language, creativity = 0.7, hasProducts = false } = options;
    const cost = calculateCreditCost(customerCount, options);
    const lengthText = `${length.charAt(0).toUpperCase() + length.slice(1)} message`;
    const styleText = style.charAt(0).toUpperCase() + style.slice(1);
    const languageText = language === 'en' ? 'English' : 'Non-English';
    const creativityText = creativity <= 0.3 ? 'Low' :
        creativity >= 0.8 ? 'High' : 'Medium';
    const productText = hasProducts ? 'with products' : 'without products';
    return `Credits are calculated based on message length, style, language, creativity, and products.
A ${lengthText} in ${styleText} style, ${languageText}, ${creativityText} creativity, ${productText} = ${cost} credit${cost > 1 ? 's' : ''} per message.
Total cost for ${customerCount} message${customerCount > 1 ? 's' : ''}: ${cost} credit${cost > 1 ? 's' : ''}.`;
}
