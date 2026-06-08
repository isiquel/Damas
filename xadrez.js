/*
    XADREZ ARENA - FASE 1
    Arquivo separado da Damas Arena.
    Aqui fica somente a lógica inicial do Xadrez.
*/
(function () {
    'use strict';

    const pecasUnicode = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };

    let chessBoard = [];
    let chessTurn = 'white';
    let selectedSquare = null;
    let legalMoves = [];

    function criarPeca(color, type) {
        return { color, type };
    }

    function criarTabuleiroInicial() {
        const vazio = () => Array(8).fill(null);
        chessBoard = [
            [criarPeca('black', 'rook'), criarPeca('black', 'knight'), criarPeca('black', 'bishop'), criarPeca('black', 'queen'), criarPeca('black', 'king'), criarPeca('black', 'bishop'), criarPeca('black', 'knight'), criarPeca('black', 'rook')],
            Array.from({ length: 8 }, () => criarPeca('black', 'pawn')),
            vazio(),
            vazio(),
            vazio(),
            vazio(),
            Array.from({ length: 8 }, () => criarPeca('white', 'pawn')),
            [criarPeca('white', 'rook'), criarPeca('white', 'knight'), criarPeca('white', 'bishop'), criarPeca('white', 'queen'), criarPeca('white', 'king'), criarPeca('white', 'bishop'), criarPeca('white', 'knight'), criarPeca('white', 'rook')]
        ];
        chessTurn = 'white';
        selectedSquare = null;
        legalMoves = [];
    }

    function dentroDoTabuleiro(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function casaTemAdversario(row, col, color) {
        return dentroDoTabuleiro(row, col) && chessBoard[row][col] && chessBoard[row][col].color !== color;
    }

    function casaLivre(row, col) {
        return dentroDoTabuleiro(row, col) && !chessBoard[row][col];
    }

    function adicionarMovimentoSeValido(moves, row, col, color) {
        if (!dentroDoTabuleiro(row, col)) return false;

        const destino = chessBoard[row][col];

        if (!destino) {
            moves.push({ row, col, capture: false });
            return true;
        }

        if (destino.color !== color) {
            moves.push({ row, col, capture: true });
        }

        return false;
    }

    function movimentosLinha(row, col, color, direcoes) {
        const moves = [];

        for (const [dr, dc] of direcoes) {
            let r = row + dr;
            let c = col + dc;

            while (dentroDoTabuleiro(r, c)) {
                const continuar = adicionarMovimentoSeValido(moves, r, c, color);
                if (!continuar) break;

                r += dr;
                c += dc;
            }
        }

        return moves;
    }

    function calcularMovimentos(row, col) {
        const peca = chessBoard[row][col];
        if (!peca) return [];

        const { color, type } = peca;
        const moves = [];

        if (type === 'pawn') {
            const dir = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;

            if (casaLivre(row + dir, col)) {
                moves.push({ row: row + dir, col, capture: false });

                if (row === startRow && casaLivre(row + dir * 2, col)) {
                    moves.push({ row: row + dir * 2, col, capture: false });
                }
            }

            for (const dc of [-1, 1]) {
                if (casaTemAdversario(row + dir, col + dc, color)) {
                    moves.push({ row: row + dir, col: col + dc, capture: true });
                }
            }

            return moves;
        }

        if (type === 'rook') {
            return movimentosLinha(row, col, color, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]);
        }

        if (type === 'bishop') {
            return movimentosLinha(row, col, color, [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1]
            ]);
        }

        if (type === 'queen') {
            return movimentosLinha(row, col, color, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1]
            ]);
        }

        if (type === 'knight') {
            for (const [dr, dc] of [
                [2, 1],
                [2, -1],
                [-2, 1],
                [-2, -1],
                [1, 2],
                [1, -2],
                [-1, 2],
                [-1, -2]
            ]) {
                adicionarMovimentoSeValido(moves, row + dr, col + dc, color);
            }

            return moves;
        }

        if (type === 'king') {
            for (const [dr, dc] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1]
            ]) {
                adicionarMovimentoSeValido(moves, row + dr, col + dc, color);
            }

            return moves;
        }

        return moves;
    }

    function nomeCor(color) {
        return color === 'white' ? 'brancas' : 'pretas';
    }

    function atualizarStatus(textoExtra) {
        const status = document.getElementById('chess-status');
        if (!status) return;

        const base = `Vez das ${nomeCor(chessTurn)}.`;
        status.textContent = textoExtra ? `${base} ${textoExtra}` : base;
    }

    function renderChessBoard() {
        const boardEl = document.getElementById('chess-board');
        if (!boardEl) return;

        boardEl.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'chess-light' : 'chess-dark'}`;
                square.dataset.row = String(row);
                square.dataset.col = String(col);
                square.setAttribute('role', 'button');
                square.setAttribute('aria-label', `Casa ${row + 1}, ${col + 1}`);

                if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                const move = legalMoves.find(m => m.row === row && m.col === col);
                if (move) {
                    square.classList.add(move.capture ? 'capture' : 'legal');
                }

                const peca = chessBoard[row][col];

                if (peca) {
                    const span = document.createElement('span');
                    span.className = `chess-piece ${peca.color}`;
                    span.textContent = pecasUnicode[peca.color][peca.type];
                    square.appendChild(span);
                }

                square.addEventListener('click', () => handleChessSquareClick(row, col));
                boardEl.appendChild(square);
            }
        }
    }

    function handleChessSquareClick(row, col) {
        const peca = chessBoard[row][col];

        if (selectedSquare) {
            const move = legalMoves.find(m => m.row === row && m.col === col);

            if (move) {
                chessBoard[row][col] = chessBoard[selectedSquare.row][selectedSquare.col];
                chessBoard[selectedSquare.row][selectedSquare.col] = null;

                chessTurn = chessTurn === 'white' ? 'black' : 'white';
                selectedSquare = null;
                legalMoves = [];

                atualizarStatus('Movimento realizado.');
                renderChessBoard();
                return;
            }
        }

        if (!peca) {
            selectedSquare = null;
            legalMoves = [];
            atualizarStatus('Escolha uma peça da sua cor.');
            renderChessBoard();
            return;
        }

        if (peca.color !== chessTurn) {
            selectedSquare = null;
            legalMoves = [];
            atualizarStatus(`Agora é a vez das ${nomeCor(chessTurn)}.`);
            renderChessBoard();
            return;
        }

        selectedSquare = { row, col };
        legalMoves = calcularMovimentos(row, col);

        atualizarStatus(
            legalMoves.length
                ? 'Casas possíveis marcadas no tabuleiro.'
                : 'Essa peça não tem movimento livre agora.'
        );

        renderChessBoard();
    }

    function abrirXadrezArena() {
        document.body.classList.remove('platform-start-active', 'mode-selecting', 'game-selected');
        document.body.classList.add('chess-selected');

        const hub = document.getElementById('games-hub-panel');
        const lobby = document.getElementById('lobby-screen');
        const game = document.getElementById('game-screen');
        const chess = document.getElementById('chess-screen');

        if (hub) hub.style.display = 'none';
        if (lobby) lobby.style.display = 'none';
        if (game) game.style.display = 'none';
        if (chess) chess.style.display = 'block';

        if (!chessBoard.length) criarTabuleiroInicial();

        atualizarStatus('');
        renderChessBoard();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function voltarParaModalidades() {
        document.body.classList.remove('chess-selected', 'game-selected');
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
        criarTabuleiroInicial();
        atualizarStatus('Partida reiniciada.');
        renderChessBoard();
    }

    function iniciarModuloXadrez() {
        criarTabuleiroInicial();

        document.getElementById('chess-back-btn')?.addEventListener('click', voltarParaModalidades);
        document.getElementById('chess-reset-btn')?.addEventListener('click', resetChessGame);
    }

    window.abrirXadrezArena = abrirXadrezArena;
    window.resetChessGame = resetChessGame;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarModuloXadrez);
    } else {
        iniciarModuloXadrez();
    }
})();
