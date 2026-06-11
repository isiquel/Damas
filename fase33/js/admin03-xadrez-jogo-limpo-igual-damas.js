/*
  TABULEIRO ARENA - ADMIN 03
  Corrige a causa do painel admin aparecendo no jogo do Xadrez.
  O painel admin só abre quando o dono entra em Administrar Xadrez.
*/
(function admin03XadrezJogoLimpo(){
  const ADMIN_CLASS = 'admin03-xadrez-admin-real';
  const PLAYING_CLASS = 'admin03-xadrez-jogando';

  function $(sel){ return document.querySelector(sel); }

  function visivel(el){
    if(!el) return false;
    const st = getComputedStyle(el);
    if(st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function telaXadrezVisivel(){
    return visivel(document.getElementById('chess-screen'));
  }

  function tabuleiroXadrezVisivel(){
    if(!telaXadrezVisivel()) return false;
    const board = document.getElementById('chess-board');
    const wrap = $('#chess-screen .chess-board-wrap');
    const actions = $('#chess-screen .chess-actions');
    const temCasas = !!(board && board.children && board.children.length >= 16);
    return temCasas && (visivel(board) || visivel(wrap) || visivel(actions));
  }

  function painelAdmin(){
    return document.getElementById('chess-admin-panel');
  }

  function limparTextos(){
    document.querySelectorAll('.chess-admin-title').forEach(el => {
      el.textContent = '🛡️ Painel Admin do Xadrez';
    });
    document.querySelectorAll('.chess-admin-desc').forEach(el => {
      if(!el.textContent) return;
      el.textContent = el.textContent
        .replace(/Painel Admin do Xadrez\s*[—-]\s*Fase\s*12\.1/gi, 'Painel Admin do Xadrez')
        .replace(/Fase\s*12\.1/gi, 'Controle de salas')
        .replace(/servidores/gi, 'salas')
        .replace(/sala espionada/gi, 'monitoramento do chat');
    });
  }

  function esconderPainelAdmin(){
    const p = painelAdmin();
    if(!p) return;
    p.style.setProperty('display','none','important');
    p.style.setProperty('visibility','hidden','important');
    p.style.setProperty('pointer-events','none','important');
    p.style.setProperty('max-height','0','important');
    p.style.setProperty('overflow','hidden','important');
    p.style.setProperty('margin','0','important');
    p.style.setProperty('padding','0','important');
    p.style.setProperty('border','0','important');
  }

  function mostrarPainelAdmin(){
    const p = painelAdmin();
    if(!p) return;
    p.style.setProperty('display','block','important');
    p.style.setProperty('visibility','visible','important');
    p.style.setProperty('pointer-events','auto','important');
    p.style.setProperty('max-height','none','important');
    p.style.setProperty('overflow','visible','important');
    p.style.setProperty('margin','14px 0','important');
    p.style.setProperty('padding','14px','important');
    p.style.setProperty('border','2px dashed #c084fc','important');
  }

  function ativarAdminReal(){
    document.body.classList.add(ADMIN_CLASS);
    document.body.classList.remove(PLAYING_CLASS);
    limparTextos();
    mostrarPainelAdmin();
  }

  function sairDoAdminReal(){
    document.body.classList.remove(ADMIN_CLASS);
    esconderPainelAdmin();
  }

  function sincronizar(){
    limparTextos();
    const jogando = tabuleiroXadrezVisivel();

    if(jogando){
      document.body.classList.add(PLAYING_CLASS);
      document.body.classList.remove(ADMIN_CLASS);
      document.body.classList.remove('chess-admin-only');
      esconderPainelAdmin();
      return;
    }

    document.body.classList.toggle(PLAYING_CLASS, false);

    const deveMostrarAdmin = document.body.classList.contains(ADMIN_CLASS) && document.body.classList.contains('chess-admin-only');
    if(deveMostrarAdmin) mostrarPainelAdmin();
    else esconderPainelAdmin();
  }

  function acaoDeJogo(target){
    return !!target.closest([
      '#game-card-chess',
      '#chess-back-btn',
      '#chess-back-btn-bottom',
      '#chess-reset-btn',
      '#chess-new-btn',
      '#chess-resign-btn',
      '#chess-board-leave-online-btn',
      '#chess-online-panel button',
      '#chess-training-panel button',
      '#chess-board',
      '.chess-square'
    ].join(','));
  }

  document.addEventListener('click', function(ev){
    const target = ev.target;
    if(!target) return;

    if(target.closest('#central-admin-xadrez-btn')){
      setTimeout(ativarAdminReal, 250);
      setTimeout(ativarAdminReal, 800);
      return;
    }

    if(acaoDeJogo(target)){
      sairDoAdminReal();
      setTimeout(sincronizar, 120);
      setTimeout(sincronizar, 450);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', sincronizar);
  window.addEventListener('load', sincronizar);
  window.addEventListener('resize', sincronizar);

  const obs = new MutationObserver(() => sincronizar());
  obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });

  setInterval(sincronizar, 700);
})();
