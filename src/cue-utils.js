const CONTROL_TAG_PATTERN = /\[(motion|action|expression):([^\]]*)\]/g;
const LEADING_INCOMPLETE_CONTROL_TAG_PATTERN = /^(?:\[(?:motion|action|expression):[^\]]*)+/;

export const MOTION_CATEGORIES = Object.freeze([
    'idle',
    'walk',
    'run',
    'dance',
    'fight',
    'sports',
    'zombie',
    'superhero'
]);

export const CUE_INTENSITY_LEVELS = Object.freeze(['low', 'medium', 'high']);

export const EXPRESSION_NAMES = Object.freeze([
    'happy',
    'sad',
    'angry',
    'relaxed',
    'surprised',
    'blinkRight',
    'neutral'
]);

function normalizeDisplayLines(text) {
    return (text || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function parseKeyValueBody(rawValue) {
    return (rawValue || '')
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((fields, part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) {
                return fields;
            }

            const key = part.slice(0, separatorIndex).trim().toLowerCase();
            const value = part.slice(separatorIndex + 1).trim();
            if (key && value) {
                fields[key] = value;
            }
            return fields;
        }, {});
}

export function normalizeMotionCategory(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return MOTION_CATEGORIES.includes(normalized) ? normalized : null;
}

export function normalizeCueIntensity(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return CUE_INTENSITY_LEVELS.includes(normalized) ? normalized : null;
}

export function normalizeExpressionName(value) {
    const normalized = String(value || '').trim();
    return EXPRESSION_NAMES.includes(normalized) ? normalized : null;
}

function parseMotionTag(kind, rawValue) {
    const trimmedValue = String(rawValue || '').trim();
    if (!trimmedValue) {
        return {
            action: null,
            legacyAction: null,
            motionCategory: null,
            motionIntensity: null
        };
    }

    const hasStructuredPayload = trimmedValue.includes('=');
    if (!hasStructuredPayload) {
        const normalizedCategory = normalizeMotionCategory(trimmedValue);
        return {
            action: normalizedCategory || trimmedValue,
            legacyAction: kind === 'action' ? trimmedValue : null,
            motionCategory: normalizedCategory,
            motionIntensity: null
        };
    }

    const fields = parseKeyValueBody(trimmedValue);
    const motionCategory = normalizeMotionCategory(
        fields.category || fields.motion || fields.name || fields.value
    );
    const motionIntensity = normalizeCueIntensity(fields.intensity);
    const legacyAction = (fields.legacy || fields.action || '').trim() || null;

    return {
        action: motionCategory || legacyAction,
        legacyAction,
        motionCategory,
        motionIntensity
    };
}

function parseExpressionTag(rawValue) {
    const trimmedValue = String(rawValue || '').trim();
    if (!trimmedValue) {
        return {
            expression: null,
            expressionIntensity: null
        };
    }

    const hasStructuredPayload = trimmedValue.includes('=');
    if (!hasStructuredPayload) {
        return {
            expression: normalizeExpressionName(trimmedValue),
            expressionIntensity: null
        };
    }

    const fields = parseKeyValueBody(trimmedValue);
    return {
        expression: normalizeExpressionName(
            fields.name || fields.expression || fields.value
        ),
        expressionIntensity: normalizeCueIntensity(fields.intensity)
    };
}

export function parseReplyMarkup(rawText) {
    let action = null;
    let legacyAction = null;
    let motionCategory = null;
    let motionIntensity = null;
    let expression = null;
    let expressionIntensity = null;

    const strippedText = (rawText || '').replace(CONTROL_TAG_PATTERN, (_, kind, value) => {
        if ((kind === 'motion' || kind === 'action') && !motionCategory && !legacyAction && !action) {
            const parsedMotion = parseMotionTag(kind, value);
            action = parsedMotion.action;
            legacyAction = parsedMotion.legacyAction;
            motionCategory = parsedMotion.motionCategory;
            motionIntensity = parsedMotion.motionIntensity;
        } else if (kind === 'expression' && !expression) {
            const parsedExpression = parseExpressionTag(value);
            expression = parsedExpression.expression;
            expressionIntensity = parsedExpression.expressionIntensity;
        }
        return '';
    });

    const visibleText = strippedText.replace(LEADING_INCOMPLETE_CONTROL_TAG_PATTERN, '');
    const displayText = normalizeDisplayLines(visibleText);

    return {
        raw_text: rawText || '',
        display_text: displayText,
        speech_text: displayText.replace(/\n/g, ' '),
        action,
        legacy_action: legacyAction,
        motion_category: motionCategory,
        motion_intensity: motionIntensity,
        expression,
        expression_intensity: expressionIntensity
    };
}
