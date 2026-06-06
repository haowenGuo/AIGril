const DEFAULT_MAX_TURN_ITEMS = 18;
const DEFAULT_PREVIEW_CHARS = 1400;

function normalizeText(value = '') {
    return String(value || '').trim();
}

function summarizeValue(value, maxChars = DEFAULT_PREVIEW_CHARS) {
    if (value == null) {
        return '';
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!text) {
        return '';
    }
    return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}

function extractToolResultText(result) {
    if (result == null) {
        return '';
    }
    if (typeof result === 'string') {
        return result;
    }
    if (typeof result.text === 'string') {
        return result.text;
    }
    if (typeof result.content === 'string') {
        return result.content;
    }
    if (typeof result.stdout === 'string') {
        return result.stdout;
    }
    if (typeof result.preview === 'string') {
        return result.preview;
    }
    return summarizeValue(result);
}

function getResponseDetails(response = {}) {
    if (response?.result?.details && typeof response.result.details === 'object') {
        return response.result.details;
    }
    if (response?.details && typeof response.details === 'object') {
        return response.details;
    }
    return {};
}

function getCommandProgram(command = '') {
    const text = normalizeText(command);
    if (!text) {
        return '';
    }
    const match = text.match(/^\s*(?:"([^"]+)"|'([^']+)'|([^\s|&<>]+))/);
    return normalizeText(match?.[1] || match?.[2] || match?.[3]);
}

function classifyToolFailureObservation({ tool = '', args = {}, response = {}, preview = '' } = {}) {
    const details = getResponseDetails(response);
    const action = normalizeText(args.action || details.action).toLowerCase();
    const exitCode = Number(details.exitCode ?? response.exitCode);
    const command = normalizeText(details.command || args.command);
    const program = getCommandProgram(command);
    const text = `${preview}\n${response.error || ''}\n${extractToolResultText(response.result)}`.toLowerCase();

    if (tool === 'computer' && action === 'exec' && (exitCode === 9009 || /not recognized|not found|无法将/.test(text))) {
        return {
            error_type: 'missing_dependency',
            summary: program
                ? `Command not found on this Windows machine: ${program}.`
                : 'Command not found on this Windows machine.',
            recovery_hint: 'Treat this as a failed tool observation and try an available cross-platform path, such as PowerShell, Node.js, curl, built-in read/web_fetch, artifact_verifier, or an installed Python launcher.',
            alternatives: ['powershell', 'node', 'curl', 'read', 'web_fetch', 'artifact_verifier']
        };
    }

    if (tool === 'computer' && action === 'exec' && Number.isFinite(exitCode) && exitCode !== 0) {
        return {
            error_type: 'command_failed',
            summary: `Command exited with code ${exitCode}.`,
            recovery_hint: 'Inspect the tool output and choose a different command, parser, or built-in tool before stopping.',
            alternatives: ['inspect_output', 'retry_with_simpler_command', 'use_builtin_tool']
        };
    }

    if (/timeout|timed out|超时/.test(text)) {
        return {
            error_type: 'timeout',
            summary: 'Tool call timed out.',
            recovery_hint: 'Retry with a smaller operation, narrower input, or a more direct tool.',
            alternatives: ['narrow_input', 'retry', 'use_direct_tool']
        };
    }

    return null;
}

function formatFailureHint(failure = null) {
    if (!failure) {
        return '';
    }
    return [
        `error_type=${failure.error_type}`,
        failure.summary,
        failure.recovery_hint,
        failure.alternatives?.length ? `available_alternatives=${failure.alternatives.join(', ')}` : ''
    ].filter(Boolean).join(' | ');
}

function buildToolCallItem(event = {}) {
    return {
        type: 'tool_call',
        status: 'started',
        id: event.id || null,
        title: event.title || event.tool || 'tool call',
        tool: event.tool || null,
        args: event.args || null,
        iteration: Number.isFinite(event.iteration) ? event.iteration : null
    };
}

