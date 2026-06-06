const CONTRACT_VERSION = 1;

const STANDARD_TOOL_RETURN_SCHEMA = Object.freeze({
    type: 'object',
    required: ['content'],
    properties: {
        content: arraySchema(makeObjectSchema({
            required: ['type'],
            properties: {
                type: stringSchema({ enum: ['text', 'image', 'resource', 'json'] }),
                text: stringSchema(),
                uri: stringSchema(),
                mimeType: stringSchema()
            },
            additionalProperties: true
        })),
        isError: booleanSchema(),
        structuredContent: objectSchema(),
        details: objectSchema()
    },
    additionalProperties: true
});

const STANDARD_TOOL_ERROR_CODES = Object.freeze([
    'missing_tool',
    'invalid_tool_args',
    'blocked',
    'needs_approval',
    'timeout',
    'not_materialized',
    'tool_error'
]);

function normalizeString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
}

function normalizeAction(value, fallback = '') {
    return normalizeString(value, fallback).toLowerCase().replace(/[-\s]+/g, '_');
}

function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneJson(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function makeObjectSchema({ required = [], properties = {}, additionalProperties = true } = {}) {
    return {
        type: 'object',
        required,
        properties,
        additionalProperties
    };
}

function stringSchema(options = {}) {
    return {
        type: 'string',
        ...options
    };
}

function numberSchema(options = {}) {
    return {
        type: 'number',
        ...options
    };
}

function booleanSchema(options = {}) {
    return {
        type: 'boolean',
        ...options
    };
}

function objectSchema(options = {}) {
    return makeObjectSchema(options);
}

function arraySchema(items = {}, options = {}) {
    return {
        type: 'array',
        items,
        ...options
    };
}

function actionSchema(actions, extraProperties = {}, required = []) {
    return makeObjectSchema({
        required: ['action', ...required],
        properties: {
            action: stringSchema({ enum: actions }),
            operation: stringSchema(),
            intent: stringSchema(),
            timeoutMs: numberSchema({ minimum: 1000, maximum: 180000 }),
            ...extraProperties
        },
        additionalProperties: true
    });
}

const EMAIL_ACTIONS = Object.freeze([
    'providers',
    'schema',
    'list',
    'search',
    'inbox',
    'read',
    'get',
    'draft',
    'compose',
    'send',
    'mark_read',
    'mark_unread',
    'move',
    'delete',
    'oauth_authorize_url',
    'oauth_url',
    'oauth_exchange_code',
    'oauth_token',
    'oauth_refresh',
    'refresh_token',
    'gmail_list_labels',
    'gmail_list_threads',
    'gmail_get_thread',
    'outlook_graph_messages',
    'outlook_graph_message',
    'outlook_graph_folders'
]);

const FILE_MANAGER_ACTIONS = Object.freeze([
    'schema',
    'profiles',
    'scan',
    'plan_clean',
    'clean',
    'plan_organize',
    'organize',
    'quarantine',
    'restore'
]);

const COMPUTER_ACTIONS = Object.freeze([
    'schema',
    'list',
    'ls',
    'tree',
    'stat',
    'read',
    'read_binary',
    'write',
    'write_binary',
    'append',
    'mkdir',
    'copy',
    'move',
    'rename',
    'delete',
    'trash',
    'search',
    'find',
    'hash',
    'du',
    'screen_screenshot',
    'mouse_move',
    'mouse_click',
    'mouse_double_click',
    'mouse_right_click',
    'mouse_drag',
    'scroll',
    'keyboard_type',
    'keyboard_press',
    'keyboard_hotkey',
    'clipboard_read',
    'clipboard_write',
    'wait',
    'exec',
    'run',
    'session_start',
    'process_list',
    'process_read',
    'process_write',
    'process_kill',
    'pty_status',
    'pty_start',
    'pty_read',
    'pty_write',
    'pty_resize',
    'pty_kill',
    'watch_start',
    'watch_poll',
    'watch_list',
    'watch_stop',
    'rollback_list',
    'rollback_restore',
    'acl_get',
    'acl_set'
]);

const CODE_ACTIONS = Object.freeze([
    'schema',
    'search',
    'symbols',
    'semantic_index',
    'diagnostics',
    'lsp_diagnostics',
    'refactor_rename',
    'rename_symbol',
    'test',
    'git_status',
    'git_diff',
    'git_log',
    'git_commit',
    'pr_create',
    'ci_status'
]);

const MCP_ACTIONS = Object.freeze([
    'schema',
    'list_servers',
    'register_server',
    'add_server',
    'unregister_server',
    'remove_server',
    'health_check',
    'list_tools',
    'list_tool_specs',
    'search_tools',
    'list_resources',
    'read_resource',
    'list_prompts',
    'get_prompt',
    'call_tool',
    'tool_call',
    'shutdown_server'
]);

const TOOL_DOCTOR_ACTIONS = Object.freeze([
    'schema',
    'health_check',
    'doctor',
    'run_eval',
    'eval_plan',
    'discover_mcp',
    'scorecard',
    'record_observation',
    'propose_repair',
    'list_repairs',
    'mark_repair'
]);

const CAPABILITY_MANAGER_ACTIONS = Object.freeze([
    'schema',
    'registry',
    'list_capabilities',
    'refresh_registry',
    'plan_install',
    'list_plans',
    'install_capability',
    'author_skill',
    'rollback',
    'execute_repair',
    'list_installations'
]);

const SELF_DEBUGGER_ACTIONS = Object.freeze([
    'schema',
    'open_case',
    'create_case',
    'list_cases',
    'get_case',
    'collect_evidence',
    'diagnose',
    'propose_patch',
    'validate_patch',
    'apply_patch',
    'run_loop',
    'mark_case',
    'close_case'
]);

function defaultReturns() {
    return cloneJson(STANDARD_TOOL_RETURN_SCHEMA);
}

function defaultErrors(extra = []) {
    return [...STANDARD_TOOL_ERROR_CODES, ...extra];
}

function makeExperienceMetadata({
    embodiedAction,
    permissionStyle = 'policy',
    progressStyle = 'quiet',
    successStyle = 'summarize_result',
    failureStyle = 'plain_explain',
    userFacingVerb = '处理',
    userSafePreview = 'summary_only'
}) {
    return Object.freeze({
        embodiedAction,
        permissionStyle,
        progressStyle,
        successStyle,
        failureStyle,
        userFacingVerb,
        userSafePreview
    });
}

const TOOL_EXPERIENCE = Object.freeze({
    read: makeExperienceMetadata({
        embodiedAction: 'check_local_text',
        permissionStyle: 'silent_read',
        userFacingVerb: '看一下文件'
    }),
    write: makeExperienceMetadata({
        embodiedAction: 'write_local_file',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        userFacingVerb: '写入文件'
    }),
    edit: makeExperienceMetadata({
        embodiedAction: 'edit_local_file',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        userFacingVerb: '修改文件'
    }),
    apply_patch: makeExperienceMetadata({
        embodiedAction: 'patch_project',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        userFacingVerb: '应用补丁'
    }),
    exec: makeExperienceMetadata({
        embodiedAction: 'run_command',
        permissionStyle: 'explicit',
        progressStyle: 'focused',
        failureStyle: 'explain_command_failure',
        userFacingVerb: '运行命令'
    }),
    update_plan: makeExperienceMetadata({
        embodiedAction: 'organize_plan',
        permissionStyle: 'silent_internal',
        progressStyle: 'quiet',
        userFacingVerb: '整理步骤'
    }),
    tool_search: makeExperienceMetadata({
        embodiedAction: 'find_capability',
        permissionStyle: 'silent_internal',
        progressStyle: 'quiet',
        successStyle: 'summarize_result',
        failureStyle: 'plain_explain',
        userFacingVerb: '查找可用工具'
    }),
    subagents: makeExperienceMetadata({
        embodiedAction: 'delegate_subtask',
        permissionStyle: 'inherits_parent_policy',
        progressStyle: 'background',
        userFacingVerb: '分派子任务'
    }),
    mcp_bridge: makeExperienceMetadata({
        embodiedAction: 'use_external_tool',
        permissionStyle: 'policy',
        progressStyle: 'focused',
        failureStyle: 'explain_integration_failure',
        userFacingVerb: '调用外部工具'
    }),
    tool_doctor: makeExperienceMetadata({
        embodiedAction: 'inspect_tool_health',
        permissionStyle: 'silent_internal',
        progressStyle: 'background',
        successStyle: 'summarize_result',
        failureStyle: 'plain_explain',
        userFacingVerb: '检查工具健康'
    }),
    capability_manager: makeExperienceMetadata({
        embodiedAction: 'grow_capability',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        successStyle: 'summarize_result',
        failureStyle: 'explain_test_or_code_failure',
        userFacingVerb: '安装和修复能力'
    }),
    self_debugger: makeExperienceMetadata({
        embodiedAction: 'debug_self',
        permissionStyle: 'explicit_for_patch_application',
        progressStyle: 'focused',
        successStyle: 'summarize_result',
        failureStyle: 'explain_test_or_code_failure',
        userFacingVerb: '自我排查问题'
    }),
    email: makeExperienceMetadata({
        embodiedAction: 'check_mailbox',
        permissionStyle: 'explicit_when_private_or_sending',
        progressStyle: 'quiet',
        successStyle: 'summarize_private_result',
        userFacingVerb: '看看邮箱',
        userSafePreview: 'redacted_summary'
    }),
    file_manager: makeExperienceMetadata({
        embodiedAction: 'organize_files',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        userFacingVerb: '整理文件'
    }),
    computer: makeExperienceMetadata({
        embodiedAction: 'check_local_state',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        failureStyle: 'plain_explain',
        userFacingVerb: '确认本地状态'
    }),
    code: makeExperienceMetadata({
        embodiedAction: 'inspect_code',
        permissionStyle: 'explicit_when_mutating',
        progressStyle: 'focused',
        failureStyle: 'explain_test_or_code_failure',
        userFacingVerb: '检查代码'
    }),
    artifact_verifier: makeExperienceMetadata({
        embodiedAction: 'verify_artifact',
        permissionStyle: 'silent_internal',
        progressStyle: 'quiet',
        successStyle: 'summarize_result',
        failureStyle: 'plain_explain',
        userFacingVerb: '复核产物'
    }),
    vision_capture_context: makeExperienceMetadata({
        embodiedAction: 'look',
        permissionStyle: 'gentle',
        progressStyle: 'quiet',
        successStyle: 'explain_observation',
        failureStyle: 'admit_uncertainty',
        userFacingVerb: '看一眼',
        userSafePreview: 'thumbnail_and_summary'
    })
});

const TOOL_CONTRACTS = Object.freeze({
    read: Object.freeze({
        id: 'read',
        version: CONTRACT_VERSION,
        mutates: false,
        risk: 'low',
        approval: 'never',
        experience: TOOL_EXPERIENCE.read,
        returns: defaultReturns(),
        errors: defaultErrors(['file_not_found', 'path_outside_workspace']),
        schema: makeObjectSchema({
            required: ['path'],
            properties: {
                path: stringSchema({ minLength: 1 }),
                encoding: stringSchema(),
                maxBytes: numberSchema({ minimum: 1, maximum: 5 * 1024 * 1024 })
            },
            additionalProperties: true
        })
    }),
    write: Object.freeze({
        id: 'write',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.write,
        returns: defaultReturns(),
        errors: defaultErrors(['path_outside_workspace', 'write_failed']),
        schema: makeObjectSchema({
            required: ['path'],
            properties: {
                path: stringSchema({ minLength: 1 }),
                content: stringSchema(),
                encoding: stringSchema()
            },
            additionalProperties: true
        })
    }),
    edit: Object.freeze({
        id: 'edit',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.edit,
        returns: defaultReturns(),
        errors: defaultErrors(['path_outside_workspace', 'edit_target_not_found']),
        schema: makeObjectSchema({
            required: ['path'],
            properties: {
                path: stringSchema({ minLength: 1 }),
                oldString: stringSchema(),
                newString: stringSchema(),
                input: stringSchema()
            },
            additionalProperties: true
        })
    }),
    apply_patch: Object.freeze({
        id: 'apply_patch',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.apply_patch,
        returns: defaultReturns(),
        errors: defaultErrors(['patch_rejected', 'path_outside_workspace']),
        schema: makeObjectSchema({
            required: ['input'],
            properties: {
                input: stringSchema({ minLength: 1 })
            },
            additionalProperties: true
        })
    }),
    exec: Object.freeze({
        id: 'exec',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'high',
        approval: 'required',
        experience: TOOL_EXPERIENCE.exec,
        returns: defaultReturns(),
        errors: defaultErrors(['exec_blocked', 'exec_failed', 'shell_access_disabled']),
        schema: makeObjectSchema({
            properties: {
                command: stringSchema({ minLength: 1 }),
                cmd: stringSchema({ minLength: 1 }),
                workdir: stringSchema(),
                timeoutMs: numberSchema({ minimum: 1000, maximum: 24 * 60 * 60 * 1000 }),
                timeout: numberSchema({ minimum: 1 }),
                maxOutputBytes: numberSchema({ minimum: 1 }),
                env: objectSchema()
            },
            additionalProperties: true
        }),
        customValidate(args = {}) {
            if (!normalizeString(args.command || args.cmd)) {
                return ['exec requires command or cmd'];
            }
            return [];
        }
    }),
    update_plan: Object.freeze({
        id: 'update_plan',
        version: CONTRACT_VERSION,
        mutates: false,
        risk: 'low',
        approval: 'never',
        experience: TOOL_EXPERIENCE.update_plan,
        returns: defaultReturns(),
        errors: defaultErrors(['invalid_plan']),
        schema: makeObjectSchema({
            required: ['plan'],
            properties: {
                explanation: stringSchema(),
                plan: arraySchema(makeObjectSchema({
                    required: ['step', 'status'],
                    properties: {
                        id: stringSchema(),
                        step: stringSchema({ minLength: 1 }),
                        status: stringSchema({ enum: ['pending', 'in_progress', 'completed'] })
                    },
                    additionalProperties: true
                }), { minItems: 1 })
            },
            additionalProperties: true
        })
    }),
    tool_search: Object.freeze({
        id: 'tool_search',
        version: CONTRACT_VERSION,
        mutates: false,
        risk: 'low',
        approval: 'never',
        experience: TOOL_EXPERIENCE.tool_search,
        returns: defaultReturns(),
        errors: defaultErrors(['empty_query']),
        schema: makeObjectSchema({
            properties: {
                query: stringSchema({ minLength: 1 }),
                q: stringSchema({ minLength: 1 }),
                limit: numberSchema({ minimum: 1, maximum: 50 }),
                includeDeferred: booleanSchema(),
                includeMcp: booleanSchema()
            },
            additionalProperties: true
        }),
        customValidate(args = {}) {
            if (!normalizeString(args.query || args.q)) {
                return ['tool_search requires query/q'];
            }
            return [];
        }
    }),
    subagents: Object.freeze({
        id: 'subagents',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.subagents,
        returns: defaultReturns(),
        errors: defaultErrors(['subagent_not_found', 'subagent_timeout', 'subagent_cancelled']),
        schema: actionSchema(
            ['list', 'spawn', 'create', 'status', 'info', 'wait', 'log', 'send', 'steer', 'close', 'cancel', 'kill'],
            {
                subagentId: stringSchema(),
                id: stringSchema(),
                task: stringSchema(),
                message: stringSchema(),
                prompt: stringSchema(),
                wait: booleanSchema(),
                waitTimeoutMs: numberSchema({ minimum: 1000, maximum: 24 * 60 * 60 * 1000 }),
                maxAgentSteps: numberSchema({ minimum: 1, maximum: 50 })
            }
        )
    }),
    mcp_bridge: Object.freeze({
        id: 'mcp_bridge',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.mcp_bridge,
        returns: defaultReturns(),
        errors: defaultErrors([
            'mcp_server_not_configured',
            'mcp_transport_error',
            'invalid_mcp_tool_args',
            'mcp_resource_not_found'
        ]),
        schema: actionSchema(MCP_ACTIONS, {
            server: stringSchema(),
            serverId: stringSchema(),
            tool: stringSchema(),
            toolName: stringSchema(),
            tool_name: stringSchema(),
            name: stringSchema(),
            uri: stringSchema(),
            resourceUri: stringSchema(),
            resource: stringSchema(),
            prompt: stringSchema(),
            promptName: stringSchema(),
            query: stringSchema(),
            limit: numberSchema({ minimum: 1, maximum: 50 }),
            args: objectSchema(),
            arguments: objectSchema(),
            tool_args: objectSchema(),
            toolArgs: objectSchema(),
            parameters: objectSchema(),
            params: objectSchema(),
            serverConfig: objectSchema(),
            config: objectSchema(),
            servers: objectSchema(),
            persist: booleanSchema(),
            timeoutMs: numberSchema({ minimum: 1000, maximum: 180000 })
        }),
        customValidate(args = {}) {
            const action = normalizeAction(args.action || args.operation || args.intent, 'list_servers');
            if (action === 'read_resource' && !normalizeString(args.uri || args.resourceUri || args.resource)) {
                return ['mcp_bridge.read_resource requires uri/resourceUri/resource'];
            }
            if (['call_tool', 'tool_call'].includes(action) && !normalizeString(args.tool || args.name || args.toolName || args.tool_name)) {
                return ['mcp_bridge.call_tool requires tool/name/toolName/tool_name'];
            }
            if (action === 'get_prompt' && !normalizeString(args.prompt || args.promptName || args.name)) {
                return ['mcp_bridge.get_prompt requires prompt/promptName/name'];
            }
            return [];
        }
    }),
    tool_doctor: Object.freeze({
        id: 'tool_doctor',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.tool_doctor,
        returns: defaultReturns(),
        errors: defaultErrors([
            'tool_health_check_failed',
            'mcp_discovery_failed',
            'scorecard_write_failed',
            'repair_gate_rejected'
        ]),
        schema: actionSchema(TOOL_DOCTOR_ACTIONS, {
            mode: stringSchema({ enum: ['smoke', 'deep', 'release', 'full'] }),
            server: stringSchema(),
            serverId: stringSchema(),
            tool: stringSchema(),
            toolId: stringSchema(),
            status: stringSchema(),
            ok: booleanSchema(),
            latencyMs: numberSchema({ minimum: 0 }),
            durationMs: numberSchema({ minimum: 0 }),
            errorCode: stringSchema(),
            error: stringSchema(),
            reason: stringSchema(),
            summary: stringSchema(),
            title: stringSchema(),
            scope: stringSchema(),
            risk: stringSchema({ enum: ['low', 'medium', 'high'] }),
            paths: arraySchema(stringSchema()),
            roots: arraySchema(stringSchema()),
            localDirs: arraySchema(stringSchema()),
            configPaths: arraySchema(stringSchema()),
            githubRepos: arraySchema(stringSchema()),
            evidence: arraySchema(objectSchema()),
            candidateDiff: stringSchema(),
            candidatePatchPath: stringSchema(),
            validationCommands: arraySchema(stringSchema()),
            validationReport: stringSchema(),
            id: stringSchema(),
            repairId: stringSchema(),
            note: stringSchema(),
            includeMcp: booleanSchema(),
            includeProject: booleanSchema(),
            includeConfigured: booleanSchema(),
            cloneGithub: booleanSchema(),
            allowNetwork: booleanSchema(),
            maxDepth: numberSchema({ minimum: 0, maximum: 8 }),
            maxFiles: numberSchema({ minimum: 1, maximum: 5000 }),
            limit: numberSchema({ minimum: 1, maximum: 500 })
        }),
        customValidate(args = {}) {
            const action = normalizeAction(args.action || args.operation || args.intent, 'health_check');
            if (action === 'record_observation' && !normalizeString(args.tool || args.toolId || args.name)) {
                return ['tool_doctor.record_observation requires tool/toolId/name'];
            }
            if (action === 'propose_repair' && !normalizeString(args.title || args.summary)) {
                return ['tool_doctor.propose_repair requires title/summary'];
            }
            if (action === 'mark_repair' && !normalizeString(args.id || args.repairId)) {
                return ['tool_doctor.mark_repair requires id/repairId'];
            }
            if (action === 'mark_repair' && !normalizeString(args.status)) {
                return ['tool_doctor.mark_repair requires status'];
            }
            return [];
        }
    }),
    capability_manager: Object.freeze({
        id: 'capability_manager',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'high',
        approval: 'required-for-install-or-repair',
        experience: TOOL_EXPERIENCE.capability_manager,
        returns: defaultReturns(),
        errors: defaultErrors([
            'capability_not_found',
            'install_plan_invalid',
            'install_failed',
            'validation_failed',
            'rollback_failed',
            'repair_patch_rejected'
        ]),
        schema: actionSchema(CAPABILITY_MANAGER_ACTIONS, {
            request: stringSchema(),
            capability: stringSchema(),
            capabilityId: stringSchema(),
            planId: stringSchema(),
            installationId: stringSchema(),
            sourceKind: stringSchema({ enum: ['npm_mcp', 'github_mcp', 'mcp_config', 'local_skill'] }),
            source: stringSchema(),
            name: stringSchema(),
            title: stringSchema(),
            label: stringSchema(),
            description: stringSchema(),
            npmPackage: stringSchema(),
            version: stringSchema(),
            githubRepo: stringSchema(),
            localPath: stringSchema(),
            mcpServerName: stringSchema(),
            server: stringSchema(),
            mcpConfig: objectSchema(),
            serverConfig: objectSchema(),
            mcpArgs: arraySchema(stringSchema()),
            bin: stringSchema(),
            preferredBin: stringSchema(),
            skillId: stringSchema(),
            skillLabel: stringSchema(),
            skillDescription: stringSchema(),
            when: stringSchema(),
            triggers: arraySchema(stringSchema()),
            markdown: stringSchema(),
            mcpTools: arraySchema(objectSchema()),
            risk: stringSchema({ enum: ['low', 'medium', 'high'] }),
            validationCommands: arraySchema(stringSchema()),
            validate: arraySchema(stringSchema()),
            candidateDiff: stringSchema(),
            candidatePatchPath: stringSchema(),
            patchPath: stringSchema(),
            repairId: stringSchema(),
            dryRun: booleanSchema(),
            approved: booleanSchema(),
            includeHealth: booleanSchema(),
            timeoutMs: numberSchema({ minimum: 1000, maximum: 300000 }),
            validationTimeoutMs: numberSchema({ minimum: 1000, maximum: 300000 }),
            limit: numberSchema({ minimum: 1, maximum: 500 }),
            query: stringSchema(),
            type: stringSchema(),
            status: stringSchema()
        }),
        customValidate(args = {}) {
            const action = normalizeAction(args.action || args.operation || args.intent, 'registry');
            if (action === 'plan_install' && !normalizeString(args.request || args.capability || args.name || args.npmPackage || args.githubRepo || args.skillId)) {
                return ['capability_manager.plan_install requires request/capability/name/npmPackage/githubRepo/skillId'];
            }
            if (action === 'install_capability' && !normalizeString(args.planId || args.id || args.request || args.capability || args.name || args.npmPackage || args.githubRepo) && !args.plan) {
                return ['capability_manager.install_capability requires planId or install request fields'];
            }
            if (action === 'author_skill' && !normalizeString(args.skillId || args.id || args.capabilityId)) {
                return ['capability_manager.author_skill requires skillId/id/capabilityId'];
            }
            if (action === 'rollback' && !normalizeString(args.installationId || args.id)) {
                return ['capability_manager.rollback requires installationId/id'];
            }
            if (action === 'execute_repair' && !normalizeString(args.candidateDiff || args.candidatePatchPath || args.patchPath || args.repairId || args.id)) {
                return ['capability_manager.execute_repair requires candidateDiff/candidatePatchPath/patchPath/repairId'];
            }
            return [];
        }
    }),
    self_debugger: Object.freeze({
        id: 'self_debugger',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'high',
        approval: 'required-for-apply-patch',
        experience: TOOL_EXPERIENCE.self_debugger,
        returns: defaultReturns(),
        errors: defaultErrors([
            'debug_case_not_found',
            'debug_evidence_missing',
            'patch_proposal_required',
            'patch_validation_failed',
            'repair_patch_rejected'
        ]),
        schema: actionSchema(SELF_DEBUGGER_ACTIONS, {
            caseId: stringSchema(),
            id: stringSchema(),
            bugReport: stringSchema(),
            report: stringSchema(),
            message: stringSchema(),
            summary: stringSchema(),
            affectedCapability: stringSchema(),
            capability: stringSchema(),
            area: stringSchema(),
            symptoms: arraySchema(stringSchema()),
            sourceHints: arraySchema(stringSchema()),
            files: arraySchema(stringSchema()),
            recentRunId: stringSchema(),
            runId: stringSchema(),
            sessionId: stringSchema(),
            risk: stringSchema({ enum: ['low', 'medium', 'high'] }),
            status: stringSchema(),
            phase: stringSchema(),
            note: stringSchema(),
            title: stringSchema(),
            candidateDiff: stringSchema(),
            patch: stringSchema(),
            candidatePatchPath: stringSchema(),
            patchPath: stringSchema(),
            validationCommands: arraySchema(stringSchema()),
            validate: arraySchema(stringSchema()),
            tests: arraySchema(stringSchema()),
            maxTranscriptItems: numberSchema({ minimum: 1, maximum: 500 }),
            maxLogChars: numberSchema({ minimum: 1000, maximum: 200000 }),
            maxFileChars: numberSchema({ minimum: 1000, maximum: 200000 }),
            maxFiles: numberSchema({ minimum: 1, maximum: 100 }),
            approved: booleanSchema(),
            allowGitFallback: booleanSchema(),
            limit: numberSchema({ minimum: 1, maximum: 500 }),
            validationTimeoutMs: numberSchema({ minimum: 1000, maximum: 300000 })
        }),
        customValidate(args = {}) {
            const action = normalizeAction(args.action || args.operation || args.intent, 'open_case');
            const hasCase = Boolean(normalizeString(args.caseId || args.id));
            const hasReport = Boolean(normalizeString(args.bugReport || args.report || args.message || args.summary));
            const hasPatch = Boolean(normalizeString(args.candidateDiff || args.patch || args.candidatePatchPath || args.patchPath));
            if (['open_case', 'create_case', 'run_loop'].includes(action) && !hasReport) {
                return [`self_debugger.${action} requires bugReport/report/message/summary`];
            }
            if (['get_case', 'mark_case', 'close_case'].includes(action) && !hasCase) {
                return [`self_debugger.${action} requires caseId/id`];
            }
            if (['collect_evidence', 'diagnose'].includes(action) && !hasCase && !hasReport) {
                return [`self_debugger.${action} requires caseId/id or bugReport/report/message/summary`];
            }
            if (['validate_patch', 'apply_patch'].includes(action) && !hasCase && !hasPatch) {
                return [`self_debugger.${action} requires caseId/id or candidateDiff/candidatePatchPath`];
            }
            return [];
        }
    }),
    email: Object.freeze({
        id: 'email',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.email,
        returns: defaultReturns(),
        errors: defaultErrors(['email_provider_not_configured', 'email_auth_failed', 'email_send_failed']),
        schema: actionSchema(EMAIL_ACTIONS, {
            provider: stringSchema(),
            account: stringSchema(),
            filter: stringSchema(),
            query: stringSchema(),
            limit: numberSchema({ minimum: 1, maximum: 100 }),
            uid: stringSchema(),
            messageId: stringSchema(),
            to: stringSchema(),
            subject: stringSchema(),
            text: stringSchema(),
            body: stringSchema(),
            dryRun: booleanSchema()
        })
    }),
    file_manager: Object.freeze({
        id: 'file_manager',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.file_manager,
        returns: defaultReturns(),
        errors: defaultErrors(['scan_failed', 'quarantine_failed', 'restore_failed']),
        schema: actionSchema(FILE_MANAGER_ACTIONS, {
            path: stringSchema(),
            target: stringSchema(),
            profile: stringSchema(),
            dryRun: booleanSchema(),
            quarantine: booleanSchema()
        })
    }),
    computer: Object.freeze({
        id: 'computer',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'high',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.computer,
        returns: defaultReturns(),
        errors: defaultErrors(['path_outside_workspace', 'computer_exec_failed', 'session_not_found']),
        schema: actionSchema(COMPUTER_ACTIONS, {
            path: stringSchema(),
            target: stringSchema(),
            source: stringSchema(),
            destination: stringSchema(),
            content: stringSchema(),
            command: stringSchema(),
            cmd: stringSchema(),
            workdir: stringSchema(),
            sessionId: stringSchema(),
            x: numberSchema(),
            y: numberSchema(),
            endX: numberSchema(),
            endY: numberSchema(),
            delta: numberSchema(),
            durationMs: numberSchema({ minimum: 0, maximum: 60000 }),
            key: stringSchema(),
            keys: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            text: stringSchema(),
            outputPath: stringSchema(),
            timeoutMs: numberSchema({ minimum: 1000, maximum: 24 * 60 * 60 * 1000 })
        })
    }),
    code: Object.freeze({
        id: 'code',
        version: CONTRACT_VERSION,
        mutates: true,
        risk: 'medium',
        approval: 'policy',
        experience: TOOL_EXPERIENCE.code,
        returns: defaultReturns(),
        errors: defaultErrors(['diagnostics_failed', 'test_failed', 'git_failed', 'refactor_failed']),
        schema: actionSchema(CODE_ACTIONS, {
            path: stringSchema(),
            query: stringSchema(),
            from: stringSchema(),
            to: stringSchema(),
            command: stringSchema(),
            cwd: stringSchema(),
            includeSymbols: booleanSchema()
        })
    }),
    artifact_verifier: Object.freeze({
        id: 'artifact_verifier',
        version: CONTRACT_VERSION,
        mutates: false,
        risk: 'low',
        approval: 'never',
        experience: TOOL_EXPERIENCE.artifact_verifier,
        returns: defaultReturns(),
        errors: defaultErrors(['file_not_found', 'path_outside_workspace', 'parse_failed', 'verification_failed']),
        schema: actionSchema(['schema', 'detect', 'verify'], {
            path: stringSchema(),
            target: stringSchema(),
            file: stringSchema(),
            filename: stringSchema(),
            contract: stringSchema(),
            profile: stringSchema(),
            format: stringSchema({ enum: ['auto', 'json', 'jsonl', 'csv', 'tsv', 'yaml', 'yml', 'toml', 'markdown', 'md', 'log', 'text'] }),
            kind: stringSchema(),
            encoding: stringSchema(),
            maxBytes: numberSchema({ minimum: 1, maximum: 50 * 1024 * 1024 }),
            requiredKeys: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            requiredFields: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            requiredColumns: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            requiredHeadings: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            requiredSections: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            contains: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            mustContain: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            requiredText: { anyOf: [stringSchema(), arraySchema(stringSchema())] },
            minRows: numberSchema({ minimum: 0, maximum: 1000000 }),
            minItems: numberSchema({ minimum: 0, maximum: 1000000 }),
            minLines: numberSchema({ minimum: 0, maximum: 1000000 }),
            minHeadings: numberSchema({ minimum: 0, maximum: 100000 }),
            minLinks: numberSchema({ minimum: 0, maximum: 100000 }),
            maxErrors: numberSchema({ minimum: 0, maximum: 1000000 })
        })
    }),
    'vision.capture_context': Object.freeze({
        id: 'vision.capture_context',
        version: CONTRACT_VERSION,
        mutates: false,
        risk: 'low',
        approval: 'vision-policy',
        experience: TOOL_EXPERIENCE.vision_capture_context,
        returns: defaultReturns(),
        errors: defaultErrors(['vision_permission_required', 'capture_failed', 'vision_model_failed']),
        schema: actionSchema(['schema', 'capture_context'], {
            target: stringSchema({ enum: ['screen', 'chat-window', 'active-window', 'region', 'pet-window', 'control-window'] }),
            source: stringSchema(),
            reason: stringSchema(),
            question: stringSchema()
        })
    })
});

function validatePrimitiveType(value, expectedType) {
    if (expectedType === 'array') {
        return Array.isArray(value);
    }
    if (expectedType === 'object') {
        return isPlainObject(value);
    }
    if (expectedType === 'number') {
        return typeof value === 'number' && Number.isFinite(value);
    }
    if (expectedType === 'integer') {
        return Number.isInteger(value);
    }
    if (expectedType === 'boolean') {
        return typeof value === 'boolean';
    }
    if (expectedType === 'string') {
        return typeof value === 'string';
    }
    return true;
}

function validateAgainstSchema(value, schema = {}, path = '$') {
    const errors = [];
    if (!schema || typeof schema !== 'object') {
        return errors;
    }
    if (Array.isArray(schema.anyOf)) {
        const variants = schema.anyOf.map((variant) => validateAgainstSchema(value, variant, path));
        if (!variants.some((variantErrors) => variantErrors.length === 0)) {
            errors.push(`${path} must match at least one schema variant`);
        }
        return errors;
    }
    if (schema.type && !validatePrimitiveType(value, schema.type)) {
        errors.push(`${path} must be ${schema.type}`);
        return errors;
    }
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
    }
    if (typeof value === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(`${path} must have length >= ${schema.minLength}`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(`${path} must have length <= ${schema.maxLength}`);
        }
    }
    if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${path} must be >= ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${path} must be <= ${schema.maximum}`);
        }
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push(`${path} must contain at most ${schema.maxItems} item(s)`);
        }
        if (schema.items) {
            value.forEach((entry, index) => {
                errors.push(...validateAgainstSchema(entry, schema.items, `${path}[${index}]`));
            });
        }
    }
    if (isPlainObject(value)) {
        for (const key of schema.required || []) {
            if (value[key] === undefined) {
                errors.push(`${path}.${key} is required`);
            }
        }
        for (const [key, propertySchema] of Object.entries(schema.properties || {})) {
            if (value[key] !== undefined) {
                errors.push(...validateAgainstSchema(value[key], propertySchema, `${path}.${key}`));
            }
        }
        if (schema.additionalProperties === false) {
            const allowed = new Set(Object.keys(schema.properties || {}));
            for (const key of Object.keys(value)) {
                if (!allowed.has(key)) {
                    errors.push(`${path}.${key} is not allowed`);
                }
            }
        }
    }
    return errors;
}

function normalizeArgsForContract(toolId, args = {}) {
    if (!isPlainObject(args)) {
        return {};
    }
    const normalized = { ...args };
    if (['email', 'file_manager', 'computer', 'code', 'artifact_verifier', 'mcp_bridge', 'tool_doctor', 'capability_manager', 'self_debugger', 'subagents', 'vision.capture_context'].includes(toolId)) {
        normalized.action = normalizeAction(
            args.action || args.operation || args.intent,
            toolId === 'vision.capture_context' ? 'capture_context' : 'schema'
        );
    }
    if (toolId === 'mcp_bridge') {
        normalized.tool = normalizeString(args.tool || args.name || args.toolName || args.tool_name);
        const explicitArgs =
            args.args ||
            args.arguments ||
            args.tool_args ||
            args.toolArgs ||
            args.parameters ||
            args.params;
        if (isPlainObject(explicitArgs)) {
            normalized.args = { ...explicitArgs };
        }
    }
    return normalized;
}

function getToolContract(toolId) {
    return TOOL_CONTRACTS[toolId] || null;
}

function listToolContracts() {
    return Object.values(TOOL_CONTRACTS).map((contract) => ({
        id: contract.id,
        version: contract.version,
        mutates: contract.mutates,
        risk: contract.risk,
        approval: contract.approval,
        experience: cloneJson(contract.experience || {}),
        schema: cloneJson(contract.schema),
        returns: cloneJson(contract.returns || STANDARD_TOOL_RETURN_SCHEMA),
        errors: [...(contract.errors || STANDARD_TOOL_ERROR_CODES)]
    }));
}

function compactSchemaForPrompt(schema = {}) {
    const clone = cloneJson(schema);
    return JSON.stringify(clone, null, 2);
}

function getToolContractPromptText(toolId) {
    const contract = getToolContract(toolId);
    if (!contract) {
        return '';
    }
    const actions = contract.schema?.properties?.action?.enum || [];
    const lines = [
        `TOOL CONTRACT ${contract.id}@v${contract.version}`,
        `risk=${contract.risk}; mutates=${contract.mutates ? 'true' : 'false'}; approval=${contract.approval}`,
        contract.experience ? `experience=${JSON.stringify(contract.experience)}` : '',
        actions.length ? `actions=${actions.join(', ')}` : '',
        'input_schema:',
        compactSchemaForPrompt(contract.schema),
        'return_schema:',
        compactSchemaForPrompt(contract.returns || STANDARD_TOOL_RETURN_SCHEMA),
        `error_codes=${(contract.errors || STANDARD_TOOL_ERROR_CODES).join(', ')}`
    ];
    return lines.filter(Boolean).join('\n');
}

function buildToolContractsPrompt(toolIds = []) {
    const ids = Array.isArray(toolIds) && toolIds.length
        ? toolIds
        : Object.keys(TOOL_CONTRACTS);
    return ids
        .map((id) => getToolContractPromptText(id))
        .filter(Boolean)
        .join('\n\n');
}

function listToolContractSummaries(toolIds = []) {
    const ids = Array.isArray(toolIds) && toolIds.length
        ? toolIds
        : Object.keys(TOOL_CONTRACTS);
    return ids
        .map((id) => getToolContract(id))
        .filter(Boolean)
        .map((contract) => ({
            id: contract.id,
            version: contract.version,
            risk: contract.risk,
            mutates: contract.mutates,
            approval: contract.approval,
            experience: cloneJson(contract.experience || {}),
            actions: contract.schema?.properties?.action?.enum || [],
            errors: [...(contract.errors || STANDARD_TOOL_ERROR_CODES)]
        }));
}

function validateToolContract(toolId, args = {}) {
    const contract = getToolContract(toolId);
    if (!contract) {
        return {
            ok: true,
            status: 'no_contract',
            contract: null,
            args
        };
    }
    const normalizedArgs = normalizeArgsForContract(toolId, args);
    const errors = validateAgainstSchema(normalizedArgs, contract.schema);
    if (typeof contract.customValidate === 'function') {
        errors.push(...contract.customValidate(normalizedArgs));
    }
    return {
        ok: errors.length === 0,
        status: errors.length ? 'invalid_tool_args' : 'validated',
        errors,
        contract: {
            id: contract.id,
            version: contract.version,
            mutates: contract.mutates,
            risk: contract.risk,
            approval: contract.approval,
            experience: cloneJson(contract.experience || {})
        },
        args: normalizedArgs
    };
}

module.exports = {
    CONTRACT_VERSION,
    TOOL_CONTRACTS,
    TOOL_EXPERIENCE,
    getToolContract,
    listToolContracts,
    listToolContractSummaries,
    getToolContractPromptText,
    buildToolContractsPrompt,
    validateAgainstSchema,
    validateToolContract
};
