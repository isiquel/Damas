/*
   TABULEIRO ARENA - ADMIN 01
   Ajustes de texto dos painéis administrativos após renderizações dinâmicas.
*/
(function admin01PaineisLimpos(){
  function trocarTexto(el, antes, depois){
    if(!el || !el.textContent) return;
    if(el.textContent.includes(antes)) el.textContent = el.textContent.replace(antes, depois);
  }
  function limparTextosAdmin(){
    document.querySelectorAll('.chess-admin-title').forEach(el => {
      el.textContent = '🛡️ Painel Admin do Xadrez — Controle de Salas';
    });
    document.querySelectorAll('.chess-admin-desc').forEach(el => {
      trocarTexto(el, 'Fase 12.1 ativa:', 'Painel Admin aberto:');
      trocarTexto(el, 'Fase 12 ativa:', 'Sala online ativa:');
    });
    document.querySelectorAll('*').forEach(el => {
      if(!el || !el.childNodes || el.childNodes.length > 1) return;
      trocarTexto(el, 'ESCUTA ATIVA: SALA ESPIONADA', 'Monitoramento do chat da sala');
      trocarTexto(el, 'Lista Geral de Servidores', 'Lista geral de salas');
      trocarTexto(el, 'Sincronizando Servidores', 'Sincronizando salas');
      trocarTexto(el, 'SAIR DO TERMINAL', 'VOLTAR / SAIR DO PAINEL');
    });
  }
  document.addEventListener('DOMContentLoaded', limparTextosAdmin);
  window.addEventListener('load', limparTextosAdmin);
  setTimeout(limparTextosAdmin, 500);
  const obs = new MutationObserver(() => limparTextosAdmin());
  obs.observe(document.documentElement, {childList:true, subtree:true});
})();