function buildToolResultItem(event = {}) {
    const failure = event.ok ? null : classifyToolFailureObservation({
        tool: event.tool,
        args: event.args,
        response: event.response || event.result || {},
        preview: event.preview || event.error || ''
    });
    const preview = summarizeValue(event.preview || event.error || event.result || '', DEFAULT_PREVIEW_CHARS);
    return {
        type: 'tool_result',
        status: event.ok ? 'completed' : 'failed',
        id: event.id || null,
        title: event.title || event.tool || 'tool result',
        tool: event.tool || null,
        ok: event.ok === true,
        result_status: event.status || 'unknown',
        preview: summarizeValue([preview, formatFailureHint(failure)].filter(Boolean).join('\n'), DEFAULT_PREVIEW_CHARS),
        error_type: failure?.error_type || null,
        recovery_hint: failure?.recovery_hint || null,
        alternatives: failure?.alternatives || [],
        iteration: Number.isFinite(event.iteration) ? event.iteration : null
    };
}

function buildToolResultItemFromStep(stepResult = {}) {
    const response = stepResult.response || {};
    const basePreview = summarizeValue(
        extractToolResultText(response.result) || response.error || response.result || response,
        DEFAULT_PREVIEW_CHARS
    );
    const failure = response.ok === true ? null : classifyToolFailureObservation({
        tool: stepResult.tool,
        args: stepResult.args,
        response,
        preview: basePreview
    });
    return {
        type: 'tool_result',
        status: response.ok === true ? 'completed' : 'failed',
        id: stepResult.id || null,
        title: stepResult.title || stepResult.tool || 'tool result',
        tool: stepResult.tool || null,
        ok: response.ok === true,
        result_status: response.status || 'unknown',
        preview: summarizeValue([basePreview, formatFailureHint(failure)].filter(Boolean).join('\n'), DEFAULT_PREVIEW_CHARS),
        error_type: failure?.error_type || null,
        recovery_hint: failure?.recovery_hint || null,
        alternatives: failure?.alternatives || [],
        iteration: Number.isFinite(stepResult.iteration) ? stepResult.iteration : null
    };
}

function buildContextItem(event = {}) {
    return {
        type: 'context',
        status: event.status || 'loaded',
        title: 'capability context',
        loaded: event.loaded || null,
        missing: event.missing || null,
        preview: summarizeValue(event.content || event.request || '', DEFAULT_PREVIEW_CHARS),
        iteration: Number.isFinite(event.iteration) ? event.iteration : null
    };
}

function buildNoteItem(event = {}) {
    return {
        type: 'runtime_note',
        status: event.status || event.type || 'note',
        title: event.type || 'runtime note',
        preview: summarizeValue(event, DEFAULT_PREVIEW_CHARS),
        iteration: Number.isFinite(event.iteration) ? event.iteration : null
    };
}

function eventToTurnItem(event = {}) {
    if (!event || typeof event !== 'object') {
        return null;
    }
    if (event.type === 'tool_call') {
        return buildToolCallItem(event);
    }
    if (event.type === 'tool_result') {
        return buildToolResultItem(event);
    }
    if (event.type === 'capability_context') {
        return buildContextItem(event);
    }
    return buildNoteItem(event);
}

function buildCodexLikeTurnItems({
    events = [],
    stepResults = [],
    maxItems = DEFAULT_MAX_TURN_ITEMS
} = {}) {
    const items = [];
    for (const event of Array.isArray(events) ? events : []) {
        const item = eventToTurnItem(event);
        if (item) {
            items.push(item);
        }
    }
    const knownResultIds = new Set(
        items
            .filter((item) => item.type === 'tool_result' && item.id)
            .map((item) => item.id)
    );
    for (const stepResult of Array.isArray(stepResults) ? stepResults : []) {
        if (!stepResult?.id || knownResultIds.has(stepResult.id)) {
            continue;
        }
        items.push(buildToolResultItemFromStep(stepResult));
    }
    return items.slice(-Math.max(1, maxItems));
}

function buildTurnItemsPromptObject(input = {}) {
    const items = buildCodexLikeTurnItems(input);
    return {
        model: 'codex_like_turn_items',
        note: 'These are chronological runtime items. Tool failures are observations for the next decision, not final blockers.',
        items
    };
}

module.exports = {
    buildCodexLikeTurnItems,
    buildTurnItemsPromptObject,
    classifyToolFailureObservation,
    formatFailureHint
};
