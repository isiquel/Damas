    (function prepararXadrezArenaSeparado() {
        'use strict';

        const pecasUnicode = {
            white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
            black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
        };

        const nomePeca = {
            king: 'Rei', queen: 'Dama', rook: 'Torre', bishop: 'Bispo', knight: 'Cavalo', pawn: 'Peão'
        };

        let chessBoard = [];
        let chessTurn = 'white';
        let selectedSquare = null;
        let legalMoves = [];
        let chessGameOver = false;
        let lastMoveMessage = '';
        let lastChessMove = null;
        let enPassantTarget = null;
        let moveHistory = [];
        let undoStack = [];

        let chessMode = 'local';
        let chessRoomId = '';
        let chessPlayerName = '';
        let chessPlayerColor = 'white';
        let chessIsSpectator = false;
        let chessRoomRef = null;
        let chessUnsubscribeRoom = null;
        let chessUnsubscribeChat = null;
        let chessOnlineSyncing = false;
        let chessOnlineReady = false;
        let chessRoomPlayers = { white: null, black: null };
        let chessRoomSpectators = {};
        let chessSoundEnabled = false;
        let chessLastRemoteMoveCount = 0;
        let chessLastTurnAlertKey = '';
        let chessBoardFlipped = false;
        let chessCurrentRoomData = {};
        let chessAdminUnsubscribeRooms = null;
        let chessAdminUnsubscribeChat = null;

        // ✅ FASE 13.5 - MODO TREINO DO XADREZ
        // Mantém a Damas preservada. A máquina joga somente dentro do módulo do Xadrez.
        let chessTrainingActive = false;
        let chessTrainingDifficulty = 'medio';
        let chessTrainingLearnMode = false;
        let chessAiThinking = false;
        let chessLastResultShown = '';
        let chessLearnExampleMove = null;
        let chessHistoryPanelOpen = false;
        let chessTrainingResultRecorded = false;
        const chessHumanColor = 'white';

        function criarPeca(color, type) {
            return { color, type, moved: false };
        }

        function criarTabuleiroInicial() {
            const vazio = () => Array(8).fill(null);
            chessBoard = [
                [criarPeca('black', 'rook'), criarPeca('black', 'knight'), criarPeca('black', 'bishop'), criarPeca('black', 'queen'), criarPeca('black', 'king'), criarPeca('black', 'bishop'), criarPeca('black', 'knight'), criarPeca('black', 'rook')],
                Array.from({ length: 8 }, () => criarPeca('black', 'pawn')),
                vazio(), vazio(), vazio(), vazio(),
                Array.from({ length: 8 }, () => criarPeca('white', 'pawn')),
                [criarPeca('white', 'rook'), criarPeca('white', 'knight'), criarPeca('white', 'bishop'), criarPeca('white', 'queen'), criarPeca('white', 'king'), criarPeca('white', 'bishop'), criarPeca('white', 'knight'), criarPeca('white', 'rook')]
            ];
            chessTurn = 'white';
            selectedSquare = null;
            legalMoves = [];
            chessGameOver = false;
            lastMoveMessage = 'Fase 36 ativa: Xadrez Online com câmera fixa abaixo do tabuleiro, tabuleiro centralizado no celular e Damas preservada.';
            lastChessMove = null;
            enPassantTarget = null;
            moveHistory = [];
            undoStack = [];
            chessLastResultShown = '';
            chessLearnExampleMove = null;
            chessHistoryPanelOpen = false;
            chessTrainingResultRecorded = false;
        }

        function instalarCssXadrezFase5() {
            if (document.getElementById('chess-phase5-style')) return;

            const style = document.createElement('style');
            style.id = 'chess-phase5-style';
            style.textContent = `
                .chess-square.check {
                    box-shadow: inset 0 0 0 5px rgba(239, 68, 68, 0.95), 0 0 18px rgba(239, 68, 68, 0.8);
                    animation: chessCheckPulse 0.9s infinite alternate;
                }
                .chess-square.last-from { box-shadow: inset 0 0 0 4px rgba(59, 130, 246, 0.65); }
                .chess-square.last-to { box-shadow: inset 0 0 0 4px rgba(34, 197, 94, 0.8); }
                .chess-square.castle::after {
                    content: '⇄';
                    position: absolute;
                    z-index: 3;
                    color: #0f172a;
                    background: rgba(250, 204, 21, 0.86);
                    width: 36%;
                    height: 36%;
                    border-radius: 999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 1000;
                    box-shadow: 0 0 12px rgba(250, 204, 21, 0.75);
                }
                .btn-chess-sound { background: #0f766e; }
                .btn-chess-sound.on { background: #16a34a; box-shadow: 0 0 14px rgba(34,197,94,.35); }
                .btn-chess-sound.off { background: #475569; }
                .chess-square.en-passant::after {
                    content: 'e.p.';
                    position: absolute;
                    z-index: 3;
                    color: #fff;
                    background: rgba(14, 165, 233, 0.9);
                    padding: 3px 5px;
                    border-radius: 999px;
                    font-size: .62rem;
                    font-weight: 900;
                    box-shadow: 0 0 12px rgba(14, 165, 233, 0.72);
                }
                @keyframes chessCheckPulse { from { filter: brightness(1); } to { filter: brightness(1.22); } }
                .chess-history-panel {
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: #020617;
                    border: 1px solid rgba(56,189,248,0.32);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                }
                .chess-history-title {
                    color: #38bdf8;
                    font-weight: 900;
                    text-transform: uppercase;
                    font-size: .78rem;
                    letter-spacing: .5px;
                    margin-bottom: 6px;
                }
                .chess-history-list {
                    max-height: 118px;
                    overflow-y: auto;
                    color: #cbd5e1;
                    font-size: .82rem;
                    line-height: 1.5;
                }
                .chess-history-empty { color: #64748b; font-size: .82rem; }
                .btn-chess-undo { background: #0ea5e9; }
                .btn-chess-undo:hover:not(:disabled) { background: #0284c7; }
                .btn-chess-undo:disabled { opacity: .62; }
                .chess-promotion-modal {
                    display: none;
                    position: fixed;
                    inset: 0;
                    z-index: 10050;
                    background: rgba(2, 6, 23, .86);
                    backdrop-filter: blur(7px);
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                }
                .chess-promotion-card {
                    width: min(94vw, 420px);
                    background: linear-gradient(135deg, #0f172a, #1e1b4b);
                    border: 1px solid rgba(216,180,254,.5);
                    border-radius: 18px;
                    padding: 18px;
                    box-shadow: 0 20px 70px rgba(0,0,0,.72);
                    text-align: center;
                }
                .chess-promotion-card h2 {
                    color: #d8b4fe;
                    margin-bottom: 8px;
                    font-size: 1.12rem;
                    text-transform: uppercase;
                }
                .chess-promotion-card p { color: #cbd5e1; font-size: .9rem; margin-bottom: 12px; }
                .chess-promotion-options {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }
                .chess-promotion-options button {
                    min-height: 76px;
                    padding: 8px;
                    background: #111827;
                    border: 1px solid rgba(255,255,255,.1);
                    border-radius: 12px;
                    text-transform: none;
                    font-size: 1.8rem;
                    line-height: 1;
                }
                .chess-promotion-options button span {
                    display: block;
                    margin-top: 5px;
                    font-size: .65rem;
                    color: #cbd5e1;
                    font-weight: 800;
                }
                .chess-online-panel {
                    max-width: 520px;
                    margin: 0 auto 14px auto;
                    background: linear-gradient(135deg, #020617, #111827);
                    border: 1px solid rgba(34,197,94,.32);
                    border-radius: 14px;
                    padding: 12px;
                    text-align: left;
                }
                .chess-online-title {
                    color: #86efac;
                    font-weight: 1000;
                    text-transform: uppercase;
                    font-size: .82rem;
                    letter-spacing: .55px;
                    margin-bottom: 6px;
                }
                .chess-online-desc {
                    color: #cbd5e1;
                    font-size: .78rem;
                    line-height: 1.35;
                    margin-bottom: 10px;
                }
                .chess-online-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .chess-online-grid input {
                    margin: 0;
                    text-align: left;
                    font-size: .86rem;
                    padding: 10px 12px;
                }
                .chess-online-actions {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 7px;
                }
                .chess-online-actions button {
                    text-transform: none;
                    padding: 9px 7px;
                    font-size: .72rem;
                    border-radius: 9px;
                }
                .btn-chess-online { background: #16a34a; }
                .btn-chess-watch { background: #2563eb; }
                .btn-chess-leave-online { background: #64748b; }
                .btn-chess-copy-room { background: #7c3aed; }
                .chess-online-status {
                    margin-top: 8px;
                    color: #cbd5e1;
                    font-size: .76rem;
                    line-height: 1.35;
                    background: rgba(15,23,42,.72);
                    border-left: 4px solid #22c55e;
                    border-radius: 8px;
                    padding: 8px;
                }
                .chess-room-players-panel {
                    margin-top: 8px;
                    display: none;
                    background: linear-gradient(135deg, rgba(15,23,42,.92), rgba(2,6,23,.92));
                    border: 1px solid rgba(56,189,248,.28);
                    border-radius: 10px;
                    padding: 9px;
                    color: #e2e8f0;
                    font-size: .76rem;
                    line-height: 1.35;
                }
                .chess-room-players-title {
                    color: #38bdf8;
                    font-weight: 1000;
                    text-transform: uppercase;
                    letter-spacing: .45px;
                    font-size: .72rem;
                    margin-bottom: 6px;
                }
                .chess-room-player-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    border-bottom: 1px solid rgba(255,255,255,.06);
                    padding: 4px 0;
                }
                .chess-room-player-row:last-child { border-bottom: none; }
                .chess-room-player-label { color: #94a3b8; font-weight: 900; }
                .chess-room-player-name { color: #fff; text-align: right; word-break: break-word; }
                .chess-room-player-name.empty { color: #facc15; }
                .chess-room-player-name.me { color: #86efac; font-weight: 1000; }

                /* 📹 FASE 22 - VÍDEO E ÁUDIO DO XADREZ, SEPARADO DA DAMAS */
                .chess-call-panel {
                    display: none;
                    margin-top: 12px;
                    background: linear-gradient(135deg, #020617, #111827);
                    border: 1px solid rgba(56,189,248,.45);
                    border-radius: 14px;
                    padding: 12px;
                    text-align: left;
                    box-shadow: 0 10px 24px rgba(0,0,0,.38);
                }
                .chess-call-panel.online-visible { display: block; }
                .chess-call-panel.call-active {
                    position: static;
                    left: auto;
                    bottom: auto;
                    top: auto;
                    right: auto;
                    transform: none;
                    width: 100%;
                    max-width: 520px;
                    margin: 10px auto 12px auto;
                    padding: 12px;
                    z-index: auto;
                    border-color: rgba(56,189,248,.65);
                    box-shadow: 0 10px 24px rgba(0,0,0,.38);
                    backdrop-filter: none;
                }
                .chess-call-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,.08);
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                }
                .chess-call-panel.call-active .chess-call-header {
                    cursor: default;
                    touch-action: auto;
                    justify-content: space-between;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                }
                .chess-call-panel.call-active .chess-call-header:active { cursor: default; }
                .chess-call-title { color:#38bdf8; font-weight:1000; font-size:.86rem; text-transform:uppercase; letter-spacing:.45px; }
                .chess-call-status { color:#cbd5e1; font-size:.74rem; line-height:1.25; text-align:right; max-width: 230px; }
                .chess-call-panel.call-active .chess-call-title { font-size:.86rem; }
                .chess-call-panel.call-active .chess-call-title::after { content:''; }
                .chess-call-panel.call-active .chess-call-status { display:block; }
                .chess-call-panel.call-active .chess-call-note { display:block; }
                .chess-call-videos { display:none; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
                .chess-call-panel.call-active .chess-call-videos { display:grid; gap:8px; margin-bottom:10px; }
                .chess-video-tile { position:relative; overflow:hidden; border-radius:10px; background:#020617; border:1px solid #1e293b; aspect-ratio:4/3; min-height:110px; height:var(--fase35-video-height, 150px); }
                .chess-call-panel.call-active .chess-video-tile { aspect-ratio:auto; border-color:rgba(255,255,255,.18); }
                .chess-video-tile video { width:100%; height:100%; object-fit:cover; display:block; background:#020617; }
                #chess-local-video { transform:scaleX(-1); }
                .chess-video-label { position:absolute; left:6px; bottom:6px; background:rgba(0,0,0,.64); color:#fff; border-radius:999px; padding:3px 8px; font-size:.68rem; font-weight:900; }
                .chess-call-panel.call-active .chess-video-label { font-size:.68rem; padding:3px 8px; }
                .chess-call-controls { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
                .chess-call-controls button { padding:9px 6px; font-size:.72rem; text-transform:none; border-radius:8px; }
                .btn-chess-call-start { background:#0284c7; }
                .btn-chess-call-start:hover:not(:disabled) { background:#0369a1; }
                .btn-chess-call-end { background:#dc2626; }
                .btn-chess-call-end:hover:not(:disabled) { background:#b91c1c; }
                .chess-call-muted { background:#475569 !important; }
                .chess-call-note { margin-top:8px; color:#94a3b8; font-size:.72rem; line-height:1.32; }
                .chess-call-panel.call-active #chess-start-video-call-btn,
                .chess-call-panel.call-active #chess-start-audio-call-btn { display:none; }
                .chess-call-panel.call-active .chess-call-controls { grid-template-columns:1fr 1fr; gap:8px; }
                .chess-call-panel.call-active .chess-call-controls button { padding:10px 8px; font-size:.76rem; line-height:1.15; }
                .chess-call-panel.call-active #chess-end-call-btn { grid-column:auto; }
                @media (max-width: 520px) {
                    .chess-call-controls { grid-template-columns:1fr 1fr; }
                    .chess-call-panel.call-active { width:100%; bottom:auto; }
                    .chess-call-panel.call-active .chess-call-controls { grid-template-columns:1fr 1fr; }
                    .chess-call-panel.call-active #chess-end-call-btn { grid-column:1 / -1; }
                }

                .chess-material-panel {
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: linear-gradient(135deg, #07111f, #020617);
                    border: 1px solid rgba(250,204,21,.34);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                    color: #e2e8f0;
                }
                .chess-material-title {
                    color: #facc15;
                    font-weight: 1000;
                    text-transform: uppercase;
                    font-size: .78rem;
                    letter-spacing: .5px;
                    margin-bottom: 7px;
                }
                .chess-material-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .chess-material-box {
                    background: rgba(15,23,42,.78);
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 10px;
                    padding: 8px;
                    min-height: 72px;
                }
                .chess-material-label {
                    color: #94a3b8;
                    font-size: .72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .chess-material-pieces {
                    font-size: 1.35rem;
                    line-height: 1.25;
                    min-height: 30px;
                    word-break: break-word;
                }
                .chess-material-empty { color: #64748b; font-size: .78rem; }
                .chess-material-score {
                    margin-top: 5px;
                    color: #86efac;
                    font-size: .72rem;
                    font-weight: 900;
                }
                .chess-material-note {
                    margin-top: 7px;
                    color: #94a3b8;
                    font-size: .72rem;
                    line-height: 1.35;
                }

                .chess-chat-panel {
                    display: none;
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: #020617;
                    border: 1px solid rgba(148,163,184,.28);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                }
                .chess-chat-title {
                    color: #93c5fd;
                    font-weight: 900;
                    font-size: .78rem;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }
                .chess-chat-messages {
                    height: 110px;
                    overflow-y: auto;
                    background: #0f172a;
                    border-radius: 8px;
                    padding: 8px;
                    color: #dbeafe;
                    font-size: .8rem;
                    line-height: 1.45;
                    margin-bottom: 8px;
                }
                .chess-chat-row { word-break: break-word; margin-bottom: 4px; }
                .chess-chat-row strong { color: #38bdf8; }
                .chess-chat-input-row { display: grid; grid-template-columns: 1fr auto; gap: 7px; }
                .chess-chat-input-row input { margin: 0; text-align: left; padding: 9px 10px; font-size: .84rem; }
                .chess-chat-input-row button { width: auto; padding: 9px 13px; font-size: .76rem; text-transform: none; }
                .chess-status-online-pill {
                    display: inline-block;
                    margin-left: 6px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: rgba(34,197,94,.14);
                    border: 1px solid rgba(34,197,94,.4);
                    color: #86efac;
                    font-size: .68rem;
                    font-weight: 900;
                }


                /* ✅ FASE 7.1 - TABULEIRO FIXO: evita a tela ficar pulando quando atualiza status, chat, placar ou Firebase */
                #chess-screen, #chess-screen .chess-card, #chess-screen .chess-board-wrap, #chess-screen .chess-board {
                    overflow-anchor: none;
                }
                #chess-screen .chess-card {
                    contain: layout paint;
                }
                #chess-screen .chess-board-wrap {
                    position: relative;
                    min-height: min(520px, calc(100vw - 52px));
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #chess-screen .chess-coord-shell {
                    width: 100%;
                }
                #chess-screen .chess-board {
                    flex: 0 0 auto;
                    transform: translateZ(0);
                    will-change: auto;
                }
                #chess-status {
                    min-height: 58px;
                    display: flex;
                    align-items: center;
                }
                #chess-online-status {
                    min-height: 44px;
                }
                #chess-room-players-panel {
                    min-height: 104px;
                }
                #chess-material-panel {
                    min-height: 132px;
                }
                #chess-history-panel {
                    min-height: 152px;
                }

                /* ✅ FASE 9 - LAYOUT FOCO: evita o jogador se perder na tela e deixa o tabuleiro mais confortável */
                #chess-screen .chess-title {
                    margin-bottom: 4px;
                }
                #chess-screen .chess-subtitle {
                    margin-bottom: 10px;
                    font-size: .82rem;
                }
                #chess-screen .chess-online-panel {
                    margin-bottom: 10px;
                }
                #chess-screen .chess-board-wrap {
                    scroll-margin-top: 18px;
                }
                .btn-chess-focus {
                    background: #0f766e;
                }
                .btn-chess-flip { background: #b45309; }
                .btn-chess-flip:hover:not(:disabled) { background: #92400e; }
                .btn-chess-focus:hover:not(:disabled) {
                    background: #0d9488;
                }
                body.chess-focus-mode #chess-screen .chess-room-players-panel,
                body.chess-focus-mode #chess-screen #chess-online-status,
                body.chess-focus-mode #chess-screen .chess-subtitle {
                    display: none !important;
                }
                body.chess-focus-mode #chess-screen .chess-online-panel {
                    padding: 10px;
                }
                body.chess-focus-mode #chess-screen .chess-online-desc,
                body.chess-focus-mode #chess-screen .chess-online-grid {
                    display: none !important;
                }
                body.chess-focus-mode #chess-screen .chess-online-actions {
                    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
                    gap: 7px;
                }
                body.chess-focus-mode #chess-screen .chess-board-wrap {
                    max-width: min(520px, 94vw);
                    margin-top: 8px;
                }
                @media (max-width: 520px) {
                    .chess-promotion-options { grid-template-columns: repeat(2, 1fr); }
                    .chess-online-grid, .chess-online-actions, .chess-material-grid { grid-template-columns: 1fr; }
                    .chess-chat-input-row { grid-template-columns: 1fr; }
                }
            `;
            document.head.appendChild(style);
        }

        function instalarUiXadrezFase5() {
            const actions = document.querySelector('#chess-screen .chess-actions');
            if (actions && !document.getElementById('chess-undo-btn')) {
                const undo = document.createElement('button');
                undo.id = 'chess-undo-btn';
                undo.className = 'btn-chess-undo';
                undo.type = 'button';
                undo.textContent = 'Desfazer Jogada';
                actions.insertBefore(undo, actions.children[1] || null);
                actions.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
            }

            const card = document.querySelector('#chess-screen .chess-card');
            if (card && !document.getElementById('chess-online-panel')) {
                const online = document.createElement('div');
                online.id = 'chess-online-panel';
                online.className = 'chess-online-panel';
                online.innerHTML = `
                    <div class="chess-online-title">🌐 Xadrez Online — Fase 36.12 Estável</div>
                    <div class="chess-online-desc">Entre em uma sala de Xadrez separada da Damas. O tabuleiro abre somente depois de clicar em Entrar/Jogar ou Assistir.</div>
                    <div class="chess-online-grid">
                        <input id="chess-online-name" type="text" maxlength="18" placeholder="Seu nome">
                        <input id="chess-online-room" type="text" maxlength="18" placeholder="Código da sala, ex: xadrez1">
                    </div>
                    <div class="chess-online-actions">
                        <button id="chess-online-join-btn" class="btn-chess-online" type="button">Entrar/Jogar</button>
                        <button id="chess-online-watch-btn" class="btn-chess-watch" type="button">Assistir</button>
                        <button id="chess-online-copy-btn" class="btn-chess-copy-room" type="button">Copiar sala</button>
                        <button id="chess-sound-btn" class="btn-chess-sound off" type="button">Ativar alerta</button>
                        <button id="chess-focus-btn" class="btn-chess-focus" type="button">Foco no tabuleiro</button>
                        <button id="chess-flip-btn" class="btn-chess-flip" type="button">Virar tabuleiro</button>
                        <button id="chess-online-leave-btn" class="btn-chess-leave-online" type="button">Sair online</button>
                    </div>
                    <div id="chess-online-status" class="chess-online-status">Modo local ativo. O Xadrez online usa o caminho <strong>chessRooms</strong>, separado da Damas.</div>
                    <div id="chess-room-players-panel" class="chess-room-players-panel">
                        <div class="chess-room-players-title">👥 Jogadores da sala</div>
                        <div id="chess-room-players-list"></div>
                    </div>
                    <div id="chess-call-panel" class="chess-call-panel call-compact">
                        <div class="chess-call-header">
                            <div class="chess-call-title">📹 Vídeo e áudio do Xadrez</div>
                            <div id="chess-call-status" class="chess-call-status">Entre em uma sala online para liberar a chamada.</div>
                            <button id="chess-call-toggle-btn" class="chess-call-toggle-btn" type="button" aria-expanded="false">+</button>
                        </div>
                        <div class="chess-call-videos">
                            <div class="chess-video-tile">
                                <video id="chess-local-video" autoplay muted playsinline></video>
                                <div id="chess-local-label" class="chess-video-label">Você</div>
                            </div>
                            <div class="chess-video-tile">
                                <video id="chess-remote-video" autoplay playsinline></video>
                                <audio id="chess-remote-audio" autoplay playsinline></audio>
                                <div id="chess-remote-label" class="chess-video-label">Oponente</div>
                            </div>
                        </div>
                        <div class="chess-call-controls">
                            <button id="chess-start-video-call-btn" class="btn-chess-call-start" type="button">Iniciar vídeo</button>
                            <button id="chess-start-audio-call-btn" class="btn-chess-call-start" type="button">Somente áudio</button>
                            <button id="chess-toggle-mic-btn" type="button">🎙️ Mic</button>
                            <button id="chess-toggle-camera-btn" type="button">📷 Cam</button>
                            <button id="chess-unlock-audio-btn" type="button">🔊 Som</button>
                            <button id="chess-call-size-minus-btn" type="button">➖ Menor</button>
                            <button id="chess-call-size-plus-btn" type="button">➕ Maior</button>
                            <button id="chess-end-call-btn" class="btn-chess-call-end" type="button">Encerrar</button>
                        </div>
                        <div class="chess-call-note">A chamada usa <strong>chessRooms/sala/call</strong>, separada da Damas. Vídeo/áudio só aparece para jogadores; espectador fica sem câmera e microfone.</div>
                    </div>
                `;
                const status = document.getElementById('chess-status');
                if (status) card.insertBefore(online, status);
                else card.insertBefore(online, card.firstChild?.nextSibling || null);
            }

            if (card && !document.getElementById('chess-training-panel')) {
                const training = document.createElement('div');
                training.id = 'chess-training-panel';
                training.className = 'chess-training-panel';
                training.innerHTML = `
                    <div class="chess-section-kicker">Treino do Xadrez</div>
                    <div class="chess-training-title">🤖 Escolha como treinar</div>
                    <div class="chess-training-desc">O tabuleiro só abre depois da escolha. Você joga com as brancas e a máquina responde com as pretas.</div>
                    <div class="chess-training-actions modern">
                        <button id="chess-training-easy-btn" class="btn-chess-training easy" type="button">
                            <span>🌱 Fácil</span>
                            <small>Para começar sem pressão</small>
                        </button>
                        <button id="chess-training-medium-btn" class="btn-chess-training medium" type="button">
                            <span>🔵 Médio</span>
                            <small>Mais equilibrado</small>
                        </button>
                        <button id="chess-training-hard-btn" class="btn-chess-training hard" type="button">
                            <span>🔥 Difícil</span>
                            <small>Máquina mais forte</small>
                        </button>
                        <button id="chess-training-learn-btn" class="btn-chess-training learn" type="button">
                            <span>🎓 Aprender do Zero</span>
                            <small>Nomes, cores e dicas</small>
                        </button>
                    </div>
                    <button id="chess-pieces-lesson-btn" class="btn-chess-lesson" type="button">📚 Conhecer as peças antes de jogar</button>
                    <div id="chess-pieces-lesson-panel" class="chess-pieces-lesson-panel" style="display:none;">
                        <div class="chess-lesson-title">📚 Aprenda o básico do Xadrez</div>
                        <div class="chess-lesson-grid">
                            <div class="chess-lesson-item"><strong>♔ Rei</strong><span>É a peça principal. Anda 1 casa para qualquer lado. Não pode ficar em perigo.</span></div>
                            <div class="chess-lesson-item"><strong>♕ Dama</strong><span>É a peça mais forte. Anda reto e diagonal, quantas casas estiverem livres.</span></div>
                            <div class="chess-lesson-item"><strong>♖ Torre</strong><span>Anda em linha reta: para frente, para trás e para os lados.</span></div>
                            <div class="chess-lesson-item"><strong>♗ Bispo</strong><span>Anda somente na diagonal, quantas casas estiverem livres.</span></div>
                            <div class="chess-lesson-item"><strong>♘ Cavalo</strong><span>Anda em formato de L. É a única peça que pula por cima das outras.</span></div>
                            <div class="chess-lesson-item"><strong>♙ Peão</strong><span>Anda para frente, mas captura na diagonal. No primeiro movimento pode andar 2 casas.</span></div>
                        </div>
                        <div class="chess-color-legend">
                            <div><b class="leg-yellow"></b> Amarelo: peça escolhida</div>
                            <div><b class="leg-green"></b> Verde: pode andar</div>
                            <div><b class="leg-red"></b> Vermelho: pode capturar</div>
                            <div><b class="leg-blue"></b> Azul: última jogada</div>
                        </div>
                    </div>
                    <div id="chess-training-status" class="chess-training-status">Escolha um modo acima para abrir o tabuleiro.</div>
                    <div id="chess-training-coach" class="chess-training-coach" style="display:none;">
                        <strong>🎓 Professor de Xadrez:</strong>
                        <span id="chess-training-coach-text">No modo Aprender eu explico a peça, mostro as cores e dou uma ideia simples para sua próxima jogada.</span>
                        <button id="chess-training-tip-btn" type="button">Mostrar dica</button>
                    </div>
                    <div id="chess-beginner-box" class="chess-beginner-box" style="display:none;">
                        <div class="chess-beginner-title">📚 Aula rápida para quem nunca jogou</div>
                        <div><strong>Como jogar:</strong> clique em uma peça branca. A casa amarela é a peça escolhida. A bolinha verde é onde ela pode andar. O vermelho significa que você pode capturar: clique na peça vermelha para comer.</div>
                        <div class="chess-legend-row">
                            <div class="chess-legend-pill yellow">🟨 escolhida</div>
                            <div class="chess-legend-pill green">🟢 pode andar</div>
                            <div class="chess-legend-pill red">🔴 pode capturar</div>
                        </div>
                        <div class="chess-beginner-grid">
                            <div class="chess-beginner-item">♔ <strong>Rei:</strong> anda 1 casa. Se cair, acaba o jogo.</div>
                            <div class="chess-beginner-item">♕ <strong>Dama:</strong> anda longe em linha, coluna e diagonal.</div>
                            <div class="chess-beginner-item">♖ <strong>Torre:</strong> anda reto, para frente, para trás e lados.</div>
                            <div class="chess-beginner-item">♗ <strong>Bispo:</strong> anda só nas diagonais.</div>
                            <div class="chess-beginner-item">♘ <strong>Cavalo:</strong> anda em L e pode pular peças.</div>
                            <div class="chess-beginner-item">♙ <strong>Peão:</strong> anda para frente, mas captura na diagonal.</div>
                        </div>
                    </div>
                `;
                const onlinePanel = document.getElementById('chess-online-panel');
                if (onlinePanel) onlinePanel.insertAdjacentElement('afterend', training);
                else {
                    const status = document.getElementById('chess-status');
                    if (status) card.insertBefore(training, status);
                    else card.appendChild(training);
                }
            }


            if (card && !document.getElementById('chess-training-ranking-panel')) {
                const ranking = document.createElement('div');
                ranking.id = 'chess-training-ranking-panel';
                ranking.className = 'chess-training-ranking-panel chess-rank-collapsed';
                ranking.innerHTML = `
                    <div class="chess-training-ranking-head">
                        <div>
                            <div class="chess-training-ranking-title">🏆 Ranking do Treino de Xadrez</div>
                            <div id="chess-training-ranking-badge" class="chess-training-ranking-badge">Separado da Damas</div>
                        </div>
                        <button id="chess-ranking-toggle-btn" class="chess-ranking-toggle-btn" type="button" aria-expanded="false">+</button>
                    </div>
                    <div class="chess-training-ranking-grid">
                        <div class="chess-training-ranking-stat"><div id="chess-rank-points" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Pontos</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-wins" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Vitórias</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-games" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Partidas</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-losses" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Derrotas</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-draws" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Empates</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-streak" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Sequência</div></div>
                    </div>
                    <div class="chess-training-ranking-details">
                        <div class="chess-training-ranking-line"><strong>Melhor nível vencido:</strong><br><span id="chess-rank-best">Nenhum ainda</span></div>
                        <div class="chess-training-ranking-line"><strong>Último resultado:</strong><br><span id="chess-rank-last">Nenhuma partida finalizada</span></div>
                    </div>
                    <div class="chess-training-ranking-actions">
                        <button id="chess-ranking-refresh-btn" class="btn-chess-ranking-refresh" type="button">Atualizar ranking</button>
                        <button id="chess-ranking-clear-btn" class="btn-chess-ranking-clear" type="button">Limpar ranking</button>
                    </div>
                    <div class="chess-training-ranking-note">Pontuação: Aprender +5, Fácil +10, Médio +20 e Difícil +35 por vitória. Empate soma 2 pontos. Este ranking é local e não mistura com a Damas.</div>
                `;
                const trainingPanel = document.getElementById('chess-training-panel');
                if (trainingPanel) trainingPanel.insertAdjacentElement('afterend', ranking);
                else card.appendChild(ranking);
            }




            // ✅ FASE 28: painel de conquistas removido do menu para deixar a tela mais limpa.

            // ✅ FASE 28: menu rápido removido. O menu agora começa direto nas áreas principais.
            const addChessMenuLabel = (id, html, beforeId) => {
                if (!card || document.getElementById(id)) return;
                const label = document.createElement('div');
                label.id = id;
                label.className = 'chess-menu-section-label';
                label.innerHTML = html;
                const beforeEl = document.getElementById(beforeId);
                if (beforeEl) card.insertBefore(label, beforeEl);
                else card.appendChild(label);
            };
            addChessMenuLabel('chess-menu-play-label', '<span>1.</span> Jogar — online, assistir ou treinar', 'chess-online-panel');
            addChessMenuLabel('chess-menu-learn-label', '<span>2.</span> Aprender — modos de treino e peças', 'chess-training-panel');

            const scrollChessMenuTo = (targetId) => {
                const el = document.getElementById(targetId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            // Fase 28: sem botões do menu rápido; rolagem manual normal do usuário.

            if (card && !document.getElementById('chess-material-panel')) {
                const material = document.createElement('div');
                material.id = 'chess-material-panel';
                material.className = 'chess-material-panel';
                material.innerHTML = `
                    <div class="chess-material-title">⚔️ Placar de material</div>
                    <div class="chess-material-grid">
                        <div class="chess-material-box">
                            <div class="chess-material-label">⚪ Brancas capturaram</div>
                            <div id="chess-material-white" class="chess-material-pieces"><span class="chess-material-empty">Nada ainda</span></div>
                            <div id="chess-material-white-score" class="chess-material-score">Vantagem: 0</div>
                        </div>
                        <div class="chess-material-box">
                            <div class="chess-material-label">⚫ Pretas capturaram</div>
                            <div id="chess-material-black" class="chess-material-pieces"><span class="chess-material-empty">Nada ainda</span></div>
                            <div id="chess-material-black-score" class="chess-material-score">Vantagem: 0</div>
                        </div>
                    </div>
                    <div id="chess-material-note" class="chess-material-note">O placar atualiza sozinho conforme as peças são capturadas.</div>
                `;
                const boardWrap = card.querySelector('.chess-board-wrap');
                if (boardWrap) boardWrap.insertAdjacentElement('afterend', material);
                else card.appendChild(material);
            }

            if (card && !document.getElementById('chess-history-panel')) {
                const history = document.createElement('div');
                history.id = 'chess-history-panel';
                history.className = 'chess-history-panel';
                history.innerHTML = `
                    <div class="chess-history-head">
                        <div class="chess-history-title">📜 Histórico de jogadas</div>
                        <div class="chess-history-actions">
                            <button id="chess-history-toggle-btn" class="btn-history-toggle" type="button">Ver jogadas</button>
                            <button id="chess-history-clear-btn" class="btn-history-clear" type="button">Limpar visual</button>
                        </div>
                    </div>
                    <div class="chess-history-body">
                        <div id="chess-history-list" class="chess-history-list"><div class="chess-history-empty">Nenhuma jogada ainda.</div></div>
                        <div class="chess-history-note">O histórico mostra as jogadas da partida atual de forma simples. Limpar visual não volta a jogada.</div>
                    </div>
                `;
                const warning = card.querySelector('.chess-warning');
                if (warning) card.insertBefore(history, warning);
                else card.appendChild(history);
            }

            renderRankingTreinoXadrez();
            renderConquistasXadrez();

            if (card && !document.getElementById('chess-chat-panel')) {
                const chat = document.createElement('div');
                chat.id = 'chess-chat-panel';
                chat.className = 'chess-chat-panel';
                chat.innerHTML = `
                    <div class="chess-chat-title">💬 Chat da sala de Xadrez</div>
                    <div id="chess-chat-messages" class="chess-chat-messages"><div class="chess-chat-row"><strong>Sistema:</strong> Entre em uma sala online para usar o chat.</div></div>
                    <div class="chess-chat-input-row">
                        <input id="chess-chat-input" type="text" maxlength="180" placeholder="Digite sua mensagem...">
                        <button id="chess-chat-send-btn" type="button">Enviar</button>
                    </div>
                `;
                const warning = card.querySelector('.chess-warning');
                if (warning) card.insertBefore(chat, warning);
                else card.appendChild(chat);
            }

            if (!document.getElementById('chess-promotion-modal')) {
                const modal = document.createElement('div');
                modal.id = 'chess-promotion-modal';
                modal.className = 'chess-promotion-modal';
                modal.innerHTML = `
                    <div class="chess-promotion-card">
                        <h2>Promover peão</h2>
                        <p>Escolha em qual peça o peão será transformado.</p>
                        <div class="chess-promotion-options">
                            <button type="button" data-piece="queen">♕<span>Dama</span></button>
                            <button type="button" data-piece="rook">♖<span>Torre</span></button>
                            <button type="button" data-piece="bishop">♗<span>Bispo</span></button>
                            <button type="button" data-piece="knight">♘<span>Cavalo</span></button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const warning = document.querySelector('#chess-screen .chess-warning');
            if (warning) {
                warning.innerHTML = '✅ Fase 29 ativa: Xadrez Online com estabilidade reforçada, tabuleiro grande e travado visualmente, vídeo/áudio separado da Damas e atualizações do Firebase mais leves.';
            }
        }

        function pecaXadrezValida(piece) {
            if (!piece || typeof piece !== 'object') return false;
            if (piece.color !== 'white' && piece.color !== 'black') return false;
            return ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(piece.type);
        }

        function tabuleiroXadrezTemFormatoValido(board) {
            // Firebase Realtime Database apaga valores null dentro de arrays.
            // Por isso, uma linha vazia pode voltar como "buraco" no array.
            // Não usamos every/map direto porque eles pulam buracos e deixam passar tabuleiro quebrado.
            if (!board || typeof board !== 'object') return false;
            for (let r = 0; r < 8; r++) {
                const row = board[r];
                if (!row || typeof row !== 'object') return false;
                for (let c = 0; c < 8; c++) {
                    const cell = row[c];
                    if (cell === null || cell === undefined || cell === '' || cell === 0 || cell === false) continue;
                    if (!pecaXadrezValida(cell)) return false;
                }
            }
            return true;
        }

        function limparTabuleiroXadrezRecebido(board) {
            if (!tabuleiroXadrezTemFormatoValido(board)) return null;
            const limpo = Array.from({ length: 8 }, () => Array(8).fill(null));
            for (let r = 0; r < 8; r++) {
                const row = board[r] || {};
                for (let c = 0; c < 8; c++) {
                    const piece = row[c];
                    if (!pecaXadrezValida(piece)) {
                        limpo[r][c] = null;
                    } else {
                        limpo[r][c] = {
                            color: piece.color,
                            type: piece.type,
                            moved: !!piece.moved
                        };
                    }
                }
            }
            return limpo;
        }

        function serializarTabuleiroXadrezParaFirebase(board) {
            const limpo = limparTabuleiroXadrezRecebido(board) || (() => {
                criarTabuleiroInicial();
                return limparTabuleiroXadrezRecebido(chessBoard);
            })();
            // Nunca enviar null para o Firebase nas casas vazias.
            // Usamos string vazia para preservar as 8 linhas e as 8 colunas.
            return Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => {
                    const piece = limpo?.[r]?.[c];
                    return pecaXadrezValida(piece)
                        ? { color: piece.color, type: piece.type, moved: !!piece.moved }
                        : '';
                })
            );
        }

        function contarPecasXadrez(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            if (!limpo) return 0;
            let total = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (pecaXadrezValida(limpo[r][c])) total++;
                }
            }
            return total;
        }

        function temReisDoXadrez(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            if (!limpo) return false;
            let whiteKing = false;
            let blackKing = false;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = limpo[r][c];
                    if (p && p.type === 'king' && p.color === 'white') whiteKing = true;
                    if (p && p.type === 'king' && p.color === 'black') blackKing = true;
                }
            }
            return whiteKing && blackKing;
        }

        function tabuleiroXadrezPrecisaRestaurar(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            return !limpo || !temReisDoXadrez(limpo) || contarPecasXadrez(limpo) < 2;
        }

        function clonarTabuleiro(board) {
            return limparTabuleiroXadrezRecebido(board);
        }

        function garantirTabuleiroXadrezPronto(motivo = '') {
            if (!tabuleiroXadrezPrecisaRestaurar(chessBoard)) return false;
            criarTabuleiroInicial();
            if (motivo) lastMoveMessage = motivo;
            return true;
        }

        function normalizarCampoXadrez(valor) {
            return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, 18);
        }

        function normalizarSalaXadrez(valor) {
            return String(valor || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(0, 24);
        }

        function escapeHtmlXadrez(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        function getChessUid() {
            if (typeof playerId !== 'undefined' && playerId) return playerId;
            let id = localStorage.getItem('tabuleiroArenaChessUid');
            if (!id) {
                id = 'local-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem('tabuleiroArenaChessUid', id);
            }
            return id;
        }

        function atualizarStatusOnlineXadrez(texto) {
            const el = document.getElementById('chess-online-status');
            if (el) el.innerHTML = texto;
        }

        function nomeJogadorSalaXadrez(jogador) {
            return jogador && jogador.name ? escapeHtmlXadrez(jogador.name) : '';
        }

        function jogadorAtualEh(jogador) {
            const uid = getChessUid();
            return !!(jogador && jogador.id && jogador.id === uid);
        }

        function contarEspectadoresXadrez() {
            return Object.values(chessRoomSpectators || {}).filter(s => s && s.id).length;
        }


        function calcularMaterialXadrez() {
            const valores = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
            const ordem = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
            const simbolos = {
                white: { queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
                black: { queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
            };
            const inicial = {
                white: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1, king: 1 },
                black: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1, king: 1 }
            };
            const atual = {
                white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
                black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
            };

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = chessBoard?.[r]?.[c];
                    if (pecaXadrezValida(p)) atual[p.color][p.type]++;
                }
            }

            const capturadasPorBrancas = [];
            const capturadasPorPretas = [];
            let pontosBrancas = 0;
            let pontosPretas = 0;

            ordem.forEach(tipo => {
                const pretasPerdidas = Math.max(0, inicial.black[tipo] - atual.black[tipo]);
                const brancasPerdidas = Math.max(0, inicial.white[tipo] - atual.white[tipo]);
                for (let i = 0; i < pretasPerdidas; i++) {
                    capturadasPorBrancas.push(simbolos.black[tipo]);
                    pontosBrancas += valores[tipo] || 0;
                }
                for (let i = 0; i < brancasPerdidas; i++) {
                    capturadasPorPretas.push(simbolos.white[tipo]);
                    pontosPretas += valores[tipo] || 0;
                }
            });

            return { capturadasPorBrancas, capturadasPorPretas, pontosBrancas, pontosPretas };
        }

        function renderizarPlacarMaterialXadrez() {
            const whiteEl = document.getElementById('chess-material-white');
            const blackEl = document.getElementById('chess-material-black');
            const whiteScoreEl = document.getElementById('chess-material-white-score');
            const blackScoreEl = document.getElementById('chess-material-black-score');
            const noteEl = document.getElementById('chess-material-note');
            if (!whiteEl || !blackEl) return;

            const material = calcularMaterialXadrez();
            whiteEl.innerHTML = material.capturadasPorBrancas.length ? material.capturadasPorBrancas.join(' ') : '<span class="chess-material-empty">Nada ainda</span>';
            blackEl.innerHTML = material.capturadasPorPretas.length ? material.capturadasPorPretas.join(' ') : '<span class="chess-material-empty">Nada ainda</span>';

            const saldoBrancas = material.pontosBrancas - material.pontosPretas;
            const saldoPretas = material.pontosPretas - material.pontosBrancas;
            if (whiteScoreEl) whiteScoreEl.textContent = saldoBrancas > 0 ? `Vantagem: +${saldoBrancas}` : `Vantagem: ${saldoBrancas}`;
            if (blackScoreEl) blackScoreEl.textContent = saldoPretas > 0 ? `Vantagem: +${saldoPretas}` : `Vantagem: ${saldoPretas}`;

            if (noteEl) {
                if (saldoBrancas > 0) noteEl.textContent = `As brancas estão com vantagem material de ${saldoBrancas} ponto(s).`;
                else if (saldoPretas > 0) noteEl.textContent = `As pretas estão com vantagem material de ${saldoPretas} ponto(s).`;
                else noteEl.textContent = 'Material equilibrado até agora.';
            }
        }


        function atualizarBotaoSomXadrez() {
            const btn = document.getElementById('chess-sound-btn');
            if (!btn) return;
            btn.textContent = chessSoundEnabled ? 'Alerta ligado' : 'Ativar alerta';
            btn.classList.toggle('on', chessSoundEnabled);
            btn.classList.toggle('off', !chessSoundEnabled);
        }

        function tocarAlertaVezXadrez() {
            try {
                if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
            } catch (_) {}
            if (!chessSoundEnabled) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 740;
                gain.gain.setValueAtTime(0.001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.24);
                setTimeout(() => ctx.close?.(), 500);
            } catch (e) {
                console.warn('Som do alerta de vez não tocou:', e);
            }
        }

        function alternarAlertaXadrez() {
            chessSoundEnabled = !chessSoundEnabled;
            atualizarBotaoSomXadrez();
            try { localStorage.setItem('tabuleiroArenaChessSound', chessSoundEnabled ? '1' : '0'); } catch (_) {}
            mostrarToastXadrez(chessSoundEnabled ? '🔔 Alerta de vez ativado.' : '🔕 Alerta de vez desligado.');
            if (chessSoundEnabled) tocarAlertaVezXadrez();
        }

        function verificarAlertaDeVezXadrez(data) {
            if (chessMode !== 'online' || chessIsSpectator || !chessPlayerColor || chessPlayerColor === 'spectator') return;
            const history = Array.isArray(data?.moveHistory) ? data.moveHistory : [];
            const count = history.length;
            const turn = data?.turn === 'black' ? 'black' : 'white';
            const key = `${chessRoomId}|${count}|${turn}|${chessPlayerColor}`;
            if (count > chessLastRemoteMoveCount && turn === chessPlayerColor && key !== chessLastTurnAlertKey) {
                chessLastTurnAlertKey = key;
                setTimeout(() => {
                    mostrarToastXadrez('🔔 Sua vez de jogar no Xadrez Online.');
                    tocarAlertaVezXadrez();
                }, 120);
            }
            chessLastRemoteMoveCount = Math.max(chessLastRemoteMoveCount, count);
        }

        function renderizarListaJogadoresXadrez() {
            const panel = document.getElementById('chess-room-players-panel');
            const list = document.getElementById('chess-room-players-list');
            if (!panel || !list) return;

            if (chessMode !== 'online') {
                panel.style.display = 'none';
                list.innerHTML = '';
                return;
            }

            panel.style.display = 'block';
            const white = chessRoomPlayers?.white || null;
            const black = chessRoomPlayers?.black || null;
            const spectators = Object.values(chessRoomSpectators || {}).filter(s => s && s.id);
            const specNames = spectators.map(s => nomeJogadorSalaXadrez(s)).filter(Boolean);

            const whiteName = white ? nomeJogadorSalaXadrez(white) : 'Aguardando jogador...';
            const blackName = black ? nomeJogadorSalaXadrez(black) : 'Aguardando jogador...';
            const specText = specNames.length ? specNames.join(', ') : 'Nenhum espectador';

            list.innerHTML = `
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">⚪ Brancas</span>
                    <span class="chess-room-player-name ${white ? '' : 'empty'} ${jogadorAtualEh(white) ? 'me' : ''}">${whiteName}${jogadorAtualEh(white) ? ' (você)' : ''}</span>
                </div>
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">⚫ Pretas</span>
                    <span class="chess-room-player-name ${black ? '' : 'empty'} ${jogadorAtualEh(black) ? 'me' : ''}">${blackName}${jogadorAtualEh(black) ? ' (você)' : ''}</span>
                </div>
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">👀 Espectadores</span>
                    <span class="chess-room-player-name">${specText}</span>
                </div>
            `;
        }

        function atualizarPainelOnlineXadrez() {
            const chat = document.getElementById('chess-chat-panel');
            if (chat) chat.style.display = chessMode === 'online' ? 'block' : 'none';
            const undo = document.getElementById('chess-undo-btn');
            if (undo) undo.disabled = chessMode === 'online' || undoStack.length === 0;
            const joinBtn = document.getElementById('chess-online-join-btn');
            const watchBtn = document.getElementById('chess-online-watch-btn');
            const leaveBtn = document.getElementById('chess-online-leave-btn');
            if (joinBtn) joinBtn.disabled = chessMode === 'online' && !chessIsSpectator;
            if (watchBtn) watchBtn.disabled = chessMode === 'online' && chessIsSpectator;
            if (leaveBtn) leaveBtn.disabled = chessMode !== 'online';

            if (chessMode === 'training') {
                atualizarStatusOnlineXadrez(`🤖 Modo treino ativo no Xadrez. Você joga de <strong>brancas</strong> contra a máquina no nível <strong>${nomeDificuldadeTreinoXadrez()}</strong>. Firebase e Damas não são usados neste modo.`);
                renderizarListaJogadoresXadrez();
                atualizarPainelTreinoXadrez();
                return;
            }

            if (chessMode !== 'online') {
                atualizarStatusOnlineXadrez('Modo local ativo. O Xadrez online usa o caminho <strong>chessRooms</strong>, separado da Damas.');
                renderizarListaJogadoresXadrez();
                atualizarPainelTreinoXadrez();
                return;
            }

            const papel = chessIsSpectator ? 'espectador' : (chessPlayerColor === 'white' ? 'brancas' : 'pretas');
            const vezTexto = chessIsSpectator
                ? 'Você apenas assiste.'
                : (chessPlayerColor === chessTurn ? 'É a sua vez de jogar.' : `Aguarde a vez das ${nomeCor(chessTurn)}.`);
            const faltando = !chessRoomPlayers?.black?.id ? ' Aguardando segundo jogador entrar como pretas.' : '';
            const espectadores = contarEspectadoresXadrez();

            atualizarStatusOnlineXadrez(`Online na sala <strong>${escapeHtmlXadrez(chessRoomId)}</strong> como <strong>${papel}</strong>. ${vezTexto}${faltando} 👀 Espectadores: <strong>${espectadores}</strong>. 🔔 Alerta: <strong>${chessSoundEnabled ? 'ligado' : 'desligado'}</strong>.`);
            renderizarListaJogadoresXadrez();
        }

        function mostrarTabuleiroXadrezAposEscolha() {
            document.body.classList.add('chess-board-visible', 'chess-game-active');
            document.body.classList.remove('chess-menu-active');
            const status = document.getElementById('chess-status');
            if (status) status.style.display = '';
            const wrap = document.querySelector('#chess-screen .chess-board-wrap');
            if (wrap) wrap.style.display = '';
            const actions = document.querySelector('#chess-screen .chess-actions');
            if (actions) actions.style.display = '';
        }

        function ocultarTabuleiroXadrezParaMenu() {
            document.body.classList.remove('chess-board-visible', 'chess-game-active');
            document.body.classList.add('chess-menu-active');
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = 'Escolha como deseja jogar. Na parte de treino, você pode conhecer as peças antes de começar. O tabuleiro abrirá só depois de selecionar Online, Treino ou Aprender do Zero.';
            atualizarProfessorXadrez('', null);
            const resultPanel = document.getElementById('chess-result-panel');
            if (resultPanel) resultPanel.style.display = 'none';
            atualizarPainelTreinoXadrez();
            atualizarPainelOnlineXadrez();
        }

        function nomeDificuldadeTreinoXadrez() {
            if (chessTrainingLearnMode) return 'Aprender';
            if (chessTrainingDifficulty === 'facil') return 'Fácil';
            if (chessTrainingDifficulty === 'dificil') return 'Difícil';
            return 'Médio';
        }

        function atualizarPainelTreinoXadrez() {
            const status = document.getElementById('chess-training-status');
            const coach = document.getElementById('chess-training-coach');
            const beginnerBox = document.getElementById('chess-beginner-box');
            const beginnerActive = chessMode === 'training' && chessTrainingLearnMode;
            document.body.classList.toggle('chess-beginner-mode', beginnerActive);
            if (beginnerBox) beginnerBox.style.display = beginnerActive ? 'block' : 'none';
            document.querySelectorAll('#chess-training-panel .btn-chess-training').forEach(btn => btn.classList.remove('active'));
            const id = chessTrainingLearnMode ? 'chess-training-learn-btn' : `chess-training-${chessTrainingDifficulty === 'facil' ? 'easy' : chessTrainingDifficulty === 'dificil' ? 'hard' : 'medium'}-btn`;
            document.getElementById(id)?.classList.add('active');
            if (!status) return;
            if (chessMode !== 'training') {
                status.textContent = 'Treino desligado. Escolha um nível para começar contra a máquina.';
                if (coach) coach.style.display = 'none';
                return;
            }
            const vez = chessTurn === chessHumanColor ? 'Sua vez de jogar.' : 'A máquina está pensando...';
            status.textContent = chessTrainingLearnMode ? `Aprender do Zero ligado. Você joga com as brancas. Clique numa peça branca: verde anda, vermelho captura. ${vez}` : `Treino ligado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas. ${vez}`;
            if (coach) coach.style.display = chessTrainingLearnMode ? 'block' : 'none';
            if (chessTrainingLearnMode && chessTurn === chessHumanColor && !chessGameOver) {
                atualizarProfessorXadrez('Clique em uma peça branca. Eu vou explicar como ela anda e marcar um exemplo no tabuleiro.', null);
                atualizarDicaTreinoXadrez();
            }
        }

        function textoMovimentoPecaXadrez(type) {
            const textos = {
                king: 'O Rei anda 1 casa para qualquer lado. O segredo é nunca deixar o Rei em perigo. Se ele estiver ameaçado, você precisa defender, fugir ou capturar a peça que ameaça.',
                queen: 'A Dama é a peça mais forte. Ela anda quantas casas quiser em linha reta, coluna ou diagonal, desde que o caminho esteja livre.',
                rook: 'A Torre anda em linha reta: para frente, para trás e para os lados. Ela fica muito forte em colunas e linhas abertas.',
                bishop: 'O Bispo anda somente nas diagonais. Cada bispo fica sempre na mesma cor de casa durante a partida.',
                knight: 'O Cavalo anda em formato de L: duas casas para um lado e uma para o outro. Ele é especial porque pode pular por cima das peças.',
                pawn: 'O Peão anda para frente, mas captura na diagonal. No primeiro movimento pode andar duas casas. Quando chega ao fim do tabuleiro, vira outra peça.'
            };
            return textos[type] || 'Clique numa peça sua para ver as casas possíveis.';
        }

        function atualizarProfessorXadrez(texto, exemplo = null) {
            const box = document.getElementById('chess-live-coach');
            const el = document.getElementById('chess-live-coach-text');
            if (!box || !el) return;
            const ativo = chessMode === 'training' && chessTrainingLearnMode && document.body.classList.contains('chess-board-visible');
            box.style.display = ativo ? 'block' : 'none';
            if (ativo && texto) el.textContent = texto;
            chessLearnExampleMove = exemplo;
        }

        function jogadaPodeGerarXequeContra(corDefesa) {
            const atacante = corOposta(corDefesa);
            const movimentos = todosMovimentosLegais(atacante, chessBoard);
            for (const item of movimentos) {
                const temp = clonarTabuleiro(chessBoard);
                if (!temp) continue;
                aplicarMovimentoEmBoard(temp, item.from.row, item.from.col, item.to);
                if (reiEstaEmXeque(temp, corDefesa)) return true;
            }
            return false;
        }

        function feedbackProfessorDepoisDaJogada(peca, fromRow, fromCol, move, estado) {
            if (!(chessMode === 'training' && chessTrainingLearnMode && peca?.color === chessHumanColor)) return;
            if (/Xeque-mate/i.test(estado || '')) {
                atualizarProfessorXadrez('🏆 Excelente! Isso foi xeque-mate. Você protegeu seu Rei e deixou o Rei adversário sem saída.', null);
                return;
            }
            if (/Xeque/i.test(estado || '')) {
                atualizarProfessorXadrez('🔥 Boa! Você colocou o Rei da máquina em xeque. Agora ela será obrigada a se defender.', null);
                return;
            }
            if (jogadaPodeGerarXequeContra(chessHumanColor)) {
                atualizarProfessorXadrez('⚠️ Atenção: sua jogada é legal, mas a máquina pode criar ameaça de xeque. Observe bem o Rei antes da próxima jogada.', null);
                return;
            }
            if (move.capture) {
                atualizarProfessorXadrez('✅ Boa jogada! Você capturou uma peça. Capturar com segurança ajuda a ganhar material e controlar a partida.', null);
                return;
            }
            if (move.castle) {
                atualizarProfessorXadrez('🛡️ Ótimo roque! Você colocou o Rei em mais segurança e aproximou a Torre do jogo.', null);
                return;
            }
            if (peca.type === 'knight' || peca.type === 'bishop') {
                atualizarProfessorXadrez('✅ Boa jogada! Você desenvolveu uma peça. No começo da partida, tirar Cavalo e Bispo da posição inicial ajuda muito.', null);
                return;
            }
            if (peca.type === 'pawn' && Math.abs(move.row - fromRow) === 2) {
                atualizarProfessorXadrez('✅ Bom avanço de peão! Você ganhou espaço. Agora tente desenvolver Cavalos e Bispos.', null);
                return;
            }
            atualizarProfessorXadrez('✅ Jogada feita. Agora observe a resposta da máquina e procure manter seu Rei seguro.', null);
        }

        function reforcarProfessorXequeXadrez(estado) {
            if (!/Xeque/i.test(estado || '')) return;
            if (/Xeque-mate/i.test(estado || '')) {
                atualizarProfessorXadrez('♟️ Xeque-mate! A partida terminou porque o Rei ameaçado não tem fuga, defesa nem captura possível.', null);
            } else {
                atualizarProfessorXadrez('⚠️ Xeque! O Rei está ameaçado. A prioridade é uma destas três: fugir com o Rei, capturar a peça atacante ou bloquear o caminho do ataque.', null);
            }
        }


        function chaveRankingTreinoXadrez() {
            return 'tabuleiroArena.chessTrainingRanking.v20';
        }

        function rankingTreinoXadrezPadrao() {
            return {
                points: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                games: 0,
                streak: 0,
                bestDifficulty: '',
                lastResult: 'Nenhuma partida finalizada',
                byDifficulty: {
                    aprender: { wins: 0, losses: 0, draws: 0, games: 0 },
                    facil: { wins: 0, losses: 0, draws: 0, games: 0 },
                    medio: { wins: 0, losses: 0, draws: 0, games: 0 },
                    dificil: { wins: 0, losses: 0, draws: 0, games: 0 }
                }
            };
        }

        function carregarRankingTreinoXadrez() {
            try {
                const raw = localStorage.getItem(chaveRankingTreinoXadrez());
                const base = rankingTreinoXadrezPadrao();
                if (!raw) return base;
                const data = JSON.parse(raw);
                return {
                    ...base,
                    ...data,
                    byDifficulty: {
                        ...base.byDifficulty,
                        ...(data && data.byDifficulty ? data.byDifficulty : {})
                    }
                };
            } catch (_) {
                return rankingTreinoXadrezPadrao();
            }
        }

        function salvarRankingTreinoXadrez(data) {
            try { localStorage.setItem(chaveRankingTreinoXadrez(), JSON.stringify(data)); } catch (_) {}
        }

        function chaveDificuldadeRankingAtual() {
            if (chessTrainingLearnMode) return 'aprender';
            if (chessTrainingDifficulty === 'facil') return 'facil';
            if (chessTrainingDifficulty === 'dificil') return 'dificil';
            return 'medio';
        }

        function nomeDificuldadeRankingXadrez(chave) {
            const nomes = { aprender: 'Aprender do Zero', facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
            return nomes[chave] || 'Médio';
        }

        function pontosVitoriaRankingXadrez(chave) {
            const pontos = { aprender: 5, facil: 10, medio: 20, dificil: 35 };
            return pontos[chave] || 20;
        }

        function prioridadeDificuldadeRanking(chave) {
            const ordem = { aprender: 1, facil: 2, medio: 3, dificil: 4 };
            return ordem[chave] || 0;
        }

        function renderRankingTreinoXadrez() {
            const data = carregarRankingTreinoXadrez();
            const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
            setText('chess-rank-points', data.points || 0);
            setText('chess-rank-wins', data.wins || 0);
            setText('chess-rank-losses', data.losses || 0);
            setText('chess-rank-draws', data.draws || 0);
            setText('chess-rank-games', data.games || 0);
            setText('chess-rank-streak', data.streak || 0);
            setText('chess-rank-best', data.bestDifficulty ? nomeDificuldadeRankingXadrez(data.bestDifficulty) : 'Nenhum ainda');
            setText('chess-rank-last', data.lastResult || 'Nenhuma partida finalizada');
            const badge = document.getElementById('chess-training-ranking-badge');
            if (badge) badge.textContent = data.games ? `${data.games} partida${data.games === 1 ? '' : 's'} registrada${data.games === 1 ? '' : 's'}` : 'Separado da Damas';
            renderConquistasXadrez();
        }

        function prepararRankingTreinoXadrez() {
            const panel = document.getElementById('chess-training-ranking-panel');
            const btn = document.getElementById('chess-ranking-toggle-btn');
            if (!panel) return;
            let aberto = false;
            try { aberto = localStorage.getItem('tabuleiroArenaChessRankingOpen') === '1'; } catch (_) {}
            panel.classList.toggle('chess-rank-collapsed', !aberto);
            if (btn) {
                btn.textContent = aberto ? '−' : '+';
                btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            }
        }

        function alternarRankingTreinoXadrez() {
            const panel = document.getElementById('chess-training-ranking-panel');
            if (!panel) return;
            const abrir = panel.classList.contains('chess-rank-collapsed');
            panel.classList.toggle('chess-rank-collapsed', !abrir);
            try { localStorage.setItem('tabuleiroArenaChessRankingOpen', abrir ? '1' : '0'); } catch (_) {}
            prepararRankingTreinoXadrez();
        }

        function registrarResultadoRankingTreinoXadrez(textoEstado) {
            if (chessMode !== 'training' || !chessGameOver || chessTrainingResultRecorded) return;
            if (!textoEstado || !/Xeque-mate|Empate|afogamento|venceram|venceu|desistência/i.test(textoEstado)) return;

            const data = carregarRankingTreinoXadrez();
            const diff = chaveDificuldadeRankingAtual();
            const bucket = data.byDifficulty[diff] || { wins: 0, losses: 0, draws: 0, games: 0 };
            const brancasVenceram = /brancas/i.test(textoEstado);
            const pretasVenceram = /pretas/i.test(textoEstado);
            const empate = /Empate|afogamento/i.test(textoEstado);

            data.games = (data.games || 0) + 1;
            bucket.games = (bucket.games || 0) + 1;

            if (empate) {
                data.draws = (data.draws || 0) + 1;
                bucket.draws = (bucket.draws || 0) + 1;
                data.points = (data.points || 0) + 2;
                data.streak = 0;
                data.lastResult = `Empate no modo ${nomeDificuldadeRankingXadrez(diff)} (+2 pontos)`;
            } else if (brancasVenceram && !pretasVenceram) {
                const pontos = pontosVitoriaRankingXadrez(diff);
                data.wins = (data.wins || 0) + 1;
                bucket.wins = (bucket.wins || 0) + 1;
                data.points = (data.points || 0) + pontos;
                data.streak = (data.streak || 0) + 1;
                if (!data.bestDifficulty || prioridadeDificuldadeRanking(diff) > prioridadeDificuldadeRanking(data.bestDifficulty)) data.bestDifficulty = diff;
                data.lastResult = `Vitória no modo ${nomeDificuldadeRankingXadrez(diff)} (+${pontos} pontos)`;
            } else {
                data.losses = (data.losses || 0) + 1;
                bucket.losses = (bucket.losses || 0) + 1;
                data.streak = 0;
                data.lastResult = `Derrota no modo ${nomeDificuldadeRankingXadrez(diff)}`;
            }

            data.byDifficulty[diff] = bucket;
            data.updatedAt = Date.now();
            salvarRankingTreinoXadrez(data);
            registrarConquistasPorResultadoXadrez(textoEstado, data, diff);
            chessTrainingResultRecorded = true;
            renderRankingTreinoXadrez();
        }

        function limparRankingTreinoXadrez() {
            exibirConfirmacao('Limpar ranking do Xadrez', 'Deseja limpar somente o <strong>ranking do treino de Xadrez</strong>?<br><br>A Damas não será alterada.', () => {
                salvarRankingTreinoXadrez(rankingTreinoXadrezPadrao());
                renderRankingTreinoXadrez();
                prepararRankingTreinoXadrez();
                mostrarToastXadrez('🏆 Ranking do treino de Xadrez limpo.');
            });
        }



        function chaveConquistasXadrez() {
            return 'tabuleiroArena.chessAchievements.v21';
        }

        function conquistasXadrezPadrao() {
            return { unlocked: {}, updatedAt: null };
        }

        function listaConquistasXadrez() {
            return [
                { id: 'firstGame', icon: '🎮', name: 'Primeira partida', desc: 'Finalizou uma partida de treino de Xadrez.' },
                { id: 'firstWin', icon: '🏆', name: 'Primeira vitória', desc: 'Venceu a máquina pela primeira vez.' },
                { id: 'firstCapture', icon: '⚔️', name: 'Primeira captura', desc: 'Capturou uma peça adversária no Xadrez.' },
                { id: 'queenHunter', icon: '👑', name: 'Caçador da Dama', desc: 'Capturou a Dama adversária.' },
                { id: 'firstCheck', icon: '⚠️', name: 'Primeiro xeque', desc: 'Colocou o Rei adversário em xeque.' },
                { id: 'firstCheckmate', icon: '♟️', name: 'Primeiro xeque-mate', desc: 'Venceu uma partida com xeque-mate.' },
                { id: 'learnWin', icon: '🎓', name: 'Aprendeu vencendo', desc: 'Venceu no modo Aprender do Zero.' },
                { id: 'winMedium', icon: '🥈', name: 'Venceu no médio', desc: 'Derrotou a máquina no nível médio.' },
                { id: 'winHard', icon: '🥇', name: 'Venceu no difícil', desc: 'Derrotou a máquina no nível difícil.' },
                { id: 'streak3', icon: '🔥', name: 'Sequência 3', desc: 'Conseguiu 3 vitórias seguidas no treino.' },
                { id: 'points100', icon: '💯', name: '100 pontos', desc: 'Chegou a 100 pontos no ranking do treino.' },
                { id: 'castleDone', icon: '🏰', name: 'Rei protegido', desc: 'Fez um roque para proteger o Rei.' }
            ];
        }

        function carregarConquistasXadrez() {
            try {
                const raw = localStorage.getItem(chaveConquistasXadrez());
                const base = conquistasXadrezPadrao();
                if (!raw) return base;
                const data = JSON.parse(raw);
                return { ...base, ...data, unlocked: { ...base.unlocked, ...(data && data.unlocked ? data.unlocked : {}) } };
            } catch (_) {
                return conquistasXadrezPadrao();
            }
        }

        function salvarConquistasXadrez(data) {
            try { localStorage.setItem(chaveConquistasXadrez(), JSON.stringify(data)); } catch (_) {}
        }

        function desbloquearConquistaXadrez(id, silencioso = false) {
            const data = carregarConquistasXadrez();
            if (data.unlocked && data.unlocked[id]) return false;
            const def = listaConquistasXadrez().find(item => item.id === id);
            if (!def) return false;
            data.unlocked[id] = Date.now();
            data.updatedAt = Date.now();
            salvarConquistasXadrez(data);
            renderConquistasXadrez();
            if (!silencioso) mostrarToastXadrez(`🥇 Nova conquista: ${def.name}!`);
            return true;
        }

        function renderConquistasXadrez() {
            const grid = document.getElementById('chess-achievements-grid');
            const badge = document.getElementById('chess-achievements-badge');
            if (!grid) return;
            const data = carregarConquistasXadrez();
            const defs = listaConquistasXadrez();
            const total = defs.length;
            const unlockedCount = defs.filter(item => data.unlocked && data.unlocked[item.id]).length;
            if (badge) badge.textContent = `${unlockedCount}/${total} liberadas`;
            grid.innerHTML = defs.map(item => {
                const ok = !!(data.unlocked && data.unlocked[item.id]);
                return `
                    <div class="chess-achievement-card ${ok ? 'unlocked' : ''}">
                        <div class="chess-achievement-icon">${ok ? item.icon : '🔒'}</div>
                        <div class="chess-achievement-name">${escapeHtmlXadrez(item.name)}</div>
                        <div class="chess-achievement-desc">${escapeHtmlXadrez(ok ? item.desc : 'Bloqueada: continue jogando para liberar.')}</div>
                    </div>
                `;
            }).join('');
        }

        function limparConquistasXadrez() {
            exibirConfirmacao('Limpar conquistas do Xadrez', 'Deseja limpar somente as <strong>conquistas do Xadrez</strong>?<br><br>A Damas e o ranking não serão alterados.', () => {
                salvarConquistasXadrez(conquistasXadrezPadrao());
                renderConquistasXadrez();
                mostrarToastXadrez('🥇 Conquistas do Xadrez limpas.');
            });
        }

        function registrarConquistasPorJogadaXadrez(peca, move, capturedPiece, estadoDepois) {
            if (!peca) return;
            if (capturedPiece && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCapture');
            if (capturedPiece && capturedPiece.type === 'queen' && peca.color === chessHumanColor) desbloquearConquistaXadrez('queenHunter');
            if (move && move.castle && peca.color === chessHumanColor) desbloquearConquistaXadrez('castleDone');
            if (/Xeque/i.test(estadoDepois || '') && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCheck');
            if (/Xeque-mate/i.test(estadoDepois || '') && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCheckmate');
        }

        function registrarConquistasPorResultadoXadrez(textoEstado, dataRanking, diff) {
            if (chessMode !== 'training' || !textoEstado) return;
            desbloquearConquistaXadrez('firstGame', true);
            const brancasVenceram = /brancas/i.test(textoEstado);
            if (brancasVenceram) {
                desbloquearConquistaXadrez('firstWin');
                if (diff === 'aprender') desbloquearConquistaXadrez('learnWin');
                if (diff === 'medio') desbloquearConquistaXadrez('winMedium');
                if (diff === 'dificil') desbloquearConquistaXadrez('winHard');
            }
            if (/Xeque-mate/i.test(textoEstado) && brancasVenceram) desbloquearConquistaXadrez('firstCheckmate');
            if ((dataRanking.streak || 0) >= 3) desbloquearConquistaXadrez('streak3');
            if ((dataRanking.points || 0) >= 100) desbloquearConquistaXadrez('points100');
        }

        function esconderResultadoAntigoXadrezSeguro() {
            const panel = document.getElementById('chess-result-panel');
            if (panel) {
                panel.style.display = 'none';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.className = 'chess-result-panel';
            }
            const modaisAntigos = ['ta-chess-result-modal', 'ta-chess-result-modal-final'];
            modaisAntigos.forEach((id) => {
                const m = document.getElementById(id);
                if (m) {
                    m.classList.remove('is-open');
                    m.style.display = 'none';
                    m.style.visibility = 'hidden';
                    m.style.opacity = '0';
                    m.setAttribute('aria-hidden', 'true');
                }
            });
            document.body.classList.remove('ta-chess-result-open', 'ta-result-modal-central-active', 'ta-result-modal-final-active');
        }

        function garantirModalResultadoXadrezSeguro() {
            let modal = document.getElementById('ta-chess-result-modal-safe');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'ta-chess-result-modal-safe';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="ta-safe-result-card" role="dialog" aria-modal="true" aria-label="Resultado do Xadrez">
                    <div class="ta-safe-result-icon" id="ta-safe-result-icon">🏆</div>
                    <div class="ta-safe-result-title" id="ta-safe-result-title">Partida encerrada</div>
                    <div class="ta-safe-result-text" id="ta-safe-result-text">A partida terminou.</div>
                    <div class="ta-safe-result-actions">
                        <button id="ta-safe-result-again-btn" type="button">Jogar novamente</button>
                        <button id="ta-safe-result-menu-btn" type="button">Voltar ao menu</button>
                        <button id="ta-safe-result-close-btn" type="button">Continuar olhando</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const fechar = () => fecharModalResultadoXadrezSeguro();
            document.getElementById('ta-safe-result-close-btn')?.addEventListener('click', fechar);
            document.getElementById('ta-safe-result-again-btn')?.addEventListener('click', () => {
                fecharModalResultadoXadrezSeguro();
                resetChessGame();
                focarTabuleiroXadrez(false);
            });
            document.getElementById('ta-safe-result-menu-btn')?.addEventListener('click', () => {
                fecharModalResultadoXadrezSeguro();
                ocultarTabuleiroXadrezParaMenu();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            return modal;
        }

        function fecharModalResultadoXadrezSeguro() {
            const modal = document.getElementById('ta-chess-result-modal-safe');
            if (modal) {
                modal.className = '';
                modal.classList.remove('is-open', 'win', 'loss', 'draw', 'mate');
                modal.setAttribute('aria-hidden', 'true');
            }
            document.body.classList.remove('ta-result-modal-safe-active');
            esconderResultadoAntigoXadrezSeguro();
        }

        function limparResultadoXadrez() {
            fecharModalResultadoXadrezSeguro();
            chessLastResultShown = '';
        }

        function mostrarResultadoXadrezSeTerminou(textoEstado) {
            if (!chessGameOver || !textoEstado) return;

            esconderResultadoAntigoXadrezSeguro();

            if (chessLastResultShown !== textoEstado) {
                chessLastResultShown = textoEstado;
                registrarResultadoRankingTreinoXadrez(textoEstado);
            }

            let tipo = 'draw';
            let titulo = 'Partida empatada';
            let icone = '🤝';
            let textoAmigavel = textoEstado;
            const terminouPorMate = /Xeque-mate/i.test(textoEstado);
            if (terminouPorMate || /venceram|venceu|desistência/i.test(textoEstado)) {
                const brancasVenceram = /brancas/i.test(textoEstado);
                const pretasVenceram = /pretas/i.test(textoEstado);
                tipo = terminouPorMate ? 'mate' : 'win';
                if (chessMode === 'training') {
                    tipo = brancasVenceram ? (terminouPorMate ? 'mate' : 'win') : 'loss';
                    titulo = brancasVenceram ? 'Você venceu!' : 'A máquina venceu';
                    icone = brancasVenceram ? '🏆' : '♟️';
                    textoAmigavel = brancasVenceram
                        ? `${textoEstado} Parabéns! Você derrotou a máquina.`
                        : `${textoEstado} Continue treinando: proteja melhor o Rei e tente novamente.`;
                } else {
                    titulo = brancasVenceram ? 'Brancas venceram!' : pretasVenceram ? 'Pretas venceram!' : 'Partida finalizada';
                    icone = terminouPorMate ? '♟️' : '🏆';
                }
            }

            if (/Empate|afogamento|material insuficiente|repetição/i.test(textoEstado)) {
                tipo = 'draw';
                titulo = 'Partida empatada';
                icone = '🤝';
            }

            const modal = garantirModalResultadoXadrezSeguro();
            modal.className = `is-open ${tipo}`;
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('ta-result-modal-safe-active');

            const iconEl = document.getElementById('ta-safe-result-icon');
            const titleEl = document.getElementById('ta-safe-result-title');
            const textEl = document.getElementById('ta-safe-result-text');
            if (iconEl) iconEl.textContent = icone;
            if (titleEl) titleEl.textContent = titulo;
            if (textEl) textEl.textContent = textoAmigavel;
        }

        function dicaSelecaoPecaXadrez(peca, row, col, movimentosLegais) {
            const capturas = movimentosLegais.filter(m => m.capture).length;
            const movimentos = movimentosLegais.length - capturas;
            const exemplo = movimentosLegais.find(m => m.capture) || movimentosLegais[0] || null;
            const exemploTexto = exemplo ? ` Exemplo agora: de ${alg(row, col)} para ${alg(exemplo.row, exemplo.col)}${exemplo.capture ? ' para capturar uma peça' : ' para avançar com segurança'}.` : ' Agora essa peça não tem movimento legal.';
            return {
                texto: `${nomePeca[peca.type]} em ${alg(row, col)}. ${textoMovimentoPecaXadrez(peca.type)} Verde = andar (${movimentos}). Vermelho = capturar (${capturas}).${exemploTexto}`,
                exemplo: exemplo ? { from: { row, col }, to: { row: exemplo.row, col: exemplo.col } } : null
            };
        }

        function valorPecaTreinoXadrez(type) {
            return { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 }[type] || 0;
        }

        function valorPosicionalTreinoXadrez(peca, row, col) {
            if (!peca) return 0;
            const centro = Math.abs(3.5 - row) + Math.abs(3.5 - col);
            let bonus = Math.max(0, 7 - centro) * 3;
            const avancado = peca.color === 'black' ? row : (7 - row);

            if (peca.type === 'pawn') bonus += avancado * 7;
            if (peca.type === 'knight' || peca.type === 'bishop') {
                bonus += Math.max(0, 6 - centro) * 7;
                const casaInicial = peca.color === 'black' ? row === 0 : row === 7;
                if (casaInicial) bonus -= 16;
            }
            if (peca.type === 'rook') {
                const colunaAberta = !chessBoard.some(linha => linha[col]?.type === 'pawn');
                if (colunaAberta) bonus += 18;
            }
            if (peca.type === 'queen') {
                const saiuMuitoCedo = peca.color === 'black' ? row > 1 : row < 6;
                if (saiuMuitoCedo) bonus -= 10;
            }
            if (peca.type === 'king') {
                const linhaSegura = peca.color === 'black' ? row <= 1 : row >= 6;
                if (linhaSegura) bonus += 20;
                if (col === 6 || col === 2) bonus += 35; // rei rocado
                if (row >= 2 && row <= 5 && col >= 2 && col <= 5) bonus -= 45;
            }
            return bonus;
        }

        function avaliarMaterialTreinoXadrez(board, corMaquina = 'black') {
            let score = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r]?.[c];
                    if (!p) continue;
                    const v = valorPecaTreinoXadrez(p.type) + valorPosicionalTreinoXadrez(p, r, c);
                    score += p.color === corMaquina ? v : -v;
                }
            }
            return score;
        }

        function avaliarSegurancaReiTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            let score = 0;
            if (reiEstaEmXeque(board, adversario)) score += 95;
            if (reiEstaEmXeque(board, corMaquina)) score -= 180;

            const reiMaquina = encontrarRei(board, corMaquina);
            const reiHumano = encontrarRei(board, adversario);
            const avaliarEscudo = (king, color) => {
                if (!king) return 0;
                const dir = color === 'black' ? 1 : -1;
                let escudo = 0;
                for (const dc of [-1, 0, 1]) {
                    const r = king.row + dir;
                    const c = king.col + dc;
                    if (dentroDoTabuleiro(r, c) && board[r][c]?.type === 'pawn' && board[r][c]?.color === color) escudo += 14;
                }
                return escudo;
            };
            score += avaliarEscudo(reiMaquina, corMaquina);
            score -= avaliarEscudo(reiHumano, adversario);
            return score;
        }

        function avaliarMobilidadeTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            const mobMaquina = todosMovimentosLegais(corMaquina, board).length;
            const mobHumano = todosMovimentosLegais(adversario, board).length;
            return (mobMaquina - mobHumano) * 3;
        }

        function avaliarPecasAmeaçadasTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            let score = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r]?.[c];
                    if (!p || p.type === 'king') continue;
                    const valor = valorPecaTreinoXadrez(p.type);
                    if (p.color === corMaquina && quadradoAtacado(board, r, c, adversario)) score -= valor * 0.22;
                    if (p.color === adversario && quadradoAtacado(board, r, c, corMaquina)) score += valor * 0.18;
                }
            }
            return score;
        }

        function avaliarPosicaoTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            const movMaquina = todosMovimentosLegais(corMaquina, board);
            const movAdversario = todosMovimentosLegais(adversario, board);
            if (!movAdversario.length && reiEstaEmXeque(board, adversario)) return 999999;
            if (!movMaquina.length && reiEstaEmXeque(board, corMaquina)) return -999999;
            if (!movAdversario.length && !reiEstaEmXeque(board, adversario)) return -90;
            if (!movMaquina.length && !reiEstaEmXeque(board, corMaquina)) return 0;
            return avaliarMaterialTreinoXadrez(board, corMaquina)
                + avaliarSegurancaReiTreinoXadrez(board, corMaquina)
                + avaliarMobilidadeTreinoXadrez(board, corMaquina)
                + avaliarPecasAmeaçadasTreinoXadrez(board, corMaquina);
        }

        function aplicarMovimentoTreinoEmClone(board, item, promotionType = 'queen') {
            const temp = clonarTabuleiro(board);
            if (!temp) return null;
            const peca = temp[item.from.row]?.[item.from.col];
            const promover = peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7) ? promotionType : null;
            aplicarMovimentoEmBoard(temp, item.from.row, item.from.col, item.to, { promotionType: promover });
            return temp;
        }

        function detectarMateEmUmTreinoXadrez(cor, board = chessBoard) {
            const adversario = corOposta(cor);
            const movimentos = todosMovimentosLegais(cor, board);
            for (const item of movimentos) {
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (!temp) continue;
                const respostas = todosMovimentosLegais(adversario, temp);
                if (!respostas.length && reiEstaEmXeque(temp, adversario)) return item;
            }
            return null;
        }

        function ordenarMovimentosTreinoXadrez(movimentos, board = chessBoard, corMaquina = 'black') {
            return movimentos.map(item => {
                const peca = board[item.from.row]?.[item.from.col];
                const capturada = item.to.enPassant && item.to.enPassantCapture
                    ? board[item.to.enPassantCapture.row]?.[item.to.enPassantCapture.col]
                    : board[item.to.row]?.[item.to.col];
                let ordem = 0;
                if (capturada) ordem += valorPecaTreinoXadrez(capturada.type) * 10 - valorPecaTreinoXadrez(peca?.type) * 0.4;
                if (item.to.castle) ordem += 90;
                if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) ordem += 900;
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (temp && reiEstaEmXeque(temp, corOposta(corMaquina))) ordem += 160;
                return { ...item, orderScore: ordem };
            }).sort((a, b) => b.orderScore - a.orderScore);
        }

        function minimaxTreinoXadrez(board, depth, alpha, beta, maximizando, corMaquina = 'black') {
            const corDaVez = maximizando ? corMaquina : corOposta(corMaquina);
            const movimentosBase = todosMovimentosLegais(corDaVez, board);
            if (depth === 0 || !movimentosBase.length) return avaliarPosicaoTreinoXadrez(board, corMaquina);

            const movimentos = ordenarMovimentosTreinoXadrez(movimentosBase, board, corDaVez).slice(0, depth >= 2 ? 18 : 28);
            if (maximizando) {
                let melhor = -Infinity;
                for (const item of movimentos) {
                    const temp = aplicarMovimentoTreinoEmClone(board, item);
                    if (!temp) continue;
                    const valor = minimaxTreinoXadrez(temp, depth - 1, alpha, beta, false, corMaquina);
                    melhor = Math.max(melhor, valor);
                    alpha = Math.max(alpha, valor);
                    if (beta <= alpha) break;
                }
                return melhor;
            }
            let pior = Infinity;
            for (const item of movimentos) {
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (!temp) continue;
                const valor = minimaxTreinoXadrez(temp, depth - 1, alpha, beta, true, corMaquina);
                pior = Math.min(pior, valor);
                beta = Math.min(beta, valor);
                if (beta <= alpha) break;
            }
            return pior;
        }

        function pontuarJogadaTreinoXadrez(item, corMaquina = 'black', board = chessBoard) {
            const temp = aplicarMovimentoTreinoEmClone(board, item);
            if (!temp) return -999999;
            const peca = board[item.from.row]?.[item.from.col];
            const capturada = item.to.enPassant && item.to.enPassantCapture
                ? board[item.to.enPassantCapture.row]?.[item.to.enPassantCapture.col]
                : board[item.to.row]?.[item.to.col];
            const adversario = corOposta(corMaquina);

            let score = avaliarPosicaoTreinoXadrez(temp, corMaquina);
            if (capturada) score += valorPecaTreinoXadrez(capturada.type) * 0.45;
            if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 820;
            if (item.to.castle) score += 90;

            // Evita entregar peça importante de graça, principalmente Dama e Torre.
            if (peca && peca.type !== 'king' && quadradoAtacado(temp, item.to.row, item.to.col, adversario)) {
                const defendida = quadradoAtacado(temp, item.to.row, item.to.col, corMaquina);
                const penalidade = valorPecaTreinoXadrez(peca.type) * (defendida ? 0.28 : 0.62);
                score -= penalidade;
            }

            const mateHumanoEmUm = detectarMateEmUmTreinoXadrez(adversario, temp);
            if (mateHumanoEmUm) score -= 80000;

            const mateMaquinaEmUm = detectarMateEmUmTreinoXadrez(corMaquina, board);
            if (mateMaquinaEmUm && mateMaquinaEmUm.from.row === item.from.row && mateMaquinaEmUm.from.col === item.from.col && mateMaquinaEmUm.to.row === item.to.row && mateMaquinaEmUm.to.col === item.to.col) {
                score += 120000;
            }

            score += Math.random() * 8;
            return score;
        }

        function escolherJogadaMaquinaXadrez() {
            const movimentos = todosMovimentosLegais('black', chessBoard);
            if (!movimentos.length) return null;

            // Prioridade 1: se tiver xeque-mate em 1, a máquina finaliza.
            const mateAgora = detectarMateEmUmTreinoXadrez('black', chessBoard);
            if (mateAgora) return mateAgora;

            const avaliadosRapidos = movimentos.map(m => ({ ...m, score: pontuarJogadaTreinoXadrez(m, 'black', chessBoard) })).sort((a, b) => b.score - a.score);

            if (chessTrainingDifficulty === 'facil') {
                // Fácil continua humano: às vezes joga aleatório, mas evita entregar a dama/rei de forma absurda.
                const aceitaveis = avaliadosRapidos.filter(m => m.score > avaliadosRapidos[0].score - 900);
                const pool = Math.random() < 0.65 ? movimentos : (aceitaveis.length ? aceitaveis : avaliadosRapidos);
                return pool[Math.floor(Math.random() * pool.length)];
            }

            if (chessTrainingDifficulty === 'medio') {
                // Médio olha as melhores opções, prioriza capturas boas, defesa do rei e xeque.
                const limite = Math.max(2, Math.ceil(avaliadosRapidos.length * 0.28));
                const melhores = avaliadosRapidos.slice(0, limite);
                return melhores[Math.floor(Math.random() * melhores.length)];
            }

            // Difícil: usa uma busca curta de 2 lances para não cair em armadilhas simples.
            const candidatos = ordenarMovimentosTreinoXadrez(movimentos, chessBoard, 'black').slice(0, 18);
            let melhor = null;
            let melhorScore = -Infinity;
            for (const item of candidatos) {
                const temp = aplicarMovimentoTreinoEmClone(chessBoard, item);
                if (!temp) continue;
                let score = minimaxTreinoXadrez(temp, 2, -Infinity, Infinity, false, 'black');
                score += pontuarJogadaTreinoXadrez(item, 'black', chessBoard) * 0.08;
                if (score > melhorScore) {
                    melhorScore = score;
                    melhor = item;
                }
            }
            return melhor || avaliadosRapidos[0];
        }

        function explicarJogadaTreinoXadrez(item) {
            if (!item) return 'Não encontrei uma jogada segura agora.';
            const peca = chessBoard[item.from.row]?.[item.from.col];
            const destino = chessBoard[item.to.row]?.[item.to.col];
            const nome = nomePeca[peca?.type] || 'Peça';
            const captura = destino ? ` capturando ${nomePeca[destino.type].toLowerCase()}` : '';
            const extra = item.to.castle ? ' É uma ideia de roque para proteger o rei.' : item.to.row === 0 && peca?.type === 'pawn' ? ' Também ameaça promoção do peão.' : '';
            return `Boa ideia: mover ${nome} de ${alg(item.from.row, item.from.col)} para ${alg(item.to.row, item.to.col)}${captura}. Essa jogada melhora sua posição sem deixar o rei em xeque.${extra}`;
        }

        function atualizarDicaTreinoXadrez() {
            const texto = document.getElementById('chess-training-coach-text');
            if (!texto) return;
            if (chessMode !== 'training' || chessTurn !== chessHumanColor || chessGameOver) {
                texto.textContent = 'Aguarde sua vez para receber a próxima dica.';
                return;
            }
            const movimentos = todosMovimentosLegais(chessHumanColor, chessBoard);
            if (!movimentos.length) {
                texto.textContent = 'Você não tem movimentos legais nesta posição.';
                return;
            }
            const melhores = movimentos.map(m => ({ ...m, score: pontuarJogadaTreinoXadrez(m, chessHumanColor) })).sort((a,b)=>b.score-a.score);
            texto.textContent = explicarJogadaTreinoXadrez(melhores[0]);
        }

        async function executarJogadaMaquinaXadrez() {
            if (chessMode !== 'training' || chessGameOver || chessTurn !== 'black' || chessAiThinking) return;
            chessAiThinking = true;
            atualizarPainelTreinoXadrez();
            mostrarToastXadrez('🤖 Máquina pensando...');
            await new Promise(resolve => setTimeout(resolve, chessTrainingDifficulty === 'dificil' ? 650 : 420));
            const escolha = escolherJogadaMaquinaXadrez();
            if (!escolha) {
                chessAiThinking = false;
                avaliarEstadoDoJogo('A máquina não tem movimentos legais.');
                renderChessBoard();
                return;
            }
            await executarMovimentoXadrez(escolha.from.row, escolha.from.col, escolha.to);
            chessAiThinking = false;
            atualizarPainelTreinoXadrez();
        }

        async function iniciarTreinoXadrez(nivel = 'medio', aprender = false) {
            try { if (chessMode === 'online') await sairXadrezOnline(false); } catch (_) {}
            chessMode = 'training';
            chessTrainingActive = true;
            chessTrainingDifficulty = nivel;
            chessTrainingLearnMode = !!aprender;
            chessAiThinking = false;
            chessPlayerColor = 'white';
            chessIsSpectator = false;
            chessBoardFlipped = false;
            criarTabuleiroInicial();
            limparResultadoXadrez();
            lastMoveMessage = chessTrainingLearnMode ? 'Aprender do Zero iniciado. Clique em uma peça branca. Verde é andar, vermelho é capturar. Para comer a peça preta, clique na casa vermelha.' : `Modo Treino iniciado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas e a máquina joga com as pretas.`;
            selectedSquare = null;
            legalMoves = [];
            mostrarTabuleiroXadrezAposEscolha();
            renderChessBoard();
            atualizarPainelTreinoXadrez();
            renderRankingTreinoXadrez();
            focarTabuleiroXadrez(false);
            mostrarToastXadrez(`🤖 Modo Treino ${nomeDificuldadeTreinoXadrez()} iniciado.`);
        }

        function salvarEstadoParaDesfazer() {
            if (chessMode === 'online') return;
            undoStack.push({
                board: clonarTabuleiro(chessBoard),
                turn: chessTurn,
                gameOver: chessGameOver,
                lastMove: lastChessMove ? { ...lastChessMove } : null,
                enPassant: enPassantTarget ? { ...enPassantTarget } : null,
                history: [...moveHistory],
                message: lastMoveMessage
            });
            if (undoStack.length > 80) undoStack.shift();
        }

        function desfazerJogada() {
            const previous = undoStack.pop();
            if (!previous) {
                lastMoveMessage = 'Não há jogada para desfazer.';
                atualizarStatus();
                return;
            }
            chessBoard = clonarTabuleiro(previous.board);
            chessTurn = previous.turn;
            chessGameOver = previous.gameOver;
            lastChessMove = previous.lastMove;
            enPassantTarget = previous.enPassant;
            moveHistory = [...previous.history];
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = 'Jogada desfeita.';
            renderChessBoard();
        }

        function dentroDoTabuleiro(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }
        function nomeCor(color) { return color === 'white' ? 'brancas' : 'pretas'; }
        function nomeVencedor(color) { return color === 'white' ? 'Brancas' : 'Pretas'; }
        function corOposta(color) { return color === 'white' ? 'black' : 'white'; }
        function casaLivre(row, col, board = chessBoard) { return dentroDoTabuleiro(row, col) && !board[row][col]; }
        function casaTemAdversario(row, col, color, board = chessBoard) { return dentroDoTabuleiro(row, col) && board[row][col] && board[row][col].color !== color; }
        function alg(row, col) { return `${String.fromCharCode(97 + col)}${8 - row}`; }

        function encontrarRei(board, color) {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.color === color && p.type === 'king') return { row: r, col: c };
                }
            }
            return null;
        }

        function caminhoLivre(board, row, col, dr, dc) {
            let r = row + dr;
            let c = col + dc;
            while (dentroDoTabuleiro(r, c)) {
                if (board[r][c]) return false;
                r += dr;
                c += dc;
            }
            return true;
        }

        function quadradoAtacado(board, row, col, byColor) {
            const pawnDir = byColor === 'white' ? -1 : 1;
            for (const dc of [-1, 1]) {
                const pr = row - pawnDir;
                const pc = col - dc;
                if (dentroDoTabuleiro(pr, pc)) {
                    const p = board[pr][pc];
                    if (p && p.color === byColor && p.type === 'pawn') return true;
                }
            }

            for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                const r = row + dr;
                const c = col + dc;
                const p = dentroDoTabuleiro(r, c) ? board[r][c] : null;
                if (p && p.color === byColor && p.type === 'knight') return true;
            }

            for (const [dr, dc, types] of [
                [1,0,['rook','queen']], [-1,0,['rook','queen']], [0,1,['rook','queen']], [0,-1,['rook','queen']],
                [1,1,['bishop','queen']], [1,-1,['bishop','queen']], [-1,1,['bishop','queen']], [-1,-1,['bishop','queen']]
            ]) {
                let r = row + dr;
                let c = col + dc;
                while (dentroDoTabuleiro(r, c)) {
                    const p = board[r][c];
                    if (p) {
                        if (p.color === byColor && types.includes(p.type)) return true;
                        break;
                    }
                    r += dr;
                    c += dc;
                }
            }

            for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
                const r = row + dr;
                const c = col + dc;
                const p = dentroDoTabuleiro(r, c) ? board[r][c] : null;
                if (p && p.color === byColor && p.type === 'king') return true;
            }

            return false;
        }

        function reiEstaEmXeque(board, color) {
            const king = encontrarRei(board, color);
            if (!king) return false;
            return quadradoAtacado(board, king.row, king.col, corOposta(color));
        }

        function adicionarMovimentoSeValido(moves, row, col, color, board = chessBoard, extra = {}) {
            if (!dentroDoTabuleiro(row, col)) return false;
            const destino = board[row][col];
            if (!destino) {
                moves.push({ row, col, capture: false, ...extra });
                return true;
            }
            if (destino.color !== color) moves.push({ row, col, capture: true, ...extra });
            return false;
        }

        function movimentosLinha(row, col, color, direcoes, board = chessBoard) {
            const moves = [];
            for (const [dr, dc] of direcoes) {
                let r = row + dr;
                let c = col + dc;
                while (dentroDoTabuleiro(r, c)) {
                    const continuar = adicionarMovimentoSeValido(moves, r, c, color, board);
                    if (!continuar) break;
                    r += dr;
                    c += dc;
                }
            }
            return moves;
        }

        function adicionarRoques(row, col, color, board, moves) {
            const king = board[row][col];
            if (!king || king.type !== 'king' || king.moved) return;
            if (reiEstaEmXeque(board, color)) return;

            const opponent = corOposta(color);

            const tryCastle = (side) => {
                const rookCol = side === 'king' ? 7 : 0;
                const rookToCol = side === 'king' ? 5 : 3;
                const kingToCol = side === 'king' ? 6 : 2;
                const emptyCols = side === 'king' ? [5, 6] : [1, 2, 3];
                const safeCols = side === 'king' ? [5, 6] : [3, 2];
                const rook = board[row][rookCol];

                if (!rook || rook.color !== color || rook.type !== 'rook' || rook.moved) return;
                if (emptyCols.some(c => board[row][c])) return;
                if (safeCols.some(c => quadradoAtacado(board, row, c, opponent))) return;

                moves.push({
                    row,
                    col: kingToCol,
                    capture: false,
                    castle: side,
                    rookFrom: { row, col: rookCol },
                    rookTo: { row, col: rookToCol }
                });
            };

            tryCastle('king');
            tryCastle('queen');
        }

        function calcularMovimentosBasicos(row, col, board = chessBoard, incluirRoque = true) {
            const peca = board[row]?.[col];
            if (!peca) return [];
            const { color, type } = peca;
            const moves = [];

            if (type === 'pawn') {
                const dir = color === 'white' ? -1 : 1;
                const startRow = color === 'white' ? 6 : 1;

                if (casaLivre(row + dir, col, board)) {
                    moves.push({ row: row + dir, col, capture: false });
                    if (row === startRow && casaLivre(row + dir * 2, col, board)) {
                        moves.push({ row: row + dir * 2, col, capture: false, doublePawn: true });
                    }
                }

                for (const dc of [-1, 1]) {
                    if (casaTemAdversario(row + dir, col + dc, color, board)) {
                        moves.push({ row: row + dir, col: col + dc, capture: true });
                    }
                }

                if (enPassantTarget && enPassantTarget.color !== color) {
                    if (row === enPassantTarget.pawnRow && Math.abs(col - enPassantTarget.pawnCol) === 1) {
                        const targetRow = row + dir;
                        if (targetRow === enPassantTarget.row && enPassantTarget.col === enPassantTarget.pawnCol) {
                            moves.push({
                                row: enPassantTarget.row,
                                col: enPassantTarget.col,
                                capture: true,
                                enPassant: true,
                                enPassantCapture: { row: enPassantTarget.pawnRow, col: enPassantTarget.pawnCol }
                            });
                        }
                    }
                }

                return moves;
            }

            if (type === 'rook') return movimentosLinha(row, col, color, [[1,0],[-1,0],[0,1],[0,-1]], board);
            if (type === 'bishop') return movimentosLinha(row, col, color, [[1,1],[1,-1],[-1,1],[-1,-1]], board);
            if (type === 'queen') return movimentosLinha(row, col, color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], board);

            if (type === 'knight') {
                for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                    adicionarMovimentoSeValido(moves, row + dr, col + dc, color, board);
                }
                return moves;
            }

            if (type === 'king') {
                for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
                    adicionarMovimentoSeValido(moves, row + dr, col + dc, color, board);
                }
                if (incluirRoque) adicionarRoques(row, col, color, board, moves);
                return moves;
            }

            return moves;
        }

        function aplicarMovimentoEmBoard(board, fromRow, fromCol, move, options = {}) {
            const peca = board[fromRow][fromCol];
            if (!peca) return board;

            board[move.row][move.col] = { ...peca, moved: true };
            board[fromRow][fromCol] = null;

            if (move.enPassant && move.enPassantCapture) {
                board[move.enPassantCapture.row][move.enPassantCapture.col] = null;
            }

            if (move.castle && move.rookFrom && move.rookTo) {
                const rook = board[move.rookFrom.row][move.rookFrom.col];
                if (rook) {
                    board[move.rookTo.row][move.rookTo.col] = { ...rook, moved: true };
                    board[move.rookFrom.row][move.rookFrom.col] = null;
                }
            }

            if (options.promotionType && peca.type === 'pawn' && (move.row === 0 || move.row === 7)) {
                board[move.row][move.col] = { color: peca.color, type: options.promotionType, moved: true };
            }

            return board;
        }

        function calcularMovimentosLegais(row, col, board = chessBoard) {
            const peca = board[row]?.[col];
            if (!peca) return [];
            const pseudo = calcularMovimentosBasicos(row, col, board, true);
            return pseudo.filter(move => {
                const temp = clonarTabuleiro(board);
                aplicarMovimentoEmBoard(temp, row, col, move);
                return !reiEstaEmXeque(temp, peca.color);
            });
        }

        function todosMovimentosLegais(color, board = chessBoard) {
            let moves = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.color === color) {
                        moves = moves.concat(calcularMovimentosLegais(r, c, board).map(m => ({ from: { row: r, col: c }, to: m })));
                    }
                }
            }
            return moves;
        }

        function avaliarEstadoDoJogo(mensagemBase = '') {
            const emXeque = reiEstaEmXeque(chessBoard, chessTurn);
            const movimentos = todosMovimentosLegais(chessTurn, chessBoard);
            if (movimentos.length === 0 && emXeque) {
                chessGameOver = true;
                return `Xeque-mate! ${nomeVencedor(corOposta(chessTurn))} venceram.`;
            }
            if (movimentos.length === 0 && !emXeque) {
                chessGameOver = true;
                return 'Empate por afogamento: o jogador da vez não tem movimento legal.';
            }
            if (emXeque) return `${mensagemBase ? mensagemBase + ' ' : ''}Xeque no rei das ${nomeCor(chessTurn)}.`;
            return mensagemBase || '';
        }


        function mostrarToastXadrez(texto, tipo = 'info') {
            const toast = document.getElementById('chess-toast');
            if (!toast) return;
            toast.textContent = texto;
            toast.className = 'chess-toast show';
            if (tipo === 'check') toast.style.borderColor = 'rgba(239,68,68,.75)';
            else if (tipo === 'mate') toast.style.borderColor = 'rgba(250,204,21,.85)';
            else toast.style.borderColor = 'rgba(56,189,248,.35)';
            clearTimeout(mostrarToastXadrez._t);
            mostrarToastXadrez._t = setTimeout(() => toast.classList.remove('show'), 3600);
        }

        function atualizarStatus(mensagemExtra = null) {
            const status = document.getElementById('chess-status');
            if (!status) return;

            status.classList.remove('chess-status-check', 'chess-status-mate', 'chess-status-draw');

            const textoEstado = avaliarEstadoDoJogo(mensagemExtra ?? lastMoveMessage);
            const textoFinal = chessGameOver
                ? textoEstado
                : `Vez das ${nomeCor(chessTurn)}.${textoEstado ? ' ' + textoEstado : ''}`;

            status.textContent = textoFinal;

            if (/Xeque-mate/i.test(textoFinal)) status.classList.add('chess-status-mate');
            else if (/Empate|afogamento/i.test(textoFinal)) status.classList.add('chess-status-draw');
            else if (/Xeque/i.test(textoFinal)) status.classList.add('chess-status-check');

            mostrarResultadoXadrezSeTerminou(textoEstado || textoFinal);

            const onlinePill = chessMode === 'online' ? ` <span class="chess-status-online-pill">ONLINE ${chessIsSpectator ? 'ESPECTADOR' : (chessPlayerColor === 'white' ? 'BRANCAS' : 'PRETAS')}</span>` : '';
            if (onlinePill) status.innerHTML = escapeHtmlXadrez(textoFinal) + onlinePill;

            const undo = document.getElementById('chess-undo-btn');
            if (undo) undo.disabled = chessMode === 'online' || undoStack.length === 0;
            atualizarPainelOnlineXadrez();
        }

        function renderHistorico() {
            const panel = document.getElementById('chess-history-panel');
            const list = document.getElementById('chess-history-list');
            const btn = document.getElementById('chess-history-toggle-btn');
            if (!list) return;

            if (panel) panel.classList.toggle('chess-history-collapsed', !chessHistoryPanelOpen);
            if (btn) btn.textContent = chessHistoryPanelOpen ? 'Ocultar jogadas' : 'Ver jogadas';

            if (!moveHistory.length) {
                list.innerHTML = '<div class="chess-history-empty">Nenhuma jogada ainda. Quando a partida começar, as jogadas aparecerão aqui.</div>';
                return;
            }

            const pares = [];
            for (let i = 0; i < moveHistory.length; i += 2) {
                const n = Math.floor(i / 2) + 1;
                const whiteMove = moveHistory[i] || '';
                const blackMove = moveHistory[i + 1] || '';
                pares.push(`
                    <div class="chess-history-row">
                        <span class="chess-history-move-no">${n}.</span>
                        <div class="chess-history-turns">
                            <span class="chess-history-white">⚪ ${escapeHtmlXadrez(whiteMove || 'Aguardando jogada das brancas...')}</span>
                            ${blackMove ? `<span class="chess-history-black">⚫ ${escapeHtmlXadrez(blackMove)}</span>` : '<span class="chess-history-black">⚫ Aguardando resposta das pretas...</span>'}
                        </div>
                    </div>
                `);
            }
            list.innerHTML = pares.slice(-40).join('');
            list.scrollTop = list.scrollHeight;
        }

        function atualizarCoordenadasXadrez() {
            const letras = chessBoardFlipped ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H'];
            const numeros = chessBoardFlipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
            document.querySelectorAll('#chess-screen .chess-coords-top span, #chess-screen .chess-coords-bottom span').forEach((el, i) => { el.textContent = letras[i] || ''; });
            document.querySelectorAll('#chess-screen .chess-coords-left span, #chess-screen .chess-coords-right span').forEach((el, i) => { el.textContent = numeros[i] || ''; });
            const btn = document.getElementById('chess-flip-btn');
            if (btn) btn.textContent = chessBoardFlipped ? 'Visão pretas' : 'Visão brancas';
        }

        function alternarVisaoTabuleiroXadrez() {
            chessBoardFlipped = !chessBoardFlipped;
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = chessBoardFlipped
                ? 'Tabuleiro virado: visão das pretas ativada.'
                : 'Tabuleiro normal: visão das brancas ativada.';
            renderChessBoard();
            mostrarToastXadrez(chessBoardFlipped ? '🔄 Visão das pretas ativada.' : '🔄 Visão das brancas ativada.');
        }

        function renderChessBoard() {
            const boardEl = document.getElementById('chess-board');
            if (!boardEl) return;
            document.body.classList.toggle('chess-mode-online', chessMode === 'online');
            document.body.classList.toggle('chess-mode-training', chessMode === 'training');
            const freezeOnlineViewport = chessMode === 'online' && document.body.classList.contains('chess-board-visible') && window.__chessRemoteApplyingXadrez30 === true;
            const savedOnlineScrollY = freezeOnlineViewport ? window.scrollY : null;
            const boardRectBefore = boardEl.getBoundingClientRect();
            const shouldKeepBoardStill = chessMode !== 'online' && !freezeOnlineViewport && document.body.classList.contains('chess-selected') && boardRectBefore.top > -80 && boardRectBefore.top < window.innerHeight;
            garantirTabuleiroXadrezPronto('Tabuleiro restaurado automaticamente. Entre em uma sala nova ou clique em Nova Partida se a sala antiga estava vazia.');
            boardEl.innerHTML = '';
            boardEl.style.display = 'grid';
            boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
            boardEl.style.gridTemplateRows = 'repeat(8, 1fr)';
            boardEl.style.width = '100%';
            boardEl.style.aspectRatio = '1 / 1';
            const reiEmXeque = reiEstaEmXeque(chessBoard, chessTurn);
            const kingPos = reiEmXeque ? encontrarRei(chessBoard, chessTurn) : null;

            atualizarCoordenadasXadrez();

            for (let displayRow = 0; displayRow < 8; displayRow++) {
                for (let displayCol = 0; displayCol < 8; displayCol++) {
                    const row = chessBoardFlipped ? 7 - displayRow : displayRow;
                    const col = chessBoardFlipped ? 7 - displayCol : displayCol;
                    const square = document.createElement('div');
                    square.className = `chess-square ${(row + col) % 2 === 0 ? 'chess-light' : 'chess-dark'}`;
                    square.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863';
                    square.style.minWidth = '0';
                    square.style.minHeight = '0';
                    square.dataset.row = String(row);
                    square.dataset.col = String(col);
                    square.setAttribute('role', 'button');
                    square.setAttribute('aria-label', `Casa ${alg(row, col)}`);

                    const mostrarAjudasVisuaisXadrez = chessMode === 'training';
                    const mostrarProfessorAprenderXadrez = chessMode === 'training' && chessTrainingLearnMode;

                    if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) square.classList.add('selected');
                    if (mostrarProfessorAprenderXadrez && chessLearnExampleMove && chessLearnExampleMove.from && chessLearnExampleMove.from.row === row && chessLearnExampleMove.from.col === col) square.classList.add('learn-example-from');
                    if (mostrarProfessorAprenderXadrez && chessLearnExampleMove && chessLearnExampleMove.to && chessLearnExampleMove.to.row === row && chessLearnExampleMove.to.col === col) square.classList.add('learn-example-to');
                    if (mostrarAjudasVisuaisXadrez && lastChessMove && lastChessMove.from.row === row && lastChessMove.from.col === col) square.classList.add('last-from');
                    if (mostrarAjudasVisuaisXadrez && lastChessMove && lastChessMove.to.row === row && lastChessMove.to.col === col) square.classList.add('last-to');
                    if (mostrarAjudasVisuaisXadrez && kingPos && kingPos.row === row && kingPos.col === col) square.classList.add('check');

                    const move = legalMoves.find(m => m.row === row && m.col === col);
                    if (move && mostrarAjudasVisuaisXadrez) {
                        square.classList.add(move.capture ? 'capture' : 'legal');
                        if (move.castle) square.classList.add('castle');
                        if (move.enPassant) square.classList.add('en-passant');
                    }

                    const peca = chessBoard[row]?.[col] || null;
                    if (pecaXadrezValida(peca)) {
                        const span = document.createElement('span');
                        span.className = `chess-piece ${peca.color}`;
                        span.style.fontSize = 'clamp(2rem, 8vw, 3.7rem)';
                        span.style.lineHeight = '1';
                        span.style.position = 'relative';
                        span.style.zIndex = '2';
                        span.style.color = peca.color === 'white' ? '#ffffff' : '#111827';
                        span.dataset.name = nomePeca[peca.type] || '';
                        span.title = `${nomePeca[peca.type] || 'Peça'} ${peca.color === 'white' ? 'branca' : 'preta'}`;
                        span.textContent = pecasUnicode[peca.color]?.[peca.type] || '';
                        square.appendChild(span);
                    }

                    square.addEventListener('click', () => handleChessSquareClick(row, col));
                    boardEl.appendChild(square);
                }
            }
            renderHistorico();
            renderizarPlacarMaterialXadrez();
            atualizarStatus();
            if (freezeOnlineViewport) {
                requestAnimationFrame(() => {
                    if (typeof savedOnlineScrollY === 'number' && Math.abs(window.scrollY - savedOnlineScrollY) > 1) {
                        window.scrollTo({ top: savedOnlineScrollY, behavior: 'auto' });
                    }
                });
            } else if (shouldKeepBoardStill) {
                requestAnimationFrame(() => {
                    const boardRectAfter = boardEl.getBoundingClientRect();
                    const diff = boardRectAfter.top - boardRectBefore.top;
                    if (Math.abs(diff) > 1 && Math.abs(diff) < window.innerHeight) {
                        window.scrollTo({ top: window.scrollY + diff, behavior: 'auto' });
                    }
                });
            }
        }


        function estadoXadrezParaFirebase() {
            return {
                board: serializarTabuleiroXadrezParaFirebase(chessBoard),
                turn: chessTurn,
                gameOver: chessGameOver,
                lastMoveMessage,
                lastChessMove,
                enPassantTarget,
                moveHistory,
                updatedAt: Date.now()
            };
        }

        async function publicarEstadoXadrezOnline(extra = {}) {
            if (chessMode !== 'online' || !chessRoomRef || chessOnlineSyncing) return;
            try {
                await update(chessRoomRef, { ...estadoXadrezParaFirebase(), ...extra });
            } catch (e) {
                console.warn('Erro ao sincronizar Xadrez online:', e);
                mostrarToastXadrez('⚠️ Não consegui sincronizar a jogada online.', 'check');
            }
        }

        function aplicarEstadoXadrezRemoto(data) {
            if (!data) return;
            chessCurrentRoomData = data || {};
            chessOnlineSyncing = true;
            chessRoomPlayers = data.players && typeof data.players === 'object' ? data.players : { white: null, black: null };
            chessRoomSpectators = data.spectators && typeof data.spectators === 'object' ? data.spectators : {};

            const remotoLimpo = clonarTabuleiro(data.board);
            if (remotoLimpo && !tabuleiroXadrezPrecisaRestaurar(remotoLimpo)) {
                chessBoard = remotoLimpo;
            } else {
                criarTabuleiroInicial();
                lastMoveMessage = 'A sala online estava sem peças ou sem tabuleiro válido. O Xadrez restaurou a posição inicial automaticamente.';
                if (chessRoomRef) {
                    setTimeout(() => {
                        try {
                            update(chessRoomRef, { ...estadoXadrezParaFirebase(), repairedAt: Date.now() });
                        } catch (e) {
                            console.warn('Não consegui reparar a sala online no Firebase:', e);
                        }
                    }, 80);
                }
            }

            chessTurn = data.turn === 'black' ? 'black' : 'white';
            chessGameOver = !!data.gameOver;
            if (data.lastMoveMessage) lastMoveMessage = data.lastMoveMessage;
            lastChessMove = data.lastChessMove || null;
            enPassantTarget = data.enPassantTarget || null;
            moveHistory = Array.isArray(data.moveHistory) ? data.moveHistory : [];
            selectedSquare = null;
            legalMoves = [];
            verificarAlertaDeVezXadrez(data);
            renderChessBoard();
            chessOnlineSyncing = false;
        }

        async function garantirAuthXadrezOnline() {
            try {
                if (typeof auth !== 'undefined' && auth.currentUser) {
                    playerId = auth.currentUser.uid;
                    return true;
                }

                if (typeof signInAnonymously === 'function' && typeof auth !== 'undefined') {
                    const cred = await signInAnonymously(auth);
                    playerId = cred?.user?.uid || auth.currentUser?.uid || playerId;
                    return !!playerId;
                }
            } catch (e) {
                console.warn('Auth do Xadrez online ainda não disponível:', e);
            }

            return !!getChessUid();
        }



        /* ✅ FASE 36.12 - FUNÇÕES DIRETAS: controles online dentro do tabuleiro real */
        function controlesOnlineXadrezAtivos3612() {
            return chessMode === 'online' && !!chessRoomId && document.body.classList.contains('chess-board-visible') && !chessIsSpectator;
        }

        function garantirControlesOnlineNoTabuleiro3612(forcarOnline = false) {
            const online = !!forcarOnline || controlesOnlineXadrezAtivos3612();
            document.body.classList.toggle('chess-online-active-3612', online);

            const actions = document.querySelector('#chess-screen .chess-actions');
            const back = document.getElementById('chess-back-btn-bottom');
            if (actions) {
                let sair = document.getElementById('chess-board-leave-online-btn');
                if (!sair) {
                    sair = document.createElement('button');
                    sair.id = 'chess-board-leave-online-btn';
                    sair.className = 'btn-chess-leave-online-board';
                    sair.type = 'button';
                    sair.textContent = 'Sair da sala';
                }
                if (sair.parentNode !== actions) {
                    if (back && back.parentNode === actions) actions.insertBefore(sair, back);
                    else actions.appendChild(sair);
                }
                sair.disabled = !online;
                sair.style.setProperty('display', online ? 'block' : 'none', 'important');
                sair.style.setProperty('visibility', online ? 'visible' : 'hidden', 'important');
                sair.style.setProperty('opacity', online ? '1' : '0', 'important');
            }

            const callPanel = document.getElementById('chess-call-panel');
            const chatPanel = document.getElementById('chess-chat-panel');
            if (callPanel && actions) {
                const parent = actions.parentNode;
                if (parent) {
                    if (chatPanel && chatPanel.parentNode === parent) parent.insertBefore(callPanel, chatPanel);
                    else if (callPanel.previousElementSibling !== actions) actions.insertAdjacentElement('afterend', callPanel);
                }
                callPanel.classList.remove('fase36-call-panel', 'fase36-call-open', 'fase35-call-panel', 'fase35-call-open', 'fase34-call-closed');
                if (!callPanel.classList.contains('call-active')) callPanel.classList.add('call-compact');
                ['left','right','top','bottom','transform','position','zIndex','width','maxWidth'].forEach((prop) => {
                    try { callPanel.style[prop] = ''; } catch (_) {}
                });
                const title = callPanel.querySelector('.chess-call-title');
                if (title) title.textContent = '📹 Câmera e áudio';
                const status = document.getElementById('chess-call-status');
                if (status && !callPanel.classList.contains('call-active')) status.textContent = 'Fica abaixo do tabuleiro e não cobre as peças.';
                const toggle = document.getElementById('chess-call-toggle-btn');
                if (toggle) {
                    toggle.style.display = '';
                    toggle.textContent = callPanel.classList.contains('call-compact') && !callPanel.classList.contains('call-active') ? '+' : '−';
                }
                callPanel.style.setProperty('display', online ? 'block' : 'none', 'important');
                callPanel.style.setProperty('visibility', online ? 'visible' : 'hidden', 'important');
                callPanel.style.setProperty('opacity', online ? '1' : '0', 'important');
            }
        }

        async function entrarXadrezOnline(assistir = false) {
            instalarUiXadrezFase5();

            const nameInput = document.getElementById('chess-online-name');
            const roomInput = document.getElementById('chess-online-room');

            chessPlayerName = normalizarCampoXadrez(nameInput?.value) || normalizarCampoXadrez(document.getElementById('name-input')?.value) || 'Jogador';
            chessRoomId = normalizarSalaXadrez(roomInput?.value) || 'xadrez';

            if (nameInput) nameInput.value = chessPlayerName;
            if (roomInput) roomInput.value = chessRoomId;

            try {
                atualizarStatusOnlineXadrez('Conectando ao Xadrez online...');

                await garantirAuthXadrezOnline();
                const uid = getChessUid();
                if (!uid) throw new Error('Não consegui gerar o ID do jogador.');

                // Sai de qualquer escuta antiga antes de entrar em uma nova sala.
                sairXadrezOnline(false);

                chessMode = 'online';
                chessIsSpectator = assistir;
                chessPlayerColor = 'spectator';
                chessOnlineReady = false;
                chessRoomRef = ref(db, `chessRooms/${chessRoomId}`);
                chessLastRemoteMoveCount = 0;
                chessLastTurnAlertKey = '';

                const agora = Date.now();
                const snap = await get(chessRoomRef);
                let sala = snap.exists() && snap.val() && typeof snap.val() === 'object' ? snap.val() : {};

                sala.createdAt = sala.createdAt || agora;
                sala.updatedAt = agora;
                sala.mode = 'xadrez';

                // Se a sala antiga veio vazia, corrompida, com peça quebrada ou sem reis, restaura forte.
                const boardLimpoDaSala = clonarTabuleiro(sala.board);
                if (!boardLimpoDaSala || tabuleiroXadrezPrecisaRestaurar(boardLimpoDaSala)) {
                    criarTabuleiroInicial();
                    const estado = estadoXadrezParaFirebase();
                    sala.board = estado.board;
                    sala.turn = estado.turn;
                    sala.gameOver = false;
                    sala.lastMoveMessage = 'Sala criada/restaurada com o tabuleiro inicial do Xadrez. Fase 12 online ativa.';
                    sala.lastChessMove = null;
                    sala.enPassantTarget = null;
                    sala.moveHistory = [];
                    sala.repairedAt = agora;
                } else {
                    sala.board = boardLimpoDaSala;
                }

                sala.players = sala.players && typeof sala.players === 'object' ? sala.players : {};
                sala.spectators = sala.spectators && typeof sala.spectators === 'object' ? sala.spectators : {};

                if (sala.isAuthorized === false && !(await usuarioEhAdminSeguro())) {
                    chessMode = 'local';
                    chessRoomRef = null;
                    chessOnlineReady = false;
                    atualizarPainelOnlineXadrez();
                    mostrarToastXadrez('🛡️ Esta sala de Xadrez está bloqueada pelo administrador.', 'check');
                    return;
                }

                // Limpa o próprio usuário de posições antigas dentro da mesma sala.
                if (sala.players.white?.id === uid) delete sala.players.white;
                if (sala.players.black?.id === uid) delete sala.players.black;
                if (sala.spectators[uid]) delete sala.spectators[uid];

                if (assistir) {
                    chessPlayerColor = 'spectator';
                    chessIsSpectator = true;
                    sala.spectators[uid] = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else if (!sala.players.white || !sala.players.white.id) {
                    chessPlayerColor = 'white';
                    chessIsSpectator = false;
                    sala.players.white = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else if (!sala.players.black || !sala.players.black.id) {
                    chessPlayerColor = 'black';
                    chessIsSpectator = false;
                    sala.players.black = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else {
                    chessPlayerColor = 'spectator';
                    chessIsSpectator = true;
                    sala.spectators[uid] = { id: uid, name: chessPlayerName, connectedAt: agora };
                    mostrarToastXadrez('👀 Sala cheia. Você entrou como espectador.');
                }

                if (chessPlayerColor === 'black') chessBoardFlipped = true;
                else if (chessPlayerColor === 'white') chessBoardFlipped = false;
                atualizarCoordenadasXadrez();

                chessRoomPlayers = sala.players;
                chessRoomSpectators = sala.spectators;
                if (!sala.lastMoveMessage || /^Fase 5/i.test(String(sala.lastMoveMessage))) {
                    sala.lastMoveMessage = 'Fase 12 ativa: sala online com painel Admin próprio, controle de salas, desistência, visão das pretas, alerta de vez, chat, histórico e placar.';
                }

                await set(chessRoomRef, sala);

                try {
                    if (chessPlayerColor === 'white' || chessPlayerColor === 'black') {
                        onDisconnect(ref(db, `chessRooms/${chessRoomId}/players/${chessPlayerColor}`)).remove();
                    } else {
                        onDisconnect(ref(db, `chessRooms/${chessRoomId}/spectators/${uid}`)).remove();
                    }
                } catch (presenceError) {
                    console.warn('Presença online do Xadrez não registrada:', presenceError);
                }

                chessUnsubscribeRoom = onValue(chessRoomRef, (snapshot) => {
                    const data = snapshot.val() || {};
                    aplicarEstadoXadrezRemoto(data);
                    atualizarPainelOnlineXadrez();
                    atualizarPainelChamadaXadrez();
                    setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 0);
                });

                iniciarChatXadrezOnline();
                chessOnlineReady = true;
                atualizarPainelOnlineXadrez();
                atualizarPainelChamadaXadrez();
                if (!chessIsSpectator) escutarSinalizacaoChamadaXadrez();
                mostrarToastXadrez(`🌐 Conectado na sala ${chessRoomId}. Você está como ${chessIsSpectator ? 'espectador' : nomeCor(chessPlayerColor)}.`);
                mostrarTabuleiroXadrezAposEscolha();
                garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator);
                setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 120);
                setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 700);
                focarTabuleiroXadrez(true);
            } catch (e) {
                console.error('Erro detalhado ao entrar no Xadrez online:', e);
                chessMode = 'local';
                chessRoomRef = null;
                chessOnlineReady = false;
                chessIsSpectator = false;
                chessPlayerColor = 'white';
                atualizarPainelOnlineXadrez();
                const detalheErroXadrez = e?.code || e?.message || 'erro desconhecido';
                mostrarToastXadrez(`⚠️ Erro ao entrar no Xadrez online: ${detalheErroXadrez}`, 'check');
            }
        }

        function sairXadrezOnline(mostrarMensagem = true) {
            try { encerrarChamadaXadrez(false); } catch (_) {}
            try {
                if (chessUnsubscribeRoom) chessUnsubscribeRoom();
                if (chessUnsubscribeChat) chessUnsubscribeChat();
                chessUnsubscribeRoom = null;
                chessUnsubscribeChat = null;
                const uid = getChessUid();
                if (chessRoomId && chessMode === 'online') {
                    if (chessPlayerColor === 'white' || chessPlayerColor === 'black') remove(ref(db, `chessRooms/${chessRoomId}/players/${chessPlayerColor}`));
                    if (chessIsSpectator) remove(ref(db, `chessRooms/${chessRoomId}/spectators/${uid}`));
                }
            } catch (e) { console.warn('Erro ao sair do Xadrez online:', e); }
            chessMode = 'local';
            chessRoomRef = null;
            chessOnlineReady = false;
            chessIsSpectator = false;
            chessPlayerColor = 'white';
            chessRoomPlayers = { white: null, black: null };
            chessRoomSpectators = {};
            chessLastRemoteMoveCount = 0;
            chessLastTurnAlertKey = '';
            atualizarPainelOnlineXadrez();
            atualizarPainelChamadaXadrez();
            if (mostrarMensagem) {
                ocultarTabuleiroXadrezParaMenu();
                mostrarToastXadrez('Modo local ativado. Você saiu da sala online. Escolha um modo para abrir o tabuleiro novamente.');
            }
        }

        function iniciarChatXadrezOnline() {
            const box = document.getElementById('chess-chat-messages');
            if (!box || !chessRoomId) return;
            if (chessUnsubscribeChat) chessUnsubscribeChat();
            chessUnsubscribeChat = onValue(ref(db, `chessRooms/${chessRoomId}/chat`), (snap) => {
                const data = snap.val() || {};
                const msgs = Object.values(data).sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-60);
                if (!msgs.length) {
                    box.innerHTML = '<div class="chess-chat-row"><strong>Sistema:</strong> Nenhuma mensagem ainda.</div>';
                    return;
                }
                box.innerHTML = msgs.map(m => `<div class="chess-chat-row"><strong>${escapeHtmlXadrez(m.name || 'Jogador')}:</strong> ${escapeHtmlXadrez(m.text || '')}</div>`).join('');
                box.scrollTop = box.scrollHeight;
            });
        }

        async function enviarChatXadrezOnline() {
            const input = document.getElementById('chess-chat-input');
            if (!input || chessMode !== 'online' || !chessRoomId) return;
            const text = input.value.trim();
            if (!text) return;
            if (chessCurrentRoomData && chessCurrentRoomData.chatBlocked) {
                mostrarToastXadrez('🔇 O chat desta sala foi travado pelo administrador.', 'check');
                return;
            }
            input.value = '';
            await push(ref(db, `chessRooms/${chessRoomId}/chat`), { name: chessPlayerName || 'Jogador', text, createdAt: Date.now() });
        }

        async function reiniciarXadrezOnlineOuLocal() {
            if (chessMode !== 'online') {
                resetChessGame();
                return;
            }
            if (chessIsSpectator) {
                mostrarToastXadrez('👀 Espectador não pode reiniciar a partida.', 'check');
                return;
            }
            criarTabuleiroInicial();
            await publicarEstadoXadrezOnline({ restartedBy: chessPlayerName || chessPlayerColor, restartedAt: Date.now() });
            await push(ref(db, `chessRooms/${chessRoomId}/chat`), { name: 'Sistema', text: `${chessPlayerName || 'Jogador'} reiniciou a partida.`, createdAt: Date.now() });
            renderChessBoard();
            mostrarToastXadrez('♟️ Partida online reiniciada.');
        }

        async function copiarSalaXadrez() {
            const roomInput = document.getElementById('chess-online-room');
            const sala = normalizarSalaXadrez(roomInput?.value) || chessRoomId || 'xadrez';
            const texto = `♟️ Convite para jogar Xadrez Arena

Entre no Tabuleiro Arena, escolha Xadrez Arena e use a sala: ${sala}

Link: ${location.origin}${location.pathname}`;
            try {
                await navigator.clipboard.writeText(texto);
                mostrarToastXadrez('📋 Código da sala copiado.');
            } catch (_) {
                mostrarToastXadrez(`Sala: ${sala}`);
            }
        }

        function escolherPromocao(color) {
            return new Promise(resolve => {
                const modal = document.getElementById('chess-promotion-modal');
                if (!modal) return resolve('queen');

                const botoes = modal.querySelectorAll('[data-piece]');
                botoes.forEach(btn => {
                    const type = btn.getAttribute('data-piece');
                    const symbol = pecasUnicode[color][type] || '';
                    btn.firstChild.textContent = symbol;
                });

                modal.style.display = 'flex';

                const onClick = (event) => {
                    const btn = event.target.closest('[data-piece]');
                    if (!btn) return;
                    const choice = btn.getAttribute('data-piece') || 'queen';
                    modal.style.display = 'none';
                    modal.removeEventListener('click', onClick);
                    resolve(choice);
                };

                modal.addEventListener('click', onClick);
            });
        }

        function textoPecaComCor(peca) {
            if (!peca) return 'peça';
            return `${nomePeca[peca.type]} ${peca.color === 'white' ? 'branco' : 'preto'}`;
        }

        function criarRegistroHistoricoXadrez(peca, fromRow, fromCol, move, capturedPiece = null, promotionType = null, estadoDepois = '') {
            const cor = peca.color === 'white' ? 'Brancas' : 'Pretas';
            const origem = alg(fromRow, fromCol);
            const destino = alg(move.row, move.col);
            let texto = `${cor}: ${nomePeca[peca.type]} ${origem} → ${destino}`;

            if (move.castle) {
                texto = `${cor}: Rei fez ${move.castle === 'king' ? 'roque pequeno' : 'roque grande'}`;
            } else if (capturedPiece) {
                texto = `${cor}: ${nomePeca[peca.type]} ${origem} capturou ${textoPecaComCor(capturedPiece)} em ${destino}`;
            } else if (move.enPassant) {
                texto = `${cor}: Peão ${origem} capturou en passant em ${destino}`;
            }

            if (promotionType) texto += ` e virou ${nomePeca[promotionType]}`;
            if (/Xeque-mate/i.test(estadoDepois)) texto += ' — xeque-mate!';
            else if (/Xeque/i.test(estadoDepois)) texto += ' — xeque!';
            else if (/Empate|afogamento/i.test(estadoDepois)) texto += ' — empate.';

            if (chessTrainingLearnMode && peca.color === chessHumanColor) {
                if (capturedPiece) texto += ' Boa captura: você ganhou material.';
                else if (peca.type === 'pawn') texto += ' Peões ajudam a abrir caminho para as peças.';
                else if (peca.type === 'knight' || peca.type === 'bishop') texto += ' Boa ideia: desenvolver Cavalo e Bispo ajuda no começo.';
                else if (peca.type === 'king' && move.castle) texto += ' Excelente: o roque ajuda a proteger o Rei.';
            }
            return texto;
        }

        function alternarHistoricoXadrez(forcar = null) {
            const panel = document.getElementById('chess-history-panel');
            const btn = document.getElementById('chess-history-toggle-btn');
            if (typeof forcar === 'boolean') chessHistoryPanelOpen = forcar;
            else chessHistoryPanelOpen = !chessHistoryPanelOpen;
            if (panel) panel.classList.toggle('chess-history-collapsed', !chessHistoryPanelOpen);
            if (btn) btn.textContent = chessHistoryPanelOpen ? 'Ocultar jogadas' : 'Ver jogadas';
            if (chessHistoryPanelOpen) renderHistorico();
        }

        function limparHistoricoVisualXadrez() {
            const list = document.getElementById('chess-history-list');
            if (list) list.innerHTML = '<div class="chess-history-empty">Histórico visual limpo. As jogadas continuam salvas na partida.</div>';
            mostrarToastXadrez('📜 Histórico visual limpo. A partida não foi alterada.');
        }

        function criarNotacao(peca, fromRow, fromCol, move, promotionType = null) {
            if (move.castle) return move.castle === 'king' ? 'O-O' : 'O-O-O';
            const prefix = peca.type === 'pawn' ? '' : nomePeca[peca.type][0];
            const capture = move.capture ? 'x' : '-';
            const promo = promotionType ? `=${nomePeca[promotionType]}` : '';
            const ep = move.enPassant ? ' e.p.' : '';
            return `${prefix}${alg(fromRow, fromCol)}${capture}${alg(move.row, move.col)}${promo}${ep}`;
        }


        async function desistirXadrez() {
            if (chessGameOver) {
                mostrarToastXadrez('A partida já terminou.', 'check');
                return;
            }
            if (chessMode === 'online' && chessIsSpectator) {
                mostrarToastXadrez('👀 Espectador não pode desistir pela partida.', 'check');
                return;
            }

            const corDesistente = chessMode === 'online' ? chessPlayerColor : chessTurn;
            if (corDesistente !== 'white' && corDesistente !== 'black') {
                mostrarToastXadrez('Não foi possível identificar o jogador para desistir.', 'check');
                return;
            }

            exibirConfirmacao('Desistir da partida?', `Você está prestes a desistir.<br><br>As <strong>${nomeVencedor(corOposta(corDesistente))}</strong> vencerão por desistência.`, async () => {
                const vencedor = corOposta(corDesistente);
                chessGameOver = true;
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = `${chessPlayerName || nomeVencedor(corDesistente)} desistiu. ${nomeVencedor(vencedor)} venceram por desistência.`;
                moveHistory.push(`${nomeVencedor(corDesistente)} desistiram`);
                renderChessBoard();
                mostrarToastXadrez(`🏳️ ${lastMoveMessage}`, 'mate');

                await publicarEstadoXadrezOnline({
                    winner: vencedor,
                    resignedBy: {
                        color: corDesistente,
                        name: chessPlayerName || nomeVencedor(corDesistente),
                        at: Date.now()
                    }
                });
            });
            return;
        }

        async function executarMovimentoXadrez(fromRow, fromCol, move) {
            if (chessGameOver) return;
            const peca = chessBoard[fromRow][fromCol];
            if (!peca) return;

            salvarEstadoParaDesfazer();

            let promotionType = null;
            if (peca.type === 'pawn' && (move.row === 0 || move.row === 7)) {
                promotionType = (chessMode === 'training' && peca.color !== chessHumanColor) ? 'queen' : await escolherPromocao(peca.color);
            }

            const previousEnPassant = enPassantTarget;
            const capturedPiece = move.enPassant
                ? (chessBoard[fromRow] ? chessBoard[fromRow][move.col] : null)
                : (chessBoard[move.row] ? chessBoard[move.row][move.col] : null);
            aplicarMovimentoEmBoard(chessBoard, fromRow, fromCol, move, { promotionType });

            lastChessMove = { from: { row: fromRow, col: fromCol }, to: { row: move.row, col: move.col } };

            enPassantTarget = null;
            if (peca.type === 'pawn' && move.doublePawn) {
                const dir = peca.color === 'white' ? -1 : 1;
                enPassantTarget = {
                    row: fromRow + dir,
                    col: fromCol,
                    pawnRow: move.row,
                    pawnCol: move.col,
                    color: peca.color
                };
            }

            const notation = criarNotacao(peca, fromRow, fromCol, move, promotionType);
            const moverColor = peca.color;

            selectedSquare = null;
            legalMoves = [];
            chessLearnExampleMove = null;
            chessTurn = corOposta(chessTurn);

            let msg = `${nomePeca[peca.type]} ${alg(fromRow, fromCol)} para ${alg(move.row, move.col)}.`;
            if (move.castle) msg = move.castle === 'king' ? 'Roque pequeno realizado.' : 'Roque grande realizado.';
            if (move.enPassant) msg = 'Captura en passant realizada.';
            if (promotionType) msg = `Peão promovido para ${nomePeca[promotionType]}.`;
            lastMoveMessage = msg;

            renderChessBoard();
            const estado = avaliarEstadoDoJogo(msg);
            moveHistory.push(criarRegistroHistoricoXadrez(peca, fromRow, fromCol, move, capturedPiece, promotionType, estado) || notation);
            registrarConquistasPorJogadaXadrez(peca, move, capturedPiece, estado);
            renderHistorico();
            atualizarStatus();
            reforcarProfessorXequeXadrez(estado);
            if (moverColor === chessHumanColor) feedbackProfessorDepoisDaJogada(peca, fromRow, fromCol, move, estado);
            if (/Xeque-mate/i.test(estado)) mostrarToastXadrez('♟️ XEQUE-MATE! ' + estado, 'mate');
            else if (/Xeque/i.test(estado)) {
                mostrarToastXadrez('⚠️ XEQUE! ' + estado, 'check');
            }
            else if (/Empate|afogamento/i.test(estado)) mostrarToastXadrez('🤝 ' + estado, 'mate');
            else mostrarToastXadrez('✅ ' + msg);

            await publicarEstadoXadrezOnline();

            if (chessMode === 'training' && !chessGameOver && chessTurn === 'black') {
                setTimeout(() => executarJogadaMaquinaXadrez(), 260);
            } else if (chessMode === 'training') {
                atualizarPainelTreinoXadrez();
            }
        }

        async function handleChessSquareClick(row, col) {
            if (chessGameOver) return;
            if (chessMode === 'online') {
                if (chessIsSpectator) {
                    mostrarToastXadrez('👀 Espectador apenas assiste a partida.', 'check');
                    return;
                }
                if (chessPlayerColor !== chessTurn) {
                    mostrarToastXadrez(`Aguarde. Agora é a vez das ${nomeCor(chessTurn)}.`, 'check');
                    return;
                }
            }
            if (chessMode === 'training') {
                if (chessAiThinking || chessTurn !== chessHumanColor) {
                    mostrarToastXadrez('🤖 Aguarde a máquina fazer a jogada dela.', 'check');
                    return;
                }
            }

            const peca = chessBoard[row][col];

            // ✅ FASE 13.6: captura corrigida.
            // Antes o treino bloqueava o clique em peça preta antes de verificar se ela era uma captura legal.
            // Agora, se uma peça já está selecionada, primeiro tenta executar a jogada marcada.
            if (selectedSquare) {
                const move = legalMoves.find(m => m.row === row && m.col === col);
                if (move) {
                    await executarMovimentoXadrez(selectedSquare.row, selectedSquare.col, move);
                    return;
                }

                if (peca && peca.color !== chessTurn) {
                    lastMoveMessage = chessTrainingLearnMode
                        ? 'Essa peça só pode ser capturada quando estiver marcada em vermelho. Clique primeiro na sua peça branca e depois na marca vermelha.'
                        : 'Essa captura não é permitida para a peça escolhida.';
                    mostrarToastXadrez(lastMoveMessage, 'check');
                    selectedSquare = null;
                    legalMoves = [];
                    renderChessBoard();
                    return;
                }
            }

            if (chessMode === 'training' && peca && peca.color !== chessHumanColor) {
                mostrarToastXadrez('No treino você joga com as brancas. As pretas são da máquina. Para comer uma preta, selecione uma peça branca e clique na marca vermelha.', 'check');
                selectedSquare = null;
                legalMoves = [];
                renderChessBoard();
                return;
            }

            if (chessMode === 'online' && peca && peca.color !== chessPlayerColor) {
                mostrarToastXadrez(`Você está com as ${nomeCor(chessPlayerColor)}. Para capturar, selecione sua peça primeiro e clique na casa da captura.`, 'check');
                selectedSquare = null;
                legalMoves = [];
                renderChessBoard();
                return;
            }

            if (!peca) {
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = chessTrainingLearnMode
                    ? 'Clique em uma peça branca primeiro. Depois clique numa bolinha verde para andar ou numa marca vermelha para capturar.'
                    : 'Escolha uma peça da sua cor.';
                atualizarProfessorXadrez(lastMoveMessage, null);
                renderChessBoard();
                return;
            }

            if (peca.color !== chessTurn) {
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = `Agora é a vez das ${nomeCor(chessTurn)}.`;
                renderChessBoard();
                return;
            }

            selectedSquare = { row, col };
            legalMoves = calcularMovimentosLegais(row, col, chessBoard);
            const capturas = legalMoves.filter(m => m.capture).length;
            const movimentos = legalMoves.length - capturas;
            const dicaProfessor = chessTrainingLearnMode ? dicaSelecaoPecaXadrez(peca, row, col, legalMoves) : null;
            lastMoveMessage = legalMoves.length
                ? (chessTrainingLearnMode
                    ? `${nomePeca[peca.type]} selecionado em ${alg(row, col)}. Verde = andar (${movimentos}). Vermelho = capturar (${capturas}). Clique direto na marca para jogar.`
                    : `Peça selecionada. Escolha a casa de destino para jogar.`)
                : 'Essa peça não tem movimento legal agora.';
            atualizarProfessorXadrez(dicaProfessor?.texto || '', dicaProfessor?.exemplo || null);
            renderChessBoard();
        }

        function focarTabuleiroXadrez(modoFoco = true) {
            const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
            if (modoFoco) document.body.classList.add('chess-focus-mode');
            if (boardWrap) {
                setTimeout(() => {
                    try { boardWrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    catch (_) { boardWrap.scrollIntoView(); }
                }, 120);
            }
            const btn = document.getElementById('chess-focus-btn');
            if (btn) btn.textContent = document.body.classList.contains('chess-focus-mode') ? 'Modo normal' : 'Foco no tabuleiro';
        }

        function alternarFocoTabuleiroXadrez() {
            const ativo = document.body.classList.toggle('chess-focus-mode');
            const btn = document.getElementById('chess-focus-btn');
            if (btn) btn.textContent = ativo ? 'Modo normal' : 'Foco no tabuleiro';
            focarTabuleiroXadrez(false);
        }

        function abrirXadrezArena() {
            // ✅ FASE 13.4: garante que o Xadrez comum nunca herde o modo Admin.
            // Isso evita tela vazia/travada depois de sair da administração do Xadrez.
            document.body.classList.remove('platform-start-active', 'mode-selecting', 'game-selected', 'chess-admin-only', 'chess-focus-mode', 'chess-board-visible', 'chess-game-active');
            document.body.classList.add('chess-selected', 'chess-menu-active');

            const hub = document.getElementById('games-hub-panel');
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');
            const chess = document.getElementById('chess-screen');

            if (hub) hub.style.display = 'none';
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            if (chess) chess.style.display = 'block';

            instalarUiXadrezFase5();
            if (!chessBoard.length) criarTabuleiroInicial();
            ocultarTabuleiroXadrezParaMenu();
            renderChessBoard();
            renderRankingTreinoXadrez();
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        function voltarParaModalidades() {
            try { encerrarChamadaXadrez(false); } catch (_) {}
            // ✅ FASE 13.4: remove também o modo Admin do Xadrez ao voltar para o hub.
            document.body.classList.remove('chess-selected', 'game-selected', 'chess-focus-mode', 'chess-admin-only', 'chess-beginner-mode', 'chess-board-visible', 'chess-menu-active', 'chess-game-active', 'chess-mode-online', 'chess-mode-training');
            document.body.classList.add('platform-start-active', 'mode-selecting');

            const hub = document.getElementById('games-hub-panel');
            const chess = document.getElementById('chess-screen');
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');

            if (hub) hub.style.display = 'block';
            if (chess) chess.style.display = 'none';
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function resetChessGame() {
            const manterTreino = chessMode === 'training';
            criarTabuleiroInicial();
            limparResultadoXadrez();
            if (manterTreino) {
                chessMode = 'training';
                chessTrainingActive = true;
                lastMoveMessage = `Modo Treino reiniciado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas.`;
            }
            renderChessBoard();
            atualizarPainelTreinoXadrez();
            renderRankingTreinoXadrez();
            mostrarToastXadrez(manterTreino ? '🤖 Treino reiniciado. Brancas começam.' : '♟️ Nova partida de Xadrez iniciada. Brancas começam.');
        }


        function tabuleiroInicialXadrezAdminSerializado() {
            const p = (color, type) => ({ color, type, moved: false });
            const vazio = () => Array(8).fill('');
            return [
                [p('black','rook'), p('black','knight'), p('black','bishop'), p('black','queen'), p('black','king'), p('black','bishop'), p('black','knight'), p('black','rook')],
                Array.from({ length: 8 }, () => p('black','pawn')),
                vazio(), vazio(), vazio(), vazio(),
                Array.from({ length: 8 }, () => p('white','pawn')),
                [p('white','rook'), p('white','knight'), p('white','bishop'), p('white','queen'), p('white','king'), p('white','bishop'), p('white','knight'), p('white','rook')]
            ];
        }

        function estadoInicialSalaXadrezAdmin(salaId) {
            return {
                id: salaId,
                mode: 'xadrez',
                board: tabuleiroInicialXadrezAdminSerializado(),
                turn: 'white',
                gameOver: false,
                lastMoveMessage: 'Fase 12 ativa: sala de Xadrez criada pelo painel Admin.',
                lastChessMove: null,
                enPassantTarget: null,
                moveHistory: [],
                players: {},
                spectators: {},
                chat: null,
                isAuthorized: true,
                chatBlocked: false,
                createdByAdminUid: getChessUid() || (auth.currentUser ? auth.currentUser.uid : ''),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastAdminAction: 'criada_pelo_admin_xadrez',
                lastAdminAt: Date.now()
            };
        }

        function instalarPainelAdminXadrez() {
            instalarUiXadrezFase5();
            const card = document.querySelector('#chess-screen .chess-card');
            if (!card) return;

            if (!document.getElementById('chess-admin-style')) {
                const style = document.createElement('style');
                style.id = 'chess-admin-style';
                style.textContent = `
                    .chess-admin-panel { display:none; background:linear-gradient(135deg,#1e1233,#0f172a); border:2px dashed #c084fc; border-radius:14px; padding:14px; margin:14px 0; text-align:left; box-shadow:0 10px 28px rgba(0,0,0,.45); }
                    .chess-admin-title { color:#d8b4fe; font-size:.95rem; font-weight:1000; text-transform:uppercase; margin-bottom:7px; border-bottom:1px solid rgba(216,180,254,.45); padding-bottom:6px; }
                    .chess-admin-desc { color:#cbd5e1; font-size:.78rem; line-height:1.35; margin-bottom:10px; }
                    .chess-admin-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
                    .chess-admin-grid button { padding:10px 7px; font-size:.72rem; text-transform:none; border-radius:8px; }
                    .chess-admin-panel input { margin:0 0 10px 0; text-align:left; border:1px solid #4c1d95; background:#020617; }
                    .chess-admin-list, .chess-admin-chat-monitor { background:#020617; border:1px solid #312e81; border-radius:10px; padding:10px; max-height:240px; overflow-y:auto; font-size:.78rem; color:#e2e8f0; margin-top:10px; }
                    .chess-admin-room-row { padding:9px; border-radius:8px; background:#111827; margin-bottom:7px; border-left:4px solid #22c55e; cursor:pointer; display:flex; justify-content:space-between; gap:8px; }
                    .chess-admin-room-row.blocked { border-left-color:#ef4444; }
                    .chess-admin-room-row:hover { background:#172554; }
                    /* ✅ FASE 13.8 - MENU LIMPO DO XADREZ: tabuleiro aparece só depois da escolha */
                    body.chess-selected:not(.chess-board-visible) #chess-status,
                    body.chess-selected:not(.chess-board-visible) #chess-toast,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-board-wrap,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-actions,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-action-note {
                        display: none !important;
                    }
                    body.chess-board-visible #chess-online-panel,
                    body.chess-board-visible #chess-training-panel {
                        margin-bottom: 12px;
                    }
                    .chess-online-panel, .chess-training-panel {
                        max-width: 560px;
                        margin: 0 auto 14px auto;
                        background: rgba(2, 6, 23, .72);
                        border: 1px solid rgba(148, 163, 184, .18);
                        border-radius: 18px;
                        padding: 14px;
                        text-align: left;
                        box-shadow: 0 12px 28px rgba(0,0,0,.32);
                        backdrop-filter: blur(10px);
                    }
                    .chess-online-panel {
                        border-color: rgba(56,189,248,.30);
                        background: linear-gradient(135deg, rgba(8,47,73,.52), rgba(2,6,23,.82));
                    }
                    .chess-training-panel {
                        border-color: rgba(46,204,113,.28);
                        background: linear-gradient(135deg, rgba(5,46,22,.42), rgba(2,6,23,.86));
                    }
                    .chess-training-title {
                        color: #86efac;
                        font-weight: 1000;
                        text-transform: uppercase;
                        font-size: .88rem;
                        letter-spacing: .55px;
                        margin-bottom: 5px;
                    }
                    .chess-training-desc {
                        color: #cbd5e1;
                        font-size: .80rem;
                        line-height: 1.42;
                        margin-bottom: 12px;
                    }
                    .chess-training-actions {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 9px;
                    }
                    .chess-training-actions button.btn-chess-training {
                        min-height: 74px;
                        padding: 12px 10px !important;
                        font-size: .82rem !important;
                        text-transform: none !important;
                        text-align: center !important;
                        border-radius: 16px !important;
                        border: 1px solid rgba(255,255,255,.14) !important;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 10px 22px rgba(0,0,0,.24) !important;
                        transform: none !important;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        gap: 6px;
                        position: relative;
                        overflow: hidden;
                    }
                    .chess-training-actions button.btn-chess-training::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: linear-gradient(180deg, rgba(255,255,255,.16), transparent 42%);
                        pointer-events: none;
                    }
                    .btn-chess-training span {
                        position: relative;
                        z-index: 1;
                        font-weight: 1000;
                        color:#fff;
                        font-size: .98rem;
                        letter-spacing: .2px;
                    }
                    .btn-chess-training small {
                        position: relative;
                        z-index: 1;
                        font-size: .70rem;
                        color: rgba(226,232,240,.92);
                        font-weight: 800;
                        letter-spacing: .2px;
                        margin-top: 1px;
                    }
                    .btn-chess-training.easy {
                        background: linear-gradient(135deg, #16a34a, #0f766e) !important;
                        border-color: rgba(110,231,183,.42) !important;
                    }
                    .btn-chess-training.medium {
                        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                        border-color: rgba(147,197,253,.42) !important;
                    }
                    .btn-chess-training.hard {
                        background: linear-gradient(135deg, #f97316, #dc2626) !important;
                        border-color: rgba(253,186,116,.42) !important;
                    }
                    .btn-chess-training.learn {
                        background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important;
                        border-color: rgba(196,181,253,.45) !important;
                    }
                    .btn-chess-training:hover:not(:disabled) {
                        transform: translateY(-2px) !important;
                        border-color: rgba(255,255,255,.30) !important;
                        filter: brightness(1.06);
                    }
                    .btn-chess-training.active {
                        outline: 2px solid #f8fafc !important;
                        box-shadow: 0 0 0 4px rgba(255,255,255,.10), 0 0 18px rgba(255,255,255,.16) !important;
                    }
                    .chess-training-status {
                        margin-top: 10px;
                        color: #e2e8f0;
                        background: rgba(2, 6, 23, .78);
                        border-radius: 12px;
                        padding: 10px;
                        font-size: .79rem;
                        line-height: 1.38;
                        border: 1px solid rgba(46,204,113,.28);
                        border-left: 4px solid #2ecc71;
                    }
                    .chess-training-coach {
                        margin-top: 9px;
                        color: #e2e8f0;
                        background: rgba(124,58,237,.16);
                        border: 1px solid rgba(216,180,254,.28);
                        border-radius: 10px;
                        padding: 9px;
                        font-size: .79rem;
                        line-height: 1.38;
                    }
                    .chess-training-coach strong { color:#d8b4fe; display:block; margin-bottom: 4px; }
                    .chess-training-coach button {
                        margin-top: 8px;
                        width: auto;
                        padding: 7px 10px;
                        font-size: .72rem;
                        text-transform: none;
                        border-radius: 7px;
                        background:#6d28d9;
                    }
                    .chess-beginner-box {
                        margin-top: 9px;
                        background: linear-gradient(135deg, rgba(2,6,23,.96), rgba(30,41,59,.92));
                        border: 1px solid rgba(56,189,248,.38);
                        border-radius: 10px;
                        padding: 10px;
                        color: #e2e8f0;
                        font-size: .78rem;
                        line-height: 1.38;
                    }
                    .chess-beginner-title {
                        color: #38bdf8;
                        font-weight: 1000;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        letter-spacing: .4px;
                    }
                    .chess-beginner-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 7px;
                        margin-top: 7px;
                    }
                    .chess-beginner-item {
                        background: #020617;
                        border: 1px solid rgba(148,163,184,.18);
                        border-radius: 8px;
                        padding: 7px;
                    }
                    .chess-beginner-item strong { color:#facc15; }
                    .chess-legend-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 6px;
                        margin-top: 8px;
                    }
                    .chess-legend-pill {
                        background:#020617;
                        border-radius: 999px;
                        padding: 6px 7px;
                        text-align:center;
                        font-size:.7rem;
                        border:1px solid rgba(255,255,255,.10);
                    }
                    .chess-legend-pill.green { color:#86efac; }
                    .chess-legend-pill.red { color:#fca5a5; }
                    .chess-legend-pill.yellow { color:#fde68a; }
                    body.chess-beginner-mode .chess-piece::after {
                        content: attr(data-name);
                        position: absolute;
                        left: 50%;
                        bottom: -12px;
                        transform: translateX(-50%);
                        background: rgba(2,6,23,.82);
                        color: #fff;
                        border-radius: 999px;
                        padding: 1px 5px;
                        font-size: clamp(.48rem, 1.7vw, .62rem);
                        font-weight: 900;
                        line-height: 1.2;
                        white-space: nowrap;
                        border: 1px solid rgba(255,255,255,.18);
                        text-shadow: none;
                        pointer-events: none;
                    }
                    body.chess-beginner-mode .chess-square.capture::before {
                        content: 'capturar';
                        position: absolute;
                        top: 4px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 3;
                        background: rgba(127,29,29,.88);
                        color: #fff;
                        border-radius: 999px;
                        padding: 2px 6px;
                        font-size: clamp(.48rem, 1.6vw, .62rem);
                        font-weight: 1000;
                        pointer-events: none;
                    }
                    body.chess-admin-only #chess-training-panel { display: none !important; }
                    @media(max-width:560px){ .chess-training-actions { grid-template-columns: 1fr; } .chess-beginner-grid, .chess-legend-row { grid-template-columns: 1fr; } }

                    /* ✅ FASE 12.1: ADMIN LIMPO — esconde tudo que é do jogo quando abrir o Admin do Xadrez */
                    body.chess-admin-only #chess-status,
                    body.chess-admin-only #chess-toast,
                    body.chess-admin-only .chess-board-wrap,
                    body.chess-admin-only #chess-material-panel,
                    body.chess-admin-only #chess-history-panel,
                    body.chess-admin-only .chess-actions,
                    body.chess-admin-only .chess-action-note,
                    body.chess-admin-only .chess-warning {
                        display: none !important;
                    }
                    body.chess-admin-only #chess-admin-panel {
                        display: block !important;
                    }
                    body.chess-admin-only .chess-card {
                        max-width: 660px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    body.chess-admin-only .chess-subtitle {
                        margin-bottom: 10px;
                    }
                    @media(max-width:560px){ .chess-admin-grid { grid-template-columns:1fr; } }
                `;
                document.head.appendChild(style);
            }

            if (!document.getElementById('chess-admin-panel')) {
                const panel = document.createElement('div');
                panel.id = 'chess-admin-panel';
                panel.className = 'chess-admin-panel';
                panel.innerHTML = `
                    <div class="chess-admin-title">🛡️ Painel Admin do Xadrez — Fase 12.1</div>
                    <div class="chess-admin-desc">Controle próprio do Xadrez, igual à Damas, usando o caminho <strong>chessRooms</strong>. Esta tela é somente administração: sem tabuleiro, sem placar e sem histórico do jogo. A Damas continua preservada.</div>
                    <input id="chess-admin-room-input" type="text" maxlength="18" placeholder="Código da sala de Xadrez, ex: xadrez10">
                    <div class="chess-admin-grid">
                        <button id="chess-admin-create-btn" type="button" style="background:#22c55e;">Liberar / criar sala</button>
                        <button id="chess-admin-block-btn" type="button" style="background:#dc2626;">Bloquear sala</button>
                        <button id="chess-admin-chat-btn" type="button" style="background:#f97316;">Travar / destravar chat</button>
                        <button id="chess-admin-kick-btn" type="button" style="background:#facc15; color:#111;">Expulsar jogadores</button>
                        <button id="chess-admin-clear-chat-btn" type="button" style="background:#b45309;">Limpar mensagens</button>
                        <button id="chess-admin-reset-btn" type="button" style="background:#7c3aed;">Resetar tabuleiro</button>
                        <button id="chess-admin-delete-btn" type="button" style="background:#991b1b;">Excluir sala</button>
                        <button id="chess-admin-monitor-chat-btn" type="button" style="background:#2563eb;">Monitorar chat</button>
                    </div>
                    <div id="chess-admin-panorama" class="chess-admin-desc">📊 Sincronizando salas de Xadrez...</div>
                    <div id="chess-admin-rooms-list" class="chess-admin-list">Carregando salas...</div>
                    <div id="chess-admin-chat-monitor" class="chess-admin-chat-monitor" style="display:none;">Selecione uma sala e clique em monitorar chat.</div>
                `;
                const online = document.getElementById('chess-online-panel');
                if (online) online.insertAdjacentElement('afterend', panel);
                else card.insertBefore(panel, document.getElementById('chess-status') || card.firstChild);

                document.getElementById('chess-admin-create-btn')?.addEventListener('click', adminCriarLiberarSalaXadrez);
                document.getElementById('chess-admin-block-btn')?.addEventListener('click', adminBloquearSalaXadrez);
                document.getElementById('chess-admin-chat-btn')?.addEventListener('click', adminAlternarChatXadrez);
                document.getElementById('chess-admin-kick-btn')?.addEventListener('click', adminExpulsarJogadoresXadrez);
                document.getElementById('chess-admin-clear-chat-btn')?.addEventListener('click', adminLimparChatXadrez);
                document.getElementById('chess-admin-reset-btn')?.addEventListener('click', adminResetarSalaXadrez);
                document.getElementById('chess-admin-delete-btn')?.addEventListener('click', adminExcluirSalaXadrez);
                document.getElementById('chess-admin-monitor-chat-btn')?.addEventListener('click', adminMonitorarChatXadrez);
            }
        }

        async function abrirAdminXadrezCentral() {
            if (!(await exigirAdminSeguro())) {
                exibirAlertaDoSistema('Acesso negado 🛡️', 'Entre primeiro com o login do administrador.');
                return;
            }
            instalarPainelAdminXadrez();
            // ✅ FASE 13.4: Admin do Xadrez fica isolado e não carrega tabuleiro na administração.
            document.body.classList.remove('platform-start-active','mode-selecting','game-selected','domino-selected','chess-focus-mode','chess-beginner-mode');
            document.body.classList.remove('chess-menu-active', 'chess-game-active', 'chess-board-visible');
            document.body.classList.add('chess-selected', 'chess-admin-only');
            const hub = document.getElementById('games-hub-panel');
            if (hub) hub.style.display = 'none';
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            const chess = document.getElementById('chess-screen');
            if (chess) chess.style.display = 'block';
            const panel = document.getElementById('chess-admin-panel');
            if (panel) panel.style.display = 'block';
            const online = document.getElementById('chess-online-panel');
            if (online) online.style.display = 'none';
            atualizarStatusOnlineXadrez('🛡️ Fase 12.1 ativa: modo administrador limpo do Xadrez. Só o painel administrativo fica visível.');
            ativarDashboardAdminXadrez();
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function obterSalaAdminXadrez() {
            const input = document.getElementById('chess-admin-room-input');
            const sala = normalizarSalaXadrez(input?.value || '');
            if (!sala) {
                exibirAlertaDoSistema('Sala obrigatória', 'Digite ou selecione o código da sala de Xadrez.');
                return '';
            }
            return sala;
        }

        function ativarDashboardAdminXadrez() {
            instalarPainelAdminXadrez();
            if (chessAdminUnsubscribeRooms) chessAdminUnsubscribeRooms();
            chessAdminUnsubscribeRooms = onValue(ref(db, 'chessRooms'), (snap) => {
                const list = document.getElementById('chess-admin-rooms-list');
                const panorama = document.getElementById('chess-admin-panorama');
                if (!list || !panorama) return;
                const data = snap.val() || {};
                const ids = Object.keys(data).sort();
                if (!ids.length) {
                    panorama.innerHTML = '📊 PANORAMA XADREZ: 0 salas registradas.';
                    list.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Nenhuma sala de Xadrez criada ainda.</div>';
                    return;
                }
                let liberadas = 0;
                list.innerHTML = '';
                ids.forEach(id => {
                    const sala = data[id] || {};
                    const ativa = sala.isAuthorized !== false;
                    if (ativa) liberadas++;
                    const white = sala.players?.white?.name || 'Aguardando brancas';
                    const black = sala.players?.black?.name || 'Aguardando pretas';
                    const specs = sala.spectators && typeof sala.spectators === 'object' ? Object.keys(sala.spectators).length : 0;
                    const chat = sala.chatBlocked ? ' • CHAT OFF' : '';
                    const row = document.createElement('div');
                    row.className = 'chess-admin-room-row' + (ativa ? '' : ' blocked');
                    row.innerHTML = `<div><strong>${escapeHtmlXadrez(id.toUpperCase())}</strong><div style="color:#94a3b8; margin-top:3px;">⚪ ${escapeHtmlXadrez(white)} vs ⚫ ${escapeHtmlXadrez(black)} • 👀 ${specs}${chat}</div></div><div style="color:${ativa ? '#22c55e' : '#ef4444'}; font-weight:900;">${ativa ? 'LIBERADA' : 'BLOQUEADA'}</div>`;
                    row.addEventListener('click', () => {
                        const input = document.getElementById('chess-admin-room-input');
                        if (input) input.value = id;
                    });
                    list.appendChild(row);
                });
                panorama.innerHTML = `📊 PANORAMA XADREZ: ${ids.length} salas | <span style="color:#22c55e;">${liberadas} liberadas</span> | <span style="color:#ef4444;">${ids.length - liberadas} bloqueadas</span>`;
            });
        }

        async function adminCriarLiberarSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const r = ref(db, `chessRooms/${sala}`);
            const snap = await get(r);
            if (!snap.exists()) {
                await set(r, estadoInicialSalaXadrezAdmin(sala));
                mostrarToastXadrez(`🛡️ Sala ${sala} criada e liberada pelo Admin.`);
            } else {
                await update(r, { isAuthorized: true, lastAdminAction: 'liberada_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
                mostrarToastXadrez(`🛡️ Sala ${sala} liberada.`);
            }
        }

        async function adminBloquearSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { isAuthorized: false, lastAdminAction: 'bloqueada_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🛡️ Sala ${sala} bloqueada.`);
        }

        async function adminAlternarChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const r = ref(db, `chessRooms/${sala}`);
            const snap = await get(r);
            const atual = snap.val()?.chatBlocked === true;
            await update(r, { chatBlocked: !atual, lastAdminAction: !atual ? 'chat_travado_admin_xadrez' : 'chat_liberado_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`💬 Chat da sala ${sala} ${!atual ? 'travado' : 'liberado'}.`);
        }

        async function adminExpulsarJogadoresXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { players: {}, spectators: {}, lastAdminAction: 'jogadores_expulsos_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🚪 Jogadores e espectadores removidos da sala ${sala}.`);
        }

        async function adminLimparChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { chat: null, lastAdminAction: 'chat_limpo_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🧹 Chat da sala ${sala} limpo.`);
        }

        async function adminResetarSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const estado = estadoInicialSalaXadrezAdmin(sala);
            await update(ref(db, `chessRooms/${sala}`), { board: estado.board, turn: 'white', gameOver: false, lastMoveMessage: 'Partida resetada pelo administrador do Xadrez.', lastChessMove: null, enPassantTarget: null, moveHistory: [], updatedAt: Date.now(), lastAdminAction: 'tabuleiro_resetado_admin_xadrez', lastAdminAt: Date.now() });
            mostrarToastXadrez(`♟️ Tabuleiro da sala ${sala} resetado.`);
        }

        async function adminExcluirSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            exibirConfirmacao('Excluir sala de Xadrez', `Tem certeza de que deseja excluir a sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>?`, async () => {
                await remove(ref(db, `chessRooms/${sala}`));
                mostrarToastXadrez(`❌ Sala ${sala} excluída.`);
            });
        }

        async function adminMonitorarChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const monitor = document.getElementById('chess-admin-chat-monitor');
            if (!monitor) return;
            monitor.style.display = 'block';
            monitor.innerHTML = `💬 Monitorando chat da sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>...`;
            if (chessAdminUnsubscribeChat) chessAdminUnsubscribeChat();
            chessAdminUnsubscribeChat = onValue(ref(db, `chessRooms/${sala}/chat`), (snap) => {
                const msgs = Object.values(snap.val() || {}).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).slice(-80);
                if (!msgs.length) {
                    monitor.innerHTML = `💬 Sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>: nenhuma mensagem.`;
                    return;
                }
                monitor.innerHTML = `<div style="color:#38bdf8; font-weight:900; margin-bottom:6px;">💬 Chat da sala ${escapeHtmlXadrez(sala.toUpperCase())}</div>` + msgs.map(m => `<div><strong style="color:#38bdf8;">${escapeHtmlXadrez(m.name || 'Jogador')}:</strong> ${escapeHtmlXadrez(m.text || '')}</div>`).join('');
                monitor.scrollTop = monitor.scrollHeight;
            });
        }



        // ================================================================
        // 📹 FASE 22 - CHAMADA DE VÍDEO/ÁUDIO DO XADREZ ONLINE
        // Caminho próprio: chessRooms/{sala}/call. Não usa nem altera a chamada da Damas.
        // ================================================================
        let chessCallPeer = null;
        let chessLocalCallStream = null;
        let chessCallUnsubscribe = null;
        let chessCallRemoteApplied = false;
        let chessCallSessionId = '';
        let chessProcessedRemoteCandidates = new Set();
        let chessLocalMicEnabled = true;
        let chessLocalCameraEnabled = true;
        let chessCallFloatingWidth = Number(localStorage.getItem('tabuleiroArenaChessCallHeight') || 150);
        chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth));

        function chessCallElements() {
            return {
                panel: document.getElementById('chess-call-panel'),
                status: document.getElementById('chess-call-status'),
                localVideo: document.getElementById('chess-local-video'),
                remoteVideo: document.getElementById('chess-remote-video'),
                remoteAudio: document.getElementById('chess-remote-audio'),
                startVideo: document.getElementById('chess-start-video-call-btn'),
                startAudio: document.getElementById('chess-start-audio-call-btn'),
                end: document.getElementById('chess-end-call-btn'),
                mic: document.getElementById('chess-toggle-mic-btn'),
                cam: document.getElementById('chess-toggle-camera-btn'),
                unlock: document.getElementById('chess-unlock-audio-btn'),
                minus: document.getElementById('chess-call-size-minus-btn'),
                plus: document.getElementById('chess-call-size-plus-btn'),
                toggle: document.getElementById('chess-call-toggle-btn'),
                localLabel: document.getElementById('chess-local-label'),
                remoteLabel: document.getElementById('chess-remote-label')
            };
        }

        function setChessCallStatus(texto) {
            const { status } = chessCallElements();
            if (status) status.innerText = texto;
        }

        function podeUsarChamadaXadrez() {
            return chessMode === 'online' && chessRoomId && !chessIsSpectator && (chessPlayerColor === 'white' || chessPlayerColor === 'black');
        }

        function oponenteChamadaXadrez() {
            return chessPlayerColor === 'white' ? 'black' : 'white';
        }

        function atualizarLabelsChamadaXadrez() {
            const { localLabel, remoteLabel } = chessCallElements();
            if (chessIsSpectator) {
                if (localLabel) localLabel.innerText = 'Brancas';
                if (remoteLabel) remoteLabel.innerText = 'Pretas';
                return;
            }
            if (localLabel) localLabel.innerText = chessPlayerColor === 'white' ? 'Você • Brancas' : 'Você • Pretas';
            if (remoteLabel) remoteLabel.innerText = chessPlayerColor === 'white' ? 'Oponente • Pretas' : 'Oponente • Brancas';
        }

        function atualizarPainelChamadaXadrez() {
            const els = chessCallElements();
            if (!els.panel) return;
            const online = chessMode === 'online' && !!chessRoomId;
            els.panel.classList.toggle('online-visible', online);
            els.panel.classList.toggle('call-active', !!chessLocalCallStream);
            atualizarLabelsChamadaXadrez();

            if (!online) {
                els.panel.classList.remove('online-visible', 'call-active');
                setChessCallStatus('Entre em uma sala online para liberar a chamada.');
                return;
            }

            if (chessIsSpectator) {
                setChessCallStatus('Espectador: sem câmera e sem microfone nesta fase.');
                if (els.startVideo) { els.startVideo.disabled = true; els.startVideo.style.display = 'none'; }
                if (els.startAudio) { els.startAudio.disabled = true; els.startAudio.style.display = 'none'; }
                if (els.mic) { els.mic.disabled = true; els.mic.style.display = 'none'; }
                if (els.cam) { els.cam.disabled = true; els.cam.style.display = 'none'; }
                if (els.end) { els.end.disabled = true; els.end.innerText = 'Encerrar'; }
                return;
            }

            if (els.startVideo) { els.startVideo.disabled = !!chessLocalCallStream; els.startVideo.style.display = ''; }
            if (els.startAudio) { els.startAudio.disabled = !!chessLocalCallStream; els.startAudio.style.display = ''; }
            if (els.end) { els.end.disabled = !chessLocalCallStream; els.end.innerText = 'Encerrar'; }
            if (els.mic) { els.mic.disabled = !chessLocalCallStream; els.mic.style.display = ''; }
            if (els.cam) { els.cam.disabled = !chessLocalCallStream; els.cam.style.display = ''; }
            if (els.unlock) els.unlock.style.display = '';

            if (chessLocalCallStream) {
                restaurarPosicaoChamadaXadrez();
            } else {
                setChessCallStatus('Disponível para os dois jogadores da sala de Xadrez.');
            }
        }

        function explicarErroMidiaXadrez(erro) {
            const nomeErro = erro?.name || '';
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') return 'A chamada precisa abrir em link HTTPS. Use o link publicado na Vercel.';
            if (nomeErro === 'NotAllowedError' || nomeErro === 'PermissionDeniedError') return 'Câmera ou microfone bloqueados. Libere as permissões do navegador para este site.';
            if (nomeErro === 'NotFoundError' || nomeErro === 'DevicesNotFoundError') return 'Este aparelho não encontrou câmera ou microfone disponível.';
            if (nomeErro === 'NotReadableError' || nomeErro === 'TrackStartError') return 'Câmera ou microfone estão ocupados por outro aplicativo. Feche outras chamadas e tente de novo.';
            return 'Não foi possível acessar câmera ou microfone. Confira as permissões do navegador.';
        }

        async function prepararMidiaXadrez(somenteAudio = false) {
            if (chessLocalCallStream) return chessLocalCallStream;
            const els = chessCallElements();
            try {
                if (somenteAudio) {
                    chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                } else {
                    try {
                        chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } }, audio: true });
                    } catch (erroVideo) {
                        chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        mostrarToastXadrez('📵 Câmera não liberada. Chamada iniciada somente com áudio.', 'check');
                    }
                }
            } catch (erroMidia) {
                throw new Error(explicarErroMidiaXadrez(erroMidia));
            }
            chessLocalMicEnabled = true;
            chessLocalCameraEnabled = chessLocalCallStream.getVideoTracks().some(t => t.enabled);
            if (els.localVideo) els.localVideo.srcObject = chessLocalCallStream;
            if (els.panel) els.panel.classList.add('call-active');
            atualizarBotoesMidiaXadrez();
            restaurarPosicaoChamadaXadrez();
            return chessLocalCallStream;
        }

        function atualizarBotoesMidiaXadrez() {
            const { mic, cam } = chessCallElements();
            if (mic) {
                mic.innerText = chessLocalMicEnabled ? '🎙️ Mic' : '🔇 Mudo';
                mic.classList.toggle('chess-call-muted', !chessLocalMicEnabled);
            }
            if (cam) {
                cam.innerText = chessLocalCameraEnabled ? '📷 Cam' : '📵 Sem cam';
                cam.classList.toggle('chess-call-muted', !chessLocalCameraEnabled);
            }
        }

        function criarPeerChamadaXadrez() {
            if (chessCallPeer) return chessCallPeer;
            chessCallPeer = new RTCPeerConnection(rtcConfigGratis);
            const els = chessCallElements();

            chessCallPeer.ontrack = (event) => {
                let remoteStream = event.streams && event.streams[0];
                if (!remoteStream) {
                    remoteStream = els.remoteVideo?.srcObject instanceof MediaStream ? els.remoteVideo.srcObject : new MediaStream();
                }
                if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
                    try { remoteStream.addTrack(event.track); } catch (_) {}
                }
                if (els.remoteVideo) {
                    els.remoteVideo.srcObject = remoteStream;
                    els.remoteVideo.muted = true;
                    els.remoteVideo.play?.().catch(() => {});
                }
                if (els.remoteAudio) {
                    els.remoteAudio.srcObject = remoteStream;
                    els.remoteAudio.muted = false;
                    els.remoteAudio.volume = 1;
                    els.remoteAudio.play?.().catch(() => setChessCallStatus('Vídeo conectado. Toque em 🔊 Som para liberar o áudio.'));
                }
                setChessCallStatus('Conectado ✅');
                els.panel?.classList.add('call-active');
                restaurarPosicaoChamadaXadrez();
            };

            chessCallPeer.onicecandidate = async (event) => {
                if (!event.candidate || !chessRoomId || !chessPlayerColor) return;
                try {
                    await push(ref(db, `chessRooms/${chessRoomId}/call/candidates/${chessPlayerColor}`), {
                        ...event.candidate.toJSON(),
                        sessionId: chessCallSessionId,
                        createdAt: Date.now()
                    });
                } catch (e) { console.warn('Falha ao enviar ICE do Xadrez:', e); }
            };

            chessCallPeer.onconnectionstatechange = () => {
                const estado = chessCallPeer?.connectionState || 'new';
                if (estado === 'new') setChessCallStatus('Preparando conexão...');
                if (estado === 'connecting') setChessCallStatus('Conectando chamada...');
                if (estado === 'connected') setChessCallStatus('Conectado ✅');
                if (estado === 'disconnected') setChessCallStatus('Conexão instável. Tentando reconectar...');
                if (estado === 'failed') setChessCallStatus('A rede bloqueou a conexão direta. Tente trocar de internet ou usar somente áudio.');
                if (estado === 'closed') setChessCallStatus('Chamada encerrada.');
            };

            if (chessLocalCallStream) {
                chessLocalCallStream.getTracks().forEach(track => chessCallPeer.addTrack(track, chessLocalCallStream));
            }
            return chessCallPeer;
        }

        function limparListenerChamadaXadrez() {
            try { if (typeof chessCallUnsubscribe === 'function') chessCallUnsubscribe(); } catch (_) {}
            chessCallUnsubscribe = null;
        }

        async function iniciarChamadaXadrez(somenteAudio = false) {
            if (!podeUsarChamadaXadrez()) {
                mostrarToastXadrez('📹 A chamada do Xadrez funciona somente para os dois jogadores da sala online.', 'check');
                atualizarPainelChamadaXadrez();
                return;
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                mostrarToastXadrez('⚠️ Navegador sem suporte a câmera/microfone. Use Chrome ou Edge atualizado.', 'check');
                return;
            }
            chessCallSessionId = `${Date.now()}_${chessPlayerColor}_${getChessUid()}`;
            chessProcessedRemoteCandidates = new Set();
            chessCallRemoteApplied = false;
            setChessCallStatus('Pedindo permissão da câmera e microfone...');
            try {
                await prepararMidiaXadrez(somenteAudio);
                if (chessPlayerColor === 'white') {
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/offer`));
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/answer`));
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/candidates`));
                } else {
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/candidates/${chessPlayerColor}`));
                }
                await update(ref(db, `chessRooms/${chessRoomId}/call`), { status: 'active', updatedAt: Date.now() });
                await update(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`), {
                    color: chessPlayerColor,
                    name: chessPlayerName || nomeCor(chessPlayerColor),
                    sessionId: chessCallSessionId,
                    joinedAt: Date.now()
                });
                try { onDisconnect(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`)).remove(); } catch (_) {}
                criarPeerChamadaXadrez();
                escutarSinalizacaoChamadaXadrez();
                atualizarPainelChamadaXadrez();
                setChessCallStatus(chessPlayerColor === 'white' ? 'Aguardando as pretas iniciarem a chamada...' : 'Aguardando convite das brancas...');
            } catch (e) {
                encerrarChamadaXadrez(false);
                mostrarToastXadrez('⚠️ ' + (e.message || 'Não foi possível iniciar a chamada.'), 'check');
            }
        }

        function escutarSinalizacaoChamadaXadrez() {
            limparListenerChamadaXadrez();
            if (!chessRoomId) return;
            chessCallUnsubscribe = onValue(ref(db, `chessRooms/${chessRoomId}/call`), async (snap) => {
                const callData = snap.val() || {};
                if (callData.status === 'ended' && callData.endedBy !== getChessUid() && chessLocalCallStream) {
                    encerrarChamadaXadrez(false);
                    setChessCallStatus('O oponente encerrou a chamada.');
                    return;
                }

                const participants = callData.participants || {};
                const temWhite = Object.values(participants).some(p => p?.color === 'white');
                const temBlack = Object.values(participants).some(p => p?.color === 'black');

                if (chessLocalCallStream && chessPlayerColor === 'white' && temWhite && temBlack && !callData.offer?.sdp) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                        await pc.setLocalDescription(offer);
                        await set(ref(db, `chessRooms/${chessRoomId}/call/offer`), {
                            type: offer.type,
                            sdp: offer.sdp,
                            fromColor: 'white',
                            sessionId: chessCallSessionId,
                            createdAt: Date.now()
                        });
                        setChessCallStatus('Convite enviado. Esperando resposta das pretas...');
                    } catch (e) { console.warn('Erro criando oferta do Xadrez:', e); setChessCallStatus('Falha ao criar convite da chamada.'); }
                }

                if (chessLocalCallStream && chessPlayerColor === 'black' && callData.offer?.sdp && !chessCallRemoteApplied) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: callData.offer.type, sdp: callData.offer.sdp }));
                        chessCallRemoteApplied = true;
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await set(ref(db, `chessRooms/${chessRoomId}/call/answer`), {
                            type: answer.type,
                            sdp: answer.sdp,
                            fromColor: 'black',
                            sessionId: chessCallSessionId,
                            createdAt: Date.now()
                        });
                        setChessCallStatus('Resposta enviada. Conectando...');
                    } catch (e) { console.warn('Erro respondendo chamada do Xadrez:', e); setChessCallStatus('Falha ao responder chamada.'); }
                }

                if (chessLocalCallStream && chessPlayerColor === 'white' && callData.answer?.sdp && !chessCallRemoteApplied) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: callData.answer.type, sdp: callData.answer.sdp }));
                        chessCallRemoteApplied = true;
                        setChessCallStatus('Resposta recebida. Conectando...');
                    } catch (e) { console.warn('Erro aplicando resposta do Xadrez:', e); setChessCallStatus('Falha ao aplicar resposta da chamada.'); }
                }

                if (chessLocalCallStream && callData.candidates) {
                    const outro = oponenteChamadaXadrez();
                    const lista = callData.candidates[outro] || {};
                    for (const [candId, cand] of Object.entries(lista)) {
                        const chave = `${outro}_${candId}`;
                        if (chessProcessedRemoteCandidates.has(chave)) continue;
                        try {
                            const pc = criarPeerChamadaXadrez();
                            if (!pc.remoteDescription || !cand?.candidate) continue;
                            await pc.addIceCandidate(new RTCIceCandidate(cand));
                            chessProcessedRemoteCandidates.add(chave);
                        } catch (e) { console.warn('ICE remoto do Xadrez aguardando:', e); }
                    }
                }
            });
        }

        function encerrarChamadaXadrez(notificarFirebase = true) {
            try { limparListenerChamadaXadrez(); } catch (_) {}
            try { if (chessCallPeer) chessCallPeer.close(); } catch (_) {}
            chessCallPeer = null;
            chessCallRemoteApplied = false;
            chessProcessedRemoteCandidates = new Set();

            if (chessLocalCallStream) {
                try { chessLocalCallStream.getTracks().forEach(t => t.stop()); } catch (_) {}
            }
            chessLocalCallStream = null;
            const els = chessCallElements();
            if (els.localVideo) els.localVideo.srcObject = null;
            if (els.remoteVideo) els.remoteVideo.srcObject = null;
            if (els.remoteAudio) els.remoteAudio.srcObject = null;
            if (els.panel) {
                els.panel.classList.remove('call-active');
                els.panel.style.left = '';
                els.panel.style.top = '';
                els.panel.style.right = '';
                els.panel.style.bottom = '';
                els.panel.style.transform = '';
            }
            if (notificarFirebase && chessRoomId) {
                update(ref(db, `chessRooms/${chessRoomId}/call`), { status: 'ended', endedBy: getChessUid(), endedAt: Date.now() }).catch(() => {});
                remove(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`)).catch(() => {});
            }
            atualizarPainelChamadaXadrez();
        }

        function alternarMicXadrez() {
            if (!chessLocalCallStream) return;
            chessLocalMicEnabled = !chessLocalMicEnabled;
            chessLocalCallStream.getAudioTracks().forEach(t => t.enabled = chessLocalMicEnabled);
            atualizarBotoesMidiaXadrez();
        }

        function alternarCameraXadrez() {
            if (!chessLocalCallStream) return;
            const videos = chessLocalCallStream.getVideoTracks();
            if (!videos.length) {
                mostrarToastXadrez('📵 Esta chamada começou sem câmera.', 'check');
                return;
            }
            chessLocalCameraEnabled = !chessLocalCameraEnabled;
            videos.forEach(t => t.enabled = chessLocalCameraEnabled);
            atualizarBotoesMidiaXadrez();
        }

        function liberarSomXadrez() {
            const { remoteAudio, remoteVideo } = chessCallElements();
            if (remoteAudio) {
                remoteAudio.muted = false;
                remoteAudio.volume = 1;
                remoteAudio.play?.().then(() => setChessCallStatus('Som liberado 🔊')).catch(() => setChessCallStatus('Toque novamente ou aumente o volume do aparelho.'));
            }
            remoteVideo?.play?.().catch(() => {});
        }

        function aplicarTamanhoChamadaXadrez() {
            const { panel } = chessCallElements();
            if (!panel) return;
            chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth || 150));
            panel.style.setProperty('--fase35-video-height', `${chessCallFloatingWidth}px`);
            panel.dataset.callVideoHeight = String(chessCallFloatingWidth);
            try { localStorage.setItem('tabuleiroArenaChessCallHeight', String(chessCallFloatingWidth)); } catch (_) {}
        }

        function redimensionarChamadaXadrez(delta) {
            chessCallFloatingWidth = Math.max(110, Math.min(240, (chessCallFloatingWidth || 150) + delta));
            aplicarTamanhoChamadaXadrez();
        }

        function manterChamadaXadrezNaTela() {
            const { panel } = chessCallElements();
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.transform = '';
            panel.style.width = '';
            panel.style.maxWidth = '';
            aplicarTamanhoChamadaXadrez();
        }

        function restaurarPosicaoChamadaXadrez() {
            const { panel } = chessCallElements();
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.transform = '';
            panel.style.width = '';
            panel.style.maxWidth = '';
            aplicarTamanhoChamadaXadrez();
        }

        function ativarArrastarChamadaXadrez() {
            // Fase 36: arraste desativado de propósito.
            // A câmera do Xadrez agora fica fixa abaixo do tabuleiro para não cobrir as peças no celular.
            const { panel } = chessCallElements();
            if (!panel) return;
            const header = panel.querySelector('.chess-call-header');
            if (header) {
                header.dataset.chessDragReady = '0';
                header.style.cursor = 'default';
                header.style.touchAction = 'auto';
            }
        }

        function ligarEventosChamadaXadrez() {
            const els = chessCallElements();
            if (!els.panel || els.panel.dataset.chessCallBound === '1') return;
            els.panel.dataset.chessCallBound = '1';
            els.startVideo?.addEventListener('click', () => iniciarChamadaXadrez(false));
            els.startAudio?.addEventListener('click', () => iniciarChamadaXadrez(true));
            els.end?.addEventListener('click', () => encerrarChamadaXadrez(true));
            els.mic?.addEventListener('click', alternarMicXadrez);
            els.cam?.addEventListener('click', alternarCameraXadrez);
            els.unlock?.addEventListener('click', liberarSomXadrez);
            els.minus?.addEventListener('click', () => redimensionarChamadaXadrez(-40));
            els.plus?.addEventListener('click', () => redimensionarChamadaXadrez(40));
            els.toggle?.addEventListener('click', () => window.alternarPainelChamadaXadrezCompacto?.());
            ativarArrastarChamadaXadrez();
            atualizarPainelChamadaXadrez();
        }

        function iniciarModuloXadrez() {
            instalarCssXadrezFase5();
            instalarUiXadrezFase5();
            ligarEventosChamadaXadrez();
            try { chessSoundEnabled = localStorage.getItem('tabuleiroArenaChessSound') === '1'; } catch (_) {}
            atualizarBotaoSomXadrez();
            criarTabuleiroInicial();
            document.getElementById('chess-back-btn')?.addEventListener('click', voltarParaModalidades);
            document.getElementById('chess-back-btn-bottom')?.addEventListener('click', async () => { if (chessMode === 'online' && chessRoomId) await sairXadrezOnline(false); voltarParaModalidades(); });
            document.getElementById('chess-reset-btn')?.addEventListener('click', reiniciarXadrezOnlineOuLocal);
            document.getElementById('chess-new-btn')?.addEventListener('click', reiniciarXadrezOnlineOuLocal);
            document.getElementById('chess-resign-btn')?.addEventListener('click', desistirXadrez);
            document.getElementById('chess-board-leave-online-btn')?.addEventListener('click', async () => { await sairXadrezOnline(false); ocultarTabuleiroXadrezParaMenu(); mostrarToastXadrez('🚪 Você saiu da sala online. A vaga foi liberada.'); });
            document.getElementById('chess-undo-btn')?.addEventListener('click', desfazerJogada);
            document.getElementById('chess-online-join-btn')?.addEventListener('click', () => entrarXadrezOnline(false));
            document.getElementById('chess-online-watch-btn')?.addEventListener('click', () => entrarXadrezOnline(true));
            document.getElementById('chess-online-leave-btn')?.addEventListener('click', () => sairXadrezOnline(true));
            document.getElementById('chess-online-copy-btn')?.addEventListener('click', copiarSalaXadrez);
            document.getElementById('chess-sound-btn')?.addEventListener('click', alternarAlertaXadrez);
            document.getElementById('chess-focus-btn')?.addEventListener('click', alternarFocoTabuleiroXadrez);
            document.getElementById('chess-flip-btn')?.addEventListener('click', alternarVisaoTabuleiroXadrez);
            document.getElementById('chess-chat-send-btn')?.addEventListener('click', enviarChatXadrezOnline);
            document.getElementById('chess-history-toggle-btn')?.addEventListener('click', () => alternarHistoricoXadrez());
            document.getElementById('chess-history-clear-btn')?.addEventListener('click', limparHistoricoVisualXadrez);
            document.getElementById('chess-ranking-refresh-btn')?.addEventListener('click', () => { renderRankingTreinoXadrez(); mostrarToastXadrez('🏆 Ranking do Xadrez atualizado.'); });
            document.getElementById('chess-ranking-clear-btn')?.addEventListener('click', limparRankingTreinoXadrez);
            document.getElementById('chess-ranking-toggle-btn')?.addEventListener('click', alternarRankingTreinoXadrez);
            prepararRankingTreinoXadrez();
            // Fase 28: painel de conquistas removido da interface; conquistas internas permanecem sem aparecer no menu.
            document.getElementById('chess-chat-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') enviarChatXadrezOnline(); });
            document.getElementById('chess-training-easy-btn')?.addEventListener('click', () => iniciarTreinoXadrez('facil', false));
            document.getElementById('chess-training-medium-btn')?.addEventListener('click', () => iniciarTreinoXadrez('medio', false));
            document.getElementById('chess-training-hard-btn')?.addEventListener('click', () => iniciarTreinoXadrez('dificil', false));
            document.getElementById('chess-training-learn-btn')?.addEventListener('click', () => iniciarTreinoXadrez('medio', true));
            document.getElementById('chess-training-tip-btn')?.addEventListener('click', atualizarDicaTreinoXadrez);
            document.getElementById('chess-result-close-btn')?.addEventListener('click', () => { const p = document.getElementById('chess-result-panel'); if (p) p.style.display = 'none'; });
            document.getElementById('chess-result-again-btn')?.addEventListener('click', () => { resetChessGame(); focarTabuleiroXadrez(false); });
            document.getElementById('chess-result-menu-btn')?.addEventListener('click', () => { limparResultadoXadrez(); ocultarTabuleiroXadrezParaMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
            document.getElementById('central-admin-xadrez-btn')?.addEventListener('click', abrirAdminXadrezCentral);
        }



        /* ✅ FASE 29 - XADREZ ONLINE ESTÁVEL
           Esta fase fica DENTRO do módulo do Xadrez, então consegue mexer apenas no Xadrez
           sem tocar na Damas. Corrige o problema de o Firebase atualizar chamada/chat/presença
           e forçar renderização do tabuleiro, fazendo a tela subir. */
        function instalarFase29XadrezOnlineEstavel() {
            window.__tabuleiroArenaXadrezFase29InternaAtiva = true;

            let ultimaAssinaturaRemotaXadrez29 = '';
            let ultimoHtmlBarraJogadoresXadrez29 = '';

            function assinaturaTabuleiroXadrez29(board) {
                const limpo = limparTabuleiroXadrezRecebido(board);
                if (!limpo) return 'sem-tabuleiro';
                let out = '';
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = limpo[r]?.[c];
                        out += p ? `${p.color[0]}${p.type[0]}${p.moved ? '1' : '0'}` : '--';
                    }
                }
                return out;
            }

            function assinaturaEstadoRemotoXadrez29(data) {
                if (!data || typeof data !== 'object') return 'vazio';
                const hist = Array.isArray(data.moveHistory) ? data.moveHistory.length : 0;
                const last = data.lastChessMove
                    ? `${data.lastChessMove?.from?.row ?? ''},${data.lastChessMove?.from?.col ?? ''}-${data.lastChessMove?.to?.row ?? ''},${data.lastChessMove?.to?.col ?? ''}`
                    : 'sem-ultima';
                const ep = data.enPassantTarget ? `${data.enPassantTarget.row ?? ''},${data.enPassantTarget.col ?? ''}` : 'sem-ep';
                const msg = String(data.lastMoveMessage || '').slice(0, 90);
                return [assinaturaTabuleiroXadrez29(data.board), data.turn === 'black' ? 'black' : 'white', data.gameOver ? 'fim' : 'jogo', hist, last, ep, msg].join('|');
            }

            function capturarTravaViewportXadrez29() {
                const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!wrap || chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) return null;
                const rect = wrap.getBoundingClientRect();
                return {
                    scrollY: window.scrollY,
                    top: rect.top,
                    left: rect.left,
                    height: rect.height,
                    activeId: document.activeElement && document.activeElement.id ? document.activeElement.id : ''
                };
            }

            function restaurarTravaViewportXadrez29(lock) {
                if (!lock) return;
                document.body.classList.add('chess-stabilizing-online');
                const restaurar = () => {
                    const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                    if (!wrap) {
                        document.body.classList.remove('chess-stabilizing-online');
                        return;
                    }
                    const after = wrap.getBoundingClientRect();
                    const diff = after.top - lock.top;
                    if (window.__chessRemoteApplyingXadrez30 === true && Math.abs(diff) > 14 && Math.abs(diff) < Math.max(260, window.innerHeight * 0.85)) {
                        window.scrollTo({ top: Math.max(0, window.scrollY + diff), behavior: 'auto' });
                    }
                    if (lock.activeId) {
                        const active = document.getElementById(lock.activeId);
                        if (active && document.activeElement !== active && /INPUT|TEXTAREA|BUTTON/.test(active.tagName)) {
                            try { active.focus({ preventScroll: true }); } catch (_) {}
                        }
                    }
                    setTimeout(() => document.body.classList.remove('chess-stabilizing-online'), 80);
                };
                requestAnimationFrame(() => {
                    restaurar();
                    requestAnimationFrame(restaurar);
                });
            }

            function nomeSeguroJogadorXadrez29(player, fallback) {
                return player && player.name ? escapeHtmlXadrez(player.name) : escapeHtmlXadrez(fallback || 'Aguardando');
            }

            function souEuJogadorXadrez29(player) {
                return !!(player && player.id && player.id === getChessUid());
            }

            function garantirBarraJogadoresXadrez29() {
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!boardWrap) return null;
                let bar = document.getElementById('chess-game-players-bar');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'chess-game-players-bar';
                    bar.className = 'chess-game-players-bar';
                    boardWrap.insertAdjacentElement('beforebegin', bar);
                }
                return bar;
            }

            function atualizarBarraJogadoresXadrez29(force = false) {
                const bar = garantirBarraJogadoresXadrez29();
                if (!bar) return;
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) {
                    bar.style.display = 'none';
                    return;
                }
                const white = chessRoomPlayers?.white || null;
                const black = chessRoomPlayers?.black || null;
                const whiteName = nomeSeguroJogadorXadrez29(white, 'Aguardando brancas');
                const blackName = nomeSeguroJogadorXadrez29(black, 'Aguardando pretas');
                const html = `
                    <div class="chess-game-players-side">
                        <span>⚪</span><span class="chess-game-players-name ${souEuJogadorXadrez29(white) ? 'me' : ''}">${whiteName}${souEuJogadorXadrez29(white) ? ' (você)' : ''}</span>
                    </div>
                    <div class="chess-game-players-vs">contra</div>
                    <div class="chess-game-players-side">
                        <span class="chess-game-players-name ${souEuJogadorXadrez29(black) ? 'me' : ''}">${blackName}${souEuJogadorXadrez29(black) ? ' (você)' : ''}</span><span>⚫</span>
                    </div>
                `;
                if (force || html !== ultimoHtmlBarraJogadoresXadrez29) {
                    bar.innerHTML = html;
                    ultimoHtmlBarraJogadoresXadrez29 = html;
                }
                bar.style.display = 'flex';
            }

            function garantirChatRecolhivelXadrez29() {
                const chat = document.getElementById('chess-chat-panel');
                if (!chat) return;
                const title = chat.querySelector('.chess-chat-title');
                if (!title) return;
                if (!document.getElementById('chess-chat-toggle-mini')) {
                    title.innerHTML = '<span>💬 Chat</span><button id="chess-chat-toggle-mini" class="chess-chat-toggle-mini" type="button">+</button>';
                    title.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        const collapsed = chat.classList.toggle('chat-collapsed');
                        const btn = document.getElementById('chess-chat-toggle-mini');
                        if (btn) btn.textContent = collapsed ? '+' : '−';
                    });
                }
                if (document.body.classList.contains('chess-board-visible') && chessMode === 'online') {
                    chat.classList.add('chat-collapsed');
                    const btn = document.getElementById('chess-chat-toggle-mini');
                    if (btn) btn.textContent = '+';
                }
            }

            function compactarTelaOnlineXadrez29() {
                document.body.classList.toggle('chess-mode-online', chessMode === 'online');
                document.body.classList.toggle('chess-mode-training', chessMode === 'training');
                const boardVisible = document.body.classList.contains('chess-board-visible');
                const history = document.getElementById('chess-history-panel');
                if (history && boardVisible) history.style.display = 'none';
                const material = document.getElementById('chess-material-panel');
                if (material && boardVisible) material.style.display = 'none';
                const roomPanel = document.getElementById('chess-room-players-panel');
                if (roomPanel && boardVisible) roomPanel.style.display = 'none';
                const quickMenu = document.getElementById('chess-menu-organizer');
                if (quickMenu) quickMenu.style.display = 'none';
                const achievements = document.getElementById('chess-achievements-panel');
                if (achievements) achievements.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat && boardVisible) {
                    chat.style.display = chessMode === 'online' ? 'block' : 'none';
                    if (chessMode === 'online') chat.classList.add('chat-collapsed');
                }
                garantirChatRecolhivelXadrez29();
                atualizarBarraJogadoresXadrez29();
            }

            function inserirSeloFase29Xadrez() {
                const title = document.querySelector('#chess-screen .chess-title');
                if (!title || document.getElementById('chess-online-stability-pill')) return;
                const pill = document.createElement('div');
                pill.id = 'chess-online-stability-pill';
                pill.className = 'chess-online-stability-pill';
                pill.textContent = 'Fase 29 • Firebase mais leve';
                title.insertAdjacentElement('afterend', pill);
            }

            const renderOriginalXadrez29 = renderChessBoard;
            renderChessBoard = function renderChessBoardFase29() {
                const lock = window.__chessRemoteApplyingXadrez30 === true ? capturarTravaViewportXadrez29() : null;
                renderOriginalXadrez29.apply(this, arguments);
                inserirSeloFase29Xadrez();
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const aplicarOriginalXadrez29 = aplicarEstadoXadrezRemoto;
            aplicarEstadoXadrezRemoto = function aplicarEstadoXadrezRemotoFase29(data) {
                if (!data) return;
                chessCurrentRoomData = data || {};
                chessRoomPlayers = data.players && typeof data.players === 'object' ? data.players : { white: null, black: null };
                chessRoomSpectators = data.spectators && typeof data.spectators === 'object' ? data.spectators : {};

                const assinatura = assinaturaEstadoRemotoXadrez29(data);
                const boardJaExiste = !!document.querySelector('#chess-board .chess-square');
                const soMudouPresencaChatOuChamada = assinatura === ultimaAssinaturaRemotaXadrez29 && boardJaExiste;

                if (soMudouPresencaChatOuChamada) {
                    verificarAlertaDeVezXadrez(data);
                    renderizarListaJogadoresXadrez();
                    compactarTelaOnlineXadrez29();
                    return;
                }

                ultimaAssinaturaRemotaXadrez29 = assinatura;
                const lock = capturarTravaViewportXadrez29();
                window.__chessRemoteApplyingXadrez30 = true;
                try {
                    aplicarOriginalXadrez29.call(this, data);
                } finally {
                    window.__chessRemoteApplyingXadrez30 = false;
                }
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const mostrarOriginalXadrez29 = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase29() {
                const lock = capturarTravaViewportXadrez29();
                mostrarOriginalXadrez29.apply(this, arguments);
                inserirSeloFase29Xadrez();
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const ocultarOriginalXadrez29 = ocultarTabuleiroXadrezParaMenu;
            ocultarTabuleiroXadrezParaMenu = function ocultarTabuleiroXadrezParaMenuFase29() {
                ocultarOriginalXadrez29.apply(this, arguments);
                const bar = document.getElementById('chess-game-players-bar');
                if (bar) bar.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat) chat.classList.remove('chat-collapsed');
            };

            const atualizarPainelOriginalXadrez29 = atualizarPainelOnlineXadrez;
            atualizarPainelOnlineXadrez = function atualizarPainelOnlineXadrezFase29() {
                atualizarPainelOriginalXadrez29.apply(this, arguments);
                compactarTelaOnlineXadrez29();
            };

            const renderPlayersOriginalXadrez29 = renderizarListaJogadoresXadrez;
            renderizarListaJogadoresXadrez = function renderizarListaJogadoresXadrezFase29() {
                renderPlayersOriginalXadrez29.apply(this, arguments);
                atualizarBarraJogadoresXadrez29();
            };

            const renderHistoricoOriginalXadrez29 = renderHistorico;
            renderHistorico = function renderHistoricoFase29() {
                if (document.body.classList.contains('chess-board-visible')) {
                    const panel = document.getElementById('chess-history-panel');
                    if (panel) panel.style.display = 'none';
                    return;
                }
                renderHistoricoOriginalXadrez29.apply(this, arguments);
            };

            const entrarOriginalXadrez29 = entrarXadrezOnline;
            entrarXadrezOnline = async function entrarXadrezOnlineFase29() {
                ultimaAssinaturaRemotaXadrez29 = '';
                ultimoHtmlBarraJogadoresXadrez29 = '';
                return entrarOriginalXadrez29.apply(this, arguments);
            };

            const sairOriginalXadrez29 = sairXadrezOnline;
            sairXadrezOnline = function sairXadrezOnlineFase29() {
                ultimaAssinaturaRemotaXadrez29 = '';
                ultimoHtmlBarraJogadoresXadrez29 = '';
                return sairOriginalXadrez29.apply(this, arguments);
            };

            const resultadoOriginalXadrez29 = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function mostrarResultadoXadrezSeTerminouFase29() {
                resultadoOriginalXadrez29.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const limparResultadoOriginalXadrez29 = limparResultadoXadrez;
            limparResultadoXadrez = function limparResultadoXadrezFase29() {
                limparResultadoOriginalXadrez29.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                inserirSeloFase29Xadrez();
                garantirBarraJogadoresXadrez29();
                garantirChatRecolhivelXadrez29();
                compactarTelaOnlineXadrez29();
            });
        }

        instalarFase29XadrezOnlineEstavel();


        /* ✅ FASE 30 - AJUSTE FINO DO TABULEIRO NO CELULAR
           Corrige o tabuleiro descentralizado e evita micro-movimentos na hora de tocar nas peças.
           Mantém Damas intacta. */
        function instalarFase30XadrezTabuleiroCentralizado() {
            window.__tabuleiroArenaXadrezFase30InternaAtiva = true;
            window.__chessRemoteApplyingXadrez30 = false;

            function atualizarSeloFase30() {
                const pill = document.getElementById('chess-online-stability-pill');
                if (pill) pill.textContent = 'Fase 36 • Tabuleiro estável';
                const clean = document.querySelector('#chess-screen .chess-clean-game-pill');
                if (clean && /Online/i.test(clean.textContent || '')) {
                    clean.textContent = '🎯 Online estável + tabuleiro centralizado';
                }
                const warning = document.querySelector('#chess-screen .chess-warning');
                if (warning) {
                    warning.textContent = '✅ Fase 36 ativa: Xadrez Online estável, câmera abaixo do tabuleiro e Damas preservada.';
                }
            }

            function travarLarguraVisualXadrez30() {
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) return;
                const card = document.querySelector('#chess-screen .chess-card');
                const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                const shell = document.querySelector('#chess-screen .chess-coord-shell');
                const board = document.getElementById('chess-board');
                if (card) {
                    card.style.maxWidth = '100%';
                    card.style.width = '100%';
                    card.style.minHeight = 'auto';
                }
                if (wrap) {
                    wrap.style.width = '100%';
                    wrap.style.maxWidth = window.innerWidth <= 560 ? 'calc(100vw - 20px)' : '640px';
                    wrap.style.marginLeft = 'auto';
                    wrap.style.marginRight = 'auto';
                    wrap.style.aspectRatio = 'auto';
                    wrap.style.minHeight = 'auto';
                }
                if (shell) {
                    shell.style.width = '100%';
                    shell.style.aspectRatio = '1 / 1';
                }
                if (board) {
                    board.style.width = '100%';
                    board.style.height = '100%';
                    board.style.aspectRatio = '1 / 1';
                }
            }

            const renderAnteriorFase30 = renderChessBoard;
            renderChessBoard = function renderChessBoardFase30SemToques() {
                renderAnteriorFase30.apply(this, arguments);
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            };

            const mostrarAnteriorFase30 = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase30() {
                mostrarAnteriorFase30.apply(this, arguments);
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            };

            window.addEventListener('orientationchange', () => setTimeout(travarLarguraVisualXadrez30, 350));
            window.addEventListener('resize', () => setTimeout(travarLarguraVisualXadrez30, 80));
            document.addEventListener('DOMContentLoaded', () => {
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            });
        }

        instalarFase30XadrezTabuleiroCentralizado();

        window.abrirXadrezArena = abrirXadrezArena;
        window.resetChessGame = resetChessGame;
        window.desfazerJogadaXadrez = desfazerJogada;
        window.entrarXadrezOnline = entrarXadrezOnline;
        window.sairXadrezOnline = sairXadrezOnline;
        window.iniciarTreinoXadrez = iniciarTreinoXadrez;
        window.abrirAdminXadrezCentral = abrirAdminXadrezCentral;
        window.iniciarChamadaXadrez = iniciarChamadaXadrez;
        window.encerrarChamadaXadrez = encerrarChamadaXadrez;

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarModuloXadrez);
        else iniciarModuloXadrez();
    })();
