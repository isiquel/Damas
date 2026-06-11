/* ======================================================================
   TABULEIRO ARENA - XADREZ LIMPO 01
   Ajusta só a tela visual da partida do Xadrez para ficar parecida com a
   Damas. Não mexe nas regras, no Firebase nem na Damas.
   ====================================================================== */
(function xadrezLimpoIgualDamas01(){
  if (window.__TA_XADREZ_LIMPO_IGUAL_DAMAS_01__) return;
  window.__TA_XADREZ_LIMPO_IGUAL_DAMAS_01__ = true;

  function visivel(el){
    if(!el) return false;
    const st = getComputedStyle(el);
    if(st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function xadrezEmPartida(){
    const chessScreen = document.getElementById('chess-screen');
    const board = document.getElementById('chess-board');
    const wrap = document.querySelector('#chess-screen .chess-board-wrap');
    const actions = document.querySelector('#chess-screen .chess-actions');
    const temCasas = !!(board && board.children && board.children.length >= 32);
    return document.body.classList.contains('chess-selected') &&
           document.body.classList.contains('chess-board-visible') &&
           visivel(chessScreen) && temCasas && (visivel(wrap) || visivel(actions));
  }

  function esconderPainelAdminNoJogo(){
    if(document.body.classList.contains('chess-admin-only')) return;
    document.querySelectorAll('#chess-screen #chess-admin-panel, #chess-screen .chess-admin-panel').forEach(el => {
      if(xadrezEmPartida()){
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('max-height', '0', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
      } else {
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('height');
        el.style.removeProperty('max-height');
        el.style.removeProperty('margin');
        el.style.removeProperty('padding');
      }
    });
  }

  function garantirChatRecolhido(){
    const chat = document.getElementById('chess-chat-panel');
    if(!chat || !xadrezEmPartida()) return;
    chat.style.setProperty('display', 'block', 'important');
    if(!chat.classList.contains('chat-collapsed') && !chat.classList.contains('chess-chat-collapsed')){
      chat.classList.add('chat-collapsed');
    }
    const title = chat.querySelector('.chess-chat-title');
    if(title && !document.getElementById('chess-chat-toggle-mini')){
      title.innerHTML = '<span>💬 Chat</span><button id="chess-chat-toggle-mini" class="chess-chat-toggle-mini" type="button">+</button>';
      title.addEventListener('click', function(ev){
        ev.preventDefault();
        chat.classList.toggle('chat-collapsed');
        const btn = document.getElementById('chess-chat-toggle-mini');
        if(btn) btn.textContent = chat.classList.contains('chat-collapsed') ? '+' : '−';
      });
    }
  }

  function aplicarLayout(){
    const ativo = xadrezEmPartida() && !document.body.classList.contains('chess-admin-only');
    document.body.classList.toggle('ta-xadrez-damas-layout', ativo);
    esconderPainelAdminNoJogo();
    if(ativo){
      garantirChatRecolhido();
      const warning = document.querySelector('#chess-screen .chess-warning');
      if(warning) warning.style.setProperty('display', 'none', 'important');
      const callPanels = document.querySelectorAll('#chess-call-panel, .chess-call-panel, #chess-board-camera-panel, .chess-board-camera-panel, #fase36-camera-dock, .fase36-camera-dock');
      callPanels.forEach(el => el.style.setProperty('display', 'none', 'important'));
    }
  }

  // Evita que scripts antigos do Xadrez fiquem puxando o tabuleiro para cima/baixo.
  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  if(!window.__TA_XADREZ_SCROLL_INTO_VIEW_LOCK__){
    window.__TA_XADREZ_SCROLL_INTO_VIEW_LOCK__ = true;
    Element.prototype.scrollIntoView = function patchedScrollIntoView(){
      try {
        if (document.body.classList.contains('ta-xadrez-damas-layout') && this.closest && this.closest('#chess-screen')) {
          return;
        }
      } catch(_){ }
      return nativeScrollIntoView.apply(this, arguments);
    };
  }

  const nativeScrollTo = window.scrollTo.bind(window);
  if(!window.__TA_XADREZ_WINDOW_SCROLL_LOCK__){
    window.__TA_XADREZ_WINDOW_SCROLL_LOCK__ = true;
    window.scrollTo = function patchedWindowScrollTo(){
      try {
        if (document.body.classList.contains('ta-xadrez-damas-layout')) return;
      } catch(_){ }
      return nativeScrollTo.apply(window, arguments);
    };
  }

  let scheduled = false;
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      aplicarLayout();
    });
  }

  document.addEventListener('DOMContentLoaded', aplicarLayout);
  window.addEventListener('load', aplicarLayout);
  document.addEventListener('click', () => setTimeout(aplicarLayout, 60), true);

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });

  [80, 250, 600, 1200, 2200].forEach(ms => setTimeout(aplicarLayout, ms));
})();
