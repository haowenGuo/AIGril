function getMessageClassName(role) {
    if (role === 'user') {
        return 'message-item message-user';
    }
    if (role === 'assistant') {
        return 'message-item message-ai';
    }
    if (role === 'loading') {
        return 'message-loading';
    }
    return 'message-item message-system';
}

window.addEventListener('DOMContentLoaded', () => {
    const messageListEl = document.getElementById('message-list');
    const inputEl = document.getElementById('message-input');
    const sendBtnEl = document.getElementById('send-btn');
    const closeBtnEl = document.getElementById('close-btn');
    const statusEl = document.getElementById('chat-status');

    let isBusy = false;

    function scrollToBottom() {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }

    function updateComposerState() {
        sendBtnEl.disabled = isBusy || !inputEl.value.trim();
        statusEl.textContent = isBusy ? 'AIGL 正在思考或说话...' : '已连接桌宠';
    }

    function upsertMessage(message) {
        if (!message?.id) {
            return;
        }

        let element = messageListEl.querySelector(`[data-message-id="${message.id}"]`);
        if (!element) {
            element = document.createElement('div');
            element.dataset.messageId = message.id;
            messageListEl.appendChild(element);
        }

        element.className = getMessageClassName(message.role);
        element.dataset.messageRole = message.role || 'system';
        element.textContent = message.content || '';
        scrollToBottom();
    }

    function removeMessage(messageId) {
        const element = messageListEl.querySelector(`[data-message-id="${messageId}"]`);
        if (!element) {
            return;
        }
        element.remove();
        scrollToBottom();
    }

    function renderSnapshot(messages = []) {
        messageListEl.innerHTML = '';
        messages.forEach((message) => upsertMessage(message));
        scrollToBottom();
    }

    function sendCurrentMessage() {
        const content = inputEl.value.trim();
        if (!content || isBusy) {
            return;
        }
        window.aigrilDesktop?.sendChatMessage?.(content);
        inputEl.value = '';
        updateComposerState();
    }

    sendBtnEl.addEventListener('click', sendCurrentMessage);
    inputEl.addEventListener('input', updateComposerState);
    inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendCurrentMessage();
        }
    });

    closeBtnEl.addEventListener('click', async () => {
        await window.aigrilDesktop?.hideChatWindow?.();
    });

    window.aigrilDesktop?.onChatEvent?.((payload = {}) => {
        if (payload.type === 'snapshot') {
            renderSnapshot(payload.messages || []);
            if (typeof payload.isBusy === 'boolean') {
                isBusy = payload.isBusy;
            }
            updateComposerState();
            return;
        }

        if (payload.type === 'message-added' || payload.type === 'message-updated') {
            upsertMessage(payload.message);
            return;
        }

        if (payload.type === 'message-removed') {
            removeMessage(payload.id);
            return;
        }

        if (payload.type === 'state' && typeof payload.isBusy === 'boolean') {
            isBusy = payload.isBusy;
            updateComposerState();
        }
    });

    window.addEventListener('focus', () => {
        window.aigrilDesktop?.requestChatStateSync?.();
    });

    updateComposerState();
    window.aigrilDesktop?.requestChatStateSync?.();
});
