/* ======================================================================
   TABULEIRO ARENA - FASE 40
   Remove câmera do Xadrez, limpa a tela da partida e mantém o tabuleiro
   estável. Não altera a Damas.
   ====================================================================== */
(function fase40XadrezControlesRecolhidos() {
    if (window.__TA_FASE40_XADREZ_CONTROLES_RECOLHIDOS__) return;
    window.__TA_FASE40_XADREZ_CONTROLES_RECOLHIDOS__ = true;

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
        if (hubBadge) hubBadge.textContent = 'Ativado';

        const subtitle = document.querySelector('#chess-screen .chess-subtitle');
        if (subtitle) {
            subtitle.textContent = 'Ativado: tabuleiro limpo, controles recolhidos no botão +, jogo online, chat e sair da sala funcionando.';
        }

        const pill = document.querySelector('#chess-screen .chess-clean-game-pill');
        if (pill) pill.textContent = '♟️ Tabuleiro fixo + controles +';

        const warning = document.querySelector('#chess-screen .chess-warning');
        if (warning) warning.textContent = '✅ Ativado: câmera removida, controles do Xadrez recolhidos no + e Damas preservada.';
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


    let controlsOpen = false;
    let lastBoardVisible = false;

    function ensureControlsToggle() {
        const actions = document.querySelector('#chess-screen .chess-actions');
        if (!actions || !actions.parentElement) return;

        let row = document.getElementById('chess-board-controls-toggle-row');
        if (!row) {
            row = document.createElement('div');
            row.id = 'chess-board-controls-toggle-row';
            row.className = 'chess-board-controls-toggle-row';
            row.innerHTML = `
                <div class="chess-board-controls-toggle-label">
                    <span>⚙️ Controles</span>
                    <span class="chess-board-controls-toggle-sub">abrir/fechar botões</span>
                </div>
                <button id="chess-board-controls-plus-btn" type="button" aria-expanded="false" aria-label="Abrir controles do jogo">+</button>
            `;
            actions.parentElement.insertBefore(row, actions);

            row.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                controlsOpen = !controlsOpen;
                updateControlsToggle();
            }, true);
        } else if (row.nextElementSibling !== actions) {
            actions.parentElement.insertBefore(row, actions);
        }

        updateControlsToggle();
    }

    function updateControlsToggle() {
        const visible = isChessBoardVisible();
        document.body.classList.toggle('ta-chess-controls-open', visible && controlsOpen);
        document.body.classList.toggle('ta-chess-controls-collapsed', visible && !controlsOpen);

        const btn = document.getElementById('chess-board-controls-plus-btn');
        const row = document.getElementById('chess-board-controls-toggle-row');
        if (!btn || !row) return;

        btn.textContent = controlsOpen ? '−' : '+';
        btn.setAttribute('aria-expanded', controlsOpen ? 'true' : 'false');
        btn.setAttribute('aria-label', controlsOpen ? 'Fechar controles do jogo' : 'Abrir controles do jogo');
        row.title = controlsOpen ? 'Fechar controles do jogo' : 'Abrir controles do jogo';
    }

    function stabilizeChessScreen() {
        const boardVisible = isChessBoardVisible();
        updatePhaseTexts();
        ensureLeaveButtonInBoard();
        removeCameraFromChess();

        if (boardVisible && !lastBoardVisible) {
            controlsOpen = false;
        }
        lastBoardVisible = boardVisible;

        if (boardVisible) {
            document.body.classList.add('ta-fase39-board-clean');
            document.body.classList.add('ta-fase40-controls-ready');
            ensureControlsToggle();
        } else {
            document.body.classList.remove('ta-fase39-board-clean');
            document.body.classList.remove('ta-fase40-controls-ready');
            document.body.classList.remove('ta-chess-controls-open');
            document.body.classList.remove('ta-chess-controls-collapsed');
            controlsOpen = false;
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
