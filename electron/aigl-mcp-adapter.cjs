function normalizeString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
}

function cloneJson(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function parseAiglDirectMcpToolId(value) {
    const toolId = normalizeString(value);
    if (!toolId) {
        return null;
    }
    let match = toolId.match(/^mcp:([^:]+):(.+)$/);
    if (match) {
        return {
            id: `mcp:${normalizeString(match[1])}:${normalizeString(match[2])}`,
            server: normalizeString(match[1]),
            tool: normalizeString(match[2])
        };
    }
    match = toolId.match(/^mcp\.([^.]+)\.(.+)$/);
    if (match) {
        return {
            id: `mcp:${normalizeString(match[1])}:${normalizeString(match[2])}`,
            server: normalizeString(match[1]),
            tool: normalizeString(match[2])
        };
    }
    return null;
}

function createAiglDirectMcpToolSpec({ id, server, tool, name, description, inputSchema, schemaProperties } = {}) {
    const normalizedId = normalizeString(id) || `mcp:${normalizeString(server)}:${normalizeString(tool || name)}`;
    return {
        id: normalizedId,
        type: 'mcp_tool',
        server: normalizeString(server),
        tool: normalizeString(tool || name),
        name: normalizeString(name || tool),
        description: normalizeString(description),
        input_schema: cloneJson(inputSchema || {}),
        schema_properties: Array.isArray(schemaProperties) ? [...schemaProperties] : [],
        call_pattern: {
            tool: normalizedId,
            args: Object.fromEntries((schemaProperties || []).map((key) => [key, `<${key}>`]))
        }
    };
}

function normalizeAiglMcpCallArgs(args = {}) {
    const toolArgs = args && typeof args === 'object' && !Array.isArray(args)
        ? { ...args }
        : {};
    const meta = toolArgs._meta || toolArgs.meta;
    delete toolArgs._meta;
    delete toolArgs.meta;
    return { toolArgs, meta };
}

module.exports = {
    createAiglDirectMcpToolSpec,
    normalizeAiglMcpCallArgs,
    parseAiglDirectMcpToolId
};
