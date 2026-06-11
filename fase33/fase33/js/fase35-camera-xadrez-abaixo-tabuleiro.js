(function () {
    if (window.__fase35CameraAbaixoTabuleiroOk) return;
    window.__fase35CameraAbaixoTabuleiroOk = true;

    function telaXadrezVisivel() {
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

    function criarDock() {
        let dock = document.getElementById('fase35-camera-dock');
        if (dock) return dock;

        dock = document.createElement('div');
        dock.id = 'fase35-camera-dock';
        dock.innerHTML = `
            <div class="fase35-camera-info">
                <div class="fase35-camera-title">📹 Câmera e áudio</div>
                <div class="fase35-camera-sub">Fica abaixo do tabuleiro e não cobre as peças</div>
            </div>
            <button id="fase35-camera-toggle" type="button" aria-label="Abrir câmera e áudio">+</button>
        `;

        const btn = dock.querySelector('#fase35-camera-toggle');
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const panel = document.getElementById('chess-call-panel');
            if (!panel) return;

            const abrir = !(panel.classList.contains('fase35-call-open') || panel.classList.contains('call-active'));
            panel.classList.toggle('fase35-call-open', abrir);
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
        panel.style.setProperty('--fase35-video-height', `${altura}px`);
    }

    function posicionarCameraAbaixoDoTabuleiro() {
        if (!telaXadrezVisivel()) return;

        const panel = document.getElementById('chess-call-panel');
        const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
        const card = document.querySelector('#chess-screen .chess-card');

        if (!panel || !boardWrap || !card) return;

        const online = tabuleiroXadrezAberto() && partidaOnlineAtiva();

        document.body.classList.toggle('fase35-xadrez-online', !!online);
        panel.classList.add('fase35-call-panel');

        const dock = criarDock();

        if (online) {
            if (dock.parentElement !== card || boardWrap.nextElementSibling !== dock) {
                boardWrap.insertAdjacentElement('afterend', dock);
            }

            if (panel.parentElement !== card || dock.nextElementSibling !== panel) {
                dock.insertAdjacentElement('afterend', panel);
            }

            panel.classList.remove('fase343-movida', 'fase344-posicao-manual', 'fase343-posicao-inicial-ok', 'fase34-call-closed');
            limparEstiloFlutuante(panel);
            aplicarAlturaSalva(panel);

            if (panel.classList.contains('call-active')) {
                panel.classList.add('fase35-call-open');
                panel.classList.remove('call-compact');
            }

            const btn = document.getElementById('fase35-camera-toggle');
            if (btn) {
                btn.textContent = panel.classList.contains('fase35-call-open') || panel.classList.contains('call-active') ? '−' : '+';
            }
        } else {
            panel.classList.remove('fase35-call-open');
            const btn = document.getElementById('fase35-camera-toggle');
            if (btn) btn.textContent = '+';
        }
    }

    function quandoIniciarChamada() {
        const panel = document.getElementById('chess-call-panel');
        if (!panel) return;

        if (panel.classList.contains('call-active')) {
            panel.classList.add('fase35-call-open');
            panel.classList.remove('call-compact', 'fase34-call-closed');
            limparEstiloFlutuante(panel);
            aplicarAlturaSalva(panel);

            const btn = document.getElementById('fase35-camera-toggle');
            if (btn) btn.textContent = '−';

            posicionarCameraAbaixoDoTabuleiro();
        }
    }

    document.addEventListener('DOMContentLoaded', posicionarCameraAbaixoDoTabuleiro);
    window.addEventListener('load', posicionarCameraAbaixoDoTabuleiro);
    window.addEventListener('resize', posicionarCameraAbaixoDoTabuleiro);

    document.addEventListener('click', function () {
        setTimeout(posicionarCameraAbaixoDoTabuleiro, 60);
        setTimeout(quandoIniciarChamada, 120);
        setTimeout(posicionarCameraAbaixoDoTabuleiro, 300);
        setTimeout(posicionarCameraAbaixoDoTabuleiro, 800);
    });

    setInterval(function () {
        posicionarCameraAbaixoDoTabuleiro();
        quandoIniciarChamada();
    }, 700);
})();
