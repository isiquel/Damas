/* ======================================================================
   TABULEIRO ARENA - ADMIN 05
   Admin do Xadrez sem travar.
   Esta correção NÃO usa MutationObserver e NÃO usa setInterval.
   Ela apenas reforça a tela certa em poucos tempos depois do clique.
   ====================================================================== */
(function admin05XadrezAdminSemTravar(){
  if(window.__TA_ADMIN05_XADREZ_SEM_TRAVAR__) return;
  window.__TA_ADMIN05_XADREZ_SEM_TRAVAR__ = true;

  function byId(id){ return document.getElementById(id); }

  function show(el){
    if(!el) return;
    el.style.setProperty('display','block','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('opacity','1','important');
    el.style.setProperty('pointer-events','auto','important');
  }

  function hide(el){
    if(!el) return;
    el.style.setProperty('display','none','important');
  }

  function limparTextoPainel(){
    const title = document.querySelector('#chess-admin-panel .chess-admin-title');
    if(title) title.textContent = '🛡️ Painel Admin do Xadrez';
    const desc = document.querySelector('#chess-admin-panel .chess-admin-desc');
    if(desc){
      desc.textContent = 'Controle as salas online do Xadrez: liberar, bloquear, expulsar jogadores, resetar partidas e monitorar o chat.';
    }
  }

  function aplicarTelaAdminXadrez(){
    const chess = byId('chess-screen');
    const panel = byId('chess-admin-panel');

    // Classes limpas: admin sim, jogo não.
    document.body.classList.add('chess-selected','chess-admin-only','admin05-xadrez-admin-open');
    document.body.classList.remove(
      'platform-start-active','mode-selecting','game-selected','domino-selected',
      'chess-focus-mode','chess-beginner-mode','chess-menu-active','chess-game-active',
      'chess-board-visible','chess-mode-online','chess-mode-training','ta-xadrez-damas-layout',
      'admin03-xadrez-jogando','admin02-chess-playing'
    );

    hide(byId('games-hub-panel'));
    hide(byId('lobby-screen'));
    hide(byId('game-screen'));
    show(chess);

    // Dentro do admin, some jogo/menu, fica só painel de controle.
    hide(byId('chess-online-panel'));
    hide(byId('chess-training-panel'));
    hide(byId('chess-status'));
    hide(byId('chess-toast'));
    hide(byId('chess-material-panel'));
    hide(byId('chess-history-panel'));
    hide(byId('chess-chat-panel'));
    document.querySelectorAll('#chess-screen .chess-board-wrap, #chess-screen .chess-actions, #chess-screen .chess-action-note, #chess-screen .chess-warning').forEach(hide);

    limparTextoPainel();
    show(panel);
    if(panel){
      panel.style.setProperty('max-height','none','important');
      panel.style.setProperty('height','auto','important');
      panel.style.setProperty('overflow','visible','important');
      panel.style.setProperty('margin','14px 0','important');
      panel.style.setProperty('padding','14px','important');
      panel.style.setProperty('border','2px dashed #c084fc','important');
    }
  }

  function reforcarDepoisDoClique(){
    // O app.js original cria/atualiza o painel. Nós só reforçamos visualmente, poucas vezes.
    [120, 350, 800, 1300].forEach(ms => setTimeout(aplicarTelaAdminXadrez, ms));
  }

  function sairModoAdminXadrez(){
    document.body.classList.remove('admin05-xadrez-admin-open','chess-admin-only');
  }

  document.addEventListener('click', function(ev){
    const alvo = ev.target;
    if(!alvo) return;

    if(alvo.closest('#central-admin-xadrez-btn')){
      reforcarDepoisDoClique();
      return;
    }

    if(alvo.closest('#central-admin-damas-btn, #central-admin-back-btn, #game-card-checkers, #game-card-chess, #chess-back-btn, #chess-back-btn-bottom')){
      sairModoAdminXadrez();
    }
  }, true);
})();
