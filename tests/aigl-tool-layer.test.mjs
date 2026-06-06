import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
    AIGL_RUNTIME_TOOL_DEFINITIONS,
    AIGL_TOOL_EXPOSURE,
    createAiglFunctionToolSpec
} = require('../electron/aigl-tool-specs.cjs');
const {
    makeAiglToolError,
    makeAiglToolResult,
    normalizeAiglToolOutput
} = require('../electron/aigl-tool-result.cjs');
const {
    createAiglDirectMcpToolSpec,
    normalizeAiglMcpCallArgs,
    parseAiglDirectMcpToolId
} = require('../electron/aigl-mcp-adapter.cjs');

test('AIGL tool specs keep Codex-like shape without Codex naming', () => {
    assert.ok(AIGL_RUNTIME_TOOL_DEFINITIONS.some((tool) => tool.id === 'tool_search'));

    const toolSearch = AIGL_RUNTIME_TOOL_DEFINITIONS.find((tool) => tool.id === 'tool_search');
    assert.equal(toolSearch.route, 'humanclaw-runtime');
    assert.equal(toolSearch.exposure, AIGL_TOOL_EXPOSURE.DIRECT);

    const spec = createAiglFunctionToolSpec(toolSearch);
    assert.equal(spec.type, 'function');
    assert.equal(spec.name, 'tool_search');
    assert.equal(spec.parameters.type, 'object');
    assert.ok(spec.output_schema.properties.content);
    assert.equal(Object.prototype.hasOwnProperty.call(spec, 'metadata'), false);
});

test('AIGL tool result normalizes success and error payloads', () => {
    const success = makeAiglToolResult({
        status: 'completed',
        text: 'done',
        details: { value: 1 }
    });
    assert.equal(success.isError, false);
    assert.equal(success.content[0].text, 'done');
    assert.equal(success.details.status, 'completed');

    const error = makeAiglToolError({
        status: 'timeout',
        errorCode: 'search_backend_timeout',
        message: 'search timed out',
        retryable: true,
        details: { backend: 'duckduckgo_lite' }
    });
    assert.equal(error.isError, true);
    assert.equal(error.details.errorCode, 'search_backend_timeout');
    assert.equal(error.details.retryable, true);

    const normalized = normalizeAiglToolOutput('plain text', { toolId: 'demo' });
    assert.equal(normalized.content[0].text, 'plain text');
    assert.equal(normalized.details.toolRuntime.tool, 'demo');
});

test('AIGL MCP adapter parses direct MCP ids and creates stable specs', () => {
    assert.deepEqual(parseAiglDirectMcpToolId('mcp:aigl_research:web_search'), {
        id: 'mcp:aigl_research:web_search',
        server: 'aigl_research',
        tool: 'web_search'
    });
    assert.deepEqual(parseAiglDirectMcpToolId('mcp.aigl_research.web_fetch'), {
        id: 'mcp:aigl_research:web_fetch',
        server: 'aigl_research',
        tool: 'web_fetch'
    });

    const spec = createAiglDirectMcpToolSpec({
        server: 'fixture',
        tool: 'echo',
        description: 'Echo input',
        inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
        schemaProperties: ['text']
    });
    assert.equal(spec.id, 'mcp:fixture:echo');
    assert.equal(spec.call_pattern.tool, 'mcp:fixture:echo');
    assert.deepEqual(spec.call_pattern.args, { text: '<text>' });

    const { toolArgs, meta } = normalizeAiglMcpCallArgs({
        text: 'hello',
        _meta: { reason: 'test' }
    });
    assert.deepEqual(toolArgs, { text: 'hello' });
    assert.deepEqual(meta, { reason: 'test' });
});
