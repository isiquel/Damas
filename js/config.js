/*
  Tabuleiro Arena — Separação 03
  Arquivo de configuração geral.

  IMPORTANTE:
  - Este arquivo NÃO mexe nas regras da Damas.
  - Este arquivo NÃO mexe nas regras do Xadrez.
  - Este arquivo NÃO mexe no Admin.
  - Ele apenas deixa informações gerais em um lugar separado,
    para começarmos a organizar o JavaScript com segurança.
*/
(function () {
  'use strict';

  window.TABULEIRO_ARENA_CONFIG = Object.freeze({
    appName: 'Tabuleiro Arena',
    baseEstavel: 'Fase 40',
    etapaOrganizacao: 'Separação 03 — JS Config Seguro',
    cameraXadrez: 'pausada',
    ambienteTeste: '/fase33/',
    regraDeTrabalho: 'Toda melhoria nova deve ser testada primeiro na /fase33/ antes de ir para o principal.',
    modulos: Object.freeze({
      damas: 'preservada',
      xadrez: 'funcionando',
      admin: 'funcionando',
      chat: 'funcionando',
      torneios: 'em evolução'
    })
  });
})();
