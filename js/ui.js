// ================================================================
// Tabuleiro Arena — Separação 05
// js/ui.js
//
// Funções visuais pequenas: alertas bonitos e confirmações.
// Não mexe nas regras da Damas, do Xadrez, do Admin, Firebase,
// salas, ranking ou chat.
// ================================================================
(function () {
    'use strict';

    let acaoConfirmadaCallback = null;

    function textoPlano(htmlOuTexto) {
        const temp = document.createElement('div');
        temp.innerHTML = String(htmlOuTexto ?? '');
        return temp.textContent || temp.innerText || '';
    }

    function exibirAlertaDoSistema(titulo, texto) {
        const modal = document.getElementById('custom-alert-modal');
        const tituloEl = document.getElementById('custom-alert-title');
        const textoEl = document.getElementById('custom-alert-text');

        if (!modal || !tituloEl || !textoEl) {
            window.alert(`${titulo || 'Aviso'}\n\n${textoPlano(texto)}`);
            return;
        }

        tituloEl.innerText = String(titulo ?? 'Aviso');
        textoEl.innerHTML = String(texto ?? '');
        modal.style.display = 'flex';
    }

    function fecharAlertaDoSistema() {
        const modal = document.getElementById('custom-alert-modal');
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('vitoria-animada');
    }

    function exibirConfirmacao(titulo, texto, callbackSim) {
        const modal = document.getElementById('custom-confirm-modal');
        const tituloEl = document.getElementById('custom-confirm-title');
        const textoEl = document.getElementById('custom-confirm-text');

        if (!modal || !tituloEl || !textoEl) {
            if (window.confirm(`${titulo || 'Confirmar'}\n\n${textoPlano(texto)}`) && typeof callbackSim === 'function') callbackSim();
            return;
        }

        tituloEl.innerHTML = String(titulo ?? 'Confirmar');
        textoEl.innerHTML = String(texto ?? '');
        modal.style.display = 'flex';
        acaoConfirmadaCallback = typeof callbackSim === 'function' ? callbackSim : null;
    }

    function fecharConfirmacao() {
        const modal = document.getElementById('custom-confirm-modal');
        if (modal) modal.style.display = 'none';
        acaoConfirmadaCallback = null;
    }

    function confirmarSim() {
        const callback = acaoConfirmadaCallback;
        fecharConfirmacao();
        if (typeof callback === 'function') callback();
    }

    function instalarEventosUI() {
        document.getElementById('close-alert-btn')?.addEventListener('click', fecharAlertaDoSistema);
        document.getElementById('btn-confirm-yes')?.addEventListener('click', confirmarSim);
        document.getElementById('btn-confirm-no')?.addEventListener('click', fecharConfirmacao);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', instalarEventosUI, { once: true });
    } else {
        instalarEventosUI();
    }

    window.TabuleiroArenaUI = {
        exibirAlertaDoSistema,
        fecharAlertaDoSistema,
        exibirConfirmacao,
        fecharConfirmacao
    };
})();
