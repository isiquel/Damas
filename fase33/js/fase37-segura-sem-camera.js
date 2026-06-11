/* ======================================================================
   TABULEIRO ARENA - FASE 37 SEGURA
   Não mexe na Damas. Não tenta consertar câmera. Só pausa câmera do Xadrez
   e mantém o botão Sair da sala da base estável funcionando no tabuleiro.
   ====================================================================== */
(function fase37SeguraSemCamera() {
    if (window.__TA_FASE37_SEGURA_SEM_CAMERA__) return;
    window.__TA_FASE37_SEGURA_SEM_CAMERA__ = true;

    function isChessScreenVisible() {
        return document.body.classList.contains('chess-selected') ||
               document.body.classList.contains('chess-game-active') ||
               document.getElementById('chess-screen')?.offsetParent !== null;
    }

    function hideChessCameraPanels() {
        const selectors = [
            '#chess-call-panel',
            '.chess-call-panel',
            '#fase36-camera-dock',
            '.fase36-camera-dock',
            '#chess-board-camera-panel',
            '.chess-board-camera-panel',
            '[data-xadrez-camera-panel="true"]'
        ];
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.setAttribute('aria-hidden', 'true');
            });
        });
    }

    function updateVisiblePhaseTexts() {
        const hubBadge = document.querySelector('#game-card-xadrez .game-mode-badge');
        if (hubBadge) hubBadge.textContent = 'Fase 37';

        const replacements = [
            [/Fase\s*36(?:\.\d+)?/gi, 'Fase 37'],
            [/câmera\/áudio abaixo das peças\.?/gi, 'câmera do Xadrez pausada para estabilidade.'],
            [/câmera\/áudio ficam dentro da tela do tabuleiro online\.?/gi, 'câmera do Xadrez pausada; sair da sala fica no tabuleiro online.'],
            [/câmera\/áudio continuam abaixo do tabuleiro\.?/gi, 'câmera do Xadrez pausada para estabilidade.']
        ];

        document.querySelectorAll('#chess-screen .chess-subtitle, #chess-screen .chess-warning, #chess-screen .chess-status-pill, #chess-screen .chess-clean-game-pill').forEach((el) => {
            if (!el || !el.textContent) return;
            let text = el.textContent;
            replacements.forEach(([from, to]) => { text = text.replace(from, to); });
            el.textContent = text;
        });
    }

    function ensureLeaveButtonReady() {
        const actions = document.querySelector('#chess-screen .chess-actions');
        const leaveBtn = document.getElementById('chess-board-leave-online-btn');
        const backBtn = document.getElementById('chess-back-btn-bottom');
        if (!actions || !leaveBtn) return;

        if (leaveBtn.parentElement !== actions) {
            if (backBtn && backBtn.parentElement === actions) actions.insertBefore(leaveBtn, backBtn);
            else actions.appendChild(leaveBtn);
        }

        // A base 36.12 já controla a ação. Aqui só garantimos que o botão exista no tabuleiro.
        leaveBtn.textContent = 'Sair da sala';
    }

    function ensurePausedNote() {
        if (!isChessScreenVisible()) return;
        const actions = document.querySelector('#chess-screen .chess-actions');
        if (!actions || document.getElementById('chess-camera-paused-note')) return;
        const note = document.createElement('div');
        note.id = 'chess-camera-paused-note';
        note.className = 'chess-camera-paused-note';
        note.textContent = '📹 Câmera do Xadrez pausada nesta versão. Jogo online, sair da sala, chat, treino e modo aprender continuam ativos.';
        actions.insertAdjacentElement('afterend', note);
    }

    function applyPhase37Safe() {
        updateVisiblePhaseTexts();
        ensureLeaveButtonReady();
        hideChessCameraPanels();
        ensurePausedNote();
    }

    document.addEventListener('click', () => setTimeout(applyPhase37Safe, 80), true);
    document.addEventListener('DOMContentLoaded', applyPhase37Safe);
    window.addEventListener('load', applyPhase37Safe);

    // Leve e seguro: só reaplica quando necessário, sem observar DOM inteiro o tempo todo.
    let ticks = 0;
    const timer = setInterval(() => {
        applyPhase37Safe();
        ticks += 1;
        if (ticks > 12) clearInterval(timer);
    }, 500);
})();
