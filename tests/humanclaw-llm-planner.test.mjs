import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { HumanClawGateway } = require('../electron/humanclaw-gateway.cjs');
const { resolveAgentDecisionTimeoutMs } = require('../electron/humanclaw-agent-runner.cjs');

async function jsonFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'content-type': 'application/json',
            ...(options.headers || {})
        }
    });
    const body = await response.json();
    return { response, body };
}

async function runAgent(baseUrl, payload) {
    return await jsonFetch(`${baseUrl}/agent/run`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function createMockChatCompletionsServer() {
    const calls = [];
    let agentDecisionCount = 0;
    const server = http.createServer(async (req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            const payload = raw ? JSON.parse(raw) : {};
            const messages = payload.messages || [];
            const system = messages.find((message) => message.role === 'system')?.content || '';
            calls.push({ url: req.url, system, payload });

            agentDecisionCount += 1;
            const decisions = [
                {
                      mode: 'task',
                      intent: 'create_workspace_note',
                      summary: '创建目录并写入说明文件',
                      action: 'tool',
                      plan_update: ['先创建目标目录'],
                      tool_call: {
                          tool: 'computer',
                          title: '创建目标目录',
                          args: { action: 'mkdir', path: 'planner-output' }
                      }
                },
                {
                    mode: 'task',
                    intent: 'create_workspace_note',
                    summary: '创建目录并写入说明文件',
                    action: 'tool',
                    plan_update: ['目录已创建，写入说明文件'],
                    tool_call: {
                        tool: 'computer',
                        title: '写入说明文件',
                        args: {
                            action: 'write',
                            path: 'planner-output/README.txt',
                            content: 'Agentic Executor OK\n'
                        }
                    }
                },
                {
                    mode: 'task',
                    intent: 'create_workspace_note',
                    summary: '创建目录并写入说明文件',
                    action: 'tool',
                    plan_update: ['读取文件进行复核'],
                    tool_call: {
                        tool: 'computer',
                        title: '读取说明文件复核',
                        args: { action: 'read', path: 'planner-output/README.txt' }
                    }
                },
                {
                    mode: 'task',
                    intent: 'create_workspace_note',
                    summary: '创建目录并写入说明文件',
                    action: 'final',
                    final_answer: '**Agentic Executor 已完成**\n\n- 目录和 README.txt 已创建\n- 已读取复核通过'
                }
            ];
            const content = JSON.stringify(decisions[Math.min(agentDecisionCount, decisions.length) - 1]);

            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                choices: [
                    {
                        message: { content }
                    }
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
            }));
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
        url: `http://127.0.0.1:${address.port}/v1`,
        calls,
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

async function createScriptedChatCompletionsServer(decisionFactory) {
    const calls = [];
    let decisionCount = 0;
    const server = http.createServer(async (req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            const payload = raw ? JSON.parse(raw) : {};
            const messages = payload.messages || [];
            const system = messages.find((message) => message.role === 'system')?.content || '';
            decisionCount += 1;
            calls.push({ url: req.url, system, payload, decisionCount });
            const decision = decisionFactory({ decisionCount, payload, messages, system });
            const content = typeof decision === 'string' ? decision : JSON.stringify(decision);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                choices: [
                    {
                        message: { content }
                    }
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
            }));
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
        url: `http://127.0.0.1:${address.port}/v1`,
        calls,
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

test('Agentic Executor widens decision timeout after vision context is involved', () => {
    assert.equal(
        resolveAgentDecisionTimeoutMs({ timeoutMs: 25000 }, { events: [], stepResults: [] }),
        45000
    );
    assert.equal(
        resolveAgentDecisionTimeoutMs(
            { timeoutMs: 25000 },
            {
                events: [],
                stepResults: [{ response: { ok: false, status: 'error' } }]
            }
        ),
        60000
    );
    assert.equal(
        resolveAgentDecisionTimeoutMs(
            { timeoutMs: 25000 },
            {
                events: [
                    {
                        type: 'capability_context',
                        loaded: { skills: ['vision'], tools: [] },
                        request: { skills: ['vision'], tools: [] }
                    }
                ],
                stepResults: []
            }
        ),
        90000
    );
    assert.equal(
        resolveAgentDecisionTimeoutMs(
            { timeoutMs: 25000 },
            {
                events: [
                    {
                        type: 'tool_result',
                        tool: 'vision.capture_context',
                        status: 'completed',
                        ok: true
                    }
                ],
                stepResults: []
            }
        ),
        90000
    );
    assert.equal(
        resolveAgentDecisionTimeoutMs(
            { timeoutMs: 30000 },
            {
                events: [{ type: 'tool_result', tool: 'vision.capture_context', status: 'completed' }],
                stepResults: [],
                requestContext: { visionAgentDecisionTimeoutMs: 65000 }
            }
        ),
        65000
    );
});

test('Agentic Executor Loop asks confirmation, resumes, observes, and keeps calling tools until final', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-llm-planner-'));
    const llmServer = await createMockChatCompletionsServer();
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-planner',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const baseUrl = status.url;
        const first = await runAgent(baseUrl, {
            sessionId: 'llm-planner-test',
            message: '帮我创建一个 planner-output 目录，并写入 README.txt',
            agentLoop: 'llm',
            llmSettings,
            context: { workspace: workspaceRoot }
        });

        assert.equal(first.body.ok, false);
        assert.equal(first.body.status, 'needs_approval');
        assert.equal(first.body.planner, 'llm-agentic-executor');
        assert.equal(first.body.confirmationRequired, true);
        assert.equal(first.body.approvalType, 'agent_tool_call');
        assert.ok(first.body.approvalId);
        assert.doesNotMatch(first.body.displayText, /Agentic Executor Loop|确认编号/);
        assert.equal(first.body.plan.length, 1);
        assert.equal(first.body.plan[0].args.action, 'mkdir');
        await assert.rejects(
            () => fs.readFile(path.join(workspaceRoot, 'planner-output', 'README.txt'), 'utf8'),
            /ENOENT/
        );

        const classifyConfirm = await runAgent(baseUrl, {
            sessionId: 'llm-planner-test',
            message: '确认执行',
            classifyOnly: true,
            context: { workspace: workspaceRoot }
        });
        assert.equal(classifyConfirm.body.intent, 'agent_action_confirmation');
        assert.equal(classifyConfirm.body.mode, 'task');
        assert.equal(classifyConfirm.body.approvalId, first.body.approvalId);

        const directWithoutApproval = await runAgent(baseUrl, {
            sessionId: 'llm-planner-test',
            message: 'api direct confirm',
            confirmApprovalId: first.body.approvalId,
            llmSettings,
            context: { workspace: workspaceRoot }
        });
        assert.equal(directWithoutApproval.body.status, 'needs_approval');

        const confirmed = await runAgent(baseUrl, {
            sessionId: 'llm-planner-test',
            message: '确认执行',
            llmSettings,
            context: { workspace: workspaceRoot }
        });
        assert.equal(confirmed.body.ok, true, confirmed.body.displayText);
        assert.equal(confirmed.body.status, 'completed');
        assert.equal(confirmed.body.planner, 'llm-agentic-executor');
        assert.equal(confirmed.body.steps.length, 3);
        assert.ok(confirmed.body.events.length >= 6);
        assert.match(confirmed.body.displayText, /\*\*(Agentic Executor|任务执行流程) 已完成\*\*/);
        assert.match(confirmed.body.displayText, /- 已读取复核通过/);

        const text = await fs.readFile(path.join(workspaceRoot, 'planner-output', 'README.txt'), 'utf8');
        assert.match(text, /Agentic Executor OK/);
        assert.equal(llmServer.calls.filter((call) => /HumanClaw Agentic Executor/.test(call.system)).length, 4);
        assert.match(llmServer.calls[0].system, /名字固定为AIGL/);
        assert.match(llmServer.calls[0].system, /具备人工智能/);
        assert.match(llmServer.calls[0].system, /不要依赖外部分类结果/);
        assert.doesNotMatch(llmServer.calls[0].system, /不具备任何人工智能/);
        assert.doesNotMatch(llmServer.calls[0].system, /邮箱 SKILL/);
        assert.match(llmServer.calls[0].system, /final_answer 字段是给用户看的 Markdown 字符串/);
        assert.equal(llmServer.calls[0].payload.messages[1].content.includes('"initial_plan_hint": null'), true);
        const firstPromptPayload = JSON.parse(llmServer.calls[0].payload.messages.find((entry) => entry.role === 'user').content);
        assert.equal(firstPromptPayload.capability_catalog.tool_contracts, undefined);
        assert.equal(firstPromptPayload.capability_catalog.deferred_contracts, true);
        assert.ok(firstPromptPayload.capability_catalog.tools.every((tool) => tool.contract === 'deferred'));
        assert.doesNotMatch(JSON.stringify(firstPromptPayload.capability_catalog), /TOOL CONTRACT|input_schema|return_schema/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor restores pending approval from durable store after Gateway restart', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-pending-restore-'));
    const auditDir = path.join(workspaceRoot, '.audit');
    const llmServer = await createMockChatCompletionsServer();
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-planner',
        temperature: 0.1,
        timeoutMs: 10000
    };
    let gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir
    });

    try {
        const status = await gateway.start();
        const first = await runAgent(status.url, {
            sessionId: 'pending-restore-test',
            message: '帮我创建一个 planner-output 目录，并写入 README.txt',
            agentLoop: 'llm',
            llmSettings,
            context: { workspace: workspaceRoot }
        });
        assert.equal(first.body.status, 'needs_approval');
        const approvalId = first.body.approvalId;
        const storePath = path.join(auditDir, 'pending-agent-state.json');
        const stored = JSON.parse(await fs.readFile(storePath, 'utf8'));
        assert.equal(stored.pendingAgentApprovals[0].approvalId, approvalId);
        assert.equal(JSON.stringify(stored).includes('test-key'), false);

        await gateway.stop();

        gateway = new HumanClawGateway({
            port: 0,
            workspaceRoot,
            projectRoot: path.resolve('.'),
            auditDir
        });
        const restarted = await gateway.start();
        assert.equal(restarted.agentRunner.restoredPendingAgentApprovalCount, 1);

        const confirmed = await runAgent(restarted.url, {
            sessionId: 'pending-restore-test',
            message: '确认执行',
            llmSettings,
            context: { workspace: workspaceRoot }
        });
        assert.equal(confirmed.body.ok, true, confirmed.body.displayText);
        assert.equal(confirmed.body.status, 'completed');
        assert.match(confirmed.body.displayText, /(Agentic Executor|任务执行流程) 已完成/);

        const text = await fs.readFile(path.join(workspaceRoot, 'planner-output', 'README.txt'), 'utf8');
        assert.match(text, /Agentic Executor OK/);
        const cleared = JSON.parse(await fs.readFile(storePath, 'utf8'));
        assert.equal(cleared.pendingAgentApprovals.length, 0);
    } finally {
        await gateway.stop().catch(() => {});
        await llmServer.close();
    }
});

