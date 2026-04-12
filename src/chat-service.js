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
    autoChat = false
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
        is_auto_chat: autoChat
    };
}

function buildDemoReply(latestUserMessage, isAutoChat) {
    if (isAutoChat) {
        return pickRandom([
            createDemoPayload({
                text: '我刚刚晃着脚发了会儿呆，然后就想起你啦。要不要随便聊点轻松的事情呀？',
                action: 'goodbye',
                motionCategory: 'walk',
                motionIntensity: 'low',
                expression: 'relaxed',
                expressionIntensity: 'low',
                autoChat: true
            }),
            createDemoPayload({
                text: '这里安安静静的，正适合慢悠悠地说话。你今天想让我陪你做什么呢？',
                motionCategory: 'idle',
                motionIntensity: 'low',
                expression: 'happy',
                expressionIntensity: 'low',
                autoChat: true
            })
        ]);
    }

    const normalizedText = (latestUserMessage || '').replace(/\s+/g, ' ').trim();
    const previewText = normalizedText.length > 18 ? `${normalizedText.slice(0, 18)}...` : normalizedText;

    if (!normalizedText) {
        return createDemoPayload({
            text: '我有在认真听哦，不过这次你好像没有输入内容。要不要再和我说一句呀？',
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'relaxed',
            expressionIntensity: 'low'
        });
    }

    if (/你好|hello|hi|嗨|哈喽/i.test(normalizedText)) {
        return createDemoPayload({
            text: '你好呀，我现在在 GitHub Pages 的体验模式里陪着你。后端接上以后，我就能真的带着记忆和 ElevenLabs 声音和你聊天啦。',
            action: 'goodbye',
            motionCategory: 'walk',
            motionIntensity: 'low',
            expression: 'happy',
            expressionIntensity: 'medium'
        });
    }

    if (/跳舞|舞|dance/i.test(normalizedText)) {
        return createDemoPayload({
            text: '好呀，那我先轻轻地转一圈给你看。这一段是网页体验模式里的本地演示动作，正式版会接真实后端回复。',
            action: 'dance',
            motionCategory: 'dance',
            motionIntensity: 'high',
            expression: 'happy',
            expressionIntensity: 'high'
        });
    }

    if (/惊讶|吃惊|surprise/i.test(normalizedText)) {
        return createDemoPayload({
            text: '欸，突然被你这么一说，我都有点小小地愣住啦。不过我还是会继续认真陪着你的。',
            action: 'surprised',
            motionCategory: 'superhero',
            motionIntensity: 'medium',
            expression: 'surprised',
            expressionIntensity: 'high'
        });
    }

    if (/生气|不高兴|angry/i.test(normalizedText)) {
        return createDemoPayload({
            text: '我不会真的和你闹脾气啦，只是先帮你演示一下情绪动作系统。现在这个页面主要是给大家快速体验角色联动效果的。',
            action: 'angry',
            motionCategory: 'fight',
            motionIntensity: 'high',
            expression: 'angry',
            expressionIntensity: 'high'
        });
    }

    if (/难过|伤心|sad/i.test(normalizedText)) {
        return createDemoPayload({
            text: '如果你有点低落的话，我就安安静静陪着你。这个公开网页现在是 demo 模式，所以我先用本地逻辑回应你一下。',
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'sad',
            expressionIntensity: 'medium'
        });
    }

    return pickRandom([
        createDemoPayload({
            text: `我有听见你刚刚说“${previewText}”。现在这个公开页面主要是展示模型、动作、表情和口型同步，完整对话能力要在后端上线后才会打开哦。`,
            motionCategory: 'idle',
            motionIntensity: 'low',
            expression: 'relaxed',
            expressionIntensity: 'low'
        }),
        createDemoPayload({
            text: `你刚刚提到“${previewText}”，我先用体验模式陪你回一句。等真实后端接上之后，我就能记住上下文，还能直接用 ElevenLabs 把整段回答说出来。`,
            action: 'goodbye',
            motionCategory: 'walk',
            motionIntensity: 'low',
            expression: 'happy',
            expressionIntensity: 'medium'
        })
    ]);
}


export class BackendChatService {
    getWelcomeMessage() {
        return 'AIGL到啦！现在会优先用流式文字回复你，这样会更快一点~';
    }

    async fetchAssistantTurn({ sessionId, messageHistory, isAutoChat = false, onProgress }) {
        const requestBody = JSON.stringify({
            session_id: sessionId,
            messages: messageHistory,
            is_auto_chat: isAutoChat
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
    getWelcomeMessage() {
        return 'AIGL到啦！当前是 GitHub Pages 体验模式，可以先体验模型、动作、表情和文本口型；完整对话和记忆能力需要连接后端。';
    }

    async fetchAssistantTurn({ messageHistory, isAutoChat = false }) {
        await sleep(450 + Math.random() * 350);
        return buildDemoReply(getLatestUserMessage(messageHistory), isAutoChat);
    }
}


export function createChatService() {
    return CONFIG.DEMO_MODE_ENABLED
        ? new DemoChatService()
        : new BackendChatService();
}
