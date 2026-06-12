// Tabuleiro Arena - Separação 01
// Este arquivo carrega o app em partes menores e monta a mesma lógica original em tempo de execução.
// Assim começamos a separar o código sem mudar as regras da Damas nem do Xadrez.

const TABULEIRO_ARENA_PARTES = [
  "js/parts/app.01-base-damas-admin.js",
  "js/parts/app.02-xadrez-core.js",
  "js/parts/app.03-hub-ajustes-finais.js"
];

async function carregarTabuleiroArenaSeparado() {
  const textos = [];

  for (const caminho of TABULEIRO_ARENA_PARTES) {
    const resposta = await fetch(caminho + "?v=separacao01", { cache: "no-store" });
    if (!resposta.ok) {
      throw new Error("Não foi possível carregar: " + caminho);
    }
    textos.push(await resposta.text());
  }

  const codigoCompleto = textos.join("\n\n");
  const blob = new Blob([codigoCompleto], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);

  try {
    await import(url);
    console.log("Tabuleiro Arena carregado em partes: Separação 01");
  } finally {
    URL.revokeObjectURL(url);
  }
}

carregarTabuleiroArenaSeparado().catch((erro) => {
  console.error("Erro ao carregar o Tabuleiro Arena separado:", erro);
  const aviso = document.createElement("div");
  aviso.style.cssText = "position:fixed;inset:12px;z-index:99999;background:#7f1d1d;color:#fff;padding:16px;border-radius:12px;font-family:Arial;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35)";
  aviso.innerHTML = "<strong>Erro ao carregar o jogo.</strong><br>Confira se os arquivos da pasta <code>js/parts</code> foram enviados corretamente.";
  document.body.appendChild(aviso);
});
