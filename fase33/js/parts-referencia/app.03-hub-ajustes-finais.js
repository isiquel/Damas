

    // 🎲 Tabuleiro Arena: seletor de modalidades sem mexer na lógica da Damas
    (function prepararHubTabuleiroArena() {
        const abrirDamas = () => {
            document.body.classList.remove('platform-start-active');
            document.body.classList.remove('mode-selecting');
            document.body.classList.add('game-selected');
            const hub = document.getElementById('games-hub-panel');
            if (hub) hub.style.display = 'none';
            const lobby = document.getElementById('lobby-screen');
            if (lobby) {
                lobby.style.display = 'block';
                lobby.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        const voltarModalidades = () => {
            document.body.classList.add('platform-start-active');
            document.body.classList.add('mode-selecting');
            document.body.classList.remove('game-selected');
            document.body.classList.remove('chess-selected', 'chess-focus-mode', 'chess-menu-active', 'chess-game-active', 'chess-board-visible');
            const chessScreen = document.getElementById('chess-screen');
            if (chessScreen) chessScreen.style.display = 'none';
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen && gameScreen.style.display !== 'none') {
                if (typeof leaveGame === 'function') leaveGame();
                else gameScreen.style.display = 'none';
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        const avisarEmBreve = (jogo) => {
            const texto = `<strong>${jogo} Arena</strong> já está planejado para entrar na plataforma Tabuleiro Arena.<br><br>Primeiro vamos manter Damas Arena estável e profissional; depois essa modalidade poderá usar a mesma base de salas, ranking, torneios, chat e vídeo/áudio.`;
            if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema(`${jogo} em breve`, texto);
            else alert(`${jogo} Arena em breve!`);
        };
        const ligarCard = (id, acao) => {
            const card = document.getElementById(id);
            if (!card) return;
            card.addEventListener('click', acao);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    acao();
                }
            });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                ligarCard('game-card-damas', abrirDamas);
                const backBtn = document.getElementById('back-to-games-btn');
                if (backBtn) backBtn.addEventListener('click', voltarModalidades);
                ligarCard('game-card-xadrez', () => { if (typeof abrirXadrezArena === 'function') abrirXadrezArena(); else avisarEmBreve('Xadrez'); });
            });
        } else {
            ligarCard('game-card-damas', abrirDamas);
            const backBtn = document.getElementById('back-to-games-btn');
            if (backBtn) backBtn.addEventListener('click', voltarModalidades);
            ligarCard('game-card-xadrez', () => { if (typeof abrirXadrezArena === 'function') abrirXadrezArena(); else avisarEmBreve('Xadrez'); });
        }
    })();

    // Dominó removido temporariamente para manter a Damas Arena estável.


        /* ✅ FASE 15 - AULA DAS PEÇAS NO TREINO DO XADREZ */
        (function instalarAulaPecasXadrezFase15() {
            function bindLessonButton() {
                const btn = document.getElementById('chess-pieces-lesson-btn');
                const panel = document.getElementById('chess-pieces-lesson-panel');
                if (!btn || !panel || btn.dataset.boundFase15 === '1') return;
                btn.dataset.boundFase15 = '1';
                btn.addEventListener('click', function () {
                    const aberto = panel.style.display !== 'none';
                    panel.style.display = aberto ? 'none' : 'block';
                    btn.textContent = aberto ? '📚 Conhecer as peças antes de jogar' : '📕 Fechar explicação das peças';
                    if (!aberto) {
                        const status = document.getElementById('chess-training-status');
                        if (status) status.textContent = 'Leia as peças abaixo. Depois escolha Fácil, Médio, Difícil ou Aprender do Zero para abrir o tabuleiro.';
                    }
                });
            }

            const antigoEnsure = window.ensureChessOnlinePanel;
            if (typeof antigoEnsure === 'function') {
                window.ensureChessOnlinePanel = function () {
                    const retorno = antigoEnsure.apply(this, arguments);
                    setTimeout(bindLessonButton, 0);
                    return retorno;
                };
            }

            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(bindLessonButton, 300);
            });

            setInterval(bindLessonButton, 1200);
        })();



        /* ✅ FASE 27 - CORREÇÕES DO ONLINE: nomes, chat recolhível, sem histórico e tabuleiro estável */
        (function fase27OnlineLimpoTabuleiroEstavel(){
            if (window.__tabuleiroArenaXadrezFase29InternaAtiva) return;
            function safeNameChess27(player, fallback) {
                try { return escapeHtmlXadrez(player?.name || fallback || 'Aguardando'); }
                catch (_) { return String(player?.name || fallback || 'Aguardando'); }
            }
            function isMeChess27(player) {
                try { return !!(player && player.id && typeof uid !== 'undefined' && player.id === uid); }
                catch (_) { return false; }
            }
            function ensurePlayersBarChess27() {
                const card = document.querySelector('#chess-screen .chess-card');
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!card || !boardWrap) return null;
                let bar = document.getElementById('chess-game-players-bar');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'chess-game-players-bar';
                    bar.className = 'chess-game-players-bar';
                    boardWrap.insertAdjacentElement('beforebegin', bar);
                }
                return bar;
            }
            window.updateChessGamePlayersBarFase27 = function updateChessGamePlayersBarFase27() {
                const bar = ensurePlayersBarChess27();
                if (!bar) return;
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) {
                    bar.style.display = 'none';
                    return;
                }
                const white = chessRoomPlayers?.white || null;
                const black = chessRoomPlayers?.black || null;
                const whiteName = safeNameChess27(white, 'Aguardando brancas');
                const blackName = safeNameChess27(black, 'Aguardando pretas');
                bar.innerHTML = `
                    <div class="chess-game-players-side">
                        <span>⚪</span><span class="chess-game-players-name ${isMeChess27(white) ? 'me' : ''}">${whiteName}${isMeChess27(white) ? ' (você)' : ''}</span>
                    </div>
                    <div class="chess-game-players-vs">contra</div>
                    <div class="chess-game-players-side">
                        <span class="chess-game-players-name ${isMeChess27(black) ? 'me' : ''}">${blackName}${isMeChess27(black) ? ' (você)' : ''}</span><span>⚫</span>
                    </div>
                `;
                bar.style.display = 'flex';
            };
            function ensureChatToggleChess27() {
                const chat = document.getElementById('chess-chat-panel');
                if (!chat) return;
                const title = chat.querySelector('.chess-chat-title');
                if (!title) return;
                if (!document.getElementById('chess-chat-toggle-mini')) {
                    title.innerHTML = '<span>💬 Chat</span><button id="chess-chat-toggle-mini" class="chess-chat-toggle-mini" type="button">+</button>';
                    const toggle = () => {
                        const collapsed = chat.classList.toggle('chat-collapsed');
                        const btn = document.getElementById('chess-chat-toggle-mini');
                        if (btn) btn.textContent = collapsed ? '+' : '−';
                    };
                    title.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        toggle();
                    });
                }
                if (document.body.classList.contains('chess-board-visible') && chessMode === 'online') {
                    chat.classList.add('chat-collapsed');
                    const btn = document.getElementById('chess-chat-toggle-mini');
                    if (btn) btn.textContent = '+';
                }
            }
            function compactarTelaOnlineChess27() {
                document.body.classList.toggle('chess-mode-online', chessMode === 'online');
                document.body.classList.toggle('chess-mode-training', chessMode === 'training');
                const history = document.getElementById('chess-history-panel');
                if (history && document.body.classList.contains('chess-board-visible')) history.style.display = 'none';
                const material = document.getElementById('chess-material-panel');
                if (material && document.body.classList.contains('chess-board-visible')) material.style.display = 'none';
                const roomPanel = document.getElementById('chess-room-players-panel');
                if (roomPanel && document.body.classList.contains('chess-board-visible')) roomPanel.style.display = 'none';
                ensureChatToggleChess27();
                window.updateChessGamePlayersBarFase27?.();
            }

            const oldMostrarTabuleiro = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function() {
                oldMostrarTabuleiro.apply(this, arguments);
                compactarTelaOnlineChess27();
            };

            const oldOcultarTabuleiro = ocultarTabuleiroXadrezParaMenu;
            ocultarTabuleiroXadrezParaMenu = function() {
                oldOcultarTabuleiro.apply(this, arguments);
                const bar = document.getElementById('chess-game-players-bar');
                if (bar) bar.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat) chat.classList.remove('chat-collapsed');
            };

            const oldAtualizarPainelOnline = atualizarPainelOnlineXadrez;
            atualizarPainelOnlineXadrez = function() {
                oldAtualizarPainelOnline.apply(this, arguments);
                const chat = document.getElementById('chess-chat-panel');
                if (chat && document.body.classList.contains('chess-board-visible')) {
                    chat.style.display = chessMode === 'online' ? 'block' : 'none';
                    if (chessMode === 'online') chat.classList.add('chat-collapsed');
                }
                compactarTelaOnlineChess27();
            };

            const oldRenderPlayers = renderizarListaJogadoresXadrez;
            renderizarListaJogadoresXadrez = function() {
                oldRenderPlayers.apply(this, arguments);
                window.updateChessGamePlayersBarFase27?.();
            };

            const oldRenderHistorico = renderHistorico;
            renderHistorico = function() {
                if (document.body.classList.contains('chess-board-visible')) {
                    const panel = document.getElementById('chess-history-panel');
                    if (panel) panel.style.display = 'none';
                    return;
                }
                oldRenderHistorico.apply(this, arguments);
            };

            const oldRenderBoard = renderChessBoard;
            renderChessBoard = function() {
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                const shouldLock = chessMode === 'online' && document.body.classList.contains('chess-board-visible') && boardWrap;
                const beforeTop = shouldLock ? boardWrap.getBoundingClientRect().top : null;
                oldRenderBoard.apply(this, arguments);
                compactarTelaOnlineChess27();
                if (shouldLock) {
                    requestAnimationFrame(() => {
                        const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                        if (!wrap) return;
                        const afterTop = wrap.getBoundingClientRect().top;
                        const diff = afterTop - beforeTop;
                        if (Math.abs(diff) > 1 && Math.abs(diff) < window.innerHeight * 0.85) {
                            window.scrollTo({ top: Math.max(0, window.scrollY + diff), behavior: 'auto' });
                        }
                    });
                }
            };

            const oldMostrarResultado = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function() {
                oldMostrarResultado.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const oldLimparResultado = limparResultadoXadrez;
            limparResultadoXadrez = function() {
                oldLimparResultado.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                ensurePlayersBarChess27();
                ensureChatToggleChess27();
                compactarTelaOnlineChess27();
            });
        })();


        /* ✅ FASE 35 - AJUSTES FINAIS DE LIMPEZA DO XADREZ ONLINE
           Não altera Damas. Só organiza Xadrez: ranking recolhível, chamada compacta e modais profissionais. */
        function instalarFase31XadrezTelaLimpa() {
            window.__tabuleiroArenaXadrezFase31TelaLimpa = true;

            function atualizarBotaoChamadaCompacta() {
                const els = chessCallElements();
                if (!els.panel || !els.toggle) return;
                const compacto = els.panel.classList.contains('call-compact') && !els.panel.classList.contains('call-active');
                els.toggle.textContent = compacto ? '+' : '−';
                els.toggle.setAttribute('aria-expanded', compacto ? 'false' : 'true');
            }

            function alternarPainelChamadaXadrezCompactoFase31() {
                const els = chessCallElements();
                if (!els.panel || els.panel.classList.contains('call-active')) return;
                const abrir = els.panel.classList.contains('call-compact');
                els.panel.classList.toggle('call-compact', !abrir);
                els.panel.dataset.userOpened = abrir ? '1' : '0';
                atualizarBotaoChamadaCompacta();
            }
            window.alternarPainelChamadaXadrezCompacto = alternarPainelChamadaXadrezCompactoFase31;

            const oldAtualizarPainelChamada = atualizarPainelChamadaXadrez;
            atualizarPainelChamadaXadrez = function atualizarPainelChamadaXadrezFase31() {
                oldAtualizarPainelChamada.apply(this, arguments);
                const els = chessCallElements();
                if (!els.panel) return;
                if (els.panel.classList.contains('call-active')) {
                    els.panel.classList.remove('call-compact');
                    centralizarChamadaXadrezFase31();
                } else if (els.panel.dataset.userOpened !== '1') {
                    els.panel.classList.add('call-compact');
                }
                atualizarBotaoChamadaCompacta();
            };

            aplicarTamanhoChamadaXadrez = function aplicarTamanhoChamadaXadrezFase31() {
                const { panel } = chessCallElements();
                if (!panel) return;
                chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth || 150));
                panel.style.setProperty('--fase35-video-height', `${chessCallFloatingWidth}px`);
                panel.style.left = '';
                panel.style.right = '';
                panel.style.top = '';
                panel.style.bottom = '';
                panel.style.transform = '';
                panel.style.width = '';
                panel.style.maxWidth = '';
                try { localStorage.setItem('tabuleiroArenaChessCallHeight', String(chessCallFloatingWidth)); } catch (_) {}
            };

            function centralizarChamadaXadrezFase31() {
                const { panel } = chessCallElements();
                if (!panel) return;
                aplicarTamanhoChamadaXadrez();
            }
            window.centralizarChamadaXadrezFase31 = centralizarChamadaXadrezFase31;

            restaurarPosicaoChamadaXadrez = function restaurarPosicaoChamadaXadrezFase31() {
                centralizarChamadaXadrezFase31();
            };

            const oldRedimensionarChamada = redimensionarChamadaXadrez;
            redimensionarChamadaXadrez = function redimensionarChamadaXadrezFase31(delta) {
                chessCallFloatingWidth = Math.max(110, Math.min(240, (chessCallFloatingWidth || 150) + delta));
                aplicarTamanhoChamadaXadrez();
            };

            const oldMostrarResultado31 = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function mostrarResultadoXadrezSeTerminouFase31() {
                oldMostrarResultado31.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const oldLimparResultado31 = limparResultadoXadrez;
            limparResultadoXadrez = function limparResultadoXadrezFase31() {
                oldLimparResultado31.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                prepararRankingTreinoXadrez?.();
                atualizarPainelChamadaXadrez?.();
                atualizarBotaoChamadaCompacta();
            });

            window.addEventListener('resize', () => {
                centralizarChamadaXadrezFase31();
            });
        }

        instalarFase31XadrezTelaLimpa();


