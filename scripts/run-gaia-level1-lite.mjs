import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { HumanClawGateway } = require('../electron/humanclaw-gateway.cjs');
const { callDesktopLlmProvider } = require('../electron/desktop-llm-provider.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'eval-results', 'engineering', 'gaia-level1-lite-public');
const DEFAULT_SCORING_API = 'https://agents-course-unit4-scoring.hf.space';
const DEFAULT_FILE_MIRROR = 'https://huggingface.co/spaces/Shamik/unit_4_GAIA_challenge/resolve/main';

function normalizeText(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
}

function parseArgs(argv = process.argv.slice(2)) {
    const args = {
        outputDir: DEFAULT_OUTPUT_DIR,
        runId: new Date().toISOString().replace(/[:.]/g, '-'),
        scoringApi: DEFAULT_SCORING_API,
        fileMirror: DEFAULT_FILE_MIRROR,
        username: 'AIGL-local-codex',
        submit: false,
        limit: 0,
        offset: 0,
        maxAgentSteps: 20,
        requestTimeoutMs: 240000,
        llmTimeoutMs: 120000,
        temperature: 0.2,
        taskRetries: 1,
        submitTimeoutMs: 90000,
        benchmarkName: 'gaia-level1-lite-public',
        agentCode: 'AIGL local HumanClaw Gateway GAIA Level 1 Lite runner'
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const next = () => argv[++index] || '';
        if (token === '--output-dir') args.outputDir = path.resolve(next());
        else if (token === '--run-id') args.runId = normalizeText(next(), args.runId);
        else if (token === '--scoring-api') args.scoringApi = normalizeText(next(), args.scoringApi).replace(/\/+$/, '');
        else if (token === '--file-mirror') args.fileMirror = normalizeText(next(), args.fileMirror).replace(/\/+$/, '');
        else if (token === '--username') args.username = normalizeText(next(), args.username);
        else if (token === '--submit') args.submit = true;
        else if (token === '--no-submit') args.submit = false;
        else if (token === '--limit') args.limit = Math.max(0, Number(next()) || 0);
        else if (token === '--offset') args.offset = Math.max(0, Number(next()) || 0);
        else if (token === '--max-agent-steps') args.maxAgentSteps = Math.max(1, Math.min(Number(next()) || args.maxAgentSteps, 60));
        else if (token === '--request-timeout-ms') args.requestTimeoutMs = Math.max(30000, Number(next()) || args.requestTimeoutMs);
        else if (token === '--llm-timeout-ms') args.llmTimeoutMs = Math.max(30000, Number(next()) || args.llmTimeoutMs);
        else if (token === '--temperature') args.temperature = Math.min(Math.max(Number(next()) || args.temperature, 0), 2);
        else if (token === '--task-retries') args.taskRetries = Math.max(0, Math.min(Number(next()) || args.taskRetries, 3));
        else if (token === '--submit-timeout-ms') args.submitTimeoutMs = Math.max(1000, Number(next()) || args.submitTimeoutMs);
        else if (token === '--benchmark-name') args.benchmarkName = normalizeText(next(), args.benchmarkName);
        else if (token === '--agent-code') args.agentCode = normalizeText(next(), args.agentCode);
    }

    args.outputDir = path.resolve(args.outputDir);
    args.filesDir = path.join(args.outputDir, 'files');
    args.resultPath = path.join(args.outputDir, `${args.runId}.jsonl`);
    args.summaryPath = path.join(args.outputDir, `${args.runId}.summary.json`);
    args.reportPath = path.join(args.outputDir, `${args.runId}.report.md`);
    args.answerDir = path.join(args.outputDir, 'answers', args.runId);
    return args;
}

async function fetchJson(url, options = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
        }
        return text ? JSON.parse(text) : null;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function downloadFile(url, targetPath, timeoutMs = 120000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, buffer);
        return { ok: true, path: targetPath, bytes: buffer.length };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function ensureQuestionFile(args, question) {
    const fileName = normalizeText(question.file_name);
    if (!fileName) {
        return null;
    }
    const targetPath = path.join(args.filesDir, fileName);
    if (fsSync.existsSync(targetPath) && fsSync.statSync(targetPath).size > 100) {
        return targetPath;
    }
    const url = `${args.fileMirror}/${encodeURIComponent(fileName)}`;
    await downloadFile(url, targetPath, args.requestTimeoutMs);
    return targetPath;
}

function readDesktopLlmSettings(args) {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    const statePath = path.join(appData, 'humanclaw', 'desktop-state.json');
    if (!fsSync.existsSync(statePath)) {
        throw new Error(`desktop-state.json not found: ${statePath}`);
    }
    const state = JSON.parse(fsSync.readFileSync(statePath, 'utf8'));
    const preferences = state.preferences || {};
    const apiKey = normalizeText(
        preferences.llmApiKey ||
        process.env.DOUBAO_API_KEY ||
        process.env.ARK_API_KEY ||
        process.env.VOLCENGINE_API_KEY ||
        process.env.OPENAI_COMPATIBLE_API_KEY ||
        ''
    );
    const settings = {
        provider: normalizeText(preferences.llmProvider, 'openai-compatible'),
        baseUrl: normalizeText(preferences.llmBaseUrl, 'https://ark.cn-beijing.volces.com/api/v3'),
        model: normalizeText(preferences.llmModel, 'doubao-seed-2-0-mini-260215'),
        apiKey,
        temperature: args.temperature,
        timeoutMs: args.llmTimeoutMs
    };
    if (!settings.baseUrl || !settings.model || !settings.apiKey) {
        throw new Error('LLM settings incomplete: baseUrl/model/apiKey is required.');
    }
    return settings;
}

function buildBenchmarkMessage(question, filePath) {
    const lines = [
        'Solve this exact-answer question.',
        'Use evidence and tools when needed.',
        'Follow the Agentic Executor JSON protocol from the system prompt.',
        'When the task is solved, use action="final" and put the exact short answer in final_answer.',
        'AIGL visible persona text may stay natural; the benchmark runner stores the exact final_answer into a separate answer artifact.',
        'Available generic MCP server: aigl_research.',
        'If useful, call mcp_bridge with server="aigl_research" and action="call_tool". Tools: web_search, web_fetch, web_extract_links, pdf_extract_text, download_file, youtube_transcript, transcribe_audio, describe_image, read_spreadsheet, run_python_file.',
        'For attached spreadsheets or CSV files, prefer mcp_bridge -> aigl_research.read_spreadsheet; it returns columns, rows, numeric_sums, and total_numeric_sum. Use those full-file sums before writing any custom shell command.',
        'A head()/first-rows preview is not enough evidence for a final spreadsheet answer.',
        'For attached audio/image/code files, use the file contents as primary evidence; do not guess from the filename.',
        '',
        'Question:',
        question.question
    ];
    if (filePath) {
        lines.push('', `Attached file path: ${filePath}`);
        lines.push('Use the attached file as primary evidence. Do not guess its contents.');
    }
    return lines.join('\n');
}

function stripControlTags(text) {
    return normalizeText(text)
        .replace(/\[(?:expression|action|tts|bubble|style):[^\]]+\]/gi, '')
        .replace(/^final\s*answer\s*[:：]\s*/i, '')
        .replace(/^answer\s*[:：]\s*/i, '')
        .replace(/^答案\s*(?:是|为)?\s*[:：]?\s*/i, '')
        .replace(/^the\s+answer\s+is\s+/i, '')
        .replace(/[。.!！~～\s]*(?:哦|呢|呀)$/i, '')
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
        .trim();
}

