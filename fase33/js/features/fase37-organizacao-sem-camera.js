/* ======================================================================
   TABULEIRO ARENA - FASE 37
   Arquivo pequeno para manutenção futura.
   Objetivo: não mexer no núcleo grande; apenas organizar o Xadrez atual.
   ====================================================================== */

(function fase37OrganizacaoSemCamera() {
    if (window.__tabuleiroArenaFase37OrganizacaoSemCamera) return;
    window.__tabuleiroArenaFase37OrganizacaoSemCamera = true;

    function estaNoXadrez() {
        return document.body.classList.contains('chess-selected') || !!document.getElementById('chess-screen');
    }

    function atualizarTextosFase37() {
        const hubBadge = document.querySelector('#game-card-xadrez .game-mode-badge');
        if (hubBadge) hubBadge.textContent = 'Fase 37';

        const titleTexts = document.querySelectorAll('#chess-screen .chess-subtitle, #chess-screen .chess-warning, #chess-screen .chess-status-pill, #chess-screen .chess-clean-game-pill');
        titleTexts.forEach((el) => {
            if (!el || !el.textContent) return;
            el.textContent = el.textContent
                .replace(/Fase\s*36(?:\.\d+)?/gi, 'Fase 37')
                .replace(/câmera\/áudio continuam abaixo do tabuleiro\.?/gi, 'vídeo do Xadrez foi pausado para manter o tabuleiro estável.')
                .replace(/com sair da sala e câmera\/áudio abaixo das peças\.?/gi, 'com sair da sala dentro do tabuleiro e base separada para manutenção.');
        });

        document.querySelectorAll('#chess-screen, #games-hub-panel').forEach((root) => {
            root.querySelectorAll('*').forEach((el) => {
                if (!el.childNodes || el.childNodes.length !== 1 || el.childNodes[0].nodeType !== Node.TEXT_NODE) return;
                const txt = el.textContent || '';
                if (/Fase\s*36(?:\.\d+)?/i.test(txt)) {
                    el.textContent = txt.replace(/Fase\s*36(?:\.\d+)?/gi, 'Fase 37');
                }
            });
        });
    }

    function esconderCameraXadrez() {
        if (!estaNoXadrez()) return;

        const ids = [
            'chess-call-panel',
            'fase36-camera-dock',
            'chess-board-camera-panel'
        ];

        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.setAttribute('aria-hidden', 'true');
            }
        });

        document.querySelectorAll('#chess-screen .chess-call-panel, #chess-screen .fase36-camera-dock, #chess-screen .chess-board-camera-panel').forEach((el) => {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.setAttribute('aria-hidden', 'true');
        });
    }

    function garantirBotaoSairOnline() {
        const actions = document.querySelector('#chess-screen .chess-actions');
        if (!actions) return;

        let sair = document.getElementById('chess-board-leave-online-btn');
        const voltar = document.getElementById('chess-back-btn-bottom');

        if (!sair) {
            sair = document.createElement('button');
            sair.id = 'chess-board-leave-online-btn';
            sair.className = 'btn-chess-leave-online-board';
            sair.type = 'button';
            sair.textContent = 'Sair da sala';
        }

        if (sair.parentElement !== actions) {
            if (voltar && voltar.parentElement === actions) actions.insertBefore(sair, voltar);
            else actions.appendChild(sair);
        }

        const online = document.body.classList.contains('chess-online-active-3612') ||
                       document.body.classList.contains('chess-online-active-3613') ||
                       /ONLINE/i.test(document.getElementById('chess-status')?.textContent || '') ||
                       /Aguardando|sala online|Online na sala/i.test(document.body.textContent || '');

        sair.style.setProperty('display', online ? 'block' : 'none', 'important');
    }

    function inserirAvisoCameraPausada() {
        const actions = document.querySelector('#chess-screen .chess-actions');
        if (!actions) return;
        if (document.getElementById('chess-camera-disabled-note')) return;

        const note = document.createElement('div');
        note.id = 'chess-camera-disabled-note';
        note.className = 'chess-camera-disabled-note';
        note.textContent = '📹 Câmera do Xadrez pausada nesta fase para manter a sala online estável. Jogo, chat e sair da sala continuam funcionando.';
        actions.insertAdjacentElement('afterend', note);
    }

    function aplicarFase37() {
        atualizarTextosFase37();
        esconderCameraXadrez();
        garantirBotaoSairOnline();
        inserirAvisoCameraPausada();
    }

    document.addEventListener('click', function (ev) {
        const alvo = ev.target;
        if (!alvo || !alvo.closest) return;

        if (alvo.closest('#chess-call-toggle-btn') || alvo.closest('#chess-call-panel')) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            esconderCameraXadrez();
        }

        setTimeout(aplicarFase37, 80);
    }, true);

    const observer = new MutationObserver(() => aplicarFase37());

    function iniciar() {
        aplicarFase37();
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        setInterval(aplicarFase37, 1500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
