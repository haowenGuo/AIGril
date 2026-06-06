const { getToolContract } = require('./humanclaw-tool-contracts.cjs');

const AIGL_TOOL_EXPOSURE = Object.freeze({
    DIRECT: 'direct',
    DEFERRED: 'deferred',
    HIDDEN: 'hidden'
});

const AIGL_TOOL_KIND = Object.freeze({
    FUNCTION: 'function',
    HOSTED: 'hosted',
    MCP: 'mcp',
    FREEFORM: 'freeform'
});

const AIGL_RUNTIME_TOOL_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'update_plan',
        label: 'update_plan',
        description: 'Update the visible agent plan as a first-class runtime tool.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApproval: false,
        exposure: AIGL_TOOL_EXPOSURE.DIRECT
    }),
    Object.freeze({
        id: 'tool_search',
        label: 'tool_search',
        description: 'Search deferred runtime tools and MCP tool specs, then return loadable tool specifications for the next Agent step.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApproval: false,
        exposure: AIGL_TOOL_EXPOSURE.DIRECT
    }),
    Object.freeze({
        id: 'subagents',
        label: 'subagents',
        description: 'Spawn, wait, cancel, and inspect child Agent runs through the AIGL runtime transcript.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApprovalActions: Object.freeze(['spawn', 'create', 'send', 'close']),
        exposure: AIGL_TOOL_EXPOSURE.DIRECT
    }),
    Object.freeze({
        id: 'mcp_bridge',
        label: 'mcp_bridge',
        description: 'Manage configured MCP servers and execute tools/resources/prompts through stdio or HTTP MCP sessions.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApprovalActions: Object.freeze(['tool_call']),
        exposure: AIGL_TOOL_EXPOSURE.DEFERRED
    }),
    Object.freeze({
        id: 'tool_doctor',
        label: 'tool_doctor',
        description: 'Run tool health checks, discover MCP candidates, maintain scorecards, and propose gated self-repair plans.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApprovalActions: Object.freeze([]),
        exposure: AIGL_TOOL_EXPOSURE.DEFERRED
    }),
    Object.freeze({
        id: 'capability_manager',
        label: 'capability_manager',
        description: 'Registry, install, validate, skill-author, rollback, and repair capabilities for AIGL self-iteration.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApprovalActions: Object.freeze(['install_capability', 'author_skill', 'rollback', 'execute_repair']),
        exposure: AIGL_TOOL_EXPOSURE.DEFERRED
    }),
    Object.freeze({
        id: 'self_debugger',
        label: 'self_debugger',
        description: 'Open self-debug cases, collect evidence, diagnose AIGL bugs, and route validated repairs through Capability Manager.',
        sectionId: 'runtime',
        route: 'humanclaw-runtime',
        materialized: true,
        status: 'available',
        needsApprovalActions: Object.freeze(['apply_patch']),
        exposure: AIGL_TOOL_EXPOSURE.DEFERRED
    })
]);

const AIGL_RUNTIME_TOOL_IDS = new Set(AIGL_RUNTIME_TOOL_DEFINITIONS.map((tool) => tool.id));

function createAiglFunctionToolSpec(definition = {}) {
    const contract = getToolContract(definition.id);
    return {
        type: AIGL_TOOL_KIND.FUNCTION,
        name: definition.id,
        description: definition.description || definition.label || definition.id,
        strict: false,
        defer_loading: definition.exposure === AIGL_TOOL_EXPOSURE.DEFERRED ? true : undefined,
        parameters: contract?.schema || {
            type: 'object',
            additionalProperties: true,
            properties: {}
        },
        output_schema: contract?.returns || undefined
    };
}

module.exports = {
    AIGL_RUNTIME_TOOL_DEFINITIONS,
    AIGL_RUNTIME_TOOL_IDS,
    AIGL_TOOL_EXPOSURE,
    AIGL_TOOL_KIND,
    createAiglFunctionToolSpec
};