test('Agentic Executor can request approved read-only vision context', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-vision-agent-'));
    const captured = [];
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount, messages }) => {
        const hasImageInput = messages.some((message) =>
            Array.isArray(message.content) &&
            message.content.some((part) => part?.type === 'image_url')
        );
        if (hasImageInput) {
            return '我看到截图里有一个桌面端聊天窗口，界面没有明显崩溃。';
        }
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'vision_check',
                summary: '需要视觉感知能力',
                action: 'load_context',
                capability_request: {
                    skills: ['vision'],
                    tools: ['vision.capture_context'],
                    mcp: [],
                    reason: '用户要求观察当前屏幕'
                }
            };
        }
        if (decisionCount === 2) {
            return {
                mode: 'task',
                intent: 'vision_check',
                summary: '请求只读视觉上下文',
                action: 'tool',
                tool_call: {
                    tool: 'vision.capture_context',
                    title: '看一眼当前屏幕',
                    args: {
                        action: 'capture_context',
                        target: 'screen',
                        reason: '用户要求判断桌面端视觉截图功能是否正常',
                        question: '当前聊天窗口、桌宠窗口和控制台是否正常运行？'
                    }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'vision_check',
            summary: '已经获得视觉 observation',
            action: 'final',
            final_answer: '我看到了当前界面：聊天窗口存在，未发现明显崩溃；如果要更精确，需要你框选异常区域。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-vision-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit'),
        visionServices: {
            permissionPolicy: 'manual',
            getLlmSettings: () => llmSettings,
            capture: async ({ target, reason }) => {
                captured.push({ target, reason });
                return {
                    type: 'vision',
                    id: 'snapshot-test',
                    source: target,
                    label: '屏幕截图',
                    imagePath: path.join(workspaceRoot, 'snapshot.png'),
                    thumbnailPath: path.join(workspaceRoot, 'snapshot.thumb.png'),
                    dataUrl: 'data:image/png;base64,AAAA',
                    thumbnailDataUrl: 'data:image/png;base64,BBBB',
                    mimeType: 'image/png',
                    width: 1280,
                    height: 720,
                    createdAt: new Date(0).toISOString()
                };
            }
        }
    });

    try {
        const status = await gateway.start();
        const baseUrl = status.url;
        const first = await runAgent(baseUrl, {
            sessionId: 'vision-agent-test',
            message: '帮我观察当前屏幕，判断聊天窗口和桌宠是否正常。',
            agentLoop: 'llm',
            llmSettings,
            context: { workspace: workspaceRoot }
        });

        assert.equal(first.body.ok, false);
        assert.equal(first.body.status, 'needs_approval');
        assert.equal(first.body.approvalType, 'vision_capture_context');
        assert.match(first.body.displayText, /先得到你的确认/);
        assert.match(first.body.displayText, /看一眼当前画面|看一眼屏幕/);
        assert.doesNotMatch(first.body.displayText, /确认编号|Agentic Executor/);
        assert.equal(captured.length, 0);

        const confirmed = await runAgent(baseUrl, {
            sessionId: 'vision-agent-test',
            message: '确认执行',
            llmSettings,
            context: { workspace: workspaceRoot }
        });

        assert.equal(confirmed.body.ok, true, confirmed.body.displayText);
        assert.equal(confirmed.body.status, 'completed');
        assert.equal(captured.length, 1);
        assert.equal(captured[0].target, 'screen');
        assert.match(confirmed.body.displayText, /聊天窗口存在/);
        assert.ok(
            llmServer.calls.some((call) => /VISION SKILL/.test(call.payload.messages?.[1]?.content || call.system))
        );
        assert.ok(
            llmServer.calls.some((call) =>
                call.payload.messages?.some((message) =>
                    Array.isArray(message.content) &&
                    message.content.some((part) => part?.type === 'image_url')
                )
            )
        );
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor skips vision confirmation when full computer control is enabled', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-vision-full-control-'));
    const captured = [];
    let agentDecisionCount = 0;
    const llmServer = await createScriptedChatCompletionsServer(({ messages }) => {
        const hasImageInput = messages.some((message) =>
            Array.isArray(message.content) &&
            message.content.some((part) => part?.type === 'image_url')
        );
        if (hasImageInput) {
            return '我看到桌面上有 AIGL 聊天窗口和桌宠，截图链路正常。';
        }
        agentDecisionCount += 1;
        if (agentDecisionCount === 1) {
            return {
                mode: 'task',
                intent: 'vision_full_control_check',
                summary: '完全控制下直接获取视觉上下文',
                action: 'tool',
                tool_call: {
                    tool: 'vision.capture_context',
                    title: '看一眼当前屏幕',
                    args: {
                        action: 'capture_context',
                        target: 'screen',
                        reason: '用户已开启完全控制能力，排查视觉功能状态',
                        question: '当前视觉功能是否正常？'
                    }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'vision_full_control_check',
            summary: '视觉检查完成',
            action: 'final',
            final_answer: '我看到了当前屏幕，AIGL 聊天窗口和桌宠都在，视觉截图链路正常。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-vision-full-control-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit'),
        defaultContext: {
            computerControlEnabled: true,
            permissionProfile: 'danger-full-access',
            approvalPolicy: 'auto',
            confirmationPolicy: 'auto',
            visionPermissionPolicy: 'manual',
            approved: true,
            autoConfirm: true,
            allowComputerWideAccess: true,
            allowSystemMutation: true
        },
        visionServices: {
            permissionPolicy: 'manual',
            getLlmSettings: () => llmSettings,
            capture: async ({ target, reason }) => {
                captured.push({ target, reason });
                return {
                    type: 'vision',
                    id: 'snapshot-full-control-test',
                    source: target,
                    label: '屏幕截图',
                    imagePath: path.join(workspaceRoot, 'snapshot.png'),
                    thumbnailPath: path.join(workspaceRoot, 'snapshot.thumb.png'),
                    dataUrl: 'data:image/png;base64,AAAA',
                    thumbnailDataUrl: 'data:image/png;base64,BBBB',
                    mimeType: 'image/png',
                    width: 1280,
                    height: 720,
                    createdAt: new Date(0).toISOString()
                };
            }
        }
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'vision-full-control-test',
            message: 'AIGL，直接看一下当前屏幕，判断视觉截图功能是否正常。',
            agentLoop: 'llm',
            llmSettings,
            context: { workspace: workspaceRoot }
        });

        assert.equal(result.body.ok, true, result.body.displayText);
        assert.equal(result.body.status, 'completed');
        assert.equal(result.body.confirmationRequired, undefined);
        assert.equal(captured.length, 1);
        assert.equal(captured[0].target, 'screen');
        assert.match(result.body.displayText, /视觉截图链路正常/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor max-step fallback does not expose raw tool logs to the user', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-max-step-'));
    await fs.writeFile(path.join(workspaceRoot, 'note.txt'), 'secret-ish line\n'.repeat(80), 'utf8');
    const llmServer = await createScriptedChatCompletionsServer(() => ({
        mode: 'task',
        intent: 'read_until_limit',
        summary: '检查本地 note 文件',
        action: 'tool',
        tool_call: {
            tool: 'read',
            title: '读取 note.txt',
            args: { path: 'note.txt' }
        }
    }));
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-max-step-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'max-step-test',
            message: '检查 note.txt',
            agentLoop: 'llm',
            maxAgentSteps: 1,
            llmSettings,
            context: { workspace: workspaceRoot }
        });
        assert.equal(result.body.ok, false);
        assert.equal(result.body.status, 'max_steps_reached');
        assert.match(result.body.displayText, /先停住|还没有形成足够稳的结论/);
        assert.doesNotMatch(result.body.displayText, /```|secret-ish line|Agentic Executor|我已经做过这些步骤|读取 note\.txt：完成/);
        assert.equal(result.body.surface.source, 'agent_max_steps');
        assert.equal(result.body.surface.bubbleText, '我先停住，避免越跑越乱。');
        assert.equal(result.body.steps.length, 1);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor keeps deprecated task layers out of the model prompt', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-codex-turn-prompt-'));
    const llmServer = await createScriptedChatCompletionsServer(() => ({
        mode: 'task',
        intent: 'research_reading',
        summary: '给论文做概要分析',
        action: 'blocked',
        blocked_reason: '我现在还没有读取到论文原文，所以不能把概要说成已经完成。'
    }));
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-evidence-gate-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'codex-turn-prompt-test',
            message: '读一下这篇论文《Generative Agents: Interactive Simulacra of Human Behavior》，给我一个概要分析。',
            agentLoop: 'llm',
            maxAgentSteps: 3,
            llmSettings,
            memoryContext: {
                memory_context: {
                    current_dialogue: {
                        type: 'research_reading'
                    }
                }
            },
            context: {
                workspace: workspaceRoot,
                memoryContext: {
                    memory_context: {
                        current_dialogue: {
                            type: 'research_reading'
                        }
                    }
                }
            }
        });

        assert.equal(result.body.ok, false);
        assert.equal(result.body.status, 'blocked');
        assert.equal(result.body.taskSpec, undefined);
        assert.equal(result.body.evidenceLedger, undefined);
        assert.equal(result.body.taskGraph, undefined);
        assert.equal(result.body.events.some((event) => event.type === 'evidence_recovery'), false);
        assert.match(result.body.displayText, /没有读取到论文原文|不能把概要说成已经完成/);
        assert.equal(result.body.surface.renderer, 'aigl-persona-renderer');
        assert.equal(llmServer.calls.length, 1);
        const llmUserPayload = JSON.parse(llmServer.calls[0].payload.messages.find((entry) => entry.role === 'user').content);
        assert.equal(llmUserPayload.task_brief, undefined);
        assert.equal(llmUserPayload.task_spec, undefined);
        assert.equal(llmUserPayload.evidence_ledger, undefined);
        assert.equal(llmUserPayload.task_graph, undefined);
        assert.equal(llmUserPayload.recent_turn_items.model, 'codex_like_turn_items');
        assert.equal(llmUserPayload.runtime_diagnostics, undefined);
        assert.doesNotMatch(llmServer.calls[0].system, /task_brief|TaskSpec|Evidence Ledger|Task Graph/);
        assert.match(llmServer.calls[0].system, /recent_turn_items/);
        assert.doesNotMatch(llmServer.calls[0].system, /runtime_diagnostics/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor keeps generic official-doc tasks Codex-like in the first prompt', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-generic-doc-prompt-'));
    const llmServer = await createScriptedChatCompletionsServer(() => ({
        mode: 'task',
        intent: 'browser_documentation',
        summary: '需要先查官方文档',
        action: 'final',
        final_answer: '我会先查官方文档，再写 browser-wait-example.md。'
    }));
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-generic-doc-prompt-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'generic-doc-prompt-test',
            message: 'AIGL，帮我查一下 Playwright 里如何等待元素出现，然后给我写一个最小可运行的 JS 示例，保存成 browser-wait-example.md。要求说明 timeout 怎么设置',
            agentLoop: 'llm',
            maxAgentSteps: 1,
            llmSettings,
            context: {
                workspace: workspaceRoot
            }
        });

        assert.equal(result.body.taskSpec, undefined);
        assert.equal(result.body.evidenceLedger, undefined);
        assert.equal(result.body.taskGraph, undefined);
        assert.equal(llmServer.calls.length, 1);
        const llmUserPayload = JSON.parse(llmServer.calls[0].payload.messages.find((entry) => entry.role === 'user').content);
        assert.equal(llmUserPayload.task_brief, undefined);
        assert.equal(llmUserPayload.recent_turn_items.items.some((item) => item.type === 'task_brief'), false);
        assert.match(llmServer.calls[0].system, /技术文档\/API\/官方文档/);
        assert.match(JSON.stringify(llmUserPayload.capability_catalog), /官方技术文档|API 用法|PDF/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor feeds tool results back as Codex-like turn items', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-evidence-recovery-'));
    await fs.writeFile(
        path.join(workspaceRoot, 'paper.md'),
        'Generative Agents paper notes: memory stream, reflection, planning, and retrieval are the main pieces.',
        'utf8'
    );
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'research_reading',
                summary: '补齐论文资料证据',
                action: 'tool',
                tool_call: {
                    tool: 'computer',
                    title: '读取论文资料',
                    args: { action: 'read', path: 'paper.md' }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'research_reading',
            summary: '基于读取证据总结',
            action: 'final',
            final_answer: '我这次是基于读到的 paper.md 来说：它主要围绕 memory stream、reflection、planning 和 retrieval 组织智能体行为。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-evidence-recovery-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'evidence-recovery-test',
            message: '读一下 paper.md，给我一个概要分析。',
            agentLoop: 'llm',
            maxAgentSteps: 4,
            llmSettings,
            context: {
                workspace: workspaceRoot
            }
        });

        assert.equal(result.body.ok, true, result.body.displayText);
        assert.equal(result.body.status, 'completed');
        assert.equal(result.body.events.filter((event) => event.type === 'evidence_recovery').length, 0);
        assert.equal(result.body.steps.length, 1);
        assert.match(result.body.displayText, /memory stream|reflection|planning|retrieval/);
        assert.equal(llmServer.calls.length, 2);
        const secondPayload = JSON.parse(llmServer.calls[1].payload.messages.find((entry) => entry.role === 'user').content);
        assert.equal(secondPayload.recent_turn_items.model, 'codex_like_turn_items');
        assert.ok(secondPayload.recent_turn_items.items.some((item) =>
            item.type === 'tool_result' &&
            item.status === 'completed' &&
            /memory stream|reflection|planning|retrieval/.test(item.preview)
        ));
        assert.equal(secondPayload.runtime_diagnostics, undefined);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor allows zero-observation final answers without evidence warnings', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-final-deferral-'));
    await fs.writeFile(path.join(workspaceRoot, 'paper.md'), 'Observed paper evidence from a local file.', 'utf8');
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'research_reading',
                summary: '直接总结论文',
                action: 'final',
                final_answer: '我已经读完并总结好了。'
            };
        }
        if (decisionCount === 2) {
            return {
                mode: 'task',
                intent: 'research_reading',
                summary: '先读取证据',
                action: 'tool',
                tool_call: {
                    tool: 'computer',
                    title: '读取论文证据',
                    args: { action: 'read', path: 'paper.md' }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'research_reading',
            summary: '基于证据总结',
            action: 'final',
            final_answer: '基于读取到的 paper.md 证据，可以继续写概要。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-final-deferral-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'final-deferral-test',
            message: '读一下 paper.md，给我一个概要分析。',
            agentLoop: 'llm',
            maxAgentSteps: 4,
            llmSettings,
            context: {
                workspace: workspaceRoot
            }
        });

        assert.equal(result.body.ok, true, result.body.displayText);
        assert.equal(result.body.status, 'completed');
        assert.equal(llmServer.calls.length, 1);
        assert.equal(result.body.steps.length, 0);
        assert.equal(result.body.events.some((event) => event.status === 'final_without_observation_warning'), false);
        assert.match(result.body.displayText, /我已经读完并总结好了/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor treats missing command failures as observations for the next decision', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-tool-failure-observation-'));
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'research_reading',
                summary: '尝试用外部解析器读取页面',
                action: 'tool',
                tool_call: {
                    tool: 'computer',
                    title: '尝试外部 HTML 解析器',
                    args: {
                        action: 'exec',
                        command: '__aigl_missing_parser_tool__ --version',
                        reason: '模拟一个缺失的解析依赖'
                    }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'research_reading',
            summary: '外部解析器不可用，换稳定路径',
            action: 'final',
            final_answer: '这个外部解析器不可用。下一步应该换成内置 web/pdf 读取工具，而不是卡在这一步。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-tool-failure-observation-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'tool-failure-observation-test',
            message: '读一下 https://arxiv.org/abs/1706.03762，先拿页面证据。',
            agentLoop: 'llm',
            maxAgentSteps: 3,
            llmSettings,
            context: {
                workspace: workspaceRoot,
                approved: true,
                confirmationPolicy: 'auto'
            }
        });

        assert.equal(llmServer.calls.length, 2);
        assert.equal(result.body.events.filter((event) => event.type === 'evidence_recovery').length, 0);
        assert.equal(result.body.steps.length, 1);
        assert.equal(result.body.steps[0].response.ok, false);
        const secondPayload = JSON.parse(llmServer.calls[1].payload.messages.find((entry) => entry.role === 'user').content);
        assert.ok(secondPayload.recent_turn_items.items.some((item) =>
            item.type === 'tool_result' &&
            item.status === 'failed' &&
            /__aigl_missing_parser_tool__|not recognized|not found|无法将/.test(item.preview)
        ));
        assert.ok(secondPayload.recent_turn_items.items.some((item) =>
            item.type === 'tool_result' &&
            item.status === 'failed' &&
            item.error_type === 'missing_dependency' &&
            /available cross-platform path|PowerShell|Node\.js/.test(item.recovery_hint)
        ));
        assert.match(result.body.displayText, /外部解析器不可用|换成内置/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor loads email skill on model request and normalizes new-mail actions', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-email-agent-skill-'));
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'email_management',
                summary: '需要邮箱能力',
                action: 'load_context',
                capability_request: {
                    skills: ['email'],
                    tools: ['email'],
                    mcp: [],
                    reason: '需要检查新邮件'
                }
            };
        }
        return {
            mode: 'task',
            intent: 'email_management',
            summary: '检查新邮件',
            action: 'tool',
            tool_call: {
                tool: 'email',
                title: '检查新邮件',
                args: { action: 'check_new' }
            }
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-email-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit'),
        emailProfiles: {
            qq: {
                account: 'saved@qq.com',
                secret: 'secret-for-test'
            }
        }
    });

    try {
        const status = await gateway.start();
        const result = await runAgent(status.url, {
            sessionId: 'email-agent-skill-test',
            message: '你好，帮我检查一下邮件有没有新的',
            agentLoop: 'llm',
            dryRun: true,
            llmSettings,
            context: { workspace: workspaceRoot }
        });

        assert.equal(result.body.ok, true, result.body.displayText);
        assert.equal(result.body.status, 'planned');
        assert.equal(result.body.plan[0].tool, 'email');
        assert.equal(result.body.plan[0].args.action, 'list');
        assert.equal(result.body.plan[0].args.filter, 'unread');
        assert.doesNotMatch(llmServer.calls[0].system, /邮箱 SKILL/);
        assert.match(JSON.stringify(llmServer.calls[0].payload.messages), /capability_catalog/);
        assert.match(JSON.stringify(llmServer.calls[1].payload.messages), /邮箱 SKILL/);
        assert.match(JSON.stringify(llmServer.calls[1].payload.messages), /不要用 computer\.exec/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor email loop observes mailbox results before final answer', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-email-agent-loop-'));
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'email_management',
                summary: '需要邮箱能力',
                action: 'load_context',
                capability_request: {
                    skills: ['email'],
                    tools: ['email'],
                    mcp: [],
                    reason: '需要读取邮箱'
                }
            };
        }
        if (decisionCount === 2) {
            return {
                mode: 'task',
                intent: 'email_management',
                summary: '检查未读邮件',
                action: 'tool',
                tool_call: {
                    tool: 'email',
                    title: '检查未读邮件',
                    args: { action: 'list', filter: 'unread', limit: 10 }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'email_management',
            summary: '已检查未读邮件',
            action: 'final',
            final_answer: '我检查过了，目前没有未读新邮件。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-email-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });
    const emailCalls = [];

    try {
        const status = await gateway.start();
        const originalCallTool = gateway.callTool.bind(gateway);
        gateway.callTool = async (request) => {
            if (request.tool === 'email') {
                emailCalls.push(request);
                return {
                    ok: true,
                    callId: 'mock-email-call',
                    tool: 'email',
                    status: 'completed',
                    durationMs: 1,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: '邮件列表：0 封未读新邮件。'
                            }
                        ],
                        details: {
                            messages: []
                        }
                    }
                };
            }
            return await originalCallTool(request);
        };

        const result = await runAgent(status.url, {
            sessionId: 'email-agent-loop-test',
            message: '检查一下我的邮箱有没有新的',
            agentLoop: 'llm',
            llmSettings,
            context: {
                workspace: workspaceRoot,
                approved: true,
                confirmationPolicy: 'auto'
            }
        });

        assert.equal(result.body.ok, true, result.body.displayText);
        assert.equal(result.body.status, 'completed');
        assert.equal(emailCalls.length, 1);
        assert.equal(emailCalls[0].args.action, 'list');
        assert.equal(emailCalls[0].args.filter, 'unread');
        assert.match(result.body.displayText, /没有未读新邮件/);
        assert.match(JSON.stringify(llmServer.calls[1].payload.messages), /邮箱 SKILL/);
        assert.match(JSON.stringify(llmServer.calls[2].payload.messages), /0 封未读新邮件/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});

test('Agentic Executor renders email tool failures through persona surface instead of raw tool text', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-email-agent-failure-'));
    const llmServer = await createScriptedChatCompletionsServer(({ decisionCount }) => {
        if (decisionCount === 1) {
            return {
                mode: 'task',
                intent: 'email_management',
                summary: '需要邮箱能力',
                action: 'load_context',
                capability_request: {
                    skills: ['email'],
                    tools: ['email'],
                    mcp: [],
                    reason: '需要读取未读邮件'
                }
            };
        }
        if (decisionCount === 2) {
            return {
                mode: 'task',
                intent: 'email_management',
                summary: '检查未读邮件',
                action: 'tool',
                tool_call: {
                    tool: 'email',
                    title: '检查未读邮件',
                    args: { action: 'list', filter: 'unread', limit: 10 }
                }
            };
        }
        return {
            mode: 'task',
            intent: 'email_management',
            summary: '邮箱没有配置',
            action: 'final',
            final_answer: 'email 工具需要 account/email 参数，或设置 HUMANCLAW_EMAIL_<PROVIDER>_ACCOUNT。'
        };
    });
    const llmSettings = {
        provider: 'openai-compatible',
        baseUrl: llmServer.url,
        apiKey: 'test-key',
        model: 'mock-email-failure-agent',
        temperature: 0.1,
        timeoutMs: 10000
    };
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit')
    });
    const emailCalls = [];

    try {
        const status = await gateway.start();
        const originalCallTool = gateway.callTool.bind(gateway);
        gateway.callTool = async (request) => {
            if (request.tool === 'email') {
                emailCalls.push(request);
                return {
                    ok: false,
                    callId: 'mock-email-needs-config',
                    tool: 'email',
                    status: 'needs_config',
                    durationMs: 1,
                    error: 'email 工具需要 account/email 参数，或设置 HUMANCLAW_EMAIL_<PROVIDER>_ACCOUNT。'
                };
            }
            return await originalCallTool(request);
        };

        const result = await runAgent(status.url, {
            sessionId: 'email-agent-failure-test',
            message: '帮我看看有没有 GitHub 的新邮件',
            agentLoop: 'llm',
            llmSettings,
            context: {
                workspace: workspaceRoot,
                approved: true,
                confirmationPolicy: 'auto'
            }
        });

        assert.equal(result.body.ok, false);
        assert.equal(result.body.status, 'needs_config');
        assert.equal(result.body.surface.source, 'tool_failure');
        assert.equal(emailCalls.length, 1);
        assert.match(result.body.displayText, /邮箱账号/);
        assert.match(result.body.bubbleText, /邮箱还没连上/);
        assert.doesNotMatch(result.body.displayText, /HUMANCLAW_EMAIL|<PROVIDER>|tool_call|raw observation/);
        assert.doesNotMatch(result.body.speechText, /HUMANCLAW_EMAIL|<PROVIDER>|tool_call|raw observation/);
    } finally {
        await gateway.stop();
        await llmServer.close();
    }
});
