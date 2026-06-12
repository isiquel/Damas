// ================================================================
// Tabuleiro Arena — Separação 04
// js/utils.js
//
// Funções pequenas e seguras de apoio.
// Não mexe nas regras da Damas, do Xadrez, do Admin, do Firebase,
// das salas, do ranking nem do chat.
// ================================================================
(function () {
    'use strict';

    function somenteTextoSeguro(valor, limite = 80) {
        return String(valor ?? '')
            .replace(/[<>`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, limite);
    }

    function nomeSeguro(valor) {
        return somenteTextoSeguro(valor || 'Jogador', 15) || 'Jogador';
    }

    function salaSegura(valor) {
        return String(valor ?? '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 15);
    }

    function numeroSeguro(valor, padrao = 0) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : padrao;
    }

    function limparElemento(el) {
        while (el && el.firstChild) el.removeChild(el.firstChild);
    }

    function criarTexto(tag, texto, className = '') {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.innerText = String(texto ?? '');
        return el;
    }

    function telefoneSeguro(valor) {
        let n = String(valor ?? '').replace(/\D/g, '');
        if (!n) return '';
        if (n.length === 10 || n.length === 11) n = '55' + n;
        return n.slice(0, 14);
    }

    function textoAvisoSeguro(valor, limite = 220) {
        return somenteTextoSeguro(valor || '', limite);
    }

    window.TabuleiroArenaUtils = {
        somenteTextoSeguro,
        nomeSeguro,
        salaSegura,
        numeroSeguro,
        limparElemento,
        criarTexto,
        telefoneSeguro,
        textoAvisoSeguro
    };
})();
