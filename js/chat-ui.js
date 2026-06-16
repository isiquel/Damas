// ============================================================
// Tabuleiro Arena - Separação 06
// Chat UI / Mensagens visuais
// Este arquivo cuida apenas da aparência do chat.
// Não mexe em Firebase, salas online, regras da Damas ou Xadrez.
// ============================================================
(function () {
    'use strict';

    function aplicarEstadoChatNormal(opcoes) {
        const muted = !!(opcoes && opcoes.muted);
        const button = opcoes && opcoes.button;
        const messages = opcoes && opcoes.messages;
        const inputWrapper = opcoes && opcoes.inputWrapper;

        if (button) {
            button.innerText = muted ? 'Ligar Chat' : 'Desligar Chat';
            button.classList.toggle('off', muted);
        }

        if (messages) {
            messages.style.opacity = muted ? '0.15' : '1';
            messages.style.pointerEvents = muted ? 'none' : 'auto';
            if (!muted) messages.scrollTop = messages.scrollHeight;
        }

        if (inputWrapper) {
            inputWrapper.style.display = muted ? 'none' : 'flex';
        }
    }

    function adicionarLinhaChatNormal(container, author, text) {
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'chat-msg-row';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'msg-author';
        authorSpan.innerText = String(author || 'Jogador') + ': ';

        const textSpan = document.createElement('span');
        textSpan.innerText = String(text || '');

        row.appendChild(authorSpan);
        row.appendChild(textSpan);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
    }

    function mensagemSistemaChatNormal(container, texto) {
        adicionarLinhaChatNormal(container, 'Sistema', texto || 'Chat ativo.');
    }

    function atualizarBotaoChatXadrez(chatPanel) {
        if (!chatPanel) return;
        const btn = chatPanel.querySelector('#chess-chat-toggle-mini');
        if (!btn) return;
        const fechado = chatPanel.classList.contains('chat-collapsed');
        btn.textContent = fechado ? '+' : '−';
        btn.setAttribute('aria-expanded', fechado ? 'false' : 'true');
    }

    function alternarChatXadrez(chatPanel) {
        if (!chatPanel) return;
        chatPanel.classList.toggle('chat-collapsed');
        atualizarBotaoChatXadrez(chatPanel);
    }

    window.TabuleiroChatUI = {
        aplicarEstadoChatNormal,
        adicionarLinhaChatNormal,
        mensagemSistemaChatNormal,
        atualizarBotaoChatXadrez,
        alternarChatXadrez
    };
})();
