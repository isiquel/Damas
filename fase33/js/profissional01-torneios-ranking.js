/* ============================================================
   TABULEIRO ARENA - PROFISSIONAL 01
   Central visual de Torneios, Ranking e Manual.
   Seguro: não altera regras de Damas, Xadrez, Firebase ou Admin.
   ============================================================ */
(function () {
    'use strict';

    const ID_PANEL = 'professional-arena-panel';
    const ID_MODAL = 'professional-arena-modal';

    function qs(selector) {
        return document.querySelector(selector);
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function abrirAlerta(titulo, texto) {
        if (typeof window.exibirAlertaDoSistema === 'function') {
            window.exibirAlertaDoSistema(titulo, texto);
            return;
        }
        alert(`${titulo}\n\n${texto.replace(/<[^>]*>/g, '')}`);
    }

    function abrirRanking() {
        const botaoRanking = byId('rank-btn-lobby');
        if (botaoRanking && !botaoRanking.disabled) {
            botaoRanking.click();
            return;
        }
        abrirAlerta('Ranking', 'O ranking está disponível dentro da área da Damas e também nos painéis do jogo quando houver dados registrados.');
    }

    function abrirTorneios() {
        const cardDamas = byId('game-card-damas');
        if (cardDamas) cardDamas.click();

        window.setTimeout(() => {
            const painelTorneios = qs('.tournament-lobby-panel');
            if (painelTorneios) {
                painelTorneios.scrollIntoView({ behavior: 'smooth', block: 'center' });
                painelTorneios.classList.add('professional-focus-ring');
                window.setTimeout(() => painelTorneios.classList.remove('professional-focus-ring'), 1400);
            } else {
                abrirAlerta('Torneios', 'A central de torneios está disponível no lobby da Damas e no painel do administrador.');
            }
        }, 450);
    }

    function abrirAdmin() {
        const cardAdmin = byId('game-card-admin');
        if (cardAdmin) {
            cardAdmin.click();
            return;
        }
        abrirAlerta('Painel Admin', 'Entre pelo botão Painel Admin na tela inicial para controlar salas, ranking, chat e torneios.');
    }

    function criarModalManual() {
        if (byId(ID_MODAL)) return;
        const overlay = document.createElement('div');
        overlay.id = ID_MODAL;
        overlay.className = 'professional-modal-overlay';
        overlay.innerHTML = `
            <div class="professional-modal-card" role="dialog" aria-modal="true" aria-label="Manual rápido do Tabuleiro Arena">
                <h2>Manual rápido do Tabuleiro Arena</h2>
                <p><strong>Para jogar:</strong> escolha Damas ou Xadrez, digite seu nome e entre numa sala.</p>
                <ul>
                    <li><strong>Damas:</strong> salas online, espectadores, chat, ranking e torneios.</li>
                    <li><strong>Xadrez:</strong> treino, modo aprender e partidas online com saída de sala.</li>
                    <li><strong>Admin:</strong> libera salas, bloqueia chat, limpa mensagens e organiza torneios.</li>
                </ul>
                <p><strong>Versão profissional:</strong> mantenha o link principal para jogadores e use a /fase33/ como área de teste antes de novas alterações.</p>
                <button id="professional-modal-close-btn" class="professional-modal-close" type="button">Fechar</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) overlay.classList.remove('show');
        });
        byId('professional-modal-close-btn')?.addEventListener('click', () => overlay.classList.remove('show'));
    }

    function abrirManual() {
        criarModalManual();
        byId(ID_MODAL)?.classList.add('show');
    }

    function instalarPainelProfissional() {
        if (byId(ID_PANEL)) return;
        const hub = byId('games-hub-panel');
        const grid = hub?.querySelector('.game-mode-grid');
        if (!hub || !grid) return;

        const panel = document.createElement('div');
        panel.id = ID_PANEL;
        panel.className = 'professional-arena-panel';
        panel.innerHTML = `
            <div class="professional-arena-head">
                <div>
                    <div class="professional-arena-title">Central Profissional</div>
                    <div class="professional-arena-subtitle">Acesso rápido para torneios, ranking, manual e administração.</div>
                </div>
                <div class="professional-arena-badge">Base estável</div>
            </div>
            <div class="professional-arena-grid">
                <button id="professional-tournaments-btn" class="professional-arena-action" type="button">
                    <strong>🏆 Torneios</strong><span>Ver campeonatos e salas oficiais.</span>
                </button>
                <button id="professional-ranking-btn" class="professional-arena-action" type="button">
                    <strong>📊 Ranking</strong><span>Consultar campeões e evolução.</span>
                </button>
                <button id="professional-manual-btn" class="professional-arena-action" type="button">
                    <strong>📘 Manual rápido</strong><span>Como jogar, criar salas e administrar.</span>
                </button>
                <button id="professional-admin-btn" class="professional-arena-action" type="button">
                    <strong>🛡️ Admin</strong><span>Controle de salas, chat e torneios.</span>
                </button>
            </div>
            <div class="professional-arena-footnote">Esta etapa é visual e segura: não altera as regras dos jogos nem o Firebase.</div>
        `;
        grid.insertAdjacentElement('afterend', panel);

        byId('professional-tournaments-btn')?.addEventListener('click', abrirTorneios);
        byId('professional-ranking-btn')?.addEventListener('click', abrirRanking);
        byId('professional-manual-btn')?.addEventListener('click', abrirManual);
        byId('professional-admin-btn')?.addEventListener('click', abrirAdmin);
    }

    function iniciar() {
        criarModalManual();
        instalarPainelProfissional();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
