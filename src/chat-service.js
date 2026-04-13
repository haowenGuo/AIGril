import { CONFIG } from './config.js';
import { normalizeCueIntensity, normalizeMotionCategory, parseReplyMarkup } from './cue-utils.js';


function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function getLatestUserMessage(messageHistory) {
    for (let index = messageHistory.length - 1; index >= 0; index -= 1) {
        if (messageHistory[index]?.role === 'user') {
            return (messageHistory[index].content || '').trim();
        }
    }
    return '';
}

async function readTextStream(response, onChunk) {
    if (!response.body) {
        throw new Error('浏览器不支持流式响应读取');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
            const line = part.replace(/\r$/, '');
            if (!line) {
                continue;
            }

            if (line.startsWith(':') || line.startsWith('event:')) {
                continue;
            }

            let chunkText = line;
            if (line.startsWith('data:')) {
                chunkText = line.slice(5);
                if (chunkText.startsWith(' ')) {
                    chunkText = chunkText.slice(1);
                }
            }

            if (!chunkText) {
                continue;
            }

            fullText += chunkText;
            onChunk?.(fullText);
        }
    }

    buffer += decoder.decode();
    const restLine = buffer.replace(/\r$/, '');
    if (restLine) {
        let chunkText = restLine;
        if (restLine.startsWith('data:')) {
            chunkText = restLine.slice(5);
            if (chunkText.startsWith(' ')) {
                chunkText = chunkText.slice(1);
            }
        }
        if (chunkText) {
            fullText += chunkText;
            onChunk?.(fullText);
        }
    }

    return fullText;
}

function createDemoPayload({
    text,
    action = null,
    motionCategory = null,
    motionIntensity = 'medium',
    expression = null,
    expressionIntensity = 'medium',
    autoChat = false,
    runtimeIdentity = null
}) {
    const normalizedMotionCategory = normalizeMotionCategory(motionCategory || action);
    return {
        session_id: 'github-pages-demo',
        raw_text: text,
        display_text: text,
        speech_text: text,
        action,
        motion_category: normalizedMotionCategory,
        motion_intensity: normalizeCueIntensity(motionIntensity),
        expression,
        expression_intensity: expression ? normalizeCueIntensity(expressionIntensity) : null,
        fallbackMode: true,
        demoMode: true,
        is_auto_chat: autoChat,
        runtime_identity: runtimeIdentity
    };
}

