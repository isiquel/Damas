/* ======================================================================
   TABULEIRO ARENA - ADMIN 04
   Correção direta: o botão "Administrar Xadrez" deve abrir o painel
   administrativo do Xadrez e não pode ser bloqueado pelos ajustes visuais
   do Xadrez Limpo.
   Não mexe na Damas, no jogo, no treino, no chat ou nas regras.
   ====================================================================== */
(function admin04AdminXadrezAbreCerto(){
  if (window.__TA_ADMIN04_XADREZ_ABRE_CERTO__) return;
  window.__TA_ADMIN04_XADREZ_ABRE_CERTO__ = true;

  const ADMIN_CLASS = 'admin04-xadrez-admin-aberto';
  let forcarAdminXadrez = false;
  let debounceTimer = null;

  function el(id){ return document.getElementById(id); }

  function limparTextoAdmin(){
    document.querySelectorAll('.chess-admin-title').forEach(t => {
      t.textContent = '🛡️ Painel Admin do Xadrez';
    });
    document.querySelectorAll('.chess-admin-desc').forEach(d => {
      if(!d.textContent) return;
      d.textContent = d.textContent
        .replace(/Painel Admin do Xadrez\s*[—-]\s*Fase\s*12\.1/gi, 'Painel Admin do Xadrez')
        .replace(/Fase\s*12\.1\s*ativa:?/gi, 'Painel Admin aberto:')
        .replace(/Fase\s*12\.1/gi, 'Controle de salas')
        .replace(/servidores/gi, 'salas')
        .replace(/sala espionada/gi, 'monitoramento do chat');
    });
  }

  function mostrar(elm){
    if(!elm) return;
    elm.style.setProperty('display', 'block', 'important');
    elm.style.setProperty('visibility', 'visible', 'important');
    elm.style.setProperty('opacity', '1', 'important');
    elm.style.setProperty('pointer-events', 'auto', 'important');
  }

  function esconder(elm){
    if(!elm) return;
    elm.style.setProperty('display', 'none', 'important');
  }

  function abrirVisualAdminXadrez(){
    const panel = el('chess-admin-panel');
    const chess = el('chess-screen');

    document.body.classList.add('chess-selected', 'chess-admin-only', ADMIN_CLASS, 'admin03-xadrez-admin-real');
    document.body.classList.remove(
      'platform-start-active',
      'mode-selecting',
      'game-selected',
      'domino-selected',
      'chess-focus-mode',
      'chess-beginner-mode',
      'chess-menu-active',
      'chess-game-active',
      'chess-board-visible',
      'chess-mode-online',
      'chess-mode-training',
      'admin03-xadrez-jogando',
      'admin02-chess-playing',
      'ta-xadrez-damas-layout'
    );

    esconder(el('games-hub-panel'));
    esconder(el('lobby-screen'));
    esconder(el('game-screen'));
    mostrar(chess);

    // Esconde partes de jogo do Xadrez durante o admin.
    ['chess-online-panel','chess-training-panel','chess-status','chess-toast','chess-material-panel','chess-history-panel','chess-chat-panel'].forEach(id => esconder(el(id)));
    document.querySelectorAll('#chess-screen .chess-board-wrap, #chess-screen .chess-actions, #chess-screen .chess-warning').forEach(esconder);

    if(panel){
      mostrar(panel);
      panel.style.setProperty('max-height', 'none', 'important');
      panel.style.setProperty('height', 'auto', 'important');
      panel.style.setProperty('overflow', 'visible', 'important');
      panel.style.setProperty('margin', '14px 0', 'important');
      panel.style.setProperty('padding', '14px', 'important');
      panel.style.setProperty('border', '2px dashed #c084fc', 'important');
      limparTextoAdmin();
    }
  }

  function tentarAbrirAdminXadrez(){
    forcarAdminXadrez = true;
    // O app.js cria o painel depois do clique. Por isso reforçamos em tempos curtos.
    [80, 220, 500, 900, 1400].forEach(ms => setTimeout(abrirVisualAdminXadrez, ms));
  }

  function desativarForcaAdmin(){
    forcarAdminXadrez = false;
    document.body.classList.remove(ADMIN_CLASS);
  }

  document.addEventListener('click', function(ev){
    const alvo = ev.target;
    if(!alvo) return;

    if(alvo.closest('#central-admin-xadrez-btn')){
      tentarAbrirAdminXadrez();
      return;
    }

    if(alvo.closest('#central-admin-damas-btn, #central-admin-back-btn, #game-card-checkers, #game-card-chess, #game-card-admin, #chess-back-btn, #chess-back-btn-bottom')){
      desativarForcaAdmin();
    }
  }, true);

  const obs = new MutationObserver(() => {
    if(!forcarAdminXadrez && !document.body.classList.contains(ADMIN_CLASS)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(abrirVisualAdminXadrez, 60);
  });

  document.addEventListener('DOMContentLoaded', () => {
    obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
  });
})();