function safeFileSegment(value, fallback = 'task') {
    return normalizeText(value, fallback).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 160) || fallback;
}

async function writeAnswerArtifact(args, question, answer) {
    await fs.mkdir(args.answerDir, { recursive: true });
    const targetPath = path.join(args.answerDir, `${safeFileSegment(question.task_id)}.txt`);
    await fs.writeFile(targetPath, `${normalizeText(answer)}\n`, 'utf8');
    return targetPath;
}

function looksLikeFailureSurface(text) {
    return /卡点|没有完整成功|不拿不稳|下一步|uncertain|blocked|failed|error|tool log|需要更多证据/i.test(text);
}

function looksLikeShortAnswer(text) {
    const stripped = stripControlTags(text);
    if (!stripped || looksLikeFailureSurface(stripped)) {
        return false;
    }
    if (stripped.length > 240) {
        return false;
    }
    if (stripped.split(/\r?\n/).length > 3) {
        return false;
    }
    return true;
}

function extractJsonObject(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
        return null;
    }
    try {
        return JSON.parse(normalized);
    } catch {}
    const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
        try {
            return JSON.parse(fenced[1]);
        } catch {}
    }
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(normalized.slice(start, end + 1));
        } catch {}
    }
    return null;
}

function extractSubmittedAnswer(response, { answerOnly = false } = {}) {
    const candidates = [
        response?.finalAnswer,
        response?.answer
    ];
    if (!answerOnly || response?.ok === true) {
        candidates.push(response?.displayText, response?.message, response?.speechText);
    }
    for (const candidate of candidates) {
        const stripped = stripControlTags(candidate);
        if (stripped && (!answerOnly || response?.ok !== true || looksLikeShortAnswer(stripped))) {
            return stripped;
        }
    }
    return '';
}

