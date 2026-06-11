/*
   TABULEIRO ARENA - ADMIN 02
   Correção: painel admin do Xadrez não aparece mais dentro da partida.
   Não altera Damas, regras de jogo, tabuleiro, chat ou ranking.
*/
(function admin02PainelSomenteAdmin(){
  const ADMIN_BODY_CLASS = 'admin02-chess-admin-open';
  const PLAYING_BODY_CLASS = 'admin02-chess-playing';

  function isElementVisible(el){
    if(!el) return false;
    const style = window.getComputedStyle(el);
    if(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function chessBoardIsVisible(){
    const boardWrap = document.querySelector('.chess-board-wrap');
    const board = document.getElementById('chess-board') || document.querySelector('.chess-board');
    const actions = document.querySelector('.chess-actions');
    return isElementVisible(boardWrap) || isElementVisible(board) || isElementVisible(actions) ||
      document.body.classList.contains('chess-game-active') ||
      document.body.classList.contains('chess-board-visible');
  }

  function adminModeIsOpen(){
    return document.body.classList.contains('chess-admin-only');
  }

  function limparTextosDoAdminXadrez(){
    document.querySelectorAll('.chess-admin-title').forEach(el => {
      el.textContent = '🛡️ Painel Admin do Xadrez — Controle de Salas';
    });
    document.querySelectorAll('.chess-admin-desc').forEach(el => {
      if(!el.textContent) return;
      el.textContent = el.textContent
        .replace(/Painel Admin do Xadrez\s*[—-]\s*Fase\s*12\.1/gi, 'Painel Admin do Xadrez — Controle de Salas')
        .replace(/Fase\s*12\.1\s*ativa:?/gi, 'Painel Admin aberto:')
        .replace(/Fase\s*12\s*ativa:?/gi, 'Sala online ativa:')
        .replace(/servidores/gi, 'salas')
        .replace(/sala espionada/gi, 'monitoramento do chat');
    });

    const panel = document.getElementById('chess-admin-panel');
    if(panel){
      panel.querySelectorAll('*').forEach(el => {
        if(!el.childNodes || el.childNodes.length > 1 || !el.textContent) return;
        el.textContent = el.textContent
          .replace(/Painel Admin do Xadrez\s*[—-]\s*Fase\s*12\.1/gi, 'Painel Admin do Xadrez — Controle de Salas')
          .replace(/Lista Geral de Servidores/gi, 'Lista geral de salas')
          .replace(/Sincronizando Servidores/gi, 'Sincronizando salas')
          .replace(/ESCUTA ATIVA:\s*SALA ESPIONADA/gi, 'Monitoramento do chat da sala');
      });
    }
  }

  function protegerTelaDoJogo(){
    const panel = document.getElementById('chess-admin-panel');
    if(!panel) return;

    const jogando = chessBoardIsVisible();
    const adminAberto = adminModeIsOpen() && !jogando;

    document.body.classList.toggle(PLAYING_BODY_CLASS, !!jogando);
    document.body.classList.toggle(ADMIN_BODY_CLASS, !!adminAberto);

    if(jogando){
      panel.style.setProperty('display', 'none', 'important');
      panel.style.setProperty('visibility', 'hidden', 'important');
      panel.style.setProperty('pointer-events', 'none', 'important');
      return;
    }

    if(adminAberto){
      panel.style.setProperty('display', 'block', 'important');
      panel.style.setProperty('visibility', 'visible', 'important');
      panel.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function aplicarAdmin02(){
    limparTextosDoAdminXadrez();
    protegerTelaDoJogo();
  }

  document.addEventListener('DOMContentLoaded', aplicarAdmin02);
  window.addEventListener('load', aplicarAdmin02);
  document.addEventListener('click', () => setTimeout(aplicarAdmin02, 80), true);
  document.addEventListener('input', () => setTimeout(aplicarAdmin02, 80), true);

  const obs = new MutationObserver(() => aplicarAdmin02());
  obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });

  setInterval(aplicarAdmin02, 600);
})();
