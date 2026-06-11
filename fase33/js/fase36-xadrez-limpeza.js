(function () {
    if (window.__fase36XadrezLimpezaInstalada) return;
    window.__fase36XadrezLimpezaInstalada = true;

    const alertaOriginal = window.alert ? window.alert.bind(window) : null;
    const confirmacaoOriginal = window.exibirConfirmacao;

    function xadrezVisivel() {
        const tela = document.getElementById('chess-screen');
        return document.body.classList.contains('chess-selected') ||
            (tela && getComputedStyle(tela).display !== 'none');
    }

    function tabuleiroXadrezAberto() {
        return document.body.classList.contains('chess-board-visible') ||
            document.body.classList.contains('chess-game-active');
    }

    function partidaOnlineAtiva() {
        const panel = document.getElementById('chess-call-panel');
        const onlineStatus = document.getElementById('chess-online-status');
        const statusGeral = document.getElementById('chess-status');

        if (document.body.classList.contains('chess-mode-online')) return true;
        if (panel && panel.classList.contains('online-visible')) return true;

        const textoOnline = onlineStatus ? (onlineStatus.innerText || '').toLowerCase() : '';
        const textoStatus = statusGeral ? (statusGeral.innerText || '').toLowerCase() : '';

        if (textoOnline.includes('online na sala')) return true;
        if (textoOnline.includes('como brancas')) return true;
        if (textoOnline.includes('como pretas')) return true;
        if (textoOnline.includes('sala')) return true;
        if (textoStatus.includes('online')) return true;

        return false;
    }

    function criarModalFase36() {
        let modal = document.getElementById('fase36-xadrez-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'fase36-xadrez-modal';
        modal.className = 'fase34-xadrez-modal';
        modal.innerHTML = `
            <div class="fase34-xadrez-modal-card">
                <div id="fase36-xadrez-modal-title" class="fase34-xadrez-modal-title">Aviso</div>
                <div id="fase36-xadrez-modal-text" class="fase34-xadrez-modal-text">Mensagem</div>
                <div class="fase34-xadrez-modal-actions">
                    <button id="fase36-xadrez-modal-yes" class="fase34-confirm-yes" type="button">Confirmar</button>
                    <button id="fase36-xadrez-modal-no" class="fase34-confirm-no" type="button">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function abrirModalFase36(titulo, texto, confirmar, aoConfirmar) {
        const modal = criarModalFase36();
        const title = document.getElementById('fase36-xadrez-modal-title');
        const text = document.getElementById('fase36-xadrez-modal-text');
        const yes = document.getElementById('fase36-xadrez-modal-yes');
        const no = document.getElementById('fase36-xadrez-modal-no');

        title.textContent = titulo || 'Tabuleiro Arena';
        text.innerHTML = String(texto || '').replace(/\n/g, '<br>');

        yes.style.display = confirmar ? 'inline-flex' : 'none';
        no.textContent = confirmar ? 'Cancelar' : 'OK';

        yes.onclick = function () {
            modal.classList.remove('show');
            if (typeof aoConfirmar === 'function') aoConfirmar();
        };

        no.onclick = function () {
            modal.classList.remove('show');
        };

        modal.classList.add('show');
    }

    window.alert = function (mensagem) {
        if (xadrezVisivel()) {
            abrirModalFase36('Tabuleiro Arena', mensagem, false);
            return;
        }
        if (alertaOriginal) alertaOriginal(mensagem);
    };

    if (typeof confirmacaoOriginal === 'function') {
        window.exibirConfirmacao = function (titulo, texto, aoConfirmar) {
            if (xadrezVisivel()) {
                abrirModalFase36(titulo || 'Confirmação', texto || 'Deseja confirmar?', true, aoConfirmar);
                return;
            }
            return confirmacaoOriginal.apply(this, arguments);
        };
    }

    function prepararRankingRecolhido() {
        const paineis = Array.from(document.querySelectorAll('#chess-training-ranking-panel, .chess-training-ranking-panel'));
        paineis.forEach(function (panel) {
            if (!panel || panel.dataset.fase36RankingOk === '1') return;
            panel.dataset.fase36RankingOk = '1';
            panel.classList.add('fase34-rank-closed');

            let head = panel.querySelector('.chess-training-ranking-head');
            if (!head) {
                head = document.createElement('div');
                head.className = 'chess-training-ranking-head';
                const titulo = document.createElement('div');
                titulo.className = 'chess-training-ranking-title';
                titulo.textContent = '🏆 Ranking do Treino';
                head.appendChild(titulo);
                panel.prepend(head);
            }

            let btn = head.querySelector('.fase34-rank-toggle, .chess-ranking-toggle-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'fase34-mini-plus fase34-rank-toggle';
                btn.textContent = '+';
                head.appendChild(btn);
            } else {
                btn.classList.add('fase34-mini-plus', 'fase34-rank-toggle');
            }

            function atualizar() {
                const aberto = panel.classList.contains('fase34-rank-open');
                btn.textContent = aberto ? '−' : '+';
                btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            }

            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                panel.classList.toggle('fase34-rank-open');
                atualizar();
            });

            atualizar();
        });
    }

    function removerControlesAntigosDaChamada() {
        const panel = document.getElementById('chess-call-panel');
        if (!panel) return;

        panel.classList.remove('fase34-call-closed', 'fase343-movida', 'fase344-posicao-manual', 'fase343-posicao-inicial-ok');

        const togglesAntigos = panel.querySelectorAll('.fase34-call-toggle, .fase34-video-toggle, #fase344-drag-handle');
        togglesAntigos.forEach(function (el) { el.remove(); });

        const toggleOriginal = document.getElementById('chess-call-toggle-btn');
        if (toggleOriginal) {
            toggleOriginal.style.display = 'none';
            toggleOriginal.setAttribute('aria-hidden', 'true');
        }

        const header = panel.querySelector('.chess-call-header');
        if (header) {
            header.dataset.chessDragReady = '0';
            header.dataset.dragReady = '0';
            header.style.cursor = 'default';
            header.style.touchAction = 'auto';
        }
    }

    function melhorarResultadoFinal() {
        const panel = document.getElementById('chess-result-panel');
        if (!panel) return;

        const visivel = panel.style.display !== 'none' &&
            panel.offsetParent !== null &&
            document.body.classList.contains('chess-board-visible');

        if (visivel) {
            panel.classList.add('fase34-front');
        }
    }

    function atualizarTextosFase36() {
        const seletores = [
            '.game-mode-badge',
            '.current-game-strip',
            '.system-status-text',
            '.chess-subtitle',
            '.chess-warning',
            '.chess-online-title'
        ];

        document.querySelectorAll(seletores.join(',')).forEach(function (el) {
            if (!el || !el.textContent) return;
            if (/Fase\s+\d+/i.test(el.textContent)) {
                el.textContent = el.textContent.replace(/Fase\s+\d+/gi, 'Fase 36');
            }
        });
    }

    function criarDockCamera() {
        let dock = document.getElementById('fase36-camera-dock');
        if (dock) return dock;

        dock = document.createElement('div');
        dock.id = 'fase36-camera-dock';
        dock.innerHTML = `
            <div class="fase36-camera-info">
                <div class="fase36-camera-title">📹 Câmera e áudio</div>
                <div class="fase36-camera-sub">Fica abaixo do tabuleiro e não cobre as peças</div>
            </div>
            <button id="fase36-camera-toggle" type="button" aria-label="Abrir câmera e áudio">+</button>
        `;

        const btn = dock.querySelector('#fase36-camera-toggle');
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const panel = document.getElementById('chess-call-panel');
            if (!panel) return;

            const abrir = !(panel.classList.contains('fase36-call-open') || panel.classList.contains('call-active'));
            panel.classList.toggle('fase36-call-open', abrir);
            panel.classList.toggle('call-compact', !abrir && !panel.classList.contains('call-active'));
            panel.classList.remove('fase34-call-closed');
            btn.textContent = abrir || panel.classList.contains('call-active') ? '−' : '+';

            setTimeout(posicionarCameraAbaixoDoTabuleiro, 40);
        });

        return dock;
    }

    function limparEstiloFlutuante(panel) {
        if (!panel) return;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.style.transform = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.position = '';
        panel.style.zIndex = '';
        panel.style.margin = '';
    }

    function aplicarAlturaSalva(panel) {
        if (!panel) return;
        let altura = 150;
        try {
            const salvo = Number(localStorage.getItem('tabuleiroArenaChessCallHeight') || 150);
            if (Number.isFinite(salvo)) altura = Math.max(110, Math.min(240, salvo));
        } catch (_) {}
        panel.style.setProperty('--fase36-video-height', `${altura}px`);
    }

    function posicionarCameraAbaixoDoTabuleiro() {
        if (!xadrezVisivel()) return;

        const panel = document.getElementById('chess-call-panel');
        const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
        const card = document.querySelector('#chess-screen .chess-card');

        if (!panel || !boardWrap || !card) return;

        const online = tabuleiroXadrezAberto() && partidaOnlineAtiva();

        document.body.classList.toggle('fase36-xadrez-online', !!online);
        document.body.classList.remove('fase35-xadrez-online');
        panel.classList.add('fase36-call-panel');
        panel.classList.remove('fase35-call-panel');

        const dock = criarDockCamera();

        if (online) {
            if (dock.parentElement !== card || boardWrap.nextElementSibling !== dock) {
                boardWrap.insertAdjacentElement('afterend', dock);
            }

            if (panel.parentElement !== card || dock.nextElementSibling !== panel) {
                dock.insertAdjacentElement('afterend', panel);
            }

            panel.classList.remove('fase343-movida', 'fase344-posicao-manual', 'fase343-posicao-inicial-ok', 'fase34-call-closed', 'fase35-call-open');
            removerControlesAntigosDaChamada();
            limparEstiloFlutuante(panel);
            aplicarAlturaSalva(panel);

            if (panel.classList.contains('call-active')) {
                panel.classList.add('fase36-call-open');
                panel.classList.remove('call-compact');
            }

            const btn = document.getElementById('fase36-camera-toggle');
            if (btn) {
                btn.textContent = panel.classList.contains('fase36-call-open') || panel.classList.contains('call-active') ? '−' : '+';
            }
        } else {
            panel.classList.remove('fase36-call-open');
            const btn = document.getElementById('fase36-camera-toggle');
            if (btn) btn.textContent = '+';
        }
    }

    function quandoIniciarChamada() {
        const panel = document.getElementById('chess-call-panel');
        if (!panel) return;

        if (panel.classList.contains('call-active')) {
            panel.classList.add('fase36-call-open');
            panel.classList.remove('call-compact', 'fase34-call-closed', 'fase35-call-open');
            removerControlesAntigosDaChamada();
            limparEstiloFlutuante(panel);
            aplicarAlturaSalva(panel);

            const btn = document.getElementById('fase36-camera-toggle');
            if (btn) btn.textContent = '−';

            posicionarCameraAbaixoDoTabuleiro();
        }
    }

    function aplicarFase36() {
        prepararRankingRecolhido();
        removerControlesAntigosDaChamada();
        melhorarResultadoFinal();
        atualizarTextosFase36();
        posicionarCameraAbaixoDoTabuleiro();
        quandoIniciarChamada();
    }

    document.addEventListener('DOMContentLoaded', aplicarFase36);
    window.addEventListener('load', aplicarFase36);
    window.addEventListener('resize', posicionarCameraAbaixoDoTabuleiro);

    document.addEventListener('click', function () {
        setTimeout(aplicarFase36, 80);
        setTimeout(posicionarCameraAbaixoDoTabuleiro, 300);
        setTimeout(posicionarCameraAbaixoDoTabuleiro, 800);
    });

    setInterval(aplicarFase36, 1200);
})();
