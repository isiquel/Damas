/* ======================================================================
   TABULEIRO ARENA - FASE 39
   Remove câmera do Xadrez, limpa a tela da partida e mantém o tabuleiro
   estável. Não altera a Damas.
   ====================================================================== */
(function fase39XadrezFocoTabuleiro() {
    if (window.__TA_FASE39_XADREZ_FOCO_TABULEIRO__) return;
    window.__TA_FASE39_XADREZ_FOCO_TABULEIRO__ = true;

    function isChessBoardVisible() {
        return document.body.classList.contains('chess-selected') &&
               document.body.classList.contains('chess-board-visible');
    }

    function removeCameraFromChess() {
        const selectors = [
            '#chess-call-panel',
            '.chess-call-panel',
            '#fase36-camera-dock',
            '.fase36-camera-dock',
            '#chess-board-camera-panel',
            '.chess-board-camera-panel',
            '#chess-camera-paused-note',
            '.chess-camera-paused-note',
            '[data-xadrez-camera-panel="true"]'
        ];
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('height', '0', 'important');
                el.style.setProperty('min-height', '0', 'important');
                el.style.setProperty('max-height', '0', 'important');
                el.style.setProperty('margin', '0', 'important');
                el.style.setProperty('padding', '0', 'important');
                el.style.setProperty('border', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.setAttribute('aria-hidden', 'true');
            });
        });
    }

    function updatePhaseTexts() {
        const hubBadge = document.querySelector('#game-card-xadrez .game-mode-badge');
        if (hubBadge) hubBadge.textContent = 'Fase 39';

        const subtitle = document.querySelector('#chess-screen .chess-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Fase 39: foco total no tabuleiro. Cabeçalho reduzido durante a partida, câmera removida e sala online com botão de saída no tabuleiro.';
        }

        const pill = document.querySelector('#chess-screen .chess-clean-game-pill');
        if (pill) pill.textContent = '♟️ Tabuleiro fixo e maior';

        const warning = document.querySelector('#chess-screen .chess-warning');
        if (warning) warning.textContent = '✅ Fase 39 ativa: câmera removida, tabuleiro maior e controles essenciais no jogo. Damas preservada.';
    }

    function ensureLeaveButtonInBoard() {
        const actions = document.querySelector('#chess-screen .chess-actions');
        const leaveBtn = document.getElementById('chess-board-leave-online-btn');
        const backBtn = document.getElementById('chess-back-btn-bottom');
        if (!actions || !leaveBtn) return;

        if (leaveBtn.parentElement !== actions) {
            if (backBtn && backBtn.parentElement === actions) actions.insertBefore(leaveBtn, backBtn);
            else actions.appendChild(leaveBtn);
        }
        leaveBtn.textContent = 'Sair da sala';
    }

    function stabilizeChessScreen() {
        updatePhaseTexts();
        ensureLeaveButtonInBoard();
        removeCameraFromChess();

        if (isChessBoardVisible()) {
            document.body.classList.add('ta-fase39-board-clean');
        } else {
            document.body.classList.remove('ta-fase39-board-clean');
        }
    }

    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            stabilizeChessScreen();
        });
    }

    document.addEventListener('DOMContentLoaded', stabilizeChessScreen);
    window.addEventListener('load', stabilizeChessScreen);
    document.addEventListener('click', () => setTimeout(stabilizeChessScreen, 80), true);

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style']
    });

    // Garante a primeira aplicação sem ficar em loop pesado.
    [100, 350, 800, 1500, 2500].forEach((ms) => setTimeout(stabilizeChessScreen, ms));
})();