/* ======================================================================
   FASE 36 ESTÁVEL - CORREÇÃO FINAL DE ESTABILIDADE
   - Não cria dock extra.
   - Mantém apenas o painel nativo #chess-call-panel.
   - Move esse único painel para baixo do tabuleiro.
   - Não usa MutationObserver nem loop que mexe no DOM toda hora.
   - Mantém ranking do treino abrindo pelo botão + nativo.
   ====================================================================== */
(function instalarFase36EstavelSemDuplicarCamera() {
    if (window.__tabuleiroArenaFase36EstavelSemDuplicarCamera) return;
    window.__tabuleiroArenaFase36EstavelSemDuplicarCamera = true;

    function removerDocksDuplicadosFase36() {
        document.querySelectorAll('#fase36-camera-dock, .fase36-camera-dock').forEach(function (el) {
            el.remove();
        });
    }

    function limparPainelChamadaFase36(panel) {
        if (!panel) return;
        panel.classList.remove('fase36-call-panel', 'fase36-call-open', 'fase35-call-panel', 'fase35-call-open', 'fase34-call-closed', 'fase343-movida', 'fase344-posicao-manual', 'fase343-posicao-inicial-ok');
        panel.style.left = '';
        panel.style.right = '';
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.transform = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.position = '';
        panel.style.zIndex = '';
        panel.style.marginLeft = '';
        panel.style.marginRight = '';

        const toggle = document.getElementById('chess-call-toggle-btn');
        if (toggle) {
            toggle.style.display = '';
            toggle.removeAttribute('aria-hidden');
        }

        const title = panel.querySelector('.chess-call-title');
        if (title) title.textContent = '📹 Câmera e áudio';

        const note = panel.querySelector('.chess-call-note');
        if (note) note.innerHTML = 'A chamada fica fixa abaixo do tabuleiro do Xadrez e não cobre as peças. Não usa a câmera da Damas.';
    }

    function posicionarChamadaAbaixoDoTabuleiroFase36() {
        removerDocksDuplicadosFase36();
        const panel = document.getElementById('chess-call-panel');
        const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
        if (!panel || !boardWrap) return;

        limparPainelChamadaFase36(panel);

        if (boardWrap.nextElementSibling !== panel) {
            boardWrap.insertAdjacentElement('afterend', panel);
        }

        if (typeof atualizarBotaoChamadaCompacta === 'function') {
            try { atualizarBotaoChamadaCompacta(); } catch (_) {}
        } else {
            const toggle = document.getElementById('chess-call-toggle-btn');
            if (toggle) {
                const fechado = panel.classList.contains('call-compact') && !panel.classList.contains('call-active');
                toggle.textContent = fechado ? '+' : '−';
                toggle.setAttribute('aria-expanded', fechado ? 'false' : 'true');
            }
        }
    }

    function reforcarRankingNativoFase36() {
        const panel = document.getElementById('chess-training-ranking-panel');
        const btn = document.getElementById('chess-ranking-toggle-btn');
        if (!panel || !btn || btn.dataset.fase36RankingSeguro === '1') return;
        btn.dataset.fase36RankingSeguro = '1';
        btn.addEventListener('click', function () {
            setTimeout(function () {
                const aberto = !panel.classList.contains('chess-rank-collapsed');
                btn.textContent = aberto ? '−' : '+';
                btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            }, 0);
        });
    }

    const oldMostrarTabuleiroFase36 = typeof mostrarTabuleiroXadrezAposEscolha === 'function' ? mostrarTabuleiroXadrezAposEscolha : null;
    if (oldMostrarTabuleiroFase36) {
        mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase36Estavel() {
            oldMostrarTabuleiroFase36.apply(this, arguments);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 0);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 180);
        };
    }

    const oldAtualizarPainelChamadaFase36 = typeof atualizarPainelChamadaXadrez === 'function' ? atualizarPainelChamadaXadrez : null;
    if (oldAtualizarPainelChamadaFase36) {
        atualizarPainelChamadaXadrez = function atualizarPainelChamadaXadrezFase36Estavel() {
            oldAtualizarPainelChamadaFase36.apply(this, arguments);
            posicionarChamadaAbaixoDoTabuleiroFase36();
        };
    }

    const oldAtualizarPainelOnlineFase36 = typeof atualizarPainelOnlineXadrez === 'function' ? atualizarPainelOnlineXadrez : null;
    if (oldAtualizarPainelOnlineFase36) {
        atualizarPainelOnlineXadrez = function atualizarPainelOnlineXadrezFase36Estavel() {
            oldAtualizarPainelOnlineFase36.apply(this, arguments);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 0);
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 300);
        setTimeout(reforcarRankingNativoFase36, 350);
    });

    document.addEventListener('click', function (ev) {
        const alvo = ev.target;
        if (!alvo || !alvo.closest) return;
        if (alvo.closest('#chess-online-join-btn, #chess-online-watch-btn, #chess-online-leave-btn, #chess-start-video-call-btn, #chess-start-audio-call-btn, #chess-end-call-btn, #chess-call-toggle-btn, #chess-training-easy-btn, #chess-training-medium-btn, #chess-training-hard-btn, #chess-training-learn-btn')) {
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 160);
            setTimeout(reforcarRankingNativoFase36, 180);
        }
    });

    window.addEventListener('resize', function () {
        setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 80);
    });
})();




/* ✅ FASE 36.12 - Reforço sem remendo: manter controles no tabuleiro se a sala online já estiver ativa. */
document.addEventListener('click', async (ev) => {
    const alvo = ev.target;
    if (!alvo || !alvo.closest) return;
    if (alvo.closest('#chess-board-leave-online-btn')) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        await sairXadrezOnline(false);
        ocultarTabuleiroXadrezParaMenu();
        mostrarToastXadrez('🚪 Você saiu da sala online. A vaga foi liberada.');
    }
    if (alvo.closest('#chess-call-toggle-btn') && chessMode === 'online') {
        const panel = document.getElementById('chess-call-panel');
        if (panel && !panel.classList.contains('call-active')) {
            panel.classList.toggle('call-compact');
            const toggle = document.getElementById('chess-call-toggle-btn');
            if (toggle) toggle.textContent = panel.classList.contains('call-compact') ? '+' : '−';
        }
        setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 20);
    }
}, true);

setInterval(() => {
    if (chessMode === 'online' && chessRoomId && document.body.classList.contains('chess-board-visible')) {
        garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator);
    }
}, 1000);