function clipText(value, maxChars = 8000) {
    const text = stripControlTags(value);
    return text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;
}

function getRawStepObservationText(step = {}) {
    return (
        step.response?.result?.content?.[0]?.text ||
        step.response?.result?.details?.result?.content?.[0]?.text ||
        step.response?.result?.details?.stdout ||
        step.response?.result?.details?.stderr ||
        step.response?.error ||
        ''
    );
}

function compactSpreadsheetObservation(text) {
    try {
        const payload = JSON.parse(text);
        if (!payload || typeof payload !== 'object' || (!payload.numeric_sums && !payload.columns)) {
            return '';
        }
        return JSON.stringify({
            shape: payload.shape,
            columns: payload.columns,
            numeric_sums: payload.numeric_sums,
            total_numeric_sum: payload.total_numeric_sum,
            rows_returned: Array.isArray(payload.rows) ? payload.rows.length : 0
        }, null, 2);
    } catch {
        return '';
    }
}

function getEvidenceObservationText(step = {}) {
    const rawText = getRawStepObservationText(step);
    const mcpTool = normalizeText(step.args?.tool || step.args?.tool_name || step.args?.toolName || step.args?.name);
    if (mcpTool === 'read_spreadsheet') {
        const compact = compactSpreadsheetObservation(rawText);
        if (compact) {
            return compact;
        }
    }
    return clipText(rawText, 8000);
}

function buildEvidenceDigest(response = {}) {
    const steps = (Array.isArray(response.steps) ? response.steps : [])
        .map((step) => ({
            id: step.id || '',
            title: step.title || '',
            tool: step.tool || '',
            args: step.args || {},
            ok: step.response?.ok,
            status: step.response?.status || '',
            observation: getEvidenceObservationText(step)
        }))
        .filter((step) => step.ok === true && step.observation)
        .slice(-8);
    if (!steps.length) {
        return '';
    }
    return steps.map((step, index) => {
        return [
            `Observation ${index + 1}:`,
            `tool: ${step.tool}`,
            `title: ${step.title}`,
            `args: ${JSON.stringify(step.args || {})}`,
            `result: ${step.observation}`
        ].join('\n');
    }).join('\n\n');
}