function buildDemoReply(latestUserMessage, isAutoChat, runtimeIdentity = null) {
    const displayName = runtimeIdentity?.displayName || 'AIGL';
    const spotlightWork = runtimeIdentity?.spotlightWork || '我的小舞台';
    const greeting = runtimeIdentity?.greeting || `${displayName}到啦。`;

    if (isAutoChat) {
        return pickRandom([
            createDemoPayload({
                text: `${greeting}我刚刚晃着脚发了会儿呆，然后就想起你啦。要不要聊聊今天想排哪一段？`,
                action: 'goodbye',
                motionCategory: 'walk',
                motionIntensity: 'low',
                expression: 'relaxed',
                expressionIntensity: 'low',
                autoChat: true,
                runtimeIdentity
            }),
            createDemoPayload({
                text: `${displayName}今天状态很好，${spotlightWork}也已经准备好了。你想先聊天，还是先让我唱一段？`,
                motionCategory: 'idle',
                motionIntensity: 'low',
                expression: 'happy',
                expressionIntensity: 'low',
                autoChat: true,
                runtimeIdentity
            })
        ]);
    }

    const normalizedText = (latestUserMessage || '').replace(/\s+/g, ' ').trim();
    const previewText = normalizedText.length > 18 ? `${normalizedText.slice(0, 18)}...` : normalizedText;

    if (!normalizedText) {
        return createDemoPayload({
            text: `${displayName}有在认真听哦，不过这次你好像没有输入内容。要不要再和我说一句呀？`,
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'relaxed',
            expressionIntensity: 'low',
            runtimeIdentity
        });
    }

    if (/你好|hello|hi|嗨|哈喽/i.test(normalizedText)) {
        return createDemoPayload({
            text: `${greeting}我现在先用体验模式陪着你。等后端和角色包联调更深一点后，我就会更像你刚刚发布进来的那个版本。`,
            action: 'goodbye',
            motionCategory: 'walk',
            motionIntensity: 'low',
            expression: 'happy',
            expressionIntensity: 'medium',
            runtimeIdentity
        });
    }

    if (/跳舞|舞|dance/i.test(normalizedText)) {
        return createDemoPayload({
            text: `好呀，我先用${spotlightWork}的默认风格转一圈给你看。现在这还是体验模式，但角色包里的动作气质已经能影响我了。`,
            action: 'dance',
            motionCategory: 'dance',
            motionIntensity: 'high',
            expression: 'happy',
            expressionIntensity: 'high',
            runtimeIdentity
        });
    }

    if (/惊讶|吃惊|surprise/i.test(normalizedText)) {
        return createDemoPayload({
            text: `欸，被你这么一说，${displayName}都愣了一下。不过没关系，我还是会继续认真陪着你的。`,
            action: 'surprised',
            motionCategory: 'superhero',
            motionIntensity: 'medium',
            expression: 'surprised',
            expressionIntensity: 'high',
            runtimeIdentity
        });
    }

    if (/生气|不高兴|angry/i.test(normalizedText)) {
        return createDemoPayload({
            text: `我不会真的和你闹脾气啦，只是先借这个机会演示一下情绪动作系统。现在这个页面主要是让你看角色包接进 Runtime 后的联动效果。`,
            action: 'angry',
            motionCategory: 'fight',
            motionIntensity: 'high',
            expression: 'angry',
            expressionIntensity: 'high',
            runtimeIdentity
        });
    }

    if (/难过|伤心|sad/i.test(normalizedText)) {
        return createDemoPayload({
            text: `如果你有点低落的话，${displayName}就安安静静陪着你。现在还是 demo 模式，但我已经会带着当前角色包的气质来回应了。`,
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'sad',
            expressionIntensity: 'medium',
            runtimeIdentity
        });
    }

    return pickRandom([
        createDemoPayload({
            text: `我有听见你刚刚说“${previewText}”。现在这个页面主要是展示模型、动作、表情和口型同步，以及角色包接入 Runtime 之后的基本效果。`,
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'relaxed',
            expressionIntensity: 'low',
            runtimeIdentity
        }),
        createDemoPayload({
            text: `你刚刚提到“${previewText}”，我先带着${displayName}这个版本的设定回你一句。等真实后端和角色包协议完全接上之后，我就能更稳定地保留这个人格与表演风格。`,
            action: 'goodbye',
            motionCategory: 'walk',
            motionIntensity: 'low',
            expression: 'happy',
            expressionIntensity: 'medium',
            runtimeIdentity
        })
    ]);
}


export class BackendChatService {
    constructor(runtimeIdentity = null) {
        this.runtimeIdentity = runtimeIdentity;
    }

    getWelcomeMessage() {
        if (this.runtimeIdentity?.displayName) {
            return `${this.runtimeIdentity.displayName} 已从角色包载入，现在会优先用流式文字回复你。`;
        }
        return 'AIGL到啦！现在会优先用流式文字回复你，这样会更快一点~';
    }

    async fetchAssistantTurn({ sessionId, messageHistory, isAutoChat = false, onProgress }) {
        const requestBody = JSON.stringify({
            session_id: sessionId,
            messages: messageHistory,
            is_auto_chat: isAutoChat,
            runtime_identity: this.runtimeIdentity
        });

        const response = await fetch(CONFIG.BACKEND_STREAM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `请求失败，状态码：${response.status}`;
            throw new Error(errorMessage);
        }

        const rawText = await readTextStream(response, (nextRawText) => {
            const nextPayload = parseReplyMarkup(nextRawText);
            onProgress?.(nextPayload);
        });

        return {
            ...parseReplyMarkup(rawText),
            fallbackMode: true,
            streamMode: true,
            demoMode: false
        };
    }
}


export class DemoChatService {
    constructor(runtimeIdentity = null) {
        this.runtimeIdentity = runtimeIdentity;
    }

    getWelcomeMessage() {
        if (this.runtimeIdentity?.displayName) {
            return `${this.runtimeIdentity.displayName} 已从角色包载入。当前是体验模式，你可以先确认形象设定、动作气质和基础对话口吻。`;
        }
        return 'AIGL到啦！当前是 GitHub Pages 体验模式，可以先体验模型、动作、表情和文本口型；完整对话和记忆能力需要连接后端。';
    }

    async fetchAssistantTurn({ messageHistory, isAutoChat = false }) {
        await sleep(450 + Math.random() * 350);
        return buildDemoReply(getLatestUserMessage(messageHistory), isAutoChat, this.runtimeIdentity);
    }
}


export function createChatService(runtimeIdentity = null) {
    return CONFIG.DEMO_MODE_ENABLED
        ? new DemoChatService(runtimeIdentity)
        : new BackendChatService(runtimeIdentity);
}
