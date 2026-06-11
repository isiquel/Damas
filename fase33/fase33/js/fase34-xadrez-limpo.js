(function () {
    if (window.__fase34XadrezLimpoInstalado) return;
    window.__fase34XadrezLimpoInstalado = true;

    const alertaOriginal = window.alert ? window.alert.bind(window) : null;
    const confirmacaoOriginal = window.exibirConfirmacao;

    function xadrezVisivel() {
        const tela = document.getElementById('chess-screen');
        return document.body.classList.contains('chess-selected') ||
            (tela && getComputedStyle(tela).display !== 'none');
    }

    function criarModalFase34() {
        let modal = document.getElementById('fase34-xadrez-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'fase34-xadrez-modal';
        modal.className = 'fase34-xadrez-modal';
        modal.innerHTML = `
            <div class="fase34-xadrez-modal-card">
                <div id="fase34-xadrez-modal-title" class="fase34-xadrez-modal-title">Aviso</div>
                <div id="fase34-xadrez-modal-text" class="fase34-xadrez-modal-text">Mensagem</div>
                <div class="fase34-xadrez-modal-actions">
                    <button id="fase34-xadrez-modal-yes" class="fase34-confirm-yes" type="button">Confirmar</button>
                    <button id="fase34-xadrez-modal-no" class="fase34-confirm-no" type="button">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function abrirModalFase34(titulo, texto, confirmar, aoConfirmar) {
        const modal = criarModalFase34();
        const title = document.getElementById('fase34-xadrez-modal-title');
        const text = document.getElementById('fase34-xadrez-modal-text');
        const yes = document.getElementById('fase34-xadrez-modal-yes');
        const no = document.getElementById('fase34-xadrez-modal-no');

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
            abrirModalFase34('Tabuleiro Arena', mensagem, false);
            return;
        }
        if (alertaOriginal) alertaOriginal(mensagem);
    };

    if (typeof confirmacaoOriginal === 'function') {
        window.exibirConfirmacao = function (titulo, texto, aoConfirmar) {
            if (xadrezVisivel()) {
                abrirModalFase34(titulo || 'Confirmação', texto || 'Deseja confirmar?', true, aoConfirmar);
                return;
            }
            return confirmacaoOriginal.apply(this, arguments);
        };
    }

    function prepararRankingRecolhido() {
        const paineis = Array.from(document.querySelectorAll('#chess-training-ranking-panel, .chess-training-ranking-panel'));
        paineis.forEach(function (panel) {
            if (!panel || panel.dataset.fase34RankingOk === '1') return;
            panel.dataset.fase34RankingOk = '1';
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

    function prepararChamadaCompacta() {
        const panel = document.getElementById('chess-call-panel');
        if (!panel || panel.dataset.fase34CallOk === '1') return;

        panel.dataset.fase34CallOk = '1';
        panel.classList.add('fase34-call-closed');

        let header = panel.querySelector('.chess-call-header');
        if (!header) return;

        let btn = header.querySelector('.fase34-call-toggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fase34-mini-plus fase34-call-toggle';
            btn.textContent = '+';
            header.appendChild(btn);
        }

        function atualizar() {
            const fechado = panel.classList.contains('fase34-call-closed') && !panel.classList.contains('call-active');
            btn.textContent = fechado ? '+' : '−';
            btn.setAttribute('aria-expanded', fechado ? 'false' : 'true');
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (panel.classList.contains('call-active')) return;

            panel.classList.toggle('fase34-call-closed');
            atualizar();
        });

        setInterval(function () {
            if (panel.classList.contains('call-active')) {
                panel.classList.remove('fase34-call-closed');
            }
            atualizar();
        }, 800);

        atualizar();
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

    function atualizarTextosFase34() {
        const seletores = [
            '.game-mode-badge',
            '.current-game-strip',
            '.system-status-text',
            '.chess-subtitle',
            '.chess-warning'
        ];

        document.querySelectorAll(seletores.join(',')).forEach(function (el) {
            if (!el || !el.textContent) return;
            if (/Fase\s+\d+/i.test(el.textContent)) {
                el.textContent = el.textContent.replace(/Fase\s+\d+/gi, 'Fase 35');
            }
        });
    }

    function aplicarFase34() {
        prepararRankingRecolhido();
        prepararChamadaCompacta();
        melhorarResultadoFinal();
        atualizarTextosFase34();
    }

    document.addEventListener('DOMContentLoaded', aplicarFase34);
    window.addEventListener('load', aplicarFase34);
    document.addEventListener('click', function () {
        setTimeout(aplicarFase34, 120);
    });

    setInterval(aplicarFase34, 1500);
})();