async function finalizeAnswerFromEvidence({ question, filePath, response, llmSettings }) {
    const evidence = buildEvidenceDigest(response);
    if (!evidence) {
        return null;
    }
    const extension = path.extname(filePath || '').toLowerCase();
    const resultEvidence = (Array.isArray(response.steps) ? response.steps : [])
        .filter((step) => step.response?.ok === true)
        .map((step) => getEvidenceObservationText(step))
        .filter(Boolean)
        .join('\n\n');
    if (['.xlsx', '.xls', '.csv', '.tsv'].includes(extension)) {
        const previewOnly = /first\s+\d+\s+rows|head\(|前几行|Columns:/i.test(resultEvidence);
        const hasFullComputation = /sum|total|computed|calculated|result|answer|合计|总计|求和|完整|全表/i.test(resultEvidence);
        if (previewOnly && !hasFullComputation) {
            return {
                ok: false,
                status: 'missing_full_file_computation',
                answer: '',
                confidence: 'low',
                reason: 'spreadsheet evidence only shows a preview, not a full-file computation'
            };
        }
    }
    const llmResponse = await callDesktopLlmProvider(llmSettings, {
        temperature: 0,
        timeoutMs: Math.min(Number(llmSettings.timeoutMs) || 120000, 120000),
        messages: [
            {
                role: 'system',
                content: [
                    'You are an exact-answer benchmark finalizer.',
                    'Use only the provided tool observations and attached file path context.',
                    'Do not browse, do not invent facts, and do not mention uncertainty in the answer field.',
                    'Never compute totals from observations labeled head, first rows, preview, schema, or sample rows.',
                    'For spreadsheet/CSV questions, answer only when the observations include a full-file computation or the complete relevant table.',
                    'If the observations do not contain enough evidence, return {"answer":"","confidence":"low","reason":"missing evidence"}.',
                    'Return strict JSON only: {"answer":"short exact answer","confidence":"high|medium|low","reason":"brief evidence note"}.'
                ].join('\n')
            },
            {
                role: 'user',
                content: JSON.stringify({
                    question: question.question,
                    filePath: filePath || '',
                    evidence
                }, null, 2)
            }
        ]
    });
    if (!llmResponse.ok) {
        return {
            ok: false,
            status: llmResponse.code || 'finalizer_error',
            error: llmResponse.error || ''
        };
    }
    const json = extractJsonObject(llmResponse.content);
    const answer = stripControlTags(json?.answer || json?.final_answer || json?.finalAnswer || '');
    return {
        ok: Boolean(answer),
        status: answer ? 'completed' : 'missing_evidence',
        answer,
        confidence: normalizeText(json?.confidence),
        reason: normalizeText(json?.reason),
        raw: llmResponse.content
    };
}

function summarizeAgentSteps(response = {}) {
    return (Array.isArray(response.steps) ? response.steps : []).map((step) => ({
        id: step.id || '',
        title: step.title || '',
        tool: step.tool || '',
        args: step.args || {},
        response: {
            ok: step.response?.ok,
            status: step.response?.status || '',
            error: step.response?.error || step.response?.result?.error || '',
            preview: stripControlTags(
                step.response?.result?.content?.[0]?.text ||
                step.response?.result?.details?.stdout ||
                step.response?.result?.details?.stderr ||
                step.response?.result?.details?.result?.content?.[0]?.text ||
                ''
            ).slice(0, 1200)
        }
    }));
}

async function fetchQuestions(args) {
    const url = `${args.scoringApi}/questions`;
    const questions = await fetchJson(url, {}, 60000);
    if (!Array.isArray(questions) || !questions.length) {
        throw new Error(`No questions returned from ${url}`);
    }
    const offsetQuestions = questions.slice(args.offset);
    return args.limit ? offsetQuestions.slice(0, args.limit) : offsetQuestions;
}

async function callAgent({ baseUrl, args, question, filePath, llmSettings }) {
    const message = buildBenchmarkMessage(question, filePath);
    const executionProfile = {
        kind: 'exact_answer_eval',
        goal: 'Answer an exact-answer evaluation question.',
        objective: 'Return the exact short answer.',
        successCriteria: ['Return only the exact answer in final_answer.']
    };
    const startedAt = Date.now();
    const response = await fetchJson(`${baseUrl}/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: `${safeFileSegment(args.benchmarkName)}-${args.runId}-${question.task_id}`,
            message,
            agentLoop: 'llm',
            planner: 'llm',
            maxAgentSteps: args.maxAgentSteps,
            maxSteps: args.maxAgentSteps,
            llmSettings,
            context: {
                evaluationName: args.benchmarkName,
                evaluationTaskId: question.task_id,
                executionProfile,
                answerOnly: true,
                agentLoop: 'llm',
                planner: 'llm',
                maxAgentSteps: args.maxAgentSteps,
                llmSettings,
                computerControlEnabled: true,
                permissionProfile: 'danger-full-access',
                approvalPolicy: 'auto',
                confirmationPolicy: 'auto',
                visionPermissionPolicy: 'auto',
                approved: true,
                autoConfirm: true,
                executeExternal: true,
                allowOutsideWorkspace: true,
                allowComputerWideAccess: true,
                allowSystemMutation: true,
                workspace: PROJECT_ROOT
            }
        })
    }, args.requestTimeoutMs);
    let submittedAnswer = extractSubmittedAnswer(response, { answerOnly: true });
    let finalizer = null;
    if ((!response?.ok || !submittedAnswer) && Array.isArray(response?.steps) && response.steps.length) {
        finalizer = await finalizeAnswerFromEvidence({ question, filePath, response, llmSettings }).catch((error) => ({
            ok: false,
            status: 'finalizer_error',
            error: error?.message || String(error)
        }));
        if (finalizer?.ok && finalizer.answer) {
            submittedAnswer = finalizer.answer;
        }
    }
    return {
        response,
        submittedAnswer,
        finalizer,
        durationMs: Date.now() - startedAt
    };
}

function shouldRetryTask(result = {}) {
    if (result.ok && result.submitted_answer) {
        return false;
    }
    const text = `${result.status || ''} ${result.error || ''} ${result.raw_status?.error || ''}`;
    return /runner_error|aborted|timeout|blocked|invalid_agent_decision|invalid_agent_tool_call|empty_response/i.test(text);
}

async function submitAnswers(args, answers) {
    return fetchJson(`${args.scoringApi}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: args.username,
            agent_code: args.agentCode,
            answers
        })
    }, args.submitTimeoutMs);
}

function buildReport({ args, questions, results, score }) {
    const completed = results.filter((item) => item.ok).length;
    const failed = results.length - completed;
    const scoredLine = score
        ? `- Public scorer: ${score.score}% (${score.correct_count}/${score.total_attempted})`
        : '- Public scorer: not submitted';
    const rows = results.map((item, index) => {
        const status = item.ok ? 'ok' : item.status || 'failed';
        return `${index + 1}. ${item.task_id} | ${status} | ${item.durationMs}ms | ${item.submitted_answer || '(empty)'}`;
    });
    return [
        `# ${args.benchmarkName} Run`,
        '',
        `- Run id: ${args.runId}`,
        `- Questions: ${questions.length}`,
        `- Completed locally: ${completed}/${results.length}`,
        `- Failed locally: ${failed}`,
        scoredLine,
        `- Result JSONL: ${args.resultPath}`,
        '',
        '## Answers',
        '',
        ...rows,
        ''
    ].join('\n');
}

async function main() {
    const args = parseArgs();
    await fs.mkdir(args.outputDir, { recursive: true });
    await fs.mkdir(args.filesDir, { recursive: true });

    const llmSettings = readDesktopLlmSettings(args);
    const questions = await fetchQuestions(args);
    const gateway = new HumanClawGateway({
        host: '127.0.0.1',
        port: 0,
        workspaceDir: PROJECT_ROOT,
        auditDir: path.join(args.outputDir, 'gateway-audit', args.runId),
        mcpConfigPath: path.join(PROJECT_ROOT, '.humanclaw-state', 'mcp-servers.json')
    });
    const status = await gateway.start();
    const baseUrl = `http://${status.host}:${status.port}`;
    const results = [];

    try {
        for (let index = 0; index < questions.length; index += 1) {
            const question = questions[index];
            const filePath = await ensureQuestionFile(args, question);
            process.stdout.write(`[${index + 1}/${questions.length}] ${question.task_id} ... `);
            const startedAt = Date.now();
            let finalResult = null;
            for (let attempt = 0; attempt <= args.taskRetries; attempt += 1) {
                try {
                    const agentResult = await callAgent({ baseUrl, args, question, filePath, llmSettings });
                    const completedByFinalizer = agentResult.finalizer?.ok === true && Boolean(agentResult.submittedAnswer);
                    const hasSubmittedAnswer = Boolean(agentResult.submittedAnswer);
                    const answerArtifactPath = hasSubmittedAnswer
                        ? await writeAnswerArtifact(args, question, agentResult.submittedAnswer)
                        : '';
                    finalResult = {
                        record_type: attempt < args.taskRetries ? 'attempt' : 'final',
                        attempt,
                        index,
                        task_id: question.task_id,
                        question: question.question,
                        file_name: question.file_name || '',
                        file_path: filePath || '',
                        answer_artifact_path: answerArtifactPath,
                        ok: hasSubmittedAnswer && (agentResult.response?.ok === true || completedByFinalizer),
                        status: completedByFinalizer && agentResult.response?.ok !== true ? 'finalized' : (agentResult.response?.status || ''),
                        durationMs: Date.now() - startedAt,
                        attemptDurationMs: agentResult.durationMs || 0,
                        submitted_answer: agentResult.submittedAnswer,
                        response_preview: stripControlTags(agentResult.response?.displayText || agentResult.response?.speechText || '').slice(0, 1000),
                        planner: agentResult.response?.planner || '',
                        step_count: Array.isArray(agentResult.response?.steps) ? agentResult.response.steps.length : 0,
                        steps: summarizeAgentSteps(agentResult.response),
                        finalizer: agentResult.finalizer || null,
                        raw_status: {
                            ok: agentResult.response?.ok,
                            status: agentResult.response?.status,
                            error: agentResult.response?.error || '',
                            blockedReason: agentResult.response?.blockedReason || ''
                        }
                    };
                } catch (error) {
                    finalResult = {
                        record_type: attempt < args.taskRetries ? 'attempt' : 'final',
                        attempt,
                        index,
                        task_id: question.task_id,
                        question: question.question,
                        file_name: question.file_name || '',
                        file_path: filePath || '',
                        answer_artifact_path: '',
                        ok: false,
                        status: 'runner_error',
                        durationMs: Date.now() - startedAt,
                        submitted_answer: '',
                        error: error?.message || String(error)
                    };
                }
                const retry = shouldRetryTask(finalResult) && attempt < args.taskRetries;
                finalResult.record_type = retry ? 'attempt' : 'final';
                await fs.appendFile(args.resultPath, `${JSON.stringify(finalResult)}\n`, 'utf8');
                if (!retry) {
                    break;
                }
                process.stdout.write(`${finalResult.status || 'retry'} -> retry ${attempt + 1}/${args.taskRetries} ... `);
            }
            finalResult.record_type = 'final';
            results.push(finalResult);
            process.stdout.write(`${finalResult.ok ? 'ok' : finalResult.status || 'done'} | ${finalResult.submitted_answer.slice(0, 120)}\n`);
        }
    } finally {
        await gateway.stop?.();
    }

    const answers = results.map((item) => ({
        task_id: item.task_id,
        submitted_answer: item.submitted_answer
    }));
    let score = null;
    let submitError = '';
    if (args.submit) {
        try {
            score = await submitAnswers(args, answers);
        } catch (error) {
            submitError = error?.message || String(error);
        }
    }
    const summary = {
        benchmark: args.benchmarkName,
        runId: args.runId,
        questionCount: questions.length,
        completed: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        submitted: args.submit,
        submitError,
        score,
        resultPath: args.resultPath,
        summaryPath: args.summaryPath,
        reportPath: args.reportPath
    };
    await fs.writeFile(args.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    await fs.writeFile(args.reportPath, buildReport({ args, questions, results, score }), 'utf8');
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
