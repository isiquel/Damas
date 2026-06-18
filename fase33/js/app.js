import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, set, onValue, update, get, push, onDisconnect, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
    import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const firebaseConfig = {
        apiKey: "AIzaSyAyjusKD0t6DOtI93bxYbWRSiSHe0jvStA",
        authDomain: "damas-57b07.firebaseapp.com",
        databaseURL: "https://damas-57b07-default-rtdb.firebaseio.com",
        projectId: "damas-57b07",
        storageBucket: "damas-57b07.firebasestorage.app",
        messagingSenderId: "178140626924",
        appId: "1:178140626924:web:195432bbba189d48630ac9"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);
    const auth = getAuth(app);

    let playerId = null; 
    let roomId = "";
    let playerRole = "spectator"; 
    let isPracticeMode = false;
    let practiceDifficulty = "medio";
    let isLearningMode = false;
    let currentLearningHint = null;
    let learningTipsVisible = true; 
    let currentGameState = null;
    let selectedPiece = null;
    let validMoves = [];
    let hasRecordedResult = false;
    let lockPieceForMultiCapture = null;
    let ultimoContadorEspectadores = 0;
    
    let gameTimerInterval = null;
    let isChatMutedLocally = false;

    let ultimoTurnoRegistrado = 0;
    let timestampInicioTurnoAtual = 0;
    let jaAlertouTurnoDemorado = false;
    
    let emContagemRegressivaAtiva = false;
    let listenerChatAdminAtivo = null;
    let alertaFimPartidaMostrado = false;
    let ultimaContagemInicioMostrada = 0;
    let tabuleiroViradoManual = false;

    let callPeer = null;
    let localCallStream = null;
    let callUnsubscribers = [];
    let processedRemoteCandidates = new Set();
    let callStartedByUser = false;
    let remoteDescriptionApplied = false;
    let localMicEnabled = true;
    let localCameraEnabled = true;

    // 👁️ Transmissão da chamada para espectadores.
    // Mantém a chamada dos jogadores intacta e cria conexões separadas, somente para assistir.
    let spectatorWatchActive = false;
    let spectatorWatchConnecting = false;
    let spectatorWatchUnsubscribers = [];
    let spectatorWatchPeers = {};
    let spectatorWatchStreams = { p1: null, p2: null };
    let spectatorProcessedCandidates = new Set();
    let spectatorAudioP1 = null;
    let spectatorAudioP2 = null;

    // Conexões extras que cada jogador abre para enviar sua câmera/áudio aos espectadores.
    let playerSpectatorPeers = {};
    let playerSpectatorUnsubscribers = [];
    let playerProcessedSpectatorCandidates = new Set();
    let playerAnsweredSpectatorOffers = new Set();
    let playerSpectatorOfferKeys = {};



    // ================================================================
    // 🔐 CAMADA DE SEGURANÇA E HIGIENIZAÇÃO - v Segurança Premium
    // Mantém o jogo igual, mas reduz brechas no admin, sala, chat e ranking.
    // IMPORTANTE: para blindagem real, publique também as regras do Firebase
    // que estão no final deste arquivo como comentário.
    // ================================================================
    const ADMIN_ROOM_CODE = "00";
    const LEGACY_FIRST_ADMIN_NAME = "isiquel_admin";
    const WHATSAPP_SUPORTE = "5544991711936";
    const ADMIN_EMAIL_AUTORIZADO = "isiquelcamilanatan@gmail.com";
    const APP_VERSION_10 = "10/10 Fase 2 gratuita - Admin e salas reforçados";
    const TEMPO_MAX_LOGIN_ADMIN_MS = 12000;
    let usuarioAdminConfirmado = false;
    let usuarioLogadoPorSenha = false;
    let emailAdministradorAtual = "";

    // ================================================================
    // 🧰 SEPARAÇÃO 04 — UTILITÁRIOS SEGUROS
    // Estas funções pequenas foram movidas para js/utils.js.
    // O app.js continua controlando as regras da Damas, Xadrez, Admin e salas.
    // ================================================================
    const {
        somenteTextoSeguro,
        nomeSeguro,
        salaSegura,
        numeroSeguro,
        limparElemento,
        criarTexto,
        telefoneSeguro,
        textoAvisoSeguro
    } = window.TabuleiroArenaUtils || {};


    // ================================================================
    // 🪟 SEPARAÇÃO 05 — UI / ALERTAS / CONFIRMAÇÕES
    // Estas funções visuais foram movidas para js/ui.js.
    // O app.js continua controlando Damas, Xadrez, Admin, salas e regras.
    // ================================================================
    const TA_UI = window.TabuleiroArenaUI || {};
    const exibirAlertaDoSistema = TA_UI.exibirAlertaDoSistema || ((titulo, texto) => {
        const limpo = String(texto ?? '').replace(/<[^>]*>/g, '');
        window.alert(`${titulo || 'Aviso'}

${limpo}`);
    });
    const exibirConfirmacao = TA_UI.exibirConfirmacao || ((titulo, texto, callbackSim) => {
        const limpo = String(texto ?? '').replace(/<[^>]*>/g, '');
        if (window.confirm(`${titulo || 'Confirmar'}

${limpo}`) && typeof callbackSim === 'function') callbackSim();
    });

    async function registrarJogadorComunidade(nomeBase) {
        if (!playerId || !db) return;
        const nome = nomeSeguro(nomeBase || nameInput?.value || "Jogador");
        const whatsapp = telefoneSeguro(document.getElementById('whatsapp-input')?.value || "");
        const consentiu = !!document.getElementById('whatsapp-consent')?.checked;
        try {
            await update(ref(db, `players/${playerId}`), {
                name: nome,
                whatsapp: whatsapp,
                whatsappConsent: consentiu && !!whatsapp,
                lastSeen: Date.now()
            });
        } catch (e) {
            console.warn("Não foi possível salvar cadastro do jogador:", e);
        }
    }

    function formatarDataTorneio(valor) {
        if (!valor) return "Data a definir";
        try {
            const d = new Date(valor);
            if (Number.isNaN(d.getTime())) return String(valor);
            return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        } catch (_) { return String(valor); }
    }

    function criarCardTorneio(torneio, id) {
        const card = document.createElement('div');
        card.className = 'tournament-card';
        const titulo = document.createElement('strong');
        titulo.innerText = `🏆 ${somenteTextoSeguro(torneio.name || 'Torneio de Damas', 60)}`;
        const meta = criarTexto('div', `📅 ${formatarDataTorneio(torneio.date)} • Sala: ${(torneio.room || 'a definir').toUpperCase()} • Status: ${torneio.status || 'aberto'}`, 'tiny-muted');
        const msg = criarTexto('div', textoAvisoSeguro(torneio.message || 'Participe do torneio e acompanhe as partidas no app.', 180), 'tiny-muted');
        card.append(titulo, meta, msg);
        if (torneio.room) {
            const btn = document.createElement('button');
            btn.className = 'mini-action-btn';
            btn.innerText = 'Assistir sala do torneio';
            btn.onclick = () => {
                roomInput.value = salaSegura(torneio.room);
                spectateBtn.click();
            };
            card.appendChild(btn);
        }
        return card;
    }

    const TORNEIO_AUTO_DELETE_MS = 30 * 24 * 60 * 60 * 1000;

    function torneioEncerradoAntigo(torneio) {
        if (!torneio || torneio.status !== 'encerrado') return false;
        const base = numeroSeguro(torneio.closedAt || torneio.updatedAt || torneio.createdAt);
        if (!base) return false;
        return Date.now() - base > TORNEIO_AUTO_DELETE_MS;
    }

    async function limparTorneiosEncerradosAntigos(caminho, nomeJogo) {
        try {
            if (!auth.currentUser) return;
            const snap = await get(ref(db, caminho));
            const data = snap.val() || {};
            const antigos = Object.entries(data).filter(([_, t]) => torneioEncerradoAntigo(t || {}));
            if (!antigos.length) return;
            await Promise.all(antigos.map(([id]) => remove(ref(db, `${caminho}/${id}`))));
            console.log(`Torneios antigos removidos automaticamente (${nomeJogo}):`, antigos.length);
        } catch (e) {
            console.warn(`Não foi possível limpar torneios antigos de ${nomeJogo}:`, e);
        }
    }

    function carregarTorneiosLobby() {
        const list = document.getElementById('tournament-lobby-list');
        if (!list) return;
        onValue(ref(db, 'tournaments'), (snapshot) => {
            limparElemento(list);
            const data = snapshot.val();
            if (!data) {
                list.appendChild(criarTexto('div', 'Nenhum torneio publicado ainda.', 'tiny-muted'));
                return;
            }
            const torneios = Object.entries(data)
                .map(([id, t]) => [id, t || {}])
                .filter(([_, t]) => t.status !== 'encerrado')
                .sort((a, b) => numeroSeguro(b[1].createdAt) - numeroSeguro(a[1].createdAt))
                .slice(0, 5);
            if (!torneios.length) {
                list.appendChild(criarTexto('div', 'Nenhum torneio aberto no momento.', 'tiny-muted'));
                return;
            }
            torneios.forEach(([id, t]) => list.appendChild(criarCardTorneio(t, id)));
        });
    }

    function carregarPartidasAoVivoLobby() {
        const list = document.getElementById('live-games-lobby-list');
        if (!list) return;
        onValue(ref(db, 'liveGames'), (snapshot) => {
            limparElemento(list);
            const data = snapshot.val();
            if (!data) {
                list.appendChild(criarTexto('div', 'Nenhuma partida ao vivo no momento.', 'tiny-muted'));
                return;
            }
            const jogos = Object.entries(data)
                .filter(([_, g]) => g && g.status === 'playing')
                .sort((a, b) => numeroSeguro(b[1].updatedAt) - numeroSeguro(a[1].updatedAt))
                .slice(0, 6);
            if (!jogos.length) {
                list.appendChild(criarTexto('div', 'Nenhuma partida ao vivo no momento.', 'tiny-muted'));
                return;
            }
            jogos.forEach(([id, g]) => {
                const card = document.createElement('div');
                card.className = 'live-game-card';
                const title = document.createElement('strong');
                title.innerText = `🔥 Sala ${id.toUpperCase()}`;
                const info = criarTexto('div', `${nomeSeguro(g.p1Name || 'Jogador 1')} vs ${nomeSeguro(g.p2Name || 'Jogador 2')}`, 'tiny-muted');
                const btn = document.createElement('button');
                btn.className = 'mini-action-btn';
                btn.innerText = 'Assistir como espectador';
                btn.onclick = () => { roomInput.value = salaSegura(id); spectateBtn.click(); };
                card.append(title, info, btn);
                list.appendChild(card);
            });
        });
    }

    async function atualizarPartidaAoVivo(roomName, data) {
        if (!roomName || isPracticeMode || playerRole === 'admin') return;
        try {
            if (data.status === 'playing' && data.p1Name && data.p2Name) {
                await update(ref(db, `liveGames/${roomName}`), {
                    status: 'playing',
                    p1Name: nomeSeguro(data.p1Name),
                    p2Name: nomeSeguro(data.p2Name),
                    updatedAt: Date.now()
                });
            } else if (data.status === 'finished') {
                await update(ref(db, `liveGames/${roomName}`), { status: 'finished', updatedAt: Date.now() });
            }
        } catch (e) { console.warn('Não foi possível atualizar partidas ao vivo:', e); }
    }

    async function criarTorneioAdmin() {
        if (!(await exigirAdminSeguro())) return;
        const nome = somenteTextoSeguro(document.getElementById('tournament-name-input')?.value || '', 60);
        const data = document.getElementById('tournament-date-input')?.value || '';
        const sala = salaSegura(document.getElementById('tournament-room-input')?.value || '');
        const mensagem = textoAvisoSeguro(document.getElementById('tournament-message-input')?.value || '', 220);
        if (!nome) return exibirAlertaDoSistema('Torneio', 'Digite o nome do torneio.');
        const novoRef = push(ref(db, 'tournaments'));
        await set(novoRef, {
            name: nome,
            date: data,
            room: sala,
            message: mensagem || `Novo torneio de damas: ${nome}. Entre no app para participar!`,
            status: 'aberto',
            createdAt: Date.now(),
            createdBy: playerId
        });
        await registrarLogAdmin('criou_torneio', sala || nome);
        exibirAlertaDoSistema('Torneio Publicado 🏆', `O torneio <strong>${nome}</strong> foi publicado no lobby.`);
    }

    function carregarTorneiosAdmin() {
        const list = document.getElementById('admin-tournament-list');
        if (!list) return;
        limparTorneiosEncerradosAntigos('tournaments', 'Damas');
        onValue(ref(db, 'tournaments'), (snapshot) => {
            limparElemento(list);
            const data = snapshot.val();
            if (!data) {
                list.appendChild(criarTexto('div', 'Nenhum torneio criado.', 'tiny-muted'));
                return;
            }
            Object.entries(data)
                .sort((a, b) => numeroSeguro(b[1]?.createdAt) - numeroSeguro(a[1]?.createdAt))
                .slice(0, 8)
                .forEach(([id, t]) => {
                    const card = criarCardTorneio(t || {}, id);
                    const actions = document.createElement('div');
                    actions.style.display = 'grid';
                    actions.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
                    actions.style.gap = '8px';
                    actions.style.marginTop = '8px';

                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'mini-action-btn';
                    closeBtn.style.backgroundColor = '#991b1b';
                    closeBtn.innerText = 'Encerrar';
                    closeBtn.onclick = async () => {
                        if (!(await exigirAdminSeguro())) return;
                        await update(ref(db, `tournaments/${id}`), { status: 'encerrado', closedAt: Date.now(), updatedAt: Date.now() });
                        exibirAlertaDoSistema('Torneio encerrado', 'O torneio foi marcado como encerrado.');
                    };

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'mini-action-btn';
                    deleteBtn.style.backgroundColor = '#7f1d1d';
                    deleteBtn.innerText = 'Excluir';
                    deleteBtn.onclick = async () => {
                        if (!(await exigirAdminSeguro())) return;
                        const nomeTorneio = somenteTextoSeguro(t?.name || 'Torneio de Damas', 60);
                        const ok = window.confirm(`Excluir o torneio "${nomeTorneio}" de vez?`);
                        if (!ok) return;
                        await remove(ref(db, `tournaments/${id}`));
                        await registrarLogAdmin('excluiu_torneio', nomeTorneio);
                        exibirAlertaDoSistema('Torneio excluído', 'O torneio foi removido do sistema.');
                    };

                    actions.append(closeBtn, deleteBtn);
                    card.appendChild(actions);
                    list.appendChild(card);
                });
        });
    }

    async function gerarAvisosWhatsApp() {
        if (!(await exigirAdminSeguro())) return;
        const box = document.getElementById('admin-whatsapp-participants');
        if (!box) return;
        limparElemento(box);
        const snap = await get(ref(db, 'players'));
        const players = snap.val() || {};
        const sala = salaSegura(document.getElementById('tournament-room-input')?.value || adminTargetRoomInput?.value || '');
        const nomeTorneio = somenteTextoSeguro(document.getElementById('tournament-name-input')?.value || 'Torneio de Damas', 60);
        const mensagemBase = textoAvisoSeguro(document.getElementById('tournament-message-input')?.value || `Olá! Está acontecendo um aviso do jogo de Damas: ${nomeTorneio}. ${sala ? 'Sala: ' + sala.toUpperCase() : 'Entre no app para participar.'}`, 240);
        const autorizados = Object.values(players).filter(p => p && p.whatsappConsent && p.whatsapp);
        if (!autorizados.length) {
            box.appendChild(criarTexto('div', 'Nenhum jogador com WhatsApp autorizado ainda.', 'tiny-muted'));
            return;
        }
        const aviso = criarTexto('div', `Encontrados ${autorizados.length} jogadores autorizados. Clique em cada botão para abrir o WhatsApp com a mensagem pronta.`, 'tiny-muted');
        box.appendChild(aviso);
        autorizados.forEach(p => {
            const card = document.createElement('div');
            card.className = 'participant-card';
            const title = document.createElement('strong');
            title.innerText = `${nomeSeguro(p.name || 'Jogador')} • ${telefoneSeguro(p.whatsapp)}`;
            const btn = document.createElement('button');
            btn.className = 'mini-action-btn';
            btn.style.backgroundColor = '#25d366';
            btn.innerText = 'Abrir WhatsApp';
            btn.onclick = () => {
                const msg = encodeURIComponent(mensagemBase);
                window.open(`https://wa.me/${telefoneSeguro(p.whatsapp)}?text=${msg}`, '_blank');
            };
            card.append(title, btn);
            box.appendChild(card);
        });
    }

    function criarMensagemSistema(container, texto) {
        limparElemento(container);
        const div = document.createElement('div');
        div.style.cssText = "color:#7f8c8d; font-style:italic;";
        div.innerText = texto;
        container.appendChild(div);
    }

    function comTempoLimite(promise, ms, mensagem = "Tempo esgotado") {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(mensagem)), ms))
        ]);
    }

    async function usuarioEhAdminSeguro() {
        const user = auth.currentUser;
        const emailAtual = String(user?.email || "").trim().toLowerCase();

        // ✅ Caminho principal: login e senha do dono cadastrado no Firebase Auth.
        // Assim o painel não fica preso se /admins estiver vazio, antigo ou bloqueado por regra.
        if (user && !user.isAnonymous && emailAtual === ADMIN_EMAIL_AUTORIZADO) {
            usuarioAdminConfirmado = true;
            return true;
        }

        if (!playerId) return false;
        try {
            const snap = await get(ref(db, `admins/${playerId}`));
            usuarioAdminConfirmado = snap.exists() && snap.val() === true;
            return usuarioAdminConfirmado;
        } catch (e) {
            console.warn("Não foi possível validar admin:", e);
            return false;
        }
    }

    async function existeAlgumAdminCadastrado() {
        try {
            const snap = await get(ref(db, 'admins'));
            return snap.exists();
        } catch (e) {
            return true;
        }
    }

    async function tentarConfigurarPrimeiroAdmin(playerName, roomName) {
        const nomeDigitado = String(playerName || "").toLowerCase().trim();
        if (roomName !== ADMIN_ROOM_CODE || nomeDigitado !== LEGACY_FIRST_ADMIN_NAME || !playerId) return false;

        if (await usuarioEhAdminSeguro()) return true;

        const jaExisteAdmin = await existeAlgumAdminCadastrado();
        if (jaExisteAdmin) return false;

        await set(ref(db, `admins/${playerId}`), true);
        await push(ref(db, 'adminLogs'), {
            acao: 'primeiro_admin_configurado',
            adminUid: playerId,
            data: Date.now(),
            aviso: 'Configure as Rules do Firebase e remova o acesso legado se desejar blindagem máxima.'
        });
        usuarioAdminConfirmado = true;
        return true;
    }


    async function configurarAdminPorLoginEmail(user) {
        if (!user || user.isAnonymous) return false;
        playerId = user.uid;
        usuarioLogadoPorSenha = true;
        emailAdministradorAtual = user.email || "";

        const emailAtual = String(user.email || "").trim().toLowerCase();

        // ✅ Login oficial do dono: se o e-mail for o autorizado, entra no painel.
        // Também tenta registrar o UID em /admins, mas não trava o painel se a regra do banco impedir.
        if (emailAtual === ADMIN_EMAIL_AUTORIZADO) {
            usuarioAdminConfirmado = true;
            try {
                await set(ref(db, `admins/${user.uid}`), true);
                await push(ref(db, 'adminLogs'), {
                    acao: 'admin_login_email_autorizado',
                    adminUid: user.uid,
                    email: user.email || '',
                    data: Date.now(),
                    aviso: 'Administrador reconhecido pelo e-mail autorizado.'
                });
            } catch(e) {
                console.warn('Admin autorizado pelo e-mail, mas não foi possível gravar /admins:', e);
            }
            return true;
        }

        if (await usuarioEhAdminSeguro()) return true;

        const jaExisteAdmin = await existeAlgumAdminCadastrado();
        if (!jaExisteAdmin) {
            await set(ref(db, `admins/${user.uid}`), true);
            await push(ref(db, 'adminLogs'), {
                acao: 'primeiro_admin_por_email_configurado',
                adminUid: user.uid,
                email: user.email || '',
                data: Date.now(),
                aviso: 'Primeiro administrador cadastrado por login com e-mail e senha.'
            });
            usuarioAdminConfirmado = true;
            return true;
        }

        return false;
    }

    async function podeEntrarComoAdmin(playerName, roomName) {
        if (roomName !== ADMIN_ROOM_CODE) return false;
        if (await usuarioEhAdminSeguro()) return true;
        return await tentarConfigurarPrimeiroAdmin(playerName, roomName);
    }

    async function exigirAdminSeguro() {
        const ok = playerRole === "admin" && await usuarioEhAdminSeguro();
        if (!ok) {
            exibirAlertaDoSistema("Acesso negado 🛡️", "Esta ação exige login de administrador autorizado.");
            return false;
        }
        return true;
    }

    async function registrarLogAdmin(acao, sala = "", extra = {}) {
        try {
            await push(ref(db, 'adminLogs'), {
                acao,
                sala: salaSegura(sala),
                adminUid: playerId || "sem_uid",
                data: Date.now(),
                ...extra
            });
        } catch (e) {
            console.warn("Não foi possível registrar log admin:", e);
        }
    }

    async function obterSalaAdminAlvo(opcoes = {}) {
        const { permitirSala00 = false, exigirExistente = true } = opcoes;
        const salaAlvo = salaSegura(adminTargetRoomInput.value);

        if (!salaAlvo) {
            exibirAlertaDoSistema("Aviso", "Digite ou selecione o código da sala primeiro.");
            return null;
        }

        if (salaAlvo === ADMIN_ROOM_CODE && !permitirSala00) {
            exibirAlertaDoSistema("Código restrito 🛡️", "A sala <strong>00</strong> é o terminal do administrador e não deve ser alterada por esta ação.");
            return null;
        }

        const refSala = ref(db, 'rooms/' + salaAlvo);
        const snap = await get(refSala);

        if (exigirExistente && !snap.exists()) {
            exibirAlertaDoSistema("Sala não encontrada", `A sala <strong>${salaAlvo.toUpperCase()}</strong> ainda não existe. Use <strong>LIBERAR / CRIAR SALA</strong> primeiro.`);
            return null;
        }

        return { salaAlvo, refSala, snap, data: snap.exists() ? snap.val() : null };
    }

    window.addEventListener('error', (ev) => {
        console.error('Erro geral capturado:', ev.error || ev.message);
        atualizarStatusSistema('Atenção: o navegador capturou um erro, mas o jogo tentou continuar funcionando. Abra o console se precisar diagnosticar.', '#f1c40f');
    });
    window.addEventListener('unhandledrejection', (ev) => {
        console.error('Promessa rejeitada capturada:', ev.reason);
        atualizarStatusSistema('Atenção: uma operação online falhou, mas o modo treino e a tela continuam disponíveis.', '#f1c40f');
    });

    // 🔥 NOVO DISPARADOR DE COMPARTILHAMENTO DE SUGESTÕES PARA O WHATSAPP DO ISIQUEI
    document.getElementById('btn-submit-feedback').addEventListener('click', () => {
        const txtFeedback = somenteTextoSeguro(document.getElementById('feedback-text-input').value, 180);
        if (!txtFeedback) return exibirAlertaDoSistema("Aviso", "Por favor, digite sua sugestão ou comentário antes de enviar.");
        const nomeUsuario = nomeSeguro(document.getElementById('name-input').value || "Jogador Anônimo");
        
        const msgFormatada = encodeURIComponent(`Olá Isiquel! Me chamo ${nomeUsuario} e tenho uma sugestão para o jogo de Damas: ${txtFeedback}`);
        window.open(`https://wa.me/${WHATSAPP_SUPORTE}?text=${msgFormatada}`, '_blank');
        document.getElementById('feedback-text-input').value = "";
    });

    function reproduzirSomDoJogo(tipo) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            const agora = ctx.currentTime;
            
            if (tipo === 'inicio') {
                osc.type = 'triangle'; osc.frequency.setValueAtTime(261.63, agora); 
                osc.frequency.exponentialRampToValueAtTime(523.25, agora + 0.3); 
                gain.gain.setValueAtTime(0.15, agora); gain.gain.linearRampToValueAtTime(0.01, agora + 0.3);
                osc.start(agora); osc.stop(agora + 0.3);
            } else if (tipo === 'move') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(400, agora);
                gain.gain.setValueAtTime(0.1, agora); gain.gain.linearRampToValueAtTime(0.01, agora + 0.08);
                osc.start(agora); osc.stop(agora + 0.08);
            } else if (tipo === 'capture') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, agora); osc.frequency.linearRampToValueAtTime(90, agora + 0.15);
                gain.gain.setValueAtTime(0.2, agora); gain.gain.linearRampToValueAtTime(0.01, agora + 0.15);
                osc.start(agora); osc.stop(agora + 0.15);
            } else if (tipo === 'king') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(587.33, agora); osc.frequency.setValueAtTime(880.00, agora + 0.1); 
                gain.gain.setValueAtTime(0.15, agora); gain.gain.linearRampToValueAtTime(0.01, agora + 0.3);
                osc.start(agora); osc.stop(agora + 0.3);
            } else if (tipo === 'chat') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(600, agora); osc.frequency.exponentialRampToValueAtTime(800, agora + 0.08);
                gain.gain.setValueAtTime(0.08, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.08);
                osc.start(agora); osc.stop(agora + 0.08);
            } else if (tipo === 'spectator') {
                osc.type = 'triangle'; osc.frequency.setValueAtTime(330, agora); osc.frequency.exponentialRampToValueAtTime(440, agora + 0.15);
                gain.gain.setValueAtTime(0.05, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.15);
                osc.start(agora); osc.stop(agora + 0.15);
            } else if (tipo === 'bip_aviso') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(880, agora);
                gain.gain.setValueAtTime(0.12, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.08);
                osc.start(agora); osc.stop(agora + 0.08);
            } else if (tipo === 'tic_relogio') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(700, agora);
                gain.gain.setValueAtTime(0.1, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.05);
                osc.start(agora); osc.stop(agora + 0.05);
            } else if (tipo === 'gongo_start') {
                osc.type = 'triangle'; osc.frequency.setValueAtTime(330, agora); osc.frequency.exponentialRampToValueAtTime(150, agora + 0.5);
                gain.gain.setValueAtTime(0.25, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.5);
                osc.start(agora); osc.stop(agora + 0.5);
            } else if (tipo === 'saida_rival') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(290, agora); osc.frequency.linearRampToValueAtTime(120, agora + 0.4);
                gain.gain.setValueAtTime(0.2, agora); gain.gain.linearRampToValueAtTime(0.001, agora + 0.4);
                osc.start(agora); osc.stop(agora + 0.4);
            } else if (tipo === 'fanfarra_vitoria') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, agora);
                gain.gain.setValueAtTime(0.15, agora); gain.gain.linearRampToValueAtTime(0.01, agora + 0.4);
                osc.start(agora); osc.stop(agora + 0.4);
            }
        } catch (e) { console.log("Áudio bloqueado", e); }
    }

    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const nameInput = document.getElementById('name-input');
    const roomInput = document.getElementById('room-input');
    const whatsappInput = document.getElementById('whatsapp-input');
    const whatsappConsent = document.getElementById('whatsapp-consent');
    const systemHealthText = document.getElementById('system-health-text');
    const joinBtn = document.getElementById('join-btn');
    const spectateBtn = document.getElementById('spectate-btn');
    const practiceBtn = document.getElementById('practice-btn');
    const leaveBtn = document.getElementById('leave-btn');
    const resetRoomBtn = document.getElementById('reset-room-btn');
    const drawBtn = document.getElementById('draw-btn');
    const displayRoom = document.getElementById('display-room');
    const turnIndicator = document.getElementById('turn-indicator');
    const playersNamesEl = document.getElementById('players-names');
    const playerBadge = document.getElementById('player-badge');
    const boardEl = document.getElementById('board');
    const authStatusEl = document.getElementById('auth-status');
    const downloadBtnLobby = document.getElementById('download-btn-lobby');
    const adminEmailInput = document.getElementById('admin-email-input');
    const adminPasswordInput = document.getElementById('admin-password-input');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminLoginStatus = document.getElementById('admin-login-status');
    const centralAdminMenu = document.getElementById('central-admin-menu');
    const centralAdminDamasBtn = document.getElementById('central-admin-damas-btn');
    const centralAdminXadrezBtn = document.getElementById('central-admin-xadrez-btn');
    const centralAdminBackBtn = document.getElementById('central-admin-back-btn');
    const centralAdminNote = document.getElementById('central-admin-note');
    const adminEntryCard = document.getElementById('game-card-admin');
    const adminLoginPanelBox = document.getElementById('admin-login-panel');
    const adminLoginBackBtn = document.getElementById('admin-login-back-btn');
    
    const gameTimerEl = document.getElementById('game-timer');
    const liveSpectatorsEl = document.getElementById('live-spectators');
    const chatBoxMessages = document.getElementById('chat-box-messages');
    const chatInputField = document.getElementById('chat-input-field');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const toggleChatVisibility = document.getElementById('toggle-chat-visibility');
    const chatInputWrapper = document.getElementById('chat-input-wrapper');

    const voiceVideoCallPanel = document.getElementById('voice-video-call-panel');
    const startCallBtn = document.getElementById('start-call-btn');
    const startAudioCallBtn = document.getElementById('start-audio-call-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const toggleMicBtn = document.getElementById('toggle-mic-btn');
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const callSizeMinusBtn = document.getElementById('call-size-minus-btn');
    const callSizePlusBtn = document.getElementById('call-size-plus-btn');
    const localVideoEl = document.getElementById('local-video');
    const remoteVideoEl = document.getElementById('remote-video');
    const remoteAudioEl = document.getElementById('remote-audio');
    const unlockAudioBtn = document.getElementById('unlock-audio-btn');
    const callStatusText = document.getElementById('call-status-text');

    function atualizarStatusSistema(texto, cor = '') {
        if (!systemHealthText) return;
        systemHealthText.innerText = texto;
        if (cor) systemHealthText.style.color = cor;
    }

    function carregarPreferenciasLocais() {
        try {
            const nomeSalvo = localStorage.getItem('damas_nome_jogador') || '';
            const zapSalvo = localStorage.getItem('damas_whatsapp_jogador') || '';
            const consentSalvo = localStorage.getItem('damas_whatsapp_consent') === 'sim';
            if (nomeSalvo && !nameInput.value) nameInput.value = nomeSeguro(nomeSalvo);
            if (zapSalvo && whatsappInput && !whatsappInput.value) whatsappInput.value = telefoneSeguro(zapSalvo);
            if (whatsappConsent) whatsappConsent.checked = consentSalvo;
        } catch(e) { console.warn('Preferências locais indisponíveis:', e); }
    }

    function salvarPreferenciasLocais() {
        try {
            localStorage.setItem('damas_nome_jogador', nomeSeguro(nameInput.value || ''));
            if (whatsappInput) localStorage.setItem('damas_whatsapp_jogador', telefoneSeguro(whatsappInput.value || ''));
            if (whatsappConsent) localStorage.setItem('damas_whatsapp_consent', whatsappConsent.checked ? 'sim' : 'nao');
        } catch(e) { console.warn('Não foi possível salvar preferências locais:', e); }
    }

    carregarPreferenciasLocais();
    [nameInput, whatsappInput, whatsappConsent].filter(Boolean).forEach(el => {
        el.addEventListener('input', salvarPreferenciasLocais);
        el.addEventListener('change', salvarPreferenciasLocais);
    });


    const adminPanel = document.getElementById('admin-panel');
    const adminRoomsDashboardList = document.getElementById('admin-rooms-dashboard-list');
    const adminTargetRoomInput = document.getElementById('admin-target-room');

    const rulesModal = document.getElementById('rules-modal');
    const rulesBtnLobby = document.getElementById('rules-btn-lobby');
    const rulesBtnGame = document.getElementById('rules-btn-game');
    const flipBoardBtn = document.getElementById('flip-board-btn');
    const closeRulesBtn = document.getElementById('close-rules-btn');

    const rankModal = document.getElementById('rank-modal');
    const rankBtnLobby = document.getElementById('rank-btn-lobby');
    const closeRankBtn = document.getElementById('close-rank-btn');
    const rankTableBody = document.getElementById('rank-table-body');
    const practiceRankModal = document.getElementById('practice-rank-modal');
    const practiceRankBtnLobby = document.getElementById('practice-rank-btn-lobby');
    const closePracticeRankBtn = document.getElementById('close-practice-rank-btn');
    const practiceRankTableBody = document.getElementById('practice-rank-table-body');
    const combinedPracticeRankTableBody = document.getElementById('combined-practice-rank-table-body');
    const practicePodiumContent = document.getElementById('practice-podium-content');
    const livePodiumContent = document.getElementById('live-podium-content');
    const motivateBox = document.getElementById('motivate-box');
    
    const difficultyBox = document.getElementById('difficulty-box');
    const btnChooseEasy = document.getElementById('btn-choose-easy');
    const btnChooseMedium = document.getElementById('btn-choose-medium');
    const btnChooseHard = document.getElementById('btn-choose-hard');
    const btnChooseLearn = document.getElementById('btn-choose-learn');
    const learningCoachBox = document.getElementById('learning-coach-box');
    const learningCoachText = document.getElementById('learning-coach-text');
    const btnLearningRefresh = document.getElementById('btn-learning-refresh');
    const btnLearningToggle = document.getElementById('btn-learning-toggle');

    function abrirEntradaAdminInicial() {
        document.body.classList.add('platform-start-active');
        document.body.classList.add('mode-selecting');
        document.body.classList.remove('game-selected');
        document.body.classList.remove('domino-selected');
        const hub = document.getElementById('games-hub-panel');
        if (hub) hub.style.display = 'block';
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'none';
        if (adminLoginPanelBox) {
            adminLoginPanelBox.classList.remove('central-hidden');
            adminLoginPanelBox.style.display = 'block';
            adminLoginPanelBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (adminLoginStatus && (!auth.currentUser || auth.currentUser.isAnonymous)) {
            adminLoginStatus.innerText = 'Digite o e-mail e a senha do dono para administrar a plataforma.';
        }
    }

    function fecharEntradaAdminInicial() {
        if (centralAdminMenu) centralAdminMenu.style.display = 'none';
        if (centralAdminNote) centralAdminNote.style.display = 'none';
        if (adminLoginPanelBox) {
            adminLoginPanelBox.classList.add('central-hidden');
            adminLoginPanelBox.style.display = 'none';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function mostrarMenuCentralAdmin(mensagem = "") {
        if (adminLoginPanelBox) {
            adminLoginPanelBox.classList.remove('central-hidden');
            adminLoginPanelBox.style.display = 'block';
        }
        if (centralAdminMenu) centralAdminMenu.style.display = "block";
        if (centralAdminNote) {
            centralAdminNote.style.display = mensagem ? "block" : "none";
            centralAdminNote.innerHTML = mensagem || "";
        }
        document.body.classList.add('platform-start-active');
        document.body.classList.add('mode-selecting');
        document.body.classList.remove('game-selected');
        document.body.classList.remove('domino-selected');
        const hub = document.getElementById('games-hub-panel');
        if (hub) hub.style.display = 'block';
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'none';
    }


    async function abrirAdminDamasCentral() {
        if (!auth.currentUser || auth.currentUser.isAnonymous || !(await usuarioEhAdminSeguro())) {
            exibirAlertaDoSistema("Acesso negado 🛡️", "Entre primeiro com o login do administrador.");
            return;
        }
        document.body.classList.remove('platform-start-active');
        document.body.classList.remove('mode-selecting');
        document.body.classList.add('game-selected');
        document.body.classList.remove('domino-selected');
        if (centralAdminNote) {
            centralAdminNote.style.display = "block";
            centralAdminNote.innerHTML = "Abrindo painel da <strong>Damas</strong>...";
        }
        playerRole = "admin";
        nameInput.value = "Administrador";
        roomInput.value = ADMIN_ROOM_CODE;
        await joinRoom(ADMIN_ROOM_CODE, "Administrador", false);
    }


    adminLoginBtn.addEventListener('click', async () => {
        const email = String(adminEmailInput.value || '').trim();
        const senha = String(adminPasswordInput.value || '');
        if (!email || !senha) {
            exibirAlertaDoSistema("Login do Administrador", "Digite o e-mail e a senha do administrador.");
            return;
        }

        adminLoginBtn.disabled = true;
        adminLoginBtn.innerText = "Entrando...";
        adminLoginStatus.innerText = "Validando login do administrador...";

        try {
            const cred = await comTempoLimite(signInWithEmailAndPassword(auth, email, senha), TEMPO_MAX_LOGIN_ADMIN_MS, "O login demorou demais. Confira a internet, o Firebase Auth e se o usuário foi criado.");
            const ok = await configurarAdminPorLoginEmail(cred.user);
            if (!ok) {
                adminLoginStatus.innerText = "Login feito, mas este usuário ainda não está autorizado como admin.";
                exibirAlertaDoSistema(
                    "Admin não autorizado",
                    "O e-mail e senha estão corretos, mas este usuário ainda não está cadastrado em <strong>/admins</strong>. Cadastre o UID deste usuário no Firebase ou apague /admins para transformar este primeiro login no dono."
                );
                return;
            }

            usuarioAdminConfirmado = true;
            playerRole = "admin";
            nameInput.value = "Administrador";
            roomInput.value = ADMIN_ROOM_CODE;
            adminPasswordInput.value = "";
            adminLoginBtn.style.display = "none";
            adminLogoutBtn.style.display = "block";
            adminLoginStatus.innerText = `Admin conectado: ${cred.user.email || 'usuário autorizado'}`;
            mostrarMenuCentralAdmin("Login confirmado. Agora escolha qual jogo deseja administrar.");
        } catch (e) {
            console.error("Erro no login admin:", e);
            let msg = "Não foi possível entrar. Confira o e-mail, a senha e se o login Email/Senha está ativado no Firebase Authentication.";
            if (e && e.code === 'auth/invalid-credential') msg = "E-mail ou senha inválidos. Confirme se esse usuário foi criado em Authentication > Usuários.";
            if (e && e.code === 'auth/user-not-found') msg = "Esse e-mail ainda não foi criado em Authentication > Usuários.";
            if (e && e.code === 'auth/wrong-password') msg = "Senha incorreta.";
            if (e && e.code === 'auth/too-many-requests') msg = "Muitas tentativas. Aguarde um pouco e tente novamente.";
            if (e && e.message && e.message.includes('demorou demais')) msg = e.message;
            adminLoginStatus.innerText = msg;
            exibirAlertaDoSistema("Falha no Login", msg);
        } finally {
            adminLoginBtn.disabled = false;
            adminLoginBtn.innerText = "Entrar no Painel Admin";
        }
    });

    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLoginBtn.click();
    });

    adminLogoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch(e) { console.warn("Erro ao sair do admin:", e); }
        usuarioAdminConfirmado = false;
        usuarioLogadoPorSenha = false;
        emailAdministradorAtual = "";
        playerRole = "spectator";
        adminLoginBtn.style.display = "block";
        adminLogoutBtn.style.display = "none";
        adminLoginStatus.innerText = "Admin desconectado. Jogadores comuns não usam esta área.";
        if (centralAdminMenu) centralAdminMenu.style.display = "none";
        if (centralAdminNote) centralAdminNote.style.display = "none";
        adminPanel.style.display = "none";
        gameScreen.style.display = 'none';
        lobbyScreen.style.display = 'none';
        document.body.classList.add('platform-start-active');
        document.body.classList.add('mode-selecting');
        document.body.classList.remove('game-selected');
        document.body.classList.remove('domino-selected');
        const hub = document.getElementById('games-hub-panel');
        if (hub) hub.style.display = 'block';
        if (adminLoginPanelBox) {
            adminLoginPanelBox.classList.add('central-hidden');
            adminLoginPanelBox.style.display = 'none';
        }
        iniciarAutenticacaoAnonima();
    });

    function ligarCardAdminInicial() {
        if (!adminEntryCard || adminEntryCard.dataset.adminBind === '1') return;
        adminEntryCard.dataset.adminBind = '1';
        adminEntryCard.addEventListener('click', abrirEntradaAdminInicial);
        adminEntryCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrirEntradaAdminInicial();
            }
        });
    }
    ligarCardAdminInicial();
    if (adminLoginBackBtn) adminLoginBackBtn.addEventListener('click', fecharEntradaAdminInicial);

    if (centralAdminDamasBtn) centralAdminDamasBtn.addEventListener('click', abrirAdminDamasCentral);
    if (centralAdminBackBtn) centralAdminBackBtn.addEventListener('click', () => {
        if (centralAdminNote) centralAdminNote.style.display = "none";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    rulesBtnLobby.addEventListener('click', () => rulesModal.style.display = 'flex');
    rulesBtnGame.addEventListener('click', () => rulesModal.style.display = 'flex');
    closeRulesBtn.addEventListener('click', () => rulesModal.style.display = 'none');
    if (flipBoardBtn) {
        flipBoardBtn.addEventListener('click', () => {
            tabuleiroViradoManual = !tabuleiroViradoManual;
            if (currentGameState && currentGameState.board) generateBoardUI(currentGameState.board);
        });
    }

    rankBtnLobby.addEventListener('click', () => { networkLeaderboard(); });
    async function networkLeaderboard() { rankModal.style.display = 'flex'; await Promise.all([loadLeaderboard(), loadPracticeLeaderboard()]); }
    closeRankBtn.addEventListener('click', () => rankModal.style.display = 'none');

    practiceRankBtnLobby.addEventListener('click', () => { networkPracticeLeaderboard(); });
    async function networkPracticeLeaderboard() { rankModal.style.display = 'flex'; await Promise.all([loadLeaderboard(), loadPracticeLeaderboard()]); }
    closePracticeRankBtn.addEventListener('click', () => practiceRankModal.style.display = 'none');

    downloadBtnLobby.addEventListener('click', () => { window.location.href = 'jogo.apk'; });

    async function carregarPodiumLobby() {
        try {
            const rankRef = ref(db, 'leaderboard');
            onValue(rankRef, (snapshot) => {
                const data = snapshot.val();
                limparElemento(livePodiumContent);
                if (!data) {
                    const vazio = document.createElement('div');
                    vazio.style.cssText = 'font-size:0.85rem; color:#aaa; padding:5px 0;';
                    vazio.innerText = 'Nenhuma batalha online registrada ainda!';
                    livePodiumContent.appendChild(vazio);
                    motivateBox.innerText = "⚔️ Seja o primeiro a inaugurar o tabuleiro e assumir o topo!";
                    return;
                }
                const sorted = Object.values(data)
                    .map(p => ({ name: nomeSeguro(p.name || 'Jogador'), wins: numeroSeguro(p.wins), losses: numeroSeguro(p.losses) }))
                    .sort((a, b) => b.wins - a.wins)
                    .slice(0, 3);
                let medalhas = ["🥇", "🥈", "🥉"];
                sorted.forEach((player, idx) => {
                    const row = document.createElement('div');
                    row.className = "podium-row";

                    const left = document.createElement('div');
                    const strong = document.createElement('strong');
                    strong.innerText = player.name;
                    left.append(document.createTextNode(`${medalhas[idx]} `), strong);
                    if (player.losses === 0 && player.wins > 0) {
                        const invicto = document.createElement('span');
                        invicto.style.cssText = 'color:#f1c40f; font-size:0.75rem; font-weight:bold;';
                        invicto.innerText = ' 🔥 INTACTO';
                        left.appendChild(invicto);
                    }

                    const right = document.createElement('div');
                    right.style.cssText = 'color:#2ecc71; font-weight:bold;';
                    right.innerText = `${player.wins} Vitórias`;
                    row.append(left, right);
                    livePodiumContent.appendChild(row);
                });
                if (sorted.length > 0) {
                    motivateBox.innerText = `⚔️ Desafie o topo! ${sorted[0].name} está dominando. Crie uma sala online e marque um confronto direto contra os campeões!`;
                }
            });
        } catch(e) { console.log("Erro ao carregar podium", e); }
    }

    function liberarLobbyBasico(mensagem, modoLimitado = false) {
        authStatusEl.innerText = mensagem;
        atualizarStatusSistema(modoLimitado
            ? 'Modo treino, modo aprender e regras liberados. Online aguardando Firebase sem travar o jogo.'
            : 'Sistema online ativo. Multiplayer, ranking, torneios, chamadas e painel admin disponíveis conforme permissão.',
            modoLimitado ? '#f1c40f' : '#cbd5e1'
        );
        nameInput.disabled = false;
        roomInput.disabled = false;
        if (whatsappInput) whatsappInput.disabled = false;
        if (whatsappConsent) whatsappConsent.disabled = false;
        practiceBtn.disabled = false;
        rulesBtnLobby.disabled = false;
        rankBtnLobby.disabled = modoLimitado;
        practiceRankBtnLobby.disabled = false;
        joinBtn.disabled = modoLimitado;
        spectateBtn.disabled = modoLimitado;
    }

    let tentativaAuthEmAndamento = false;
    function iniciarAutenticacaoAnonima() {
        if (auth.currentUser && !auth.currentUser.isAnonymous) return;
        if (tentativaAuthEmAndamento) return;
        tentativaAuthEmAndamento = true;
        signInAnonymously(auth)
            .catch(err => {
                console.warn("Falha na autenticação anônima:", err);
                authStatusEl.style.color = "#f1c40f";
                liberarLobbyBasico("Modo treino liberado • Online aguardando Firebase", true);
            })
            .finally(() => { tentativaAuthEmAndamento = false; });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            playerId = user.uid;
            authStatusEl.style.color = "#2ecc71";
            liberarLobbyBasico("Conexão Segura Ativa ✓", false);

            if (!user.isAnonymous) {
                usuarioLogadoPorSenha = true;
                emailAdministradorAtual = user.email || "";
                const okAdmin = await usuarioEhAdminSeguro();
                if (okAdmin) {
                    adminLoginBtn.style.display = "none";
                    adminLogoutBtn.style.display = "block";
                    adminLoginStatus.innerText = `Admin conectado: ${user.email || 'usuário autorizado'}`;
                    if (adminLoginPanelBox) {
                        adminLoginPanelBox.classList.remove('central-hidden');
                        adminLoginPanelBox.style.display = 'block';
                    }
                    if (centralAdminMenu) centralAdminMenu.style.display = "block";
                } else {
                    adminLoginStatus.innerText = "Usuário logado por e-mail, mas ainda não autorizado como administrador.";
                }
            }

            carregarPodiumLobby();
            carregarPodiumTreinoLobby();
            carregarTorneiosLobby();
            carregarPartidasAoVivoLobby(); 
        } else {
            iniciarAutenticacaoAnonima();
        }
    });

    // Se o Firebase demorar ou ficar pendurado, o modo treino não pode ficar travado.
    setTimeout(() => {
        if (!playerId) {
            authStatusEl.style.color = "#f1c40f";
            liberarLobbyBasico("Modo treino liberado • Autenticação online demorando", true);
        }
    }, 2500);

    // Dispara a autenticação logo no carregamento, sem esperar o primeiro retorno do listener.
    iniciarAutenticacaoAnonima();

    function getInitialBoard() {
        let board = Array(8).fill(null).map(() => Array(8).fill(0));
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) {
                    if (r < 3) board[r][c] = 3;      
                    else if (r > 4) board[r][c] = 1; 
                }
            }
        }
        return board;
    }

    function chaveRankingTreino(nome) {
        const base = String(nome || "Jogador")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_-]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 30);
        return base || "jogador";
    }

    function calcularPontosTreino(stats) {
        const d = stats?.difficulty || {};
        const facil = numeroSeguro(d.facil?.wins);
        const medio = numeroSeguro(d.medio?.wins);
        const dificil = numeroSeguro(d.dificil?.wins);
        return facil + (medio * 3) + (dificil * 6);
    }

    function melhorNivelTreino(stats) {
        const d = stats?.difficulty || {};
        if (numeroSeguro(d.dificil?.wins) > 0) return "Difícil";
        if (numeroSeguro(d.medio?.wins) > 0) return "Médio";
        if (numeroSeguro(d.facil?.wins) > 0) return "Fácil";
        return "—";
    }

    function ordenarRankingTreino(data) {
        return Object.values(data || {})
            .map(p => {
                const wins = numeroSeguro(p.wins);
                const losses = numeroSeguro(p.losses);
                const games = wins + losses;
                const pontos = numeroSeguro(p.score, calcularPontosTreino(p));
                return {
                    ...p,
                    name: nomeSeguro(p.name || "Jogador"),
                    wins,
                    losses,
                    games,
                    score: pontos,
                    bestLevel: p.bestLevel || melhorNivelTreino(p),
                    pct: games > 0 ? Math.round((wins / games) * 100) : 0
                };
            })
            .sort((a, b) => (b.score - a.score) || (b.wins - a.wins) || (a.losses - b.losses));
    }

    async function registrarResultadoTreino(jogadorGanhou) {
        if (!isPracticeMode || hasRecordedResult) return;
        if (practiceDifficulty === "aprender") return;
        hasRecordedResult = true;

        const nomeJogador = nomeSeguro(currentGameState?.p1Name || nameInput.value || "Jogador");
        const dificuldade = ["facil", "medio", "dificil"].includes(practiceDifficulty) ? practiceDifficulty : "medio";
        const chave = chaveRankingTreino(nomeJogador);
        const rankRef = ref(db, `practiceLeaderboard/${chave}`);

        try {
            await runTransaction(rankRef, (atual) => {
                const stats = atual || {
                    name: nomeJogador,
                    wins: 0,
                    losses: 0,
                    games: 0,
                    score: 0,
                    bestLevel: "—",
                    difficulty: {
                        facil: { wins: 0, losses: 0 },
                        medio: { wins: 0, losses: 0 },
                        dificil: { wins: 0, losses: 0 }
                    }
                };
                stats.name = nomeJogador;
                stats.wins = numeroSeguro(stats.wins);
                stats.losses = numeroSeguro(stats.losses);
                stats.games = numeroSeguro(stats.games);
                stats.difficulty = stats.difficulty || {};
                stats.difficulty.facil = stats.difficulty.facil || { wins: 0, losses: 0 };
                stats.difficulty.medio = stats.difficulty.medio || { wins: 0, losses: 0 };
                stats.difficulty.dificil = stats.difficulty.dificil || { wins: 0, losses: 0 };
                stats.difficulty[dificuldade].wins = numeroSeguro(stats.difficulty[dificuldade].wins);
                stats.difficulty[dificuldade].losses = numeroSeguro(stats.difficulty[dificuldade].losses);

                if (jogadorGanhou) {
                    stats.wins += 1;
                    stats.difficulty[dificuldade].wins += 1;
                } else {
                    stats.losses += 1;
                    stats.difficulty[dificuldade].losses += 1;
                }

                stats.games = stats.wins + stats.losses;
                stats.score = calcularPontosTreino(stats);
                stats.bestLevel = melhorNivelTreino(stats);
                stats.lastDifficulty = dificuldade;
                stats.lastResult = jogadorGanhou ? "win" : "loss";
                stats.updatedAt = Date.now();
                return stats;
            });
        } catch (e) {
            console.warn("Não foi possível registrar ranking do treino no Firebase:", e);
            try {
                const localKey = `practiceLeaderboardBackup:${chave}`;
                const atual = JSON.parse(localStorage.getItem(localKey) || "{}");
                atual.name = nomeJogador;
                atual.wins = numeroSeguro(atual.wins) + (jogadorGanhou ? 1 : 0);
                atual.losses = numeroSeguro(atual.losses) + (jogadorGanhou ? 0 : 1);
                atual.games = atual.wins + atual.losses;
                atual.updatedAt = Date.now();
                localStorage.setItem(localKey, JSON.stringify(atual));
            } catch(_) {}
        }
    }

    async function loadPracticeLeaderboard() {
        const alvosTabelaTreino = [practiceRankTableBody, combinedPracticeRankTableBody].filter(Boolean);
        const setTreinoHtml = (conteudo) => alvosTabelaTreino.forEach(t => { t.innerHTML = conteudo; });
        setTreinoHtml("<tr><td colspan='6'>Buscando ranking do treino...</td></tr>");
        try {
            const snapshot = await get(ref(db, 'practiceLeaderboard'));
            const data = snapshot.val();
            if (!data) {
                setTreinoHtml("<tr><td colspan='6'>Nenhuma partida contra a máquina registrada ainda!</td></tr>");
                return;
            }
            const sorted = ordenarRankingTreino(data);
            alvosTabelaTreino.forEach(t => limparElemento(t));
            sorted.forEach((player, index) => {
                alvosTabelaTreino.forEach(tbody => {
                    const row = document.createElement('tr');
                    const pos = document.createElement('td'); pos.innerHTML = `<strong>#${index + 1}</strong>`;
                    const name = criarTexto('td', player.name);
                    const wins = criarTexto('td', player.wins); wins.style.cssText = 'color:#2ecc71; font-weight:bold;';
                    const losses = criarTexto('td', player.losses); losses.style.cssText = 'color:#e74c3c;';
                    const best = criarTexto('td', player.bestLevel);
                    const score = criarTexto('td', `${player.score} pts`); score.style.cssText = 'color:#f1c40f; font-weight:bold;';
                    row.append(pos, name, wins, losses, best, score);
                    tbody.appendChild(row);
                });
            });
        } catch(e) {
            console.error("Erro ao carregar ranking do treino:", e);
            setTreinoHtml("<tr><td colspan='6'>Não foi possível carregar o ranking do treino agora.</td></tr>");
        }
    }

    function carregarPodiumTreinoLobby() {
        try {
            const rankRef = ref(db, 'practiceLeaderboard');
            onValue(rankRef, (snapshot) => {
                const data = snapshot.val();
                limparElemento(practicePodiumContent);
                if (!data) {
                    const vazio = document.createElement('div');
                    vazio.style.cssText = 'font-size:0.85rem; color:#aaa; padding:5px 0;';
                    vazio.innerText = 'Ainda não há vitórias contra a máquina. Seja o primeiro a vencer o robô!';
                    practicePodiumContent.appendChild(vazio);
                    return;
                }
                const sorted = ordenarRankingTreino(data).slice(0, 3);
                const medalhas = ["🥇", "🥈", "🥉"];
                sorted.forEach((player, idx) => {
                    const row = document.createElement('div');
                    row.className = 'practice-ranking-row';
                    const left = criarTexto('div', `${medalhas[idx]} ${player.name} • ${player.bestLevel}`);
                    const right = criarTexto('div', `${player.score} pts`, 'practice-ranking-score');
                    row.append(left, right);
                    practicePodiumContent.appendChild(row);
                });
            });
        } catch(e) {
            console.warn("Erro ao carregar pódio do treino:", e);
        }
    }

    async function loadLeaderboard() {
        rankTableBody.innerHTML = "<tr><td colspan='5'>Buscando pontuações...</td></tr>";
        const rankRef = ref(db, 'leaderboard');
        const snapshot = await get(rankRef);
        const data = snapshot.val();
        if (!data) {
            rankTableBody.innerHTML = "<tr><td colspan='5'>Nenhuma partida registrada ainda!</td></tr>";
            return;
        }
        const sortedPlayers = Object.values(data)
            .map(p => ({ name: nomeSeguro(p.name || 'Jogador'), wins: numeroSeguro(p.wins), losses: numeroSeguro(p.losses) }))
            .sort((a, b) => b.wins - a.wins);
        limparElemento(rankTableBody);
        sortedPlayers.forEach((player, index) => {
            const totalGames = player.wins + player.losses;
            const pct = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
            const row = document.createElement('tr');
            const pos = document.createElement('td'); pos.innerHTML = `<strong>#${index + 1}</strong>`;
            const name = criarTexto('td', player.name);
            const wins = criarTexto('td', player.wins); wins.style.cssText = 'color:#2ecc71; font-weight:bold;';
            const losses = criarTexto('td', player.losses); losses.style.cssText = 'color:#e74c3c;';
            const aproveitamento = document.createElement('td');
            const badge = criarTexto('span', `${pct}%`, 'badge');
            badge.style.backgroundColor = '#34495e';
            aproveitamento.appendChild(badge);
            row.append(pos, name, wins, losses, aproveitamento);
            rankTableBody.appendChild(row);
        });
    }

    async function updatePlayerRanking(isWin, winnerName) {
        if (isPracticeMode || hasRecordedResult) return;
        hasRecordedResult = true;
        const nomeFinal = nomeSeguro(winnerName);
        if (!playerId) {
            console.warn('Ranking online não atualizado: jogador ainda sem UID.');
            return;
        }
        const userRankRef = ref(db, 'leaderboard/' + playerId);
        try {
            await runTransaction(userRankRef, (atual) => {
                const stats = atual || { name: nomeFinal, wins: 0, losses: 0, updatedAt: 0 };
                stats.name = nomeFinal;
                stats.wins = numeroSeguro(stats.wins);
                stats.losses = numeroSeguro(stats.losses);
                if (isWin) stats.wins += 1;
                else stats.losses += 1;
                stats.updatedAt = Date.now();
                return stats;
            });
        } catch (e) {
            console.warn('Não foi possível atualizar ranking online no Firebase:', e);
            try {
                const key = `leaderboardBackup:${playerId}`;
                const atual = JSON.parse(localStorage.getItem(key) || '{}');
                atual.name = nomeFinal;
                atual.wins = numeroSeguro(atual.wins) + (isWin ? 1 : 0);
                atual.losses = numeroSeguro(atual.losses) + (isWin ? 0 : 1);
                atual.updatedAt = Date.now();
                localStorage.setItem(key, JSON.stringify(atual));
            } catch(_) {}
        }
    }

    joinBtn.addEventListener('click', () => {
        const playerName = nomeSeguro(nameInput.value);
        const roomName = salaSegura(roomInput.value);
        if (!playerName) return exibirAlertaDoSistema("Identificação", "Por favor, digite seu nome para continuar.");
        if (!roomName) return exibirAlertaDoSistema("Sala Obrigatória", "Por favor, informe o código da sala para conectar.");
        difficultyBox.style.display = "none";
        isPracticeMode = false;
        hasRecordedResult = false;
        alertaFimPartidaMostrado = false;
        lockPieceForMultiCapture = null;
        ultimoContadorEspectadores = 0;
        roomId = roomName;
        registrarJogadorComunidade(playerName);
        joinRoom(roomName, playerName, false);
    });

    spectateBtn.addEventListener('click', () => {
        const roomName = salaSegura(roomInput.value);
        if (!roomName) return exibirAlertaDoSistema("Sala Obrigatória", "Por favor, informe o código da sala para assistir.");
        difficultyBox.style.display = "none";
        isPracticeMode = false;
        hasRecordedResult = false;
        alertaFimPartidaMostrado = false;
        lockPieceForMultiCapture = null;
        ultimoContadorEspectadores = 0;
        roomId = roomName;
        registrarJogadorComunidade(nameInput.value || "Olheiro");
        joinRoom(roomName, "Olheiro", true);
    });

    practiceBtn.addEventListener('click', () => {
        difficultyBox.style.display = difficultyBox.style.display === "flex" ? "none" : "flex";
    });

    btnChooseEasy.addEventListener('click', () => { isLearningMode = false; practiceDifficulty = "facil"; iniciarTreinoDireto(); });
    btnChooseMedium.addEventListener('click', () => { isLearningMode = false; practiceDifficulty = "medio"; iniciarTreinoDireto(); });
    btnChooseHard.addEventListener('click', () => { isLearningMode = false; practiceDifficulty = "dificil"; iniciarTreinoDireto(); });
    btnChooseLearn.addEventListener('click', () => { isLearningMode = true; practiceDifficulty = "aprender"; learningTipsVisible = true; iniciarTreinoDireto(); });

    btnLearningRefresh.addEventListener('click', () => {
        if (!isLearningMode || !currentGameState || currentGameState.status !== "playing" || currentGameState.turn !== 1) return;
        atualizarDicaAprendizado(true);
    });

    btnLearningToggle.addEventListener('click', () => {
        learningTipsVisible = !learningTipsVisible;
        btnLearningToggle.innerText = learningTipsVisible ? "Ocultar dicas" : "Mostrar dicas";
        atualizarDicaAprendizado(true);
    });

    function iniciarTreinoDireto() {
        const playerName = nameInput.value.trim() || "Você";
        difficultyBox.style.display = "none";
        isPracticeMode = true;
        hasRecordedResult = false;
        alertaFimPartidaMostrado = false;
        lockPieceForMultiCapture = null;
        playerRole = "p1";
        registrarJogadorComunidade(playerName);
        setupPracticeGame(playerName);
    }

    function runLocalTimer(startTimestamp, gameStatus) {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        if (gameStatus !== "playing" || !startTimestamp) {
            if (gameStatus === "waiting") gameTimerEl.innerText = "⏱️ Aguardando";
            return;
        }
        gameTimerInterval = setInterval(() => {
            const momentoAgora = Date.now();
            const totalSeconds = Math.floor((momentoAgora - startTimestamp) / 1000);
            if (totalSeconds < 0) return;
            const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const secs = String(totalSeconds % 60).padStart(2, '0');
            gameTimerEl.innerText = `⏱️ ${mins}:${secs}`;

            if (timestampInicioTurnoAtual > 0) {
                const segundosNoTurno = Math.floor((momentoAgora - timestampInicioTurnoAtual) / 1000);
                if (segundosNoTurno >= 10 && !jaAlertouTurnoDemorado) {
                    jaAlertouTurnoDemorado = true;
                    
                    const seuTurnoE1 = (currentGameState && currentGameState.turn === 1 && playerRole === "p1");
                    const seuTurnoE2 = (currentGameState && currentGameState.turn === 2 && playerRole === "p2");
                    const noModoTreinoSuaVez = (isPracticeMode && currentGameState && currentGameState.turn === 1);

                    if (seuTurnoE1 || seuTurnoE2 || noModoTreinoSuaVez) {
                        reproduzirSomDoJogo('bip_aviso');
                        turnIndicator.classList.add('tempo-estourado');
                    }
                }
            }
        }, 1000);
    }

    toggleChatVisibility.addEventListener('click', () => {
        isChatMutedLocally = !isChatMutedLocally;
        if (window.TabuleiroChatUI && typeof window.TabuleiroChatUI.aplicarEstadoChatNormal === 'function') {
            window.TabuleiroChatUI.aplicarEstadoChatNormal({
                muted: isChatMutedLocally,
                button: toggleChatVisibility,
                messages: chatBoxMessages,
                inputWrapper: chatInputWrapper
            });
            return;
        }
        if (isChatMutedLocally) {
            toggleChatVisibility.innerText = "Ligar Chat";
            toggleChatVisibility.classList.add('off');
            chatBoxMessages.style.opacity = "0.15";
            chatBoxMessages.style.pointerEvents = "none";
            chatInputWrapper.style.display = "none";
        } else {
            toggleChatVisibility.innerText = "Desligar Chat";
            toggleChatVisibility.classList.remove('off');
            chatBoxMessages.style.opacity = "1";
            chatBoxMessages.style.pointerEvents = "auto";
            chatInputWrapper.style.display = "flex";
            chatBoxMessages.scrollTop = chatBoxMessages.scrollHeight;
        }
    });

    function pushChatMessage() {
        if (currentGameState && currentGameState.chatBlocked) {
            exibirAlertaDoSistema("Chat Trancado", "O Administrador desativou o envio de mensagens nesta sala.");
            return;
        }

        const text = somenteTextoSeguro(chatInputField.value, 80);
        if (!text) return;
        const author = nomeSeguro(nameInput.value || "Anônimo");
        if (isPracticeMode) { appendChatRow(author, text); chatInputField.value = ""; return; }
        const msgRef = ref(db, `rooms/${roomId}/chat`);
        push(msgRef, { author: author, text: text, timestamp: Date.now() });
        chatInputField.value = "";
    }

    chatSendBtn.addEventListener('click', pushChatMessage);
    chatInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') pushChatMessage(); });

    function appendChatRow(author, text) {
        if (window.TabuleiroChatUI && typeof window.TabuleiroChatUI.adicionarLinhaChatNormal === 'function') {
            window.TabuleiroChatUI.adicionarLinhaChatNormal(chatBoxMessages, author, text);
            return;
        }
        const row = document.createElement('div');
        row.className = "chat-msg-row";
        const authorSpan = document.createElement('span');
        authorSpan.className = "msg-author";
        authorSpan.innerText = author + ": ";
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        row.appendChild(authorSpan);
        row.appendChild(textSpan);
        chatBoxMessages.appendChild(row);
        chatBoxMessages.scrollTop = chatBoxMessages.scrollHeight;
    }


    // ================================================================
    // 📹 CHAMADA DE VÍDEO E ÁUDIO GRÁTIS - WEBRTC + FIREBASE
    // Versão corrigida: janelinha flutuante + sinalização por função
    // p1 sempre cria o convite e p2 sempre responde. Isso evita a tela
    // ficar presa em "aguardando jogador" quando os dois já entraram.
    // ================================================================
    const rtcConfigGratis = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    };

    let callSessionId = "";

    function atualizarStatusChamada(texto) {
        if (callStatusText) callStatusText.innerText = texto;
    }

    function podeUsarChamadaAgora() {
        return !isPracticeMode && roomId && (playerRole === "p1" || playerRole === "p2");
    }

    function oponenteDaChamada() {
        return playerRole === "p1" ? "p2" : "p1";
    }

    function atualizarPainelChamada() {
        if (!voiceVideoCallPanel) return;

        const souJogadorDaChamada = podeUsarChamadaAgora();
        const souEspectadorOnline = !isPracticeMode && roomId && playerRole === "spectator";

        if (souJogadorDaChamada) {
            voiceVideoCallPanel.style.display = "block";
            voiceVideoCallPanel.classList.remove("call-spectator");
            voiceVideoCallPanel.classList.toggle("call-active", !!localCallStream);
            if (localCallStream) restaurarPosicaoChamadaFlutuante();

            const localLabel = voiceVideoCallPanel.querySelector('.video-tile:first-child .video-label');
            const remoteLabel = voiceVideoCallPanel.querySelector('.video-tile:nth-child(2) .video-label');
            if (localLabel) localLabel.innerText = "Você";
            if (remoteLabel) remoteLabel.innerText = "Oponente";

            if (startCallBtn) { startCallBtn.disabled = !!localCallStream; startCallBtn.style.display = ""; }
            if (startAudioCallBtn) { startAudioCallBtn.disabled = !!localCallStream; startAudioCallBtn.style.display = ""; }
            if (endCallBtn) { endCallBtn.disabled = !localCallStream; endCallBtn.innerText = "Encerrar"; }
            if (toggleMicBtn) toggleMicBtn.disabled = !localCallStream;
            if (toggleCameraBtn) toggleCameraBtn.disabled = !localCallStream;
            if (unlockAudioBtn) unlockAudioBtn.style.display = "";

            if (!localCallStream) {
                atualizarStatusChamada("Toque em iniciar para chamar o oponente.");
            }
            return;
        }

        if (souEspectadorOnline) {
            voiceVideoCallPanel.style.display = "block";
            voiceVideoCallPanel.classList.add("call-spectator");
            voiceVideoCallPanel.classList.toggle("call-active", !!spectatorWatchActive);
            if (spectatorWatchActive) restaurarPosicaoChamadaFlutuante();

            const localLabel = voiceVideoCallPanel.querySelector('.video-tile:first-child .video-label');
            const remoteLabel = voiceVideoCallPanel.querySelector('.video-tile:nth-child(2) .video-label');
            if (localLabel) localLabel.innerText = "Vermelho";
            if (remoteLabel) remoteLabel.innerText = "Preto";

            if (startCallBtn) { startCallBtn.disabled = true; startCallBtn.style.display = "none"; }
            if (startAudioCallBtn) { startAudioCallBtn.disabled = true; startAudioCallBtn.style.display = "none"; }
            if (toggleMicBtn) { toggleMicBtn.disabled = true; toggleMicBtn.style.display = "none"; }
            if (toggleCameraBtn) { toggleCameraBtn.disabled = true; toggleCameraBtn.style.display = "none"; }
            if (endCallBtn) { endCallBtn.disabled = !spectatorWatchActive; endCallBtn.innerText = "Parar transmissão"; }
            if (unlockAudioBtn) unlockAudioBtn.style.display = "";

            if (!spectatorWatchActive && !spectatorWatchConnecting) {
                atualizarStatusChamada("Aguardando os jogadores abrirem câmera e áudio...");
            }
            return;
        }

        voiceVideoCallPanel.classList.remove("call-active", "call-spectator");
        voiceVideoCallPanel.style.display = "none";
        atualizarStatusChamada("Disponível apenas para sala online.");
    }

    function explicarErroMidia(erro) {
        const nomeErro = erro?.name || "";
        if (location.protocol !== "https:" && location.hostname !== "localhost") {
            return "A chamada precisa abrir em link HTTPS. Publique na Vercel ou GitHub Pages e abra pelo navegador.";
        }
        if (nomeErro === "NotAllowedError" || nomeErro === "PermissionDeniedError") {
            return "Câmera ou microfone bloqueados. Abra as permissões do navegador e libere Câmera e Microfone para este site.";
        }
        if (nomeErro === "NotFoundError" || nomeErro === "DevicesNotFoundError") {
            return "O navegador não encontrou câmera ou microfone disponível neste aparelho.";
        }
        if (nomeErro === "NotReadableError" || nomeErro === "TrackStartError") {
            return "A câmera ou o microfone estão ocupados por outro aplicativo. Feche WhatsApp, Instagram, câmera ou chamada aberta e tente novamente.";
        }
        return "Não foi possível acessar câmera ou microfone. Libere as permissões do navegador e tente novamente.";
    }

    async function prepararMidiaLocal(somenteAudio = false) {
        if (localCallStream) return localCallStream;

        try {
            if (somenteAudio) {
                localCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            } else {
                try {
                    localCallStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
                        audio: true
                    });
                } catch (erroVideo) {
                    localCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    exibirAlertaDoSistema("Chamada por áudio", "A câmera não foi liberada, então a chamada começou somente com áudio.");
                }
            }
        } catch (erroMidia) {
            throw new Error(explicarErroMidia(erroMidia));
        }

        localMicEnabled = true;
        localCameraEnabled = localCallStream.getVideoTracks().some(t => t.enabled);
        if (localVideoEl) localVideoEl.srcObject = localCallStream;
        if (voiceVideoCallPanel) {
            voiceVideoCallPanel.classList.add("call-active");
            restaurarPosicaoChamadaFlutuante();
        }
        if (toggleMicBtn) {
            toggleMicBtn.innerText = "🎙️ Mic";
            toggleMicBtn.classList.remove("btn-call-muted");
        }
        if (toggleCameraBtn) {
            toggleCameraBtn.innerText = localCameraEnabled ? "📷 Cam" : "📷 Sem cam";
            toggleCameraBtn.classList.toggle("btn-call-muted", !localCameraEnabled);
        }
        return localCallStream;
    }

    function criarPeerChamada() {
        if (callPeer) return callPeer;

        callPeer = new RTCPeerConnection(rtcConfigGratis);

        callPeer.ontrack = (event) => {
            // Recebe áudio/vídeo do outro jogador. Mantém os tracks juntos em um único stream remoto.
            if (!remoteVideoEl) return;

            let remoteStream = event.streams && event.streams[0];

            // Alguns celulares não entregam event.streams[0]; então criamos um MediaStream manual.
            if (!remoteStream) {
                remoteStream = remoteVideoEl.srcObject instanceof MediaStream
                    ? remoteVideoEl.srcObject
                    : new MediaStream();
            }

            // Garante que áudio e vídeo do oponente entrem no mesmo stream, mesmo chegando separados.
            if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
                try { remoteStream.addTrack(event.track); } catch (_) {}
            }

            remoteVideoEl.srcObject = remoteStream;
            remoteVideoEl.muted = true; // o som sai pelo elemento de áudio abaixo para evitar bloqueio/duplicidade.
            remoteVideoEl.play?.().catch(() => {});

            if (remoteAudioEl) {
                remoteAudioEl.srcObject = remoteStream;
                remoteAudioEl.muted = false;
                remoteAudioEl.volume = 1;
                remoteAudioEl.play?.().catch(() => {
                    atualizarStatusChamada("Vídeo conectado. Toque em 🔊 Som para liberar o áudio.");
                });
            }

            atualizarStatusChamada("Conectado ✅");
            if (voiceVideoCallPanel) {
                voiceVideoCallPanel.classList.add("call-active");
                restaurarPosicaoChamadaFlutuante();
            }
        };

        callPeer.onicecandidate = async (event) => {
            if (!event.candidate || !roomId || !playerRole || !playerId) return;
            try {
                await push(ref(db, `rooms/${roomId}/call/candidates/${playerRole}`), {
                    ...event.candidate.toJSON(),
                    sessionId: callSessionId,
                    createdAt: Date.now()
                });
            } catch (e) {
                console.warn("Falha ao enviar candidato ICE:", e);
            }
        };

        callPeer.onconnectionstatechange = () => {
            const estado = callPeer?.connectionState || "novo";
            if (estado === "new") atualizarStatusChamada("Preparando conexão...");
            if (estado === "connecting") atualizarStatusChamada("Conectando chamada...");
            if (estado === "connected") atualizarStatusChamada("Conectado ✅");
            if (estado === "disconnected") atualizarStatusChamada("Conexão instável. Tentando reconectar...");
            if (estado === "failed") atualizarStatusChamada("A rede bloqueou a conexão direta. Tente trocar de internet ou usar somente áudio.");
            if (estado === "closed") atualizarStatusChamada("Chamada encerrada.");
        };

        if (localCallStream) {
            localCallStream.getTracks().forEach(track => callPeer.addTrack(track, localCallStream));
        }

        return callPeer;
    }

    function limparListenersChamada() {
        callUnsubscribers.forEach(unsub => {
            try { if (typeof unsub === "function") unsub(); } catch (_) {}
        });
        callUnsubscribers = [];
    }

    async function iniciarChamadaWebRTC(somenteAudio = false) {
        if (!podeUsarChamadaAgora()) {
            exibirAlertaDoSistema("Chamada indisponível", "A chamada de vídeo e áudio funciona apenas para os dois jogadores da sala online.");
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            exibirAlertaDoSistema("Navegador incompatível", "Este navegador não liberou câmera/microfone para chamada. Use Chrome, Edge ou navegador atualizado.");
            return;
        }

        callStartedByUser = true;
        callSessionId = `${Date.now()}_${playerRole}_${playerId}`;
        processedRemoteCandidates = new Set();
        remoteDescriptionApplied = false;
        atualizarStatusChamada("Pedindo permissão da câmera e microfone...");

        try {
            await prepararMidiaLocal(somenteAudio);

            // Remove sinalização velha sem apagar o participante que já entrou.
            // Isso resolve o caso em que ficou oferta/resposta antiga no Firebase.
            if (playerRole === "p1") {
                await remove(ref(db, `rooms/${roomId}/call/offer`));
                await remove(ref(db, `rooms/${roomId}/call/answer`));
                await remove(ref(db, `rooms/${roomId}/call/candidates`));
            } else {
                await remove(ref(db, `rooms/${roomId}/call/candidates/${playerRole}`));
            }

            await update(ref(db, `rooms/${roomId}/call`), {
                status: "active",
                updatedAt: Date.now()
            });

            await update(ref(db, `rooms/${roomId}/call/participants/${playerId}`), {
                role: playerRole,
                name: nomeSeguro(nameInput.value || playerRole),
                sessionId: callSessionId,
                joinedAt: Date.now()
            });
            onDisconnect(ref(db, `rooms/${roomId}/call/participants/${playerId}`)).remove();

            criarPeerChamada();
            escutarSinalizacaoChamada();
            escutarPedidosEspectadoresChamada();
            atualizarPainelChamada();

            atualizarStatusChamada(playerRole === "p1"
                ? "Aguardando conexão com o jogador preto..."
                : "Aguardando convite do jogador vermelho...");
        } catch (e) {
            encerrarChamadaWebRTC(false);
            exibirAlertaDoSistema("Erro na chamada", somenteTextoSeguro(e.message || "Não foi possível iniciar a chamada.", 180));
        }
    }

    function escutarSinalizacaoChamada() {
        limparListenersChamada();

        const callRef = ref(db, `rooms/${roomId}/call`);
        const unsubCall = onValue(callRef, async (snap) => {
            const callData = snap.val() || {};

            if (callData.status === "ended" && callData.endedBy !== playerId && localCallStream) {
                encerrarChamadaWebRTC(false);
                atualizarStatusChamada("O oponente encerrou a chamada.");
                return;
            }

            const participants = callData.participants || {};
            const temP1 = Object.values(participants).some(p => p?.role === "p1");
            const temP2 = Object.values(participants).some(p => p?.role === "p2");

            // Jogador vermelho cria a oferta somente quando os dois já estão na chamada.
            if (localCallStream && playerRole === "p1" && temP1 && temP2 && !callData.offer?.sdp) {
                try {
                    const pc = criarPeerChamada();
                    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                    await pc.setLocalDescription(offer);
                    await set(ref(db, `rooms/${roomId}/call/offer`), {
                        type: offer.type,
                        sdp: offer.sdp,
                        fromRole: "p1",
                        sessionId: callSessionId,
                        createdAt: Date.now()
                    });
                    atualizarStatusChamada("Convite enviado. Esperando resposta...");
                } catch (e) {
                    console.warn("Erro criando oferta WebRTC:", e);
                    atualizarStatusChamada("Falha ao criar convite da chamada.");
                }
            }

            // Jogador preto recebe a oferta e responde.
            if (localCallStream && playerRole === "p2" && callData.offer?.sdp && !remoteDescriptionApplied) {
                try {
                    const pc = criarPeerChamada();
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: callData.offer.type,
                        sdp: callData.offer.sdp
                    }));
                    remoteDescriptionApplied = true;
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await set(ref(db, `rooms/${roomId}/call/answer`), {
                        type: answer.type,
                        sdp: answer.sdp,
                        fromRole: "p2",
                        sessionId: callSessionId,
                        createdAt: Date.now()
                    });
                    atualizarStatusChamada("Resposta enviada. Conectando...");
                } catch (e) {
                    console.warn("Erro respondendo chamada WebRTC:", e);
                    atualizarStatusChamada("Falha ao responder chamada.");
                }
            }

            // Jogador vermelho recebe a resposta.
            if (localCallStream && playerRole === "p1" && callData.answer?.sdp && !remoteDescriptionApplied) {
                try {
                    const pc = criarPeerChamada();
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: callData.answer.type,
                        sdp: callData.answer.sdp
                    }));
                    remoteDescriptionApplied = true;
                    atualizarStatusChamada("Resposta recebida. Conectando...");
                } catch (e) {
                    console.warn("Erro aplicando resposta WebRTC:", e);
                    atualizarStatusChamada("Falha ao aplicar resposta da chamada.");
                }
            }

            // Troca de candidatos ICE por função: p1 lê p2, p2 lê p1.
            // Correção importante: se o candidato chegar antes da descrição remota, NÃO marcamos como processado.
            // Assim ele será tentado novamente quando a oferta/resposta já estiver aplicada.
            if (localCallStream && callData.candidates) {
                const outroRole = oponenteDaChamada();
                const lista = callData.candidates[outroRole] || {};
                for (const [candId, cand] of Object.entries(lista)) {
                    const chave = `${outroRole}_${candId}`;
                    if (processedRemoteCandidates.has(chave)) continue;
                    try {
                        const pc = criarPeerChamada();
                        if (!pc.remoteDescription || !cand || !cand.candidate) {
                            continue;
                        }
                        await pc.addIceCandidate(new RTCIceCandidate(cand));
                        processedRemoteCandidates.add(chave);
                    } catch (e) {
                        // Não mata a chamada por candidato duplicado/fora de ordem.
                        console.warn("Candidato ICE aguardando nova tentativa:", e);
                    }
                }
            }
        });

        callUnsubscribers.push(unsubCall);
    }

    async function encerrarChamadaWebRTC(avisarFirebase = true) {
        limparListenersChamada();
        limparListenersJogadorParaEspectadores();
        fecharPeersJogadorParaEspectadores();
        if (playerRole === "spectator") {
            await encerrarAssistirChamadaEspectador(avisarFirebase);
        }

        if (callPeer) {
            try { callPeer.close(); } catch (_) {}
            callPeer = null;
        }

        if (localCallStream) {
            localCallStream.getTracks().forEach(track => track.stop());
            localCallStream = null;
        }

        if (localVideoEl) localVideoEl.srcObject = null;
        if (remoteVideoEl) remoteVideoEl.srcObject = null;
        if (remoteAudioEl) remoteAudioEl.srcObject = null;
        if (voiceVideoCallPanel) voiceVideoCallPanel.classList.remove("call-active");

        processedRemoteCandidates = new Set();
        remoteDescriptionApplied = false;
        callStartedByUser = false;

        if (avisarFirebase && roomId && playerId && !isPracticeMode) {
            try {
                await remove(ref(db, `rooms/${roomId}/call/participants/${playerId}`));
                await update(ref(db, `rooms/${roomId}/call`), {
                    status: "ended",
                    endedAt: Date.now(),
                    endedBy: playerId
                });
                if (playerRole === "p1" || playerRole === "p2") {
                    await remove(ref(db, `rooms/${roomId}/call/watchers`));
                }
            } catch (e) {
                console.warn("Não foi possível limpar chamada no Firebase:", e);
            }
        }

        atualizarPainelChamada();
        atualizarStatusChamada("Chamada encerrada.");
    }




    // 👁️ ESPECTADORES VENDO E OUVINDO A CHAMADA DOS DOIS JOGADORES
    // Cada espectador recebe uma conexão separada de cada jogador, sem enviar câmera nem microfone.
    function limparListenersEspectadorChamada() {
        spectatorWatchUnsubscribers.forEach(unsub => {
            try { if (typeof unsub === "function") unsub(); } catch (_) {}
        });
        spectatorWatchUnsubscribers = [];
    }

    function limparListenersJogadorParaEspectadores() {
        playerSpectatorUnsubscribers.forEach(unsub => {
            try { if (typeof unsub === "function") unsub(); } catch (_) {}
        });
        playerSpectatorUnsubscribers = [];
    }

    function fecharPeersJogadorParaEspectadores() {
        Object.values(playerSpectatorPeers).forEach(pc => {
            try { pc.close(); } catch (_) {}
        });
        playerSpectatorPeers = {};
        playerProcessedSpectatorCandidates = new Set();
        playerAnsweredSpectatorOffers = new Set();
        playerSpectatorOfferKeys = {};
    }

    async function encerrarAssistirChamadaEspectador(removerFirebase = true) {
        limparListenersEspectadorChamada();

        Object.values(spectatorWatchPeers).forEach(pc => {
            try { pc.close(); } catch (_) {}
        });
        spectatorWatchPeers = {};
        spectatorWatchStreams = { p1: null, p2: null };
        spectatorProcessedCandidates = new Set();
        spectatorWatchActive = false;
        spectatorWatchConnecting = false;

        if (localVideoEl) localVideoEl.srcObject = null;
        if (remoteVideoEl) remoteVideoEl.srcObject = null;
        if (spectatorAudioP1) { try { spectatorAudioP1.pause(); spectatorAudioP1.srcObject = null; } catch (_) {} }
        if (spectatorAudioP2) { try { spectatorAudioP2.pause(); spectatorAudioP2.srcObject = null; } catch (_) {} }
        spectatorAudioP1 = null;
        spectatorAudioP2 = null;

        if (removerFirebase && roomId && playerId) {
            try { await remove(ref(db, `rooms/${roomId}/call/watchers/${playerId}`)); } catch (_) {}
        }

        atualizarPainelChamada();
    }

    function obterAudioEspectador(role) {
        if (role === "p1") {
            if (!spectatorAudioP1) {
                spectatorAudioP1 = document.createElement('audio');
                spectatorAudioP1.autoplay = true;
                spectatorAudioP1.playsInline = true;
            }
            return spectatorAudioP1;
        }
        if (!spectatorAudioP2) {
            spectatorAudioP2 = document.createElement('audio');
            spectatorAudioP2.autoplay = true;
            spectatorAudioP2.playsInline = true;
        }
        return spectatorAudioP2;
    }

    function aplicarStreamEspectador(role, event) {
        let stream = event.streams && event.streams[0];
        if (!stream) {
            stream = spectatorWatchStreams[role] instanceof MediaStream ? spectatorWatchStreams[role] : new MediaStream();
        }
        if (event.track && !stream.getTracks().some(t => t.id === event.track.id)) {
            try { stream.addTrack(event.track); } catch (_) {}
        }
        spectatorWatchStreams[role] = stream;

        const videoEl = role === "p1" ? localVideoEl : remoteVideoEl;
        if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.muted = true;
            videoEl.play?.().catch(() => {});
        }

        const audioEl = obterAudioEspectador(role);
        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1;
        audioEl.play?.().catch(() => {
            atualizarStatusChamada("Transmissão visível. Toque em 🔊 Som para liberar o áudio.");
        });

        spectatorWatchActive = true;
        atualizarPainelChamada();
        atualizarStatusChamada("Assistindo câmera e áudio dos jogadores ✅");
    }

    function criarPeerEspectadorPara(roleAlvo) {
        if (spectatorWatchPeers[roleAlvo]) return spectatorWatchPeers[roleAlvo];

        const pc = new RTCPeerConnection(rtcConfigGratis);
        spectatorWatchPeers[roleAlvo] = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        pc.ontrack = (event) => aplicarStreamEspectador(roleAlvo, event);

        pc.onicecandidate = async (event) => {
            if (!event.candidate || !roomId || !playerId) return;
            try {
                await push(ref(db, `rooms/${roomId}/call/watchers/${playerId}/candidates/spectator/${roleAlvo}`), {
                    ...event.candidate.toJSON(),
                    createdAt: Date.now()
                });
            } catch (e) {
                console.warn("Falha ao enviar candidato ICE do espectador:", e);
            }
        };

        pc.onconnectionstatechange = () => {
            const estado = pc.connectionState || "new";
            if (estado === "connected") {
                spectatorWatchActive = true;
                atualizarPainelChamada();
                atualizarStatusChamada("Assistindo transmissão ao vivo ✅");
            }
            if (estado === "failed") atualizarStatusChamada("A rede bloqueou parte da transmissão. Toque em 🔊 Som ou atualize.");
        };

        return pc;
    }

    async function iniciarAssistirChamadaEspectador() {
        if (spectatorWatchConnecting || spectatorWatchActive) return;
        if (isPracticeMode || playerRole !== "spectator" || !roomId || !playerId) return;

        spectatorWatchConnecting = true;
        atualizarPainelChamada();
        atualizarStatusChamada("Conectando como espectador da chamada...");

        try {
            // Limpa qualquer tentativa antiga deste espectador antes de criar novas ofertas.
            // Isso evita o bug de aparecer só um jogador por causa de offer/answer velha no Firebase.
            await remove(ref(db, `rooms/${roomId}/call/watchers/${playerId}`));
            const watchSessionId = `${Date.now()}_${playerId}`;
            spectatorProcessedCandidates = new Set();

            await update(ref(db, `rooms/${roomId}/call/watchers/${playerId}/meta`), {
                name: nomeSeguro(nameInput?.value || "Espectador"),
                joinedAt: Date.now(),
                sessionId: watchSessionId
            });
            onDisconnect(ref(db, `rooms/${roomId}/call/watchers/${playerId}`)).remove();

            for (const roleAlvo of ["p1", "p2"]) {
                const pc = criarPeerEspectadorPara(roleAlvo);
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                await set(ref(db, `rooms/${roomId}/call/watchers/${playerId}/offers/${roleAlvo}`), {
                    type: offer.type,
                    sdp: offer.sdp,
                    sessionId: watchSessionId,
                    createdAt: Date.now()
                });
            }
        } catch (e) {
            console.warn("Falha ao iniciar espectador da chamada:", e);
            atualizarStatusChamada("Não foi possível assistir a chamada agora.");
        } finally {
            spectatorWatchConnecting = false;
        }
    }

    function escutarChamadaParaEspectador() {
        limparListenersEspectadorChamada();
        if (isPracticeMode || playerRole !== "spectator" || !roomId || !playerId) return;

        const callRef = ref(db, `rooms/${roomId}/call`);
        const unsub = onValue(callRef, async (snap) => {
            const callData = snap.val() || {};
            const participants = callData.participants || {};
            const temP1 = Object.values(participants).some(p => p?.role === "p1");
            const temP2 = Object.values(participants).some(p => p?.role === "p2");

            if (callData.status === "active" && temP1 && temP2 && !spectatorWatchActive && !spectatorWatchConnecting) {
                iniciarAssistirChamadaEspectador();
            }

            if ((!callData.status || callData.status === "ended") && (spectatorWatchActive || spectatorWatchConnecting)) {
                encerrarAssistirChamadaEspectador(false);
                atualizarStatusChamada("A chamada dos jogadores foi encerrada.");
                return;
            }

            if (playerRole !== "spectator" || !roomId || !playerId) return;
            const watcher = callData.watchers?.[playerId] || {};

            for (const roleAlvo of ["p1", "p2"]) {
                const answer = watcher.answers?.[roleAlvo];
                const pc = spectatorWatchPeers[roleAlvo];
                if (pc && answer?.sdp && !pc.remoteDescription) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: answer.type, sdp: answer.sdp }));
                    } catch (e) {
                        console.warn("Falha ao aplicar resposta para espectador:", e);
                    }
                }

                const lista = watcher.candidates?.[roleAlvo] || {};
                for (const [candId, cand] of Object.entries(lista)) {
                    const chave = `${roleAlvo}_${candId}`;
                    if (spectatorProcessedCandidates.has(chave)) continue;
                    try {
                        const pcAtual = spectatorWatchPeers[roleAlvo];
                        if (!pcAtual || !pcAtual.remoteDescription || !cand?.candidate) continue;
                        await pcAtual.addIceCandidate(new RTCIceCandidate(cand));
                        spectatorProcessedCandidates.add(chave);
                    } catch (e) {
                        console.warn("Candidato ICE do jogador aguardando nova tentativa:", e);
                    }
                }
            }
        });
        spectatorWatchUnsubscribers.push(unsub);
    }

    function adicionarTracksLocaisAoPeerSpectador(pc) {
        if (!pc || !localCallStream) return;

        // IMPORTANTE PARA O MODO ESPECTADOR:
        // O espectador cria uma oferta "recvonly". O jogador precisa encaixar
        // a própria câmera e microfone dentro dos transceivers que já vieram
        // nessa oferta. Se usar apenas addTrack aqui, alguns navegadores aceitam
        // a conexão, mas enviam tela preta e áudio mudo para quem assiste.
        const tracks = localCallStream.getTracks();

        tracks.forEach(track => {
            try {
                const transceiver = pc.getTransceivers().find(t => {
                    const receiverKind = t.receiver?.track?.kind;
                    const senderKind = t.sender?.track?.kind;
                    return receiverKind === track.kind || senderKind === track.kind;
                });

                if (transceiver) {
                    transceiver.direction = "sendonly";
                    transceiver.sender.replaceTrack(track).catch(() => {});
                } else if (!pc.getSenders().some(sender => sender.track && sender.track.id === track.id)) {
                    pc.addTrack(track, localCallStream);
                }
            } catch (e) {
                console.warn("Não foi possível anexar mídia ao espectador:", e);
            }
        });
    }

    function criarPeerJogadorParaEspectador(spectatorId) {
        if (playerSpectatorPeers[spectatorId]) return playerSpectatorPeers[spectatorId];

        const pc = new RTCPeerConnection(rtcConfigGratis);
        playerSpectatorPeers[spectatorId] = pc;

        pc.onicecandidate = async (event) => {
            if (!event.candidate || !roomId || !spectatorId || !playerRole) return;
            try {
                await push(ref(db, `rooms/${roomId}/call/watchers/${spectatorId}/candidates/${playerRole}`), {
                    ...event.candidate.toJSON(),
                    createdAt: Date.now()
                });
            } catch (e) {
                console.warn("Falha ao enviar candidato ICE ao espectador:", e);
            }
        };

        pc.onconnectionstatechange = () => {
            const estado = pc.connectionState || "new";
            if (estado === "failed" || estado === "closed") {
                try { pc.close(); } catch (_) {}
                delete playerSpectatorPeers[spectatorId];
                delete playerSpectatorOfferKeys[spectatorId];
            }
        };

        pc.oniceconnectionstatechange = () => {
            const estadoIce = pc.iceConnectionState || "new";
            if (estadoIce === "failed" || estadoIce === "disconnected") {
                // Libera para responder de novo se o espectador atualizar/reabrir a transmissão.
                delete playerSpectatorOfferKeys[spectatorId];
            }
        };

        return pc;
    }

    function escutarPedidosEspectadoresChamada() {
        limparListenersJogadorParaEspectadores();
        if (!localCallStream || !roomId || !(playerRole === "p1" || playerRole === "p2")) return;

        const watchersRef = ref(db, `rooms/${roomId}/call/watchers`);
        const unsub = onValue(watchersRef, async (snap) => {
            const watchers = snap.val() || {};
            for (const [spectatorId, watcher] of Object.entries(watchers)) {
                if (!watcher || spectatorId === playerId) continue;
                const offer = watcher.offers?.[playerRole];
                if (!offer?.sdp) continue;

                const offerKey = `${spectatorId}_${playerRole}_${offer.sessionId || watcher.meta?.sessionId || offer.createdAt || offer.sdp.slice(0, 24)}`;
                try {
                    // Se o espectador atualizou/reentrou, recria a conexão deste jogador para não ficar presa em SDP antigo.
                    if (playerSpectatorOfferKeys[spectatorId] && playerSpectatorOfferKeys[spectatorId] !== offerKey) {
                        try { playerSpectatorPeers[spectatorId]?.close(); } catch (_) {}
                        delete playerSpectatorPeers[spectatorId];
                    }

                    const pc = criarPeerJogadorParaEspectador(spectatorId);
                    if (!playerAnsweredSpectatorOffers.has(offerKey)) {
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: offer.sdp }));
                        // Importante: adiciona a câmera/áudio DEPOIS de ler a oferta do espectador.
                        // Em alguns celulares, adicionar antes faz o espectador conectar, mas receber tela preta/silêncio.
                        adicionarTracksLocaisAoPeerSpectador(pc);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await set(ref(db, `rooms/${roomId}/call/watchers/${spectatorId}/answers/${playerRole}`), {
                            type: answer.type,
                            sdp: answer.sdp,
                            sessionId: offer.sessionId || watcher.meta?.sessionId || "",
                            createdAt: Date.now()
                        });
                        playerAnsweredSpectatorOffers.add(offerKey);
                        playerSpectatorOfferKeys[spectatorId] = offerKey;
                    }

                    const lista = watcher.candidates?.spectator?.[playerRole] || {};
                    for (const [candId, cand] of Object.entries(lista)) {
                        const chave = `${spectatorId}_${playerRole}_${offerKey}_${candId}`;
                        if (playerProcessedSpectatorCandidates.has(chave)) continue;
                        try {
                            if (!pc.remoteDescription || !cand?.candidate) continue;
                            await pc.addIceCandidate(new RTCIceCandidate(cand));
                            playerProcessedSpectatorCandidates.add(chave);
                        } catch (e) {
                            console.warn("Candidato ICE do espectador aguardando nova tentativa:", e);
                        }
                    }
                } catch (e) {
                    console.warn("Falha ao responder espectador da chamada:", e);
                    try { playerSpectatorPeers[spectatorId]?.close(); } catch (_) {}
                    delete playerSpectatorPeers[spectatorId];
                    delete playerSpectatorOfferKeys[spectatorId];
                }
            }
        });
        playerSpectatorUnsubscribers.push(unsub);
    }

    // 🖼️ Controles da janelinha flutuante da chamada: arrastar + maior/menor.
    let callFloatingWidth = Number(localStorage.getItem('damas_call_floating_width_landscape') || 330);
    callFloatingWidth = Math.max(260, Math.min(420, callFloatingWidth));

    function aplicarTamanhoChamadaFlutuante() {
        if (!voiceVideoCallPanel) return;
        if (voiceVideoCallPanel.classList.contains('call-active')) {
            voiceVideoCallPanel.style.width = `${callFloatingWidth}px`;
        }
        localStorage.setItem('damas_call_floating_width_landscape', String(callFloatingWidth));
    }

    function redimensionarChamadaFlutuante(delta) {
        callFloatingWidth = Math.max(260, Math.min(420, callFloatingWidth + delta));
        aplicarTamanhoChamadaFlutuante();
        manterChamadaDentroDaTela();
    }

    function manterChamadaDentroDaTela() {
        if (!voiceVideoCallPanel || !voiceVideoCallPanel.classList.contains('call-active')) return;
        const rect = voiceVideoCallPanel.getBoundingClientRect();
        const margem = 6;
        let left = rect.left;
        let top = rect.top;
        if (rect.right > window.innerWidth - margem) left -= rect.right - (window.innerWidth - margem);
        if (rect.left < margem) left = margem;
        if (rect.bottom > window.innerHeight - margem) top -= rect.bottom - (window.innerHeight - margem);
        if (rect.top < margem) top = margem;
        voiceVideoCallPanel.style.left = `${Math.round(left)}px`;
        voiceVideoCallPanel.style.top = `${Math.round(top)}px`;
        voiceVideoCallPanel.style.right = 'auto';
        voiceVideoCallPanel.style.bottom = 'auto';
        voiceVideoCallPanel.style.transform = 'none';
    }

    function restaurarPosicaoChamadaFlutuante() {
        if (!voiceVideoCallPanel || !voiceVideoCallPanel.classList.contains('call-active')) return;
        aplicarTamanhoChamadaFlutuante();
        const salvo = localStorage.getItem('damas_call_floating_pos_landscape');
        if (salvo) {
            try {
                const pos = JSON.parse(salvo);
                if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
                    voiceVideoCallPanel.style.left = `${pos.left}px`;
                    voiceVideoCallPanel.style.top = `${pos.top}px`;
                    voiceVideoCallPanel.style.right = 'auto';
                    voiceVideoCallPanel.style.bottom = 'auto';
                    voiceVideoCallPanel.style.transform = 'none';
                }
            } catch (_) {}
        }
        setTimeout(manterChamadaDentroDaTela, 80);
    }

    function ativarArrastarChamadaFlutuante() {
        if (!voiceVideoCallPanel) return;
        const header = voiceVideoCallPanel.querySelector('.call-header');
        if (!header || header.dataset.dragReady === '1') return;
        header.dataset.dragReady = '1';

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        header.addEventListener('pointerdown', (ev) => {
            if (!voiceVideoCallPanel.classList.contains('call-active')) return;
            dragging = true;
            const rect = voiceVideoCallPanel.getBoundingClientRect();
            startX = ev.clientX;
            startY = ev.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            voiceVideoCallPanel.style.left = `${rect.left}px`;
            voiceVideoCallPanel.style.top = `${rect.top}px`;
            voiceVideoCallPanel.style.right = 'auto';
            voiceVideoCallPanel.style.bottom = 'auto';
            voiceVideoCallPanel.style.transform = 'none';
            try { header.setPointerCapture(ev.pointerId); } catch (_) {}
            ev.preventDefault();
        });

        header.addEventListener('pointermove', (ev) => {
            if (!dragging) return;
            const rect = voiceVideoCallPanel.getBoundingClientRect();
            const margem = 6;
            let nextLeft = startLeft + (ev.clientX - startX);
            let nextTop = startTop + (ev.clientY - startY);
            nextLeft = Math.max(margem, Math.min(window.innerWidth - rect.width - margem, nextLeft));
            nextTop = Math.max(margem, Math.min(window.innerHeight - rect.height - margem, nextTop));
            voiceVideoCallPanel.style.left = `${Math.round(nextLeft)}px`;
            voiceVideoCallPanel.style.top = `${Math.round(nextTop)}px`;
            voiceVideoCallPanel.style.right = 'auto';
            voiceVideoCallPanel.style.bottom = 'auto';
            voiceVideoCallPanel.style.transform = 'none';
        });

        const pararArrasto = () => {
            if (!dragging) return;
            dragging = false;
            const rect = voiceVideoCallPanel.getBoundingClientRect();
            localStorage.setItem('damas_call_floating_pos_landscape', JSON.stringify({
                left: Math.round(rect.left),
                top: Math.round(rect.top)
            }));
        };
        header.addEventListener('pointerup', pararArrasto);
        header.addEventListener('pointercancel', pararArrasto);
        window.addEventListener('resize', manterChamadaDentroDaTela);
    }

    ativarArrastarChamadaFlutuante();
    if (callSizeMinusBtn) callSizeMinusBtn.addEventListener('click', () => redimensionarChamadaFlutuante(-24));
    if (callSizePlusBtn) callSizePlusBtn.addEventListener('click', () => redimensionarChamadaFlutuante(24));


    function liberarSomDoOponente() {
        const tentativas = [];
        if (remoteAudioEl) {
            remoteAudioEl.muted = false;
            remoteAudioEl.volume = 1;
            tentativas.push(remoteAudioEl.play?.());
        }
        if (spectatorAudioP1) {
            spectatorAudioP1.muted = false;
            spectatorAudioP1.volume = 1;
            tentativas.push(spectatorAudioP1.play?.());
        }
        if (spectatorAudioP2) {
            spectatorAudioP2.muted = false;
            spectatorAudioP2.volume = 1;
            tentativas.push(spectatorAudioP2.play?.());
        }
        Promise.allSettled(tentativas.filter(Boolean)).then(() => {
            atualizarStatusChamada(playerRole === "spectator" ? "Som da transmissão liberado ✅" : "Som do oponente liberado ✅");
        }).catch(() => {
            atualizarStatusChamada("Toque novamente em 🔊 Som quando alguém falar.");
        });
    }

    if (unlockAudioBtn) unlockAudioBtn.addEventListener('click', liberarSomDoOponente);

    if (startCallBtn) startCallBtn.addEventListener('click', () => iniciarChamadaWebRTC(false));
    if (startAudioCallBtn) startAudioCallBtn.addEventListener('click', () => iniciarChamadaWebRTC(true));
    if (endCallBtn) endCallBtn.addEventListener('click', () => {
        if (playerRole === "spectator") encerrarAssistirChamadaEspectador(true);
        else encerrarChamadaWebRTC(true);
    });

    if (toggleMicBtn) toggleMicBtn.addEventListener('click', () => {
        if (!localCallStream) return;
        localMicEnabled = !localMicEnabled;
        localCallStream.getAudioTracks().forEach(track => track.enabled = localMicEnabled);
        toggleMicBtn.innerText = localMicEnabled ? "🎙️ Mic" : "🔇 Mutado";
        toggleMicBtn.classList.toggle("btn-call-muted", !localMicEnabled);
    });

    if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', () => {
        if (!localCallStream) return;
        const videoTracks = localCallStream.getVideoTracks();
        if (!videoTracks.length) return exibirAlertaDoSistema("Sem câmera", "Esta chamada foi iniciada apenas com áudio.");
        localCameraEnabled = !localCameraEnabled;
        videoTracks.forEach(track => track.enabled = localCameraEnabled);
        toggleCameraBtn.innerText = localCameraEnabled ? "📷 Cam" : "🚫 Cam";
        toggleCameraBtn.classList.toggle("btn-call-muted", !localCameraEnabled);
    });

    function contarPecasNoTabuleiro(board) {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] !== 0) count++;
            }
        }
        return count;
    }

    function detectouNovaDama(oldBoard, newBoard) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let antes = oldBoard[r][c];
                let depois = newBoard[r][c]; 
                if ((antes === 1 && depois === 2) || (antes === 3 && depois === 4)) {
                    return true;
                }
            }
        }
        return false;
    }

    function ativarPainelMonitoramentoRealtime() {
        const todasSalasRef = ref(db, 'rooms');
        onValue(todasSalasRef, (snapshot) => {
            const listEl = document.getElementById('admin-rooms-dashboard-list');
            const panoramaEl = document.getElementById('admin-panorama-header');
            try {
                if (!snapshot.exists()) {
                    listEl.innerHTML = `<div style="color: #888; font-style: italic; font-size: 0.85rem;">Nenhuma sala ativa nos servidores.</div>`;
                    panoramaEl.innerHTML = `📊 PANORAMA: 0 salas registradas no aplicativo`;
                    return;
                }
                
                const roomsData = snapshot.val();
                listEl.innerHTML = "";
                let countDeSalasValidas = 0;
                let salasLiberadas = 0;
                
                for (const idSala in roomsData) {
                    if (idSala === "00") continue; 
                    countDeSalasValidas++;

                    const sala = roomsData[idSala];
                    const isAuth = sala.isAuthorized !== false; 
                    if (isAuth) salasLiberadas++;
                    
                    const statusColor = isAuth ? '#2ecc71' : '#e74c3c';
                    const statusText = isAuth ? 'ATIVA / LIBERADA' : 'BLOQUEADA';
                    const chatTrancado = sala.chatBlocked ? " <span style='color:#e74c3c; font-size:0.7rem; margin-left:5px;'>[CHAT OFF]</span>" : "";
                    
                    const p1Nome = sala.p1Name ? sala.p1Name : "<span style='color:#cca43b; font-style:italic;'>Aguardando...</span>";
                    const p2Nome = sala.p2Name ? sala.p2Name : "<span style='color:#cca43b; font-style:italic;'>Aguardando...</span>";
                    
                    let ocupantesTexto = `Ocupantes: ${p1Nome} vs ${p2Nome}`;
                    if (!sala.p1Name && !sala.p2Name) {
                        ocupantesTexto = `<span style="color:#e67e22; font-weight:bold;">[ Sala Vazia / Aguardando Jogadores ]</span>`;
                    }

                    const row = document.createElement('div');
                    row.style.cssText = `background-color: #16213e; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${statusColor}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s;`;
                    
                    row.onclick = () => {
                        document.getElementById('admin-target-room').value = idSala;
                        row.style.backgroundColor = '#1f3a5f';
                        setTimeout(() => { row.style.backgroundColor = '#16213e'; }, 200);
                    };
                    
                    row.innerHTML = `
                        <div>
                            <strong style="font-size: 1rem; color:#fff;">${idSala.toUpperCase()}</strong>
                            <div style="font-size: 0.75rem; color: #aaa; margin-top: 3px;">${ocupantesTexto} ${chatTrancado}</div>
                        </div>
                        <div style="color: ${statusColor}; font-size: 0.75rem; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${statusColor};"></span>
                            ${statusText}
                        </div>
                    `;
                    
                    listEl.appendChild(row);
                }

                panoramaEl.innerHTML = `📊 PANORAMA: ${countDeSalasValidas} salas | <span style="color:#2ecc71;">${salasLiberadas} Liberadas</span> | <span style="color:#e74c3c;">${countDeSalasValidas - salasLiberadas} Bloqueadas</span>`;

                if (countDeSalasValidas === 0) {
                    listEl.innerHTML = `<div style="color: #888; font-style: italic; font-size: 0.85rem;">Nenhuma sala de jogador registrada além do terminal.</div>`;
                }
            } catch(e) {
                console.error("Erro renderizando dashboard:", e);
                listEl.innerHTML = `<div style="color: #e74c3c; font-size: 0.85rem;">Erro de sistema ao carregar servidores.</div>`;
            }
        });
    }

    document.getElementById('btn-adm-criar-torneio')?.addEventListener('click', criarTorneioAdmin);
    document.getElementById('btn-adm-listar-participantes')?.addEventListener('click', gerarAvisosWhatsApp);

    document.getElementById('btn-adm-monitorar-chat').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const salaAlvo = salaSegura(adminTargetRoomInput.value);
        if (!salaAlvo) return exibirAlertaDoSistema("Aviso", "Por favor, digite ou selecione a sala que deseja espionar o chat.");
        
        const feedContainer = document.getElementById('admin-chat-monitor-container');
        const feedDisplay = document.getElementById('admin-chat-monitor-feed');
        const titleDisplay = document.getElementById('admin-chat-monitor-title');
        
        feedContainer.style.display = "block";
        titleDisplay.innerText = `💬 ESCUTA ATIVA: SALA [${salaAlvo.toUpperCase()}]`;
        feedDisplay.innerHTML = `<div style="color:#888; font-style:italic;">Sintonizando frequências de conversa...</div>`;
        
        if (listenerChatAdminAtivo) { listenerChatAdminAtivo(); }
        
        const targetChatRef = ref(db, `rooms/${salaAlvo}/chat`);
        listenerChatAdminAtivo = onValue(targetChatRef, (snapshot) => {
            feedDisplay.innerHTML = "";
            const chats = snapshot.val();
            if (chats) {
                Object.values(chats).forEach(msg => {
                    const row = document.createElement('div');
                    const strong = document.createElement('strong');
                    strong.style.color = '#3498db';
                    strong.innerText = `${nomeSeguro(msg.author || 'Anônimo')}: `;
                    const span = document.createElement('span');
                    span.style.color = '#eee';
                    span.innerText = somenteTextoSeguro(msg.text || '', 80);
                    row.append(strong, span);
                    feedDisplay.appendChild(row);
                });
                feedDisplay.scrollTop = feedDisplay.scrollHeight;
            } else {
                feedDisplay.innerHTML = `<div style="color:#555; font-style:italic;">Nenhuma mensagem trocada nesta sala ainda.</div>`;
            }
        });
    });

    document.getElementById('btn-adm-limpar-ranking').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        exibirConfirmacao(
            "Limpar Ranking Global ⚠️", 
            "Você tem certeza de que quer <strong>RESETAR COMPLETAMENTE</strong> o placar dos campeões? Todos os jogadores voltarão para 0 vitórias.", 
            async () => {
                await set(ref(db, 'leaderboard'), null);
                await registrarLogAdmin('zerou_ranking_global');
                exibirAlertaDoSistema("Sucesso", "O Ranking Global foi zerado com total sucesso!");
            }
        );
    });

    document.getElementById('btn-adm-excluir-total').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala } = alvo;

        exibirConfirmacao("Excluir Servidor", `Tem certeza absoluta de que quer <strong>DELETAR</strong> permanentemente a sala <strong>${salaAlvo.toUpperCase()}</strong> do banco de dados?`, async () => {
            await remove(refSala);
            await registrarLogAdmin('excluiu_sala', salaAlvo);
            exibirAlertaDoSistema("Eliminação Concluída", `A sala <strong>${salaAlvo.toUpperCase()}</strong> foi removida do sistema.`);
            adminTargetRoomInput.value = "";
        });
    });

    document.getElementById('btn-adm-liberar').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: false });
        if (!alvo) return;
        const { salaAlvo, refSala, snap } = alvo;

        if (!snap.exists()) {
            await set(refSala, {
                id: salaAlvo,
                board: getInitialBoard(),
                turn: 1,
                status: "waiting",
                p1Id: "",
                p1Name: "",
                p2Id: "",
                p2Name: "",
                startTime: 0,
                chat: null,
                isAuthorized: true,
                chatBlocked: false,
                winnerRole: null,
                winnerName: null,
                finishReason: null,
                finishedAt: null,
                createdByAdminUid: playerId,
                createdAt: Date.now(),
                lastAdminAction: "criada_e_liberada",
                lastUsedDate: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            });
            await registrarLogAdmin('criou_e_liberou_sala', salaAlvo);
            exibirAlertaDoSistema("Sucesso", `A sala <strong>${salaAlvo.toUpperCase()}</strong> foi criada pelo administrador e já está liberada!`);
        } else {
            await update(refSala, {
                isAuthorized: true,
                lastAdminAction: "liberada",
                lastAdminUid: playerId,
                lastAdminAt: Date.now(),
                lastUsedDate: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            });
            await registrarLogAdmin('liberou_sala', salaAlvo);
            exibirAlertaDoSistema("Sucesso", `Acesso liberado para a sala <strong>${salaAlvo.toUpperCase()}</strong>.`);
        }
        adminTargetRoomInput.value = "";
    });

    document.getElementById('btn-adm-bloquear').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala } = alvo;
        await update(refSala, {
            isAuthorized: false,
            lastAdminAction: "bloqueada",
            lastAdminUid: playerId,
            lastAdminAt: Date.now()
        });
        await registrarLogAdmin('bloqueou_sala', salaAlvo);
        exibirAlertaDoSistema("Sala Trancada", `Acesso bloqueado para a sala <strong>${salaAlvo.toUpperCase()}</strong>. Quem já estiver jogando pode precisar sair e entrar novamente para ver o bloqueio.`);
        adminTargetRoomInput.value = "";
    });

    document.getElementById('btn-adm-travar-chat').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala, data } = alvo;
        const novoEstado = !(data && data.chatBlocked === true);
        await update(refSala, {
            chatBlocked: novoEstado,
            lastAdminAction: novoEstado ? "chat_travado" : "chat_liberado",
            lastAdminUid: playerId,
            lastAdminAt: Date.now()
        });
        await registrarLogAdmin(novoEstado ? 'travou_chat' : 'destravou_chat', salaAlvo);
        exibirAlertaDoSistema("Chat atualizado", `O chat da sala <strong>${salaAlvo.toUpperCase()}</strong> foi ${novoEstado ? '<strong>travado</strong>' : '<strong>liberado</strong>'}.`);
        adminTargetRoomInput.value = "";
    });

    document.getElementById('btn-adm-expulsar').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala } = alvo;
        
        exibirConfirmacao("Expulsar Todos", `Deseja remover todos os jogadores da sala <strong>${salaAlvo.toUpperCase()}</strong> agora? O tabuleiro será mantido, mas a sala voltará a aguardar novos jogadores.`, async () => {
            await update(refSala, {
                p1Id: "",
                p1Name: "",
                p2Id: "",
                p2Name: "",
                spectators: null,
                status: "waiting",
                startTime: 0,
                lastAdminAction: "jogadores_expulsos",
                lastAdminUid: playerId,
                lastAdminAt: Date.now()
            });
            await registrarLogAdmin('expulsou_jogadores', salaAlvo);
            exibirAlertaDoSistema("Jogadores removidos", `Todos os jogadores da sala <strong>${salaAlvo.toUpperCase()}</strong> foram removidos.`);
            adminTargetRoomInput.value = "";
        });
    });

    document.getElementById('btn-adm-limpar-chat').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala } = alvo;
        await update(refSala, {
            chat: null,
            lastAdminAction: "chat_limpo",
            lastAdminUid: playerId,
            lastAdminAt: Date.now()
        });
        await registrarLogAdmin('limpou_chat', salaAlvo);
        exibirAlertaDoSistema("Chat limpo", `As mensagens da sala <strong>${salaAlvo.toUpperCase()}</strong> foram apagadas.`);
        adminTargetRoomInput.value = "";
    });

    document.getElementById('btn-adm-reset').addEventListener('click', async () => {
        if (!(await exigirAdminSeguro())) return;
        const alvo = await obterSalaAdminAlvo({ exigirExistente: true });
        if (!alvo) return;
        const { salaAlvo, refSala, data } = alvo;
        const temDoisJogadores = !!(data && data.p1Id && data.p2Id);
        await update(refSala, {
            board: getInitialBoard(),
            turn: 1,
            status: temDoisJogadores ? "playing" : "waiting",
            startTime: temDoisJogadores ? Date.now() : 0,
            winnerRole: null,
            winnerName: null,
            finishReason: null,
            finishedAt: null,
            lastAdminAction: "tabuleiro_resetado",
            lastAdminUid: playerId,
            lastAdminAt: Date.now()
        });
        await registrarLogAdmin('resetou_tabuleiro', salaAlvo);
        exibirAlertaDoSistema("Tabuleiro resetado", `A sala <strong>${salaAlvo.toUpperCase()}</strong> foi reiniciada com segurança.`);
        adminTargetRoomInput.value = "";
    });

    document.getElementById('admin-exit-btn').addEventListener('click', () => {
        roomId = ""; playerRole = "spectator"; isPracticeMode = false;
        if (listenerChatAdminAtivo) { listenerChatAdminAtivo(); listenerChatAdminAtivo = null; }
        document.getElementById('admin-chat-monitor-container').style.display = "none";
        adminPanel.style.display = "none"; 
        gameScreen.style.display = 'none'; 
        lobbyScreen.style.display = 'none';
        document.body.classList.add('platform-start-active');
        document.body.classList.add('mode-selecting');
        document.body.classList.remove('game-selected');
        document.body.classList.remove('domino-selected');
        const hubAdminExit = document.getElementById('games-hub-panel');
        if (hubAdminExit) hubAdminExit.style.display = 'block';
        if (centralAdminMenu) centralAdminMenu.style.display = "block";
        atualizarStatusSistema('Admin saiu do terminal. Voltou para o menu central da plataforma.', '#c084fc');
    });

    // -------------------------------------------------------------------------------------------------------------------------------- //

    function dispararAnimaçãoContagemRegressiva(callbackFim, segundosIniciais = 5, tipo = "online") {
        emContagemRegressivaAtiva = true;
        const overlay = document.getElementById('countdown-screen');
        const numEl = document.getElementById('countdown-num');
        const txtEl = document.getElementById('countdown-txt');
        const subEl = document.getElementById('countdown-subtxt');
        
        overlay.style.display = "flex";
        let tempoRestante = Math.max(1, Math.min(5, Number(segundosIniciais) || 5));
        numEl.classList.remove('show');
        txtEl.innerText = tipo === "treino" ? "Preparando treino inteligente" : "Sincronizando o tabuleiro online";
        subEl.innerText = tipo === "treino"
            ? "Organizando peças, dicas e robô para começar com estabilidade."
            : "A partida começará em instantes para jogadores e espectadores.";

        function rodarPasso() {
            if (tempoRestante > 0) {
                numEl.innerText = tempoRestante;
                reproduzirSomDoJogo('tic_relogio');
                numEl.classList.remove('show');
                setTimeout(() => { numEl.classList.add('show'); }, 50);
                tempoRestante--;
                setTimeout(rodarPasso, 1000);
            } else {
                numEl.innerText = "JOGAR!";
                txtEl.innerText = tipo === "treino" ? "Treino iniciado" : "Partida iniciada";
                subEl.innerText = "Boa partida! Que vença a melhor estratégia.";
                reproduzirSomDoJogo('gongo_start');
                numEl.classList.remove('show');
                setTimeout(() => { numEl.classList.add('show'); }, 50);
                setTimeout(() => {
                    overlay.style.display = "none";
                    emContagemRegressivaAtiva = false;
                    if(callbackFim) callbackFim();
                }, 1050);
            }
        }
        rodarPasso();
    }

    async function joinRoom(roomName, playerName, forceSpectator) {
        playerName = nomeSeguro(playerName);
        roomName = salaSegura(roomName);
        if (!roomName) return exibirAlertaDoSistema("Sala Obrigatória", "Por favor, informe um código de sala válido.");

        alertaFimPartidaMostrado = false;
        const isTerminal = (roomName === ADMIN_ROOM_CODE);
        const isAdminMode = await podeEntrarComoAdmin(playerName, roomName);

        if (isTerminal && !isAdminMode) {
            exibirAlertaDoSistema("Código Restrito 🛡️", "O código de sala <strong>00</strong> é exclusivo do administrador. Use a área <strong>Entrada do Administrador</strong> com e-mail e senha.");
            return;
        }

        const roomRef = ref(db, 'rooms/' + roomName);
        const snapshot = await get(roomRef);
        let roomData = snapshot.val();

        if (!roomData) {
            if (isAdminMode) {
                roomData = {
                    id: roomName,
                    board: getInitialBoard(),
                    turn: 1,
                    status: "admin_dashboard",
                    p1Id: "",
                    p1Name: "Central Suprema",
                    p2Id: null,
                    p2Name: "",
                    startTime: 0,
                    chat: null,
                    isAuthorized: true,
                    chatBlocked: false,
                    createdByAdminUid: playerId,
                    lastUsedDate: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                };
                await set(roomRef, roomData);
                await registrarLogAdmin('criou_terminal_admin', roomName);
                playerRole = "admin";
            } else {
                const msgLiberacao = encodeURIComponent(`Olá Isiquel! Tentei entrar na sala "${roomName}", mas ela ainda não foi liberada no painel administrativo.`);
                exibirAlertaDoSistema(
                    "Sala não liberada 🛡️",
                    `<p style="margin-bottom:15px;">Esta sala ainda não foi criada/liberada pelo administrador do jogo.</p>
                     <p style="margin-bottom:15px; color:#cbd5e1;">Somente o dono do aplicativo pode criar e liberar salas pelo painel administrativo.</p>
                     <button onclick="window.open('https://wa.me/${WHATSAPP_SUPORTE}?text=${msgLiberacao}', '_blank')" class="btn-whatsapp">💬 Pedir liberação da sala</button>`
                );
                return;
            }
        } else {
            if (roomData.isAuthorized === false && !isAdminMode) {
                const msgBloqueio = encodeURIComponent(`Olá Isiquel! A minha sala "${roomName}" está bloqueada no painel de controle das Damas. Poderia verificar?`);
                exibirAlertaDoSistema(
                    "Sala Bloqueada 🛡️",
                    `<p style="margin-bottom:15px;">Esta sala foi temporariamente congelada pelo sistema.</p>
                     <button onclick="window.open('https://wa.me/${WHATSAPP_SUPORTE}?text=${msgBloqueio}', '_blank')" class="btn-whatsapp">💬 Solicitar Liberação ao Isiquel</button>`
                );
                return;
            }

            if (isAdminMode) {
                playerRole = "admin";
            } else if (forceSpectator) {
                playerRole = "spectator";
            } else {
                const tx = await runTransaction(roomRef, (sala) => {
                    if (!sala || sala.isAuthorized === false) return sala;
                    if (sala.p1Id === playerId || sala.p2Id === playerId) return sala;
                    if (!sala.p1Id || sala.p1Id === "") {
                        sala.p1Id = playerId;
                        sala.p1Name = playerName;
                        sala.chat = null;
                        if (!sala.status || sala.status === "finished") sala.status = "waiting";
                    } else if (!sala.p2Id || sala.p2Id === "") {
                        sala.p2Id = playerId;
                        sala.p2Name = playerName;
                        sala.status = "playing";
                        sala.startTime = Date.now();
                        sala.winnerRole = null;
                        sala.winnerName = null;
                        sala.finishReason = null;
                        sala.finishedAt = null;
                    }
                    sala.lastUsedDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                    return sala;
                });
                roomData = tx.snapshot.val();
                if (roomData?.p1Id === playerId) playerRole = "p1";
                else if (roomData?.p2Id === playerId) playerRole = "p2";
                else playerRole = "spectator";
            }
        }

        if (playerRole === "spectator" && !isAdminMode) {
            const specPresenceRef = ref(db, `rooms/${roomName}/spectators/${playerId}`);
            set(specPresenceRef, nomeSeguro(playerName));
            onDisconnect(specPresenceRef).remove();
        }

        displayRoom.innerText = roomName.toUpperCase();
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'flex';

        if (playerRole === "admin") {
            adminPanel.style.display = "block";
            document.getElementById('normal-game-status').style.display = "none";
            document.getElementById('normal-board-wrapper').style.display = "none";
            document.getElementById('normal-controls').style.display = "none";
            document.getElementById('normal-chat-wrapper').style.display = "none";
            voiceVideoCallPanel.style.display = "none";
            ativarPainelMonitoramentoRealtime();
            carregarTorneiosAdmin();
            return;
        } else {
            adminPanel.style.display = "none";
            document.getElementById('normal-game-status').style.display = "flex";
            document.getElementById('normal-board-wrapper').style.display = "block";
            document.getElementById('normal-controls').style.display = "grid";
            document.getElementById('normal-chat-wrapper').style.display = "flex";
        }
        
        toggleChatVisibility.style.display = (playerRole === "spectator") ? "none" : "block";
        atualizarPainelChamada();
        if (playerRole === "spectator") {
            escutarChamadaParaEspectador();
        }

        onValue(roomRef, (snap) => {
            const data = snap.val();
            if (!data) return;
            
            const inicioPartidaOnline = Number(data.startTime || 0);
            const agoraSincronizacao = Date.now();
            const partidaAcabouDeComecar = data.status === "playing" && inicioPartidaOnline && (agoraSincronizacao - inicioPartidaOnline) < 6200;
            if (partidaAcabouDeComecar && ultimaContagemInicioMostrada !== inicioPartidaOnline) {
                ultimaContagemInicioMostrada = inicioPartidaOnline;
                const segundosRestantes = Math.max(1, Math.min(5, Math.ceil((6200 - (agoraSincronizacao - inicioPartidaOnline)) / 1000)));
                dispararAnimaçãoContagemRegressiva(() => { reproduzirSomDoJogo('inicio'); }, segundosRestantes, "online");
            }

            if (currentGameState && currentGameState.status === "playing" && data.status === "finished" && (!data.p1Name || !data.p2Name)) {
                reproduzirSomDoJogo('saida_rival');
                appendChatRow("🚨 Sistema", "O oponente saiu e abandonou a sala de jogos!");
            }
            
            if (currentGameState && currentGameState.board && data.board) {
                const stringTabAnterior = JSON.stringify(currentGameState.board);
                const stringTabNovo = JSON.stringify(data.board);
                
                if (stringTabAnterior !== stringTabNovo) {
                    const pecasAntes = contarPecasNoTabuleiro(currentGameState.board);
                    const pecasDepois = contarPecasNoTabuleiro(data.board);
                    if (pecasDepois < pecasAntes) { reproduzirSomDoJogo('capture'); }
                    else if (detectouNovaDama(currentGameState.board, data.board)) { reproduzirSomDoJogo('king'); }
                    else { reproduzirSomDoJogo('move'); }
                }
            }

            if (!ultimoTurnoRegistrado || ultimoTurnoRegistrado !== data.turn) {
                ultimoTurnoRegistrado = data.turn;
                timestampInicioTurnoAtual = Date.now();
                jaAlertouTurnoDemorado = false;
                turnIndicator.classList.remove('tempo-estourado');
                lockPieceForMultiCapture = null;
                selectedPiece = null;
                validMoves = [];
            }

            let specsCount = data.spectators ? Object.keys(data.spectators).length : 0;
            if (ultimoContadorEspectadores !== 0 && specsCount > ultimoContadorEspectadores) reproduzirSomDoJogo('spectator');
            ultimoContadorEspectadores = specsCount;

            if (currentGameState && currentGameState.status === "playing" && data.status === "finished" && !alertaFimPartidaMostrado) {
                alertaFimPartidaMostrado = true;
                executarAlertaVisualDeVitoria(data);
            }

            atualizarPartidaAoVivo(roomName, data);
            currentGameState = data;
            liveSpectatorsEl.innerText = `👁️ ${specsCount} assistindo`;
            runLocalTimer(data.startTime, data.status);
            renderGameStatus(data);
            generateBoardUI(data.board);
        });

        let primeiraCargaChat = true;
        const chatRef = ref(db, `rooms/${roomName}/chat`);
        onValue(chatRef, (snap) => {
            limparElemento(chatBoxMessages);
            const data = snap.val();
            if (data) {
                Object.values(data).forEach(msg => appendChatRow(msg.author, msg.text));
                if (!primeiraCargaChat && !isChatMutedLocally) reproduzirSomDoJogo('chat');
                primeiraCargaChat = false;
            } else {
                criarMensagemSistema(chatBoxMessages, "O chat está ativo.");
            }
        });
    }

    function setupPracticeGame(playerName) {
        encerrarChamadaWebRTC(false);
        encerrarAssistirChamadaEspectador(false);
        isPracticeMode = true;
        alertaFimPartidaMostrado = false;
        toggleChatVisibility.style.display = "block";
        adminPanel.style.display = "none";
        lockPieceForMultiCapture = null;
        
        ultimoTurnoRegistrado = 1;
        timestampInicioTurnoAtual = Date.now();
        jaAlertouTurnoDemorado = false;

        let robotLabel = "Robô Estrategista";
        if (practiceDifficulty === "facil") robotLabel = "Robô Aprendiz";
        if (practiceDifficulty === "dificil") robotLabel = "Mestre das Damas 👑";
        if (practiceDifficulty === "aprender") robotLabel = "Professor Robô 🎓";

        currentGameState = { board: getInitialBoard(), turn: 1, status: "playing", p1Name: playerName, p2Name: robotLabel, startTime: Date.now() };
        displayRoom.innerText = isLearningMode ? "TREINO (APRENDER)" : `TREINO (${practiceDifficulty.toUpperCase()})`;
        
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        
        document.getElementById('normal-game-status').style.display = "flex";
        document.getElementById('normal-board-wrapper').style.display = "block";
        document.getElementById('normal-controls').style.display = "grid";
        document.getElementById('normal-chat-wrapper').style.display = "flex";
        learningCoachBox.style.display = isLearningMode ? "block" : "none";
        voiceVideoCallPanel.style.display = "none";
        currentLearningHint = null;

        dispararAnimaçãoContagemRegressiva(() => { reproduzirSomDoJogo('inicio'); }, 5, "treino");
        
        runLocalTimer(currentGameState.startTime, "playing");
        renderGameStatus(currentGameState);
        if (isLearningMode) atualizarDicaAprendizado(true);
        generateBoardUI(currentGameState.board);
    }

    function renderGameStatus(data) {
        const p1 = data.p1Name || "Aguardando...";
        const p2 = data.p2Name || "Aguardando...";
        playersNamesEl.innerText = `${p1} VS ${p2}`;
        playerBadge.innerText = playerRole === "p1" ? "Vermelho" : playerRole === "p2" ? "Preto" : playerRole === "admin" ? "Dono" : "Espectador";
        playerBadge.className = `badge badge-${playerRole === "p1"?"p1":playerRole === "p2"?"p2":playerRole === "admin"?"admin":"spec"}`;

        if (data.status === "waiting") {
            turnIndicator.innerText = "Aguardando Rival...";
            turnIndicator.style.color = "#f1c40f";
        } else if (data.status === "playing") {
            let nomeVez = data.turn === 1 ? p1 : p2;
            if (lockPieceForMultiCapture) {
                turnIndicator.innerText = `💥 Combo! ${nomeVez} continua`;
            } else {
                turnIndicator.innerText = `Vez de: ${nomeVez}`;
            }
            if (!turnIndicator.classList.contains('tempo-estourado')) {
                turnIndicator.style.color = data.turn === 1 ? "var(--p1-color)" : "#ecf0f1";
            }
        } else if (data.status === "finished") {
            turnIndicator.innerText = "Fim de Jogo!";
            turnIndicator.style.color = "#2ecc71";
            if (gameTimerInterval) clearInterval(gameTimerInterval);
        }
    }

    function deveVirarTabuleiroParaVisualizacao() {
        // A lógica interna do jogo continua igual. Aqui mudamos só a forma de enxergar o tabuleiro.
        // Vermelho vê normal. Preto vê virado automaticamente. Espectador pode virar no botão.
        const virarAutomatico = (!isPracticeMode && playerRole === "p2");
        return tabuleiroViradoManual ? !virarAutomatico : virarAutomatico;
    }

    function atualizarCoordenadasDoTabuleiro(tabuleiroVirado) {
        const letras = tabuleiroVirado ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H'];
        const numeros = tabuleiroVirado ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
        const top = document.querySelectorAll('.coord-row-top .coord-space');
        const bottom = document.querySelectorAll('.coord-row-bottom .coord-space');
        const left = document.querySelectorAll('.coord-col-left .coord-space');
        const right = document.querySelectorAll('.coord-col-right .coord-space');
        top.forEach((el, i) => el.innerText = letras[i] || '');
        bottom.forEach((el, i) => el.innerText = letras[i] || '');
        left.forEach((el, i) => el.innerText = numeros[i] || '');
        right.forEach((el, i) => el.innerText = numeros[i] || '');
    }

    function atualizarBotaoVirarTabuleiro(tabuleiroVirado) {
        if (!flipBoardBtn) return;
        if (playerRole === "p2" && !isPracticeMode) {
            flipBoardBtn.innerText = tabuleiroVirado ? "Visão Preto" : "Visão Normal";
            flipBoardBtn.title = tabuleiroVirado ? "Você está vendo o tabuleiro do lado das peças pretas." : "Você desvirou manualmente o tabuleiro.";
        } else if (playerRole === "spectator") {
            flipBoardBtn.innerText = tabuleiroVirado ? "Visão Preto" : "Virar";
            flipBoardBtn.title = "Alternar visão do espectador.";
        } else {
            flipBoardBtn.innerText = tabuleiroVirado ? "Virado" : "Virar";
            flipBoardBtn.title = "Virar tabuleiro manualmente.";
        }
    }

    function generateBoardUI(board) {
        boardEl.innerHTML = "";
        const tabuleiroVirado = deveVirarTabuleiroParaVisualizacao();
        atualizarCoordenadasDoTabuleiro(tabuleiroVirado);
        atualizarBotaoVirarTabuleiro(tabuleiroVirado);

        const linhas = tabuleiroVirado ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
        const colunas = tabuleiroVirado ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

        for (let vr = 0; vr < 8; vr++) {
            for (let vc = 0; vc < 8; vc++) {
                const r = linhas[vr];
                const c = colunas[vc];
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = String(r);
                square.dataset.col = String(c);

                const val = board[r][c];
                if (val !== 0) {
                    const piece = document.createElement('div');
                    piece.className = `piece ${val === 1 || val === 2 ? 'p1-piece' : 'p2-piece'}`;
                    if (val === 2 || val === 4) piece.classList.add('king');
                    if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) piece.classList.add('selected');
                    square.appendChild(piece);
                }

                if (validMoves.some(m => m.toR === r && m.toC === c)) square.classList.add('highlight');

                if (isLearningMode && learningTipsVisible && currentLearningHint && currentGameState?.turn === 1) {
                    if (currentLearningHint.move && currentLearningHint.move.fromR === r && currentLearningHint.move.fromC === c) square.classList.add('learn-from');
                    if (currentLearningHint.move && currentLearningHint.move.toR === r && currentLearningHint.move.toC === c) square.classList.add('learn-to');
                    if (currentLearningHint.danger && currentLearningHint.danger.r === r && currentLearningHint.danger.c === c) square.classList.add('learn-danger');
                }

                square.addEventListener('click', () => handleSquareInteraction(r, c));
                boardEl.appendChild(square);
            }
        }
    }

    function handleSquareInteraction(r, c) {
        if (emContagemRegressivaAtiva) return;
        if (!currentGameState || currentGameState.status !== "playing") return;
        if (!isPracticeMode) {
            if (currentGameState.turn === 1 && playerRole !== "p1") return;
            if (currentGameState.turn === 2 && playerRole !== "p2") return;
        } else { if (currentGameState.turn === 2) return; }

        const board = currentGameState.board;
        const clickedValue = board[r][c];

        if (lockPieceForMultiCapture && (lockPieceForMultiCapture.r !== r || lockPieceForMultiCapture.c !== c) && clickedValue !== 0) {
            return; 
        }

        if (clickedValue !== 0) {
            const isP1Turn = currentGameState.turn === 1;
            const ownsPiece = isP1Turn ? (clickedValue === 1 || clickedValue === 2) : (clickedValue === 3 || clickedValue === 4);
            if (ownsPiece) {
                selectedPiece = { r, c };
                let moves = computeValidMovesForPiece(r, c, board);
                if (lockPieceForMultiCapture) { moves = moves.filter(m => m.capture !== null); }
                validMoves = moves;
                generateBoardUI(board);
            }
        } else {
            const move = validMoves.find(m => m.toR === r && m.toC === c);
            if (move) executeGameMove(move);
        }
    }

    function computeValidMovesForPiece(r, c, board) {
        const piece = board[r][c];
        let moves = [];
        if (piece === 0) return moves;
        const isKing = piece === 2 || piece === 4;
        const isP1 = piece === 1 || piece === 2;

        if (isKing) {
            const dirs = [[1,1], [1,-1], [-1,1], [-1,-1]];
            dirs.forEach(([dr, dc]) => {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    if (board[nr][nc] === 0) { 
                        if (!lockPieceForMultiCapture) { moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: null }); }
                    } 
                    else {
                        if ((board[nr][nc] === 1 || board[nr][nc] === 2) !== isP1) {
                            let rr = nr + dr, cc = nc + dc;
                            if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === 0) {
                                moves.push({ fromR: r, fromC: c, toR: rr, toC: cc, capture: { r: nr, c: nc } });
                            }
                        }
                        break; 
                    }
                    nr += dr; nc += dc;
                }
            });
        } else {
            const captureDirs = [[1,1], [1,-1], [-1,1], [-1,-1]];
            captureDirs.forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    if (board[nr][nc] === 0) { 
                        if (!lockPieceForMultiCapture) {
                            const isForward = isP1 ? dr === -1 : dr === 1;
                            if (isForward) moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: null }); 
                        }
                    } 
                    else {
                        if ((board[nr][nc] === 1 || board[nr][nc] === 2) !== isP1) {
                            const rr = nr + dr, cc = nc + dc;
                            if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === 0) {
                                moves.push({ fromR: r, fromC: c, toR: rr, toC: cc, capture: { r: nr, c: nc } });
                            }
                        }
                    }
                }
            });
        }

        if (!lockPieceForMultiCapture) {
            const forceCaptures = moves.filter(m => m.capture !== null);
            return forceCaptures.length > 0 ? forceCaptures : moves;
        }
        return moves;
    }

    function computeAllValidMoves(turn, board) {
        let allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p === 0) continue;
                if ((turn === 1 && (p === 1 || p === 2)) || (turn === 2 && (p === 3 || p === 4))) {
                    allMoves = allMoves.concat(computeValidMovesForPiece(r, c, board));
                }
            }
        }
        const captures = allMoves.filter(m => m.capture !== null);
        return captures.length > 0 ? captures : allMoves;
    }

    function executeGameMove(move) {
        let board = currentGameState.board.map(row => row.slice());
        let piece = board[move.fromR][move.fromC];

        if (move.capture) { board[move.capture.r][move.capture.c] = 0; }

        if (piece === 1 && move.toR === 0) piece = 2; 
        if (piece === 3 && move.toR === 7) piece = 4; 

        board[move.toR][move.toC] = piece;
        board[move.fromR][move.fromC] = 0;

        let maisCapturasDisponiveis = [];
        if (move.capture) {
            lockPieceForMultiCapture = { r: move.toR, c: move.toC };
            maisCapturasDisponiveis = computeValidMovesForPiece(move.toR, move.toC, board).filter(m => m.capture !== null);
        }

        let nextTurn = currentGameState.turn;
        if (maisCapturasDisponiveis.length > 0) {
            lockPieceForMultiCapture = { r: move.toR, c: move.toC };
            selectedPiece = { r: move.toR, c: move.toC };
            validMoves = maisCapturasDisponiveis;
        } else {
            lockPieceForMultiCapture = null;
            selectedPiece = null;
            validMoves = [];
            nextTurn = currentGameState.turn === 1 ? 2 : 1;
        }

        if (isPracticeMode) {
            if (move.capture) reproduzirSomDoJogo('capture');
            else reproduzirSomDoJogo((piece === 2 || piece === 4) ? 'king' : 'move');
            
            timestampInicioTurnoAtual = Date.now();
            jaAlertouTurnoDemorado = false;
            turnIndicator.classList.remove('tempo-estourado');

            currentGameState.board = board; currentGameState.turn = nextTurn;
            renderGameStatus(currentGameState);
            if (isLearningMode && nextTurn === 1) atualizarDicaAprendizado(true);
            else currentLearningHint = null;
            generateBoardUI(board);
            if (!checkEndGameConditions(board) && nextTurn === 2) { setTimeout(executeRobotTurn, 600); }
        } else { 
            currentGameState.board = board; currentGameState.turn = nextTurn;
            if (!checkEndGameConditions(board)) { update(ref(db, 'rooms/' + roomId), { board: board, turn: nextTurn }); }
        }
    }

    function clonarTabuleiro(board) {
        return board.map(row => row.slice());
    }

    function donoDaPecaEngine(piece) {
        if (piece === 1 || piece === 2) return 1;
        if (piece === 3 || piece === 4) return 2;
        return 0;
    }

    function computeValidMovesForPieceEngine(r, c, board, somenteCapturas = false) {
        const piece = board[r][c];
        let moves = [];
        if (piece === 0) return moves;

        const isKing = piece === 2 || piece === 4;
        const owner = donoDaPecaEngine(piece);
        const isP1 = owner === 1;

        if (isKing) {
            const dirs = [[1,1], [1,-1], [-1,1], [-1,-1]];
            dirs.forEach(([dr, dc]) => {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    if (board[nr][nc] === 0) {
                        if (!somenteCapturas) moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: null });
                    } else {
                        if (donoDaPecaEngine(board[nr][nc]) !== owner) {
                            let rr = nr + dr, cc = nc + dc;
                            if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === 0) {
                                moves.push({ fromR: r, fromC: c, toR: rr, toC: cc, capture: { r: nr, c: nc } });
                            }
                        }
                        break;
                    }
                    nr += dr;
                    nc += dc;
                }
            });
        } else {
            const dirs = [[1,1], [1,-1], [-1,1], [-1,-1]];
            dirs.forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return;

                if (board[nr][nc] === 0) {
                    const isForward = isP1 ? dr === -1 : dr === 1;
                    if (!somenteCapturas && isForward) {
                        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: null });
                    }
                } else if (donoDaPecaEngine(board[nr][nc]) !== owner) {
                    const rr = nr + dr, cc = nc + dc;
                    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === 0) {
                        moves.push({ fromR: r, fromC: c, toR: rr, toC: cc, capture: { r: nr, c: nc } });
                    }
                }
            });
        }

        if (somenteCapturas) return moves.filter(m => m.capture !== null);
        const captures = moves.filter(m => m.capture !== null);
        return captures.length > 0 ? captures : moves;
    }

    function computeAllValidMovesEngine(turn, board, pecaObrigatoria = null) {
        let allMoves = [];

        if (pecaObrigatoria) {
            return computeValidMovesForPieceEngine(pecaObrigatoria.r, pecaObrigatoria.c, board, true);
        }

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (donoDaPecaEngine(board[r][c]) === turn) {
                    allMoves = allMoves.concat(computeValidMovesForPieceEngine(r, c, board, false));
                }
            }
        }

        const captures = allMoves.filter(m => m.capture !== null);
        return captures.length > 0 ? captures : allMoves;
    }

    function aplicarMovimentoEngine(board, move) {
        const nextBoard = clonarTabuleiro(board);
        let piece = nextBoard[move.fromR][move.fromC];
        let capturedPiece = 0;

        if (move.capture) {
            capturedPiece = nextBoard[move.capture.r][move.capture.c];
            nextBoard[move.capture.r][move.capture.c] = 0;
        }

        let promoted = false;
        if (piece === 1 && move.toR === 0) { piece = 2; promoted = true; }
        if (piece === 3 && move.toR === 7) { piece = 4; promoted = true; }

        nextBoard[move.toR][move.toC] = piece;
        nextBoard[move.fromR][move.fromC] = 0;

        return { board: nextBoard, piece, capturedPiece, promoted, toR: move.toR, toC: move.toC };
    }

    function contarPecasPorLadoEngine(board) {
        let p1 = 0, p2 = 0, p1Kings = 0, p2Kings = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p === 1) p1++;
                if (p === 2) { p1++; p1Kings++; }
                if (p === 3) p2++;
                if (p === 4) { p2++; p2Kings++; }
            }
        }
        return { p1, p2, p1Kings, p2Kings };
    }

    function avaliarTabuleiroParaRobo(board) {
        const counts = contarPecasPorLadoEngine(board);
        if (counts.p2 === 0) return -100000;
        if (counts.p1 === 0) return 100000;

        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p === 0) continue;

                const owner = donoDaPecaEngine(p);
                const isRobot = owner === 2;
                const sign = isRobot ? 1 : -1;
                const isKing = p === 2 || p === 4;

                score += sign * (isKing ? 320 : 115);

                // Controle do centro: peças no centro têm mais mobilidade e menos chance de ficarem presas.
                if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score += sign * 18;

                // Avanço: o robô valoriza chegar perto de virar dama; o jogador também é considerado.
                if (!isKing) {
                    if (isRobot) score += r * 13;       // robô desce rumo à linha 7
                    else score -= (7 - r) * 13;        // jogador sobe rumo à linha 0
                }

                // Proteção lateral e fundo: evita entregar peças soltas.
                if (c === 0 || c === 7) score += sign * 10;
                if (isRobot && r === 0) score += 8;
                if (!isRobot && r === 7) score -= 8;
            }
        }

        const robotMoves = computeAllValidMovesEngine(2, board).length;
        const humanMoves = computeAllValidMovesEngine(1, board).length;
        score += (robotMoves - humanMoves) * 8;

        // Capturas disponíveis no próximo lance valem bastante.
        score += computeAllValidMovesEngine(2, board).filter(m => m.capture).length * 45;
        score -= computeAllValidMovesEngine(1, board).filter(m => m.capture).length * 65;

        return score;
    }

    function ordenarMovimentosParaBusca(board, moves, turn) {
        return moves.slice().sort((a, b) => {
            const pa = pontuarMovimentoRapido(board, a, turn);
            const pb = pontuarMovimentoRapido(board, b, turn);
            return pb - pa;
        });
    }

    function pontuarMovimentoRapido(board, move, turn) {
        const piece = board[move.fromR][move.fromC];
        let s = 0;
        if (move.capture) {
            const captured = board[move.capture.r][move.capture.c];
            s += (captured === 2 || captured === 4) ? 600 : 380;
        }
        if ((piece === 3 && move.toR === 7) || (piece === 1 && move.toR === 0)) s += 500;
        if ((piece === 4 || piece === 2)) s += 40;
        if (move.toC >= 2 && move.toC <= 5 && move.toR >= 2 && move.toR <= 5) s += 25;
        return turn === 2 ? s : -s;
    }

    function minimaxRobo(board, depth, turn, alpha, beta, pecaObrigatoria = null) {
        const counts = contarPecasPorLadoEngine(board);
        if (depth <= 0 || counts.p1 === 0 || counts.p2 === 0) {
            return avaliarTabuleiroParaRobo(board);
        }

        let moves = computeAllValidMovesEngine(turn, board, pecaObrigatoria);
        if (moves.length === 0) {
            return turn === 2 ? -90000 - depth : 90000 + depth;
        }

        // Evita travamento em celulares quando há muitas damas com muitas casas disponíveis.
        moves = ordenarMovimentosParaBusca(board, moves, turn).slice(0, 16);

        if (turn === 2) {
            let best = -Infinity;
            for (const move of moves) {
                const applied = aplicarMovimentoEngine(board, move);
                let nextTurn = 1;
                let nextForced = null;

                if (move.capture) {
                    const novasCapturas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
                    if (novasCapturas.length > 0) {
                        nextTurn = 2;
                        nextForced = { r: applied.toR, c: applied.toC };
                    }
                }

                const value = minimaxRobo(applied.board, depth - 1, nextTurn, alpha, beta, nextForced);
                best = Math.max(best, value);
                alpha = Math.max(alpha, value);
                if (beta <= alpha) break;
            }
            return best;
        } else {
            let best = Infinity;
            for (const move of moves) {
                const applied = aplicarMovimentoEngine(board, move);
                let nextTurn = 2;
                let nextForced = null;

                if (move.capture) {
                    const novasCapturas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
                    if (novasCapturas.length > 0) {
                        nextTurn = 1;
                        nextForced = { r: applied.toR, c: applied.toC };
                    }
                }

                const value = minimaxRobo(applied.board, depth - 1, nextTurn, alpha, beta, nextForced);
                best = Math.min(best, value);
                beta = Math.min(beta, value);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    function escolherMovimentoDoRobo(board, moves) {
        if (practiceDifficulty === "facil") {
            // Fácil ainda erra, mas não ignora capturas obrigatórias.
            const capturas = moves.filter(m => m.capture !== null);
            if (capturas.length > 0 && Math.random() < 0.75) {
                return capturas[Math.floor(Math.random() * capturas.length)];
            }
            return moves[Math.floor(Math.random() * moves.length)];
        }

        const depth = practiceDifficulty === "dificil" ? 5 : 3;
        const candidatos = ordenarMovimentosParaBusca(board, moves, 2).slice(0, practiceDifficulty === "dificil" ? 16 : 10);
        let melhorPeso = -Infinity;
        let melhores = [];

        candidatos.forEach(move => {
            const applied = aplicarMovimentoEngine(board, move);
            let nextTurn = 1;
            let nextForced = null;

            if (move.capture) {
                const novasCapturas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
                if (novasCapturas.length > 0) {
                    nextTurn = 2;
                    nextForced = { r: applied.toR, c: applied.toC };
                }
            }

            let peso = minimaxRobo(applied.board, depth - 1, nextTurn, -Infinity, Infinity, nextForced);

            // No médio, um pouco de humanidade: ele pode escolher entre boas jogadas, não sempre a perfeita.
            if (practiceDifficulty === "medio") peso += Math.random() * 35;

            if (peso > melhorPeso) {
                melhorPeso = peso;
                melhores = [move];
            } else if (Math.abs(peso - melhorPeso) < 0.001) {
                melhores.push(move);
            }
        });

        return melhores[Math.floor(Math.random() * melhores.length)] || moves[0];
    }

    function avaliarCenarioPosicional(board, m) {
        const applied = aplicarMovimentoEngine(board, m);
        return avaliarTabuleiroParaRobo(applied.board);
    }

    function movimentoCoord(move) {
        const letras = "ABCDEFGH";
        return `${letras[move.fromC]}${8 - move.fromR} → ${letras[move.toC]}${8 - move.toR}`;
    }

    function jogadaEntregaCaptura(boardDepois) {
        const respostas = computeAllValidMovesEngine(2, boardDepois);
        const capturas = respostas.filter(m => m.capture);
        if (capturas.length === 0) return null;
        return capturas[0].capture;
    }

    function explicarJogadaAprendizado(board, move, score) {
        const piece = board[move.fromR][move.fromC];
        const applied = aplicarMovimentoEngine(board, move);
        const partes = [];
        const coord = movimentoCoord(move);
        if (move.capture) {
            partes.push(`Essa jogada em <strong>${coord}</strong> é forte porque captura uma peça do robô. Na dama, quando existe captura, ela é obrigatória — então o caminho certo é aproveitar a tomada.`);
        } else {
            partes.push(`Uma boa jogada agora é <strong>${coord}</strong>. Ela mantém sua peça em movimento e melhora sua posição no tabuleiro.`);
        }

        if (piece === 1 && move.toR <= 2) partes.push("Ela também aproxima sua peça da última linha, aumentando a chance de virar dama.");
        if (piece === 2) partes.push("Como essa peça já é dama, ela tem mais alcance. Use-a para controlar diagonais longas e pressionar o robô.");
        if (move.toC >= 2 && move.toC <= 5 && move.toR >= 2 && move.toR <= 5) partes.push("Ela ocupa uma região central, onde sua peça costuma ter mais opções de ataque e defesa.");
        if (move.toC === 0 || move.toC === 7) partes.push("Ela encosta na lateral, o que reduz alguns riscos de captura por um dos lados.");

        const perigo = jogadaEntregaCaptura(applied.board);
        if (perigo) {
            partes.push("⚠️ Atenção: mesmo sendo uma opção possível, depois dela o robô pode ter uma captura. Observe a casa marcada em vermelho antes de confirmar.");
        } else {
            partes.push("✅ O ponto positivo é que ela não deixa uma captura imediata fácil para o robô.");
        }

        return { texto: partes.join(" "), danger: perigo, score };
    }

    function analisarMelhorJogadaDoAluno(board) {
        let moves = computeAllValidMovesEngine(1, board, lockPieceForMultiCapture);
        if (!moves.length) return null;
        const candidatos = ordenarMovimentosParaBusca(board, moves, 1).slice(0, 14);
        let melhor = null;
        let melhorScore = -Infinity;

        candidatos.forEach(move => {
            const applied = aplicarMovimentoEngine(board, move);
            let nextTurn = 2;
            let nextForced = null;

            if (move.capture) {
                const novasCapturas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
                if (novasCapturas.length > 0) {
                    nextTurn = 1;
                    nextForced = { r: applied.toR, c: applied.toC };
                }
            }

            // Como a avaliação original mede vantagem do robô, invertemos o sinal para sugerir a melhor jogada do aluno.
            let score = -minimaxRobo(applied.board, 3, nextTurn, -Infinity, Infinity, nextForced);
            if (move.capture) score += 120;
            if (board[move.fromR][move.fromC] === 1 && move.toR === 0) score += 220;
            if (!jogadaEntregaCaptura(applied.board)) score += 55;

            if (score > melhorScore) {
                melhorScore = score;
                melhor = move;
            }
        });

        if (!melhor) melhor = moves[0];
        const explicacao = explicarJogadaAprendizado(board, melhor, melhorScore);
        return { move: melhor, text: explicacao.texto, danger: explicacao.danger, score: melhorScore };
    }

    function atualizarDicaAprendizado(forcarNova = false) {
        if (!isLearningMode || !learningCoachBox || !learningCoachText) return;
        learningCoachBox.style.display = "block";

        if (!learningTipsVisible) {
            currentLearningHint = null;
            learningCoachText.innerHTML = "Dicas ocultas. Clique em <strong>Mostrar dicas</strong> para o Professor de Damas voltar a orientar suas jogadas.";
            generateBoardUI(currentGameState?.board || []);
            return;
        }

        if (!currentGameState || currentGameState.status !== "playing") {
            currentLearningHint = null;
            learningCoachText.innerText = "A partida terminou. Comece outra rodada para continuar aprendendo.";
            return;
        }

        if (currentGameState.turn !== 1) {
            currentLearningHint = null;
            learningCoachText.innerText = "Agora observe o robô. Repare como ele tenta capturar, proteger peças e dominar as diagonais.";
            return;
        }

        if (!currentLearningHint || forcarNova) currentLearningHint = analisarMelhorJogadaDoAluno(currentGameState.board);
        if (!currentLearningHint) {
            learningCoachText.innerText = "Não encontrei jogadas disponíveis. Isso geralmente significa bloqueio total ou fim de partida.";
            return;
        }

        learningCoachText.innerHTML = `<strong>Dica do professor:</strong> ${currentLearningHint.text}<br><span style="display:block; margin-top:6px; color:#94a3b8;">Casa amarela = peça sugerida. Casa verde = destino sugerido. Casa vermelha = possível perigo.</span>`;
    }

    function executeRobotTurn() {
        if (!isPracticeMode || currentGameState.status !== "playing") return;
        const board = currentGameState.board;
        const robotMoves = computeAllValidMovesEngine(2, board, lockPieceForMultiCapture);

        if (robotMoves.length === 0) {
            currentGameState.status = "finished";
            currentGameState.winnerRole = "p1";
            currentGameState.winnerName = currentGameState.p1Name || "Você";
            currentGameState.finishReason = "sem_movimentos";
            currentGameState.finishedAt = Date.now();
            if (!alertaFimPartidaMostrado) {
                alertaFimPartidaMostrado = true;
                executarAlertaVisualDeVitoria(currentGameState);
            }
            renderGameStatus(currentGameState);
            return;
        }

        const nomeRobo = currentGameState.p2Name || "Robô";
        turnIndicator.innerText = `${nomeRobo} analisando a melhor jogada...`;
        turnIndicator.style.color = "#f1c40f";

        const selectedMove = escolherMovimentoDoRobo(board, robotMoves);
        const applied = aplicarMovimentoEngine(board, selectedMove);
        let nextTurn = 1;

        if (selectedMove.capture) reproduzirSomDoJogo('capture');
        else reproduzirSomDoJogo((applied.piece === 2 || applied.piece === 4) ? 'king' : 'move');

        lockPieceForMultiCapture = null;
        selectedPiece = null;
        validMoves = [];

        if (selectedMove.capture) {
            const novasCapturas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
            if (novasCapturas.length > 0) {
                nextTurn = 2;
                lockPieceForMultiCapture = { r: applied.toR, c: applied.toC };
            }
        }

        timestampInicioTurnoAtual = Date.now();
        jaAlertouTurnoDemorado = false;
        turnIndicator.classList.remove('tempo-estourado');

        currentGameState.board = applied.board;
        currentGameState.turn = nextTurn;
        renderGameStatus(currentGameState);
        if (isLearningMode && nextTurn === 1) atualizarDicaAprendizado(true);
        else currentLearningHint = null;
        generateBoardUI(applied.board);

        if (checkEndGameConditions(applied.board)) return;

        if (nextTurn === 2) {
            setTimeout(executeRobotTurn, 550);
        }
    }

    function executarAlertaVisualDeVitoria(gameDataOrBoard) {
        const gameData = Array.isArray(gameDataOrBoard)
            ? { ...(currentGameState || {}), board: gameDataOrBoard }
            : (gameDataOrBoard || currentGameState || {});
        const board = gameData.board || gameDataOrBoard;
        if (!board) return;

        let p1Pieces = 0, p2Pieces = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === 1 || board[r][c] === 2) p1Pieces++;
                if (board[r][c] === 3 || board[r][c] === 4) p2Pieces++;
            }
        }

        let winnerRole = gameData.winnerRole || "";
        if (!winnerRole) {
            if (p1Pieces === 0 || p2Pieces === 0) {
                winnerRole = p1Pieces > 0 ? "p1" : "p2";
            } else {
                winnerRole = gameData.turn === 2 ? "p1" : "p2";
            }
        }

        const nomeP1 = nomeSeguro(gameData.p1Name || currentGameState?.p1Name || "Vermelho");
        const nomeP2 = nomeSeguro(gameData.p2Name || currentGameState?.p2Name || "Preto");
        const nomeDoGanhador = nomeSeguro(gameData.winnerName || (winnerRole === "p1" ? nomeP1 : nomeP2));
        const nomeDoPerdedor = nomeSeguro(winnerRole === "p1" ? nomeP2 : nomeP1);

        const souJogadorP1 = (playerRole === "p1");
        const souJogadorP2 = (playerRole === "p2");
        const voceGanhou = (winnerRole === "p1" && souJogadorP1) || (winnerRole === "p2" && souJogadorP2);
        const vocePerdeu = (souJogadorP1 || souJogadorP2) && !voceGanhou;
        const textoRanking = isPracticeMode
            ? "Essa partida foi registrada no Ranking Contra a Máquina. Continue somando pontos e tente vencer no nível Difícil."
            : "Sua vitória entra para a caminhada no ranking global dos campeões.";

        if (playerRole === "spectator") {
            reproduzirSomDoJogo('fanfarra_vitoria');
            exibirAlertaDoSistema(
                "👑 PARTIDA TERMINADA 👑",
                `<div style="font-size:1.35rem; color:#3498db; font-weight:bold; margin-bottom:15px;">🎉 VITÓRIA DE ${nomeDoGanhador.toUpperCase()}! 🎉</div>
                 <p style="color:#e2e8f0; font-size:0.95rem; line-height:1.5;">O duelo terminou no tabuleiro. Parabéns ao vencedor e honra aos dois jogadores pela batalha!</p>`
            );
            return;
        }

        if (voceGanhou) {
            document.body.classList.add('vitoria-animada');
            reproduzirSomDoJogo('fanfarra_vitoria');
            exibirAlertaDoSistema(
                "🏆 VOCÊ GANHOU! 👑",
                `<div style="font-size:1.4rem; color:#2ecc71; font-weight:bold; text-shadow:0 0 10px rgba(46,204,113,0.5); margin-bottom:15px;">🎉 PARABÉNS, ${nomeDoGanhador.toUpperCase()}! 🎉</div>
                 <p style="color:#fff; font-size:0.98rem; line-height:1.5;">Você venceu a partida com estratégia e domínio do tabuleiro.</p>
                 <p style="color:#f1c40f; font-size:0.92rem; margin-top:10px;">${textoRanking}</p>`
            );
        } else if (vocePerdeu) {
            reproduzirSomDoJogo('saida_rival');
            exibirAlertaDoSistema(
                "💔 PARTIDA TERMINADA",
                `<div style="font-size:1.3rem; color:#e74c3c; font-weight:bold; margin-bottom:15px;">VITÓRIA DE ${nomeDoGanhador.toUpperCase()}!</div>
                 <p style="color:#eee; font-size:0.96rem; line-height:1.5;">${nomeDoPerdedor}, não fique triste. Continue treinando, observe suas jogadas e volte para a revanche mais preparado.</p>
                 <p style="color:#94a3b8; font-size:0.9rem; margin-top:10px;">Dica: use o modo contra a máquina para treinar captura obrigatória, defesa e movimentação da dama.</p>`
            );
        } else {
            exibirAlertaDoSistema(
                "👑 PARTIDA TERMINADA 👑",
                `<div style="font-size:1.3rem; color:#3498db; font-weight:bold; margin-bottom:15px;">🎉 VITÓRIA DE ${nomeDoGanhador.toUpperCase()}! 🎉</div>`
            );
        }
    }

    function checkEndGameConditions(board) {
        let p1Pieces = 0, p2Pieces = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === 1 || board[r][c] === 2) p1Pieces++;
                if (board[r][c] === 3 || board[r][c] === 4) p2Pieces++;
            }
        }

        if (currentGameState.status !== "playing") return false;

        if (p1Pieces === 0 || p2Pieces === 0) {
            const p1Venceu = p1Pieces > 0;
            currentGameState.status = "finished";
            currentGameState.winnerRole = p1Venceu ? "p1" : "p2";
            currentGameState.winnerName = p1Venceu ? currentGameState.p1Name : currentGameState.p2Name;
            currentGameState.finishReason = "sem_pecas";
            currentGameState.finishedAt = Date.now();
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            if (isPracticeMode) {
                registrarResultadoTreino(p1Venceu);
                if (!alertaFimPartidaMostrado) {
                    alertaFimPartidaMostrado = true;
                    executarAlertaVisualDeVitoria(currentGameState);
                }
            } else { finalizarPartidaOnline(p1Venceu, board, "sem_pecas"); }
            return true;
        }

        const totalMovimentosPossiveis = computeAllValidMoves(currentGameState.turn, board).length;
        if (totalMovimentosPossiveis === 0 && !lockPieceForMultiCapture) {
            const p1Venceu = (currentGameState.turn === 2);
            currentGameState.status = "finished";
            currentGameState.winnerRole = p1Venceu ? "p1" : "p2";
            currentGameState.winnerName = p1Venceu ? currentGameState.p1Name : currentGameState.p2Name;
            currentGameState.finishReason = "sem_movimentos";
            currentGameState.finishedAt = Date.now();
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            if (isPracticeMode) {
                registrarResultadoTreino(p1Venceu);
                if (!alertaFimPartidaMostrado) {
                    alertaFimPartidaMostrado = true;
                    executarAlertaVisualDeVitoria(currentGameState);
                }
            } else { finalizarPartidaOnline(p1Venceu, board, "sem_movimentos"); }
            return true;
        }
        return false;
    }

    async function finalizarPartidaOnline(p1Venceu, board, motivo = "fim_de_jogo") {
        if (isPracticeMode) return;
        const winnerRole = p1Venceu ? "p1" : "p2";
        const winnerName = nomeSeguro(p1Venceu ? currentGameState.p1Name : currentGameState.p2Name);
        await update(ref(db, 'rooms/' + roomId), {
            board: board,
            status: "finished",
            winnerRole: winnerRole,
            winnerName: winnerName,
            finishReason: motivo,
            finishedAt: Date.now()
        });
        if (playerRole === "p1") updatePlayerRanking(p1Venceu, currentGameState.p1Name);
        if (playerRole === "p2") updatePlayerRanking(!p1Venceu, currentGameState.p2Name);
    }

    drawBtn.addEventListener('click', async () => {
        if (!currentGameState || currentGameState.status !== "playing") return;
        if (playerRole === "spectator") return;
        
        exibirConfirmacao("Propor Empate", "Deseja declarar empate consensual e reiniciar a partida?", async () => {
            if (isPracticeMode) {
                setupPracticeGame(nameInput.value.trim() || "Você");
            } else {
                const roomRef = ref(db, 'rooms/' + roomId);
                push(ref(db, `rooms/${roomId}/chat`), { author: "⚙️ Sistema", text: `A partida terminou em EMPATE por acordo.`, timestamp: Date.now() });
                alertaFimPartidaMostrado = false;
                await update(roomRef, { board: getInitialBoard(), turn: 1, status: "playing", startTime: Date.now(), winnerRole: null, winnerName: null, finishReason: null, finishedAt: null });
            }
        });
    });

    resetRoomBtn.addEventListener('click', async () => {
        if (isPracticeMode) { setupPracticeGame(nameInput.value.trim() || "Você"); return; }
        if (playerRole === "spectator") return;
        lockPieceForMultiCapture = null;
        alertaFimPartidaMostrado = false;
        update(ref(db, 'rooms/' + roomId), { board: getInitialBoard(), turn: 1, status: "playing", startTime: Date.now(), winnerRole: null, winnerName: null, finishReason: null, finishedAt: null });
    });

    leaveBtn.addEventListener('click', async () => {
        await encerrarChamadaWebRTC(true);
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        if (!isPracticeMode && roomId) {
            if (playerRole === "spectator") {
                if (!usuarioAdminConfirmado) { set(ref(db, `rooms/${roomId}/spectators/${playerId}`), null); }
            } 
            else if (playerRole !== "admin") {
                if (playerRole === "p1") await update(ref(db, 'rooms/' + roomId), { p1Id: "", p1Name: "", status: "finished" });
                if (playerRole === "p2") await update(ref(db, 'rooms/' + roomId), { p2Id: "", p2Name: "", status: "finished" });
            }
        }
        roomId = ""; playerRole = "spectator"; isPracticeMode = false; lockPieceForMultiCapture = null; ultimoContadorEspectadores = 0;
        ultimoTurnoRegistrado = 0; timestampInicioTurnoAtual = 0; jaAlertouTurnoDemorado = false;
        difficultyBox.style.display = "none"; gameScreen.style.display = 'none'; lobbyScreen.style.display = 'block';
    });


    // ================================================================
    // ✅ FASE 3 GRÁTIS - POLIMENTO COMERCIAL SEM SERVIÇO PAGO
    // Recursos seguros: compartilhar sala, copiar link, instrução de instalação,
    // privacidade básica e tratamento de erros visíveis ao usuário.
    // ================================================================
    (function aplicarFase3Gratis() {
        const executar = () => {
            try {
                const lobby = document.getElementById('lobby-screen');
                if (lobby && !document.getElementById('phase3-tools-panel')) {
                    const panel = document.createElement('div');
                    panel.id = 'phase3-tools-panel';
                    panel.className = 'phase3-tools-panel';
                    panel.innerHTML = `
                        <div class="phase3-tools-title">🚀 Ferramentas rápidas</div>
                        <div class="phase3-tools-desc">Compartilhe sala, copie link do jogo, veja como instalar no celular e consulte o aviso de privacidade.</div>
                        <div class="phase3-tools-row">
                            <button id="phase3-share-room-btn" class="btn-phase3-share" type="button">Compartilhar sala no WhatsApp</button>
                            <button id="phase3-copy-link-btn" class="btn-phase3-copy" type="button">Copiar link do jogo</button>
                            <button id="phase3-install-help-btn" class="btn-phase3-install" type="button">Como instalar no celular</button>
                            <button id="phase3-privacy-btn" class="btn-phase3-privacy" type="button">Privacidade e avisos</button>
                        </div>
                    `;
                    const feedbackPanel = document.querySelector('.feedback-panel');
                    if (feedbackPanel) lobby.insertBefore(panel, feedbackPanel); else lobby.appendChild(panel);
                }

                const shareBtn = document.getElementById('phase3-share-room-btn');
                if (shareBtn && !shareBtn.dataset.phase3Ready) {
                    shareBtn.dataset.phase3Ready = '1';
                    shareBtn.addEventListener('click', () => {
                        const nome = (document.getElementById('name-input')?.value || 'Jogador').trim() || 'Jogador';
                        const sala = (document.getElementById('room-input')?.value || '').trim();
                        if (!sala) {
                            if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Informe a sala', 'Digite o código da sala antes de compartilhar.');
                            else alert('Digite o código da sala antes de compartilhar.');
                            return;
                        }
                        const link = window.location.href.split('#')[0];
                        const texto = encodeURIComponent(`🔥 Partida de Damas Online!
${nome} está chamando você para jogar ou assistir.
Sala: ${sala}
Entre pelo link: ${link}`);
                        window.open(`https://wa.me/?text=${texto}`, '_blank');
                    });
                }

                const copyBtn = document.getElementById('phase3-copy-link-btn');
                if (copyBtn && !copyBtn.dataset.phase3Ready) {
                    copyBtn.dataset.phase3Ready = '1';
                    copyBtn.addEventListener('click', async () => {
                        const sala = (document.getElementById('room-input')?.value || '').trim();
                        const link = window.location.href.split('#')[0] + (sala ? `#sala=${encodeURIComponent(sala)}` : '');
                        try {
                            await navigator.clipboard.writeText(link);
                            if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Link copiado', 'O link do jogo foi copiado. Agora é só enviar para os participantes.');
                            else alert('Link copiado.');
                        } catch (e) {
                            prompt('Copie o link abaixo:', link);
                        }
                    });
                }

                const installBtn = document.getElementById('phase3-install-help-btn');
                if (installBtn && !installBtn.dataset.phase3Ready) {
                    installBtn.dataset.phase3Ready = '1';
                    installBtn.addEventListener('click', () => {
                        const msg = `No celular, abra este jogo pelo navegador.

Android/Chrome: toque nos três pontinhos e escolha “Adicionar à tela inicial”.

iPhone/Safari: toque em compartilhar e depois “Adicionar à Tela de Início”.

Isso cria um ícone do jogo no celular sem precisar pagar nada.`;
                        if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Instalar no celular', msg.replace(/\n/g, '<br>'));
                        else alert(msg);
                    });
                }

                const privacyBtn = document.getElementById('phase3-privacy-btn');
                if (privacyBtn && !privacyBtn.dataset.phase3Ready) {
                    privacyBtn.dataset.phase3Ready = '1';
                    privacyBtn.addEventListener('click', () => {
                        const msg = `Este jogo pode salvar nome, sala, ranking, mensagens do chat e WhatsApp somente quando o jogador autorizar avisos.

A chamada de vídeo/áudio depende da permissão do navegador e deve ser iniciada pelo jogador.

O WhatsApp automático não é usado nesta versão: os avisos são manuais, para evitar spam e custos.`;
                        if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Privacidade e avisos', msg.replace(/\n/g, '<br>'));
                        else alert(msg);
                    });
                }

                const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
                const salaHash = hash.get('sala');
                const roomInput = document.getElementById('room-input');
                if (salaHash && roomInput && !roomInput.value) roomInput.value = salaHash.slice(0, 15);
            } catch (e) {
                console.warn('Fase 3 não pôde ser aplicada:', e);
            }
        };

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', executar);
        else executar();

        window.addEventListener('error', (event) => {
            console.warn('Erro capturado pelo modo estabilidade:', event.message);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.warn('Promessa rejeitada capturada pelo modo estabilidade:', event.reason);
        });
    })();


    // ================================================================
    // ✅ FASE 4 GRÁTIS - DIAGNÓSTICO, BACKUP E CHECKLIST COMERCIAL
    // Não muda regras do jogo. Só ajuda a testar, vender e manter estável.
    // ================================================================
    (function aplicarFase4Gratis() {
        const executar = () => {
            try {
                const lobby = document.getElementById('admin-panel');
                if (!lobby || document.getElementById('phase4-quality-panel')) return;

                const panel = document.createElement('div');
                panel.id = 'phase4-quality-panel';
                panel.className = 'phase4-quality-panel';
                panel.innerHTML = `
                    <div class="phase4-quality-title">✅ Central 10/10 do Sistema</div>
                    <div class="phase4-quality-desc">Use estes botões antes de divulgar o jogo: teste recursos grátis, faça backup local e veja o checklist comercial.</div>
                    <div class="phase4-quality-row">
                        <button id="phase4-run-check-btn" class="btn-phase4-check" type="button">Rodar diagnóstico grátis</button>
                        <button id="phase4-backup-btn" class="btn-phase4-backup" type="button">Baixar backup local</button>
                        <button id="phase4-clear-local-btn" class="btn-phase4-clear" type="button">Limpar dados deste celular</button>
                        <button id="phase4-sales-check-btn" class="btn-phase4-sales" type="button">Checklist para vender</button>
                    </div>
                `;
                const adminExitBtn = document.getElementById('admin-exit-btn');
                if (adminExitBtn) lobby.insertBefore(panel, adminExitBtn);
                else lobby.appendChild(panel);

                const status = (ok, texto) => `<div><span class="${ok ? 'phase4-ok' : 'phase4-warn'}">${ok ? '✅' : '⚠️'}</span> ${texto}</div>`;

                document.getElementById('phase4-run-check-btn')?.addEventListener('click', async () => {
                    const checks = [];
                    checks.push(status(!!window.navigator, 'Navegador carregado corretamente.'));
                    checks.push(status(!!auth?.currentUser, auth?.currentUser ? 'Firebase Auth conectado.' : 'Firebase Auth ainda não confirmou usuário.'));
                    checks.push(status(!!db, 'Realtime Database inicializado.'));
                    checks.push(status(typeof RTCPeerConnection !== 'undefined', 'WebRTC disponível para vídeo/áudio.'));
                    checks.push(status(!!navigator.mediaDevices?.getUserMedia, 'Permissão de câmera/microfone suportada pelo navegador.'));
                    checks.push(status(!!navigator.clipboard, 'Função copiar link disponível.'));
                    checks.push(status(testarLocalStorageFase4(), 'Armazenamento local disponível para salvar preferências.'));
                    checks.push(status(!!document.getElementById('board'), 'Tabuleiro encontrado na tela.'));
                    checks.push(status(!!document.getElementById('voice-video-call-panel'), 'Painel de chamada de vídeo/áudio encontrado.'));
                    checks.push(status(!!document.getElementById('admin-login-panel'), 'Painel de login administrador encontrado.'));

                    let dbExtra = '';
                    try {
                        if (auth?.currentUser && db) {
                            const snap = await get(ref(db, '.info/connected'));
                            dbExtra = snap.val() ? '<div><span class="phase4-ok">✅</span> Firebase informou conexão ativa.</div>' : '<div><span class="phase4-warn">⚠️</span> Firebase carregou, mas pode estar offline neste momento.</div>';
                        }
                    } catch (e) {
                        dbExtra = '<div><span class="phase4-warn">⚠️</span> Não consegui consultar o status online do Firebase agora.</div>';
                    }

                    const html = `<div class="phase4-check-list">${checks.join('')}${dbExtra}<br><div class="tiny-muted">Dica: se algum item ficar com aviso, o jogo ainda pode funcionar, mas vale testar antes de chamar jogadores.</div></div>`;
                    if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Diagnóstico do sistema', html);
                    else alert('Diagnóstico concluído.');
                });

                document.getElementById('phase4-backup-btn')?.addEventListener('click', () => {
                    const dados = {
                        versao: 'v10-fase8-lobby-limpo',
                        criadoEm: new Date().toISOString(),
                        jogador: {
                            nome: document.getElementById('name-input')?.value || '',
                            sala: document.getElementById('room-input')?.value || '',
                            whatsapp: document.getElementById('whatsapp-input')?.value || '',
                            consentimentoWhatsapp: !!document.getElementById('whatsapp-consent')?.checked
                        },
                        localStorage: coletarLocalStorageDamasFase4(),
                        observacao: 'Backup local simples. Não substitui o Firebase, mas ajuda a guardar configurações do navegador.'
                    };
                    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `backup-damas-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
                });

                document.getElementById('phase4-clear-local-btn')?.addEventListener('click', () => {
                    const limpar = () => {
                        Object.keys(localStorage).forEach(k => { if (k.startsWith('damas_')) localStorage.removeItem(k); });
                        if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Dados locais limpos', 'As preferências salvas neste celular foram apagadas. O ranking online e as salas no Firebase não foram alterados.');
                        else alert('Dados locais limpos.');
                    };
                    if (typeof exibirConfirmacao === 'function') {
                        exibirConfirmacao('Limpar dados deste celular', 'Isso apaga nome, WhatsApp salvo, posição da chamada e backups locais deste navegador. Não apaga Firebase nem ranking online.', limpar);
                    } else if (confirm('Limpar dados locais deste navegador?')) limpar();
                });

                document.getElementById('phase4-sales-check-btn')?.addEventListener('click', () => {
                    const html = `<div class="phase4-check-list">
                        <div><span class="phase4-ok">✅</span> Testar login administrador.</div>
                        <div><span class="phase4-ok">✅</span> Criar/liberar uma sala pelo painel.</div>
                        <div><span class="phase4-ok">✅</span> Entrar com dois jogadores em celulares diferentes.</div>
                        <div><span class="phase4-ok">✅</span> Testar vídeo/áudio dos dois lados.</div>
                        <div><span class="phase4-ok">✅</span> Testar espectador assistindo.</div>
                        <div><span class="phase4-ok">✅</span> Finalizar partida e conferir ranking.</div>
                        <div><span class="phase4-ok">✅</span> Testar modo treino, difícil e aprender.</div>
                        <div><span class="phase4-ok">✅</span> Criar torneio e gerar aviso WhatsApp manual.</div>
                        <div><span class="phase4-warn">⚠️</span> Antes de vender caro: aplicar Rules seguras no Firebase e testar no celular do cliente.</div>
                    </div>`;
                    if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Checklist para vender', html);
                    else alert('Checklist comercial carregado.');
                });
            } catch (e) {
                console.warn('Fase 4 não pôde ser aplicada:', e);
            }
        };

        function testarLocalStorageFase4() {
            try {
                localStorage.setItem('damas_teste_storage', 'ok');
                localStorage.removeItem('damas_teste_storage');
                return true;
            } catch (_) { return false; }
        }

        function coletarLocalStorageDamasFase4() {
            const dados = {};
            try {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('damas_')) dados[k] = localStorage.getItem(k);
                });
            } catch (_) {}
            return dados;
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', executar);
        else executar();
    })();



    // ================================================================
    // ✅ FASE 5 GRÁTIS - MODO APP + APRESENTAÇÃO COMERCIAL
    // Não usa serviço pago. Não mexe no tabuleiro, admin, ranking ou vídeo.
    // Apenas melhora instalação, divulgação e apresentação para venda.
    // ================================================================
    (function aplicarFase5Gratis() {
        const executar = () => {
            try {
                criarManifestGratisFase5();
                const lobby = document.getElementById('admin-panel');
                if (!lobby || document.getElementById('phase5-sales-panel')) return;

                const panel = document.createElement('div');
                panel.id = 'phase5-sales-panel';
                panel.className = 'phase5-sales-panel';
                panel.innerHTML = `
                    <div class="phase5-sales-title">💼 Central Comercial 10/10 Gratuita</div>
                    <div class="phase5-sales-desc">Use esta área para apresentar o jogo para escolas, igrejas, clubes e projetos sociais sem precisar pagar por nenhum serviço adicional.</div>
                    <div class="phase5-sales-row">
                        <button id="phase5-copy-pitch-btn" class="btn-phase5-copy" type="button">Copiar apresentação</button>
                        <button id="phase5-demo-script-btn" class="btn-phase5-demo" type="button">Roteiro de demonstração</button>
                        <button id="phase5-app-mode-btn" class="btn-phase5-app" type="button">Modo app grátis</button>
                        <button id="phase5-final-check-btn" class="btn-phase5-final" type="button">Checklist 10/10</button>
                    </div>
                    <div class="phase5-mini-note">Dica: antes de vender, mostre uma partida online, uma chamada de vídeo, o modo aprender, o ranking e o painel admin liberando uma sala.</div>
                `;

                const phase4Panel = document.getElementById('phase4-quality-panel');
                const adminExitBtn = document.getElementById('admin-exit-btn');
                if (phase4Panel && phase4Panel.nextSibling) lobby.insertBefore(panel, phase4Panel.nextSibling);
                else if (adminExitBtn) lobby.insertBefore(panel, adminExitBtn);
                else lobby.appendChild(panel);

                document.getElementById('phase5-copy-pitch-btn')?.addEventListener('click', async () => {
                    const texto = `Arena de Damas Online Interativa\n\nUma plataforma completa de damas online com salas privadas, ranking, torneios, modo treino contra robô, modo aprender com dicas no tabuleiro, chat, espectadores e chamada de vídeo/áudio entre jogadores.\n\nIdeal para escolas, igrejas, clubes, projetos sociais e comunidades que desejam organizar torneios e estimular raciocínio lógico de forma divertida e interativa.`;
                    try {
                        await navigator.clipboard.writeText(texto);
                        if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Apresentação copiada', 'O texto comercial foi copiado. Agora você pode enviar para um possível cliente ou parceiro.');
                        else alert('Apresentação copiada.');
                    } catch (e) {
                        prompt('Copie a apresentação abaixo:', texto);
                    }
                });

                document.getElementById('phase5-demo-script-btn')?.addEventListener('click', () => {
                    const html = `<div class="phase4-check-list">
                        <div><span class="phase4-ok">1.</span> Abra o jogo no celular e mostre o visual inicial.</div>
                        <div><span class="phase4-ok">2.</span> Entre no admin e libere uma sala.</div>
                        <div><span class="phase4-ok">3.</span> Entre com dois jogadores na mesma sala.</div>
                        <div><span class="phase4-ok">4.</span> Mostre o chat e a chamada de vídeo/áudio.</div>
                        <div><span class="phase4-ok">5.</span> Mostre o espectador assistindo a partida.</div>
                        <div><span class="phase4-ok">6.</span> Mostre o modo aprender explicando uma jogada.</div>
                        <div><span class="phase4-ok">7.</span> Mostre o ranking e o torneio.</div>
                        <div><span class="phase4-ok">8.</span> Finalize falando: “isso pode ser personalizado para sua escola, igreja, clube ou projeto”.</div>
                    </div>`;
                    if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Roteiro de demonstração', html);
                    else alert('Roteiro carregado.');
                });

                document.getElementById('phase5-app-mode-btn')?.addEventListener('click', () => {
                    const msg = `O modo app grátis já foi preparado nesta versão por meio de configurações no navegador.\n\nPara instalar no celular:\n\nAndroid/Chrome: toque nos três pontinhos > Adicionar à tela inicial.\n\niPhone/Safari: toque em compartilhar > Adicionar à Tela de Início.\n\nIsso não usa serviço pago e deixa o jogo com aparência de aplicativo.`;
                    if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Modo app grátis', msg.replace(/\n/g, '<br>'));
                    else alert(msg);
                });

                document.getElementById('phase5-final-check-btn')?.addEventListener('click', () => {
                    const html = `<div class="phase4-check-list">
                        <div><span class="phase4-ok">✅</span> Testar em dois celulares diferentes.</div>
                        <div><span class="phase4-ok">✅</span> Testar login admin, liberar sala e bloquear sala.</div>
                        <div><span class="phase4-ok">✅</span> Testar vídeo/áudio entre jogadores.</div>
                        <div><span class="phase4-ok">✅</span> Testar espectador assistindo.</div>
                        <div><span class="phase4-ok">✅</span> Testar modo treino difícil e modo aprender.</div>
                        <div><span class="phase4-ok">✅</span> Testar ranking global e ranking contra máquina.</div>
                        <div><span class="phase4-ok">✅</span> Testar torneio e WhatsApp manual.</div>
                        <div><span class="phase4-warn">⚠️</span> Para venda premium: aplicar Firebase Rules finais e testar no domínio definitivo.</div>
                    </div>`;
                    if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema('Checklist 10/10 final', html);
                    else alert('Checklist 10/10 carregado.');
                });
            } catch (e) {
                console.warn('Fase 5 não pôde ser aplicada:', e);
            }
        };

        function criarManifestGratisFase5() {
            try {
                if (document.querySelector('link[rel="manifest"]')) return;
                const manifest = {
                    name: 'Tabuleiro Arena - Damas Online',
                    short_name: 'Tabuleiro Arena',
                    start_url: './',
                    display: 'standalone',
                    background_color: '#1a1a2e',
                    theme_color: '#e94560',
                    orientation: 'portrait-primary',
                    description: 'Plataforma de jogos clássicos online começando por Damas Arena, com ranking, torneios, modo aprender e vídeo/áudio.'
                };
                const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('link');
                link.rel = 'manifest';
                link.href = url;
                document.head.appendChild(link);
                if (!document.querySelector('meta[name="theme-color"]')) {
                    const meta = document.createElement('meta');
                    meta.name = 'theme-color';
                    meta.content = '#e94560';
                    document.head.appendChild(meta);
                }
            } catch (e) {
                console.warn('Manifest grátis não pôde ser criado:', e);
            }
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', executar);
        else executar();
    })();


    // 🧱 Garantia extra: ao abrir, só o hub aparece.
    (function garantirHubInicialLimpo() {
        const aplicar = () => {
            if (!document.body.classList.contains('game-selected')) {
                document.body.classList.add('platform-start-active');
                document.body.classList.add('mode-selecting');
                const lobby = document.getElementById('lobby-screen');
                const game = document.getElementById('game-screen');
                const hub = document.getElementById('games-hub-panel');
                if (lobby) lobby.style.display = 'none';
                if (game) game.style.display = 'none';
                if (hub) hub.style.display = 'block';
            }
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
        else aplicar();
        setTimeout(aplicar, 300);
        setTimeout(aplicar, 1200);
    })();


    // ♟️ XADREZ ARENA - FASE 4 (módulo isolado da Damas)
    (function prepararXadrezArenaSeparado() {
        'use strict';

        const pecasUnicode = {
            white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
            black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
        };

        const nomePeca = {
            king: 'Rei', queen: 'Dama', rook: 'Torre', bishop: 'Bispo', knight: 'Cavalo', pawn: 'Peão'
        };

        let chessBoard = [];
        let chessTurn = 'white';
        let selectedSquare = null;
        let legalMoves = [];
        let chessGameOver = false;
        let lastMoveMessage = '';
        let lastChessMove = null;
        let enPassantTarget = null;
        let moveHistory = [];
        let undoStack = [];

        let chessMode = 'local';
        let chessRoomId = '';
        let chessPlayerName = '';
        let chessPlayerColor = 'white';
        let chessIsSpectator = false;
        let chessRoomRef = null;
        let chessUnsubscribeRoom = null;
        let chessUnsubscribeChat = null;
        let chessOnlineSyncing = false;
        let chessOnlineReady = false;
        let chessRoomPlayers = { white: null, black: null };
        let chessRoomSpectators = {};
        let chessSoundEnabled = false;
        let chessLastRemoteMoveCount = 0;
        let chessLastTurnAlertKey = '';
        let chessBoardFlipped = false;
        let chessCurrentRoomData = {};
        let chessAdminUnsubscribeRooms = null;
        let chessAdminUnsubscribeChat = null;

        // ✅ PROFISSIONAL 19 - MANUAL PRIVADO DO PROFESSOR
        // Ativa somente no aparelho de quem entrou com # no nome.
        // Não grava aviso na sala, não altera o Firebase e não aparece para o outro jogador.
        let chessProfessorPrivadoAtivo = false;
        let chessProfessorPrivadoTexto = '';
        let chessProfessorPrivadoRecolhido = false;

        // ✅ FASE 13.5 - MODO TREINO DO XADREZ
        // Mantém a Damas preservada. A máquina joga somente dentro do módulo do Xadrez.
        let chessTrainingActive = false;
        let chessTrainingDifficulty = 'medio';
        let chessTrainingLearnMode = false;
        let chessAiThinking = false;
        let chessLastResultShown = '';
        let chessLearnExampleMove = null;
        let chessHistoryPanelOpen = false;
        let chessTrainingResultRecorded = false;
        const chessHumanColor = 'white';

        function criarPeca(color, type) {
            return { color, type, moved: false };
        }

        function criarTabuleiroInicial() {
            const vazio = () => Array(8).fill(null);
            chessBoard = [
                [criarPeca('black', 'rook'), criarPeca('black', 'knight'), criarPeca('black', 'bishop'), criarPeca('black', 'queen'), criarPeca('black', 'king'), criarPeca('black', 'bishop'), criarPeca('black', 'knight'), criarPeca('black', 'rook')],
                Array.from({ length: 8 }, () => criarPeca('black', 'pawn')),
                vazio(), vazio(), vazio(), vazio(),
                Array.from({ length: 8 }, () => criarPeca('white', 'pawn')),
                [criarPeca('white', 'rook'), criarPeca('white', 'knight'), criarPeca('white', 'bishop'), criarPeca('white', 'queen'), criarPeca('white', 'king'), criarPeca('white', 'bishop'), criarPeca('white', 'knight'), criarPeca('white', 'rook')]
            ];
            chessTurn = 'white';
            selectedSquare = null;
            legalMoves = [];
            chessGameOver = false;
            lastMoveMessage = 'Fase 36 ativa: Xadrez Online com câmera fixa abaixo do tabuleiro, tabuleiro centralizado no celular e Damas preservada.';
            lastChessMove = null;
            enPassantTarget = null;
            moveHistory = [];
            undoStack = [];
            chessLastResultShown = '';
            chessLearnExampleMove = null;
            chessHistoryPanelOpen = false;
            chessTrainingResultRecorded = false;
        }

        function instalarCssXadrezFase5() {
            if (document.getElementById('chess-phase5-style')) return;

            const style = document.createElement('style');
            style.id = 'chess-phase5-style';
            style.textContent = `
                .chess-square.check {
                    box-shadow: inset 0 0 0 5px rgba(239, 68, 68, 0.95), 0 0 18px rgba(239, 68, 68, 0.8);
                    animation: chessCheckPulse 0.9s infinite alternate;
                }
                .chess-square.last-from { box-shadow: inset 0 0 0 4px rgba(59, 130, 246, 0.65); }
                .chess-square.last-to { box-shadow: inset 0 0 0 4px rgba(34, 197, 94, 0.8); }
                .chess-square.castle::after {
                    content: '⇄';
                    position: absolute;
                    z-index: 3;
                    color: #0f172a;
                    background: rgba(250, 204, 21, 0.86);
                    width: 36%;
                    height: 36%;
                    border-radius: 999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 1000;
                    box-shadow: 0 0 12px rgba(250, 204, 21, 0.75);
                }
                .btn-chess-sound { background: #0f766e; }
                .btn-chess-sound.on { background: #16a34a; box-shadow: 0 0 14px rgba(34,197,94,.35); }
                .btn-chess-sound.off { background: #475569; }
                .chess-square.en-passant::after {
                    content: 'e.p.';
                    position: absolute;
                    z-index: 3;
                    color: #fff;
                    background: rgba(14, 165, 233, 0.9);
                    padding: 3px 5px;
                    border-radius: 999px;
                    font-size: .62rem;
                    font-weight: 900;
                    box-shadow: 0 0 12px rgba(14, 165, 233, 0.72);
                }
                @keyframes chessCheckPulse { from { filter: brightness(1); } to { filter: brightness(1.22); } }
                .chess-history-panel {
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: #020617;
                    border: 1px solid rgba(56,189,248,0.32);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                }
                .chess-history-title {
                    color: #38bdf8;
                    font-weight: 900;
                    text-transform: uppercase;
                    font-size: .78rem;
                    letter-spacing: .5px;
                    margin-bottom: 6px;
                }
                .chess-history-list {
                    max-height: 118px;
                    overflow-y: auto;
                    color: #cbd5e1;
                    font-size: .82rem;
                    line-height: 1.5;
                }
                .chess-history-empty { color: #64748b; font-size: .82rem; }
                .btn-chess-undo { background: #0ea5e9; }
                .btn-chess-undo:hover:not(:disabled) { background: #0284c7; }
                .btn-chess-undo:disabled { opacity: .62; }
                .chess-promotion-modal {
                    display: none;
                    position: fixed;
                    inset: 0;
                    z-index: 10050;
                    background: rgba(2, 6, 23, .86);
                    backdrop-filter: blur(7px);
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                }
                .chess-promotion-card {
                    width: min(94vw, 420px);
                    background: linear-gradient(135deg, #0f172a, #1e1b4b);
                    border: 1px solid rgba(216,180,254,.5);
                    border-radius: 18px;
                    padding: 18px;
                    box-shadow: 0 20px 70px rgba(0,0,0,.72);
                    text-align: center;
                }
                .chess-promotion-card h2 {
                    color: #d8b4fe;
                    margin-bottom: 8px;
                    font-size: 1.12rem;
                    text-transform: uppercase;
                }
                .chess-promotion-card p { color: #cbd5e1; font-size: .9rem; margin-bottom: 12px; }
                .chess-promotion-options {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }
                .chess-promotion-options button {
                    min-height: 76px;
                    padding: 8px;
                    background: #111827;
                    border: 1px solid rgba(255,255,255,.1);
                    border-radius: 12px;
                    text-transform: none;
                    font-size: 1.8rem;
                    line-height: 1;
                }
                .chess-promotion-options button span {
                    display: block;
                    margin-top: 5px;
                    font-size: .65rem;
                    color: #cbd5e1;
                    font-weight: 800;
                }
                .chess-online-panel {
                    max-width: 520px;
                    margin: 0 auto 14px auto;
                    background: linear-gradient(135deg, #020617, #111827);
                    border: 1px solid rgba(34,197,94,.32);
                    border-radius: 14px;
                    padding: 12px;
                    text-align: left;
                }
                .chess-online-title {
                    color: #86efac;
                    font-weight: 1000;
                    text-transform: uppercase;
                    font-size: .82rem;
                    letter-spacing: .55px;
                    margin-bottom: 6px;
                }
                .chess-online-desc {
                    color: #cbd5e1;
                    font-size: .78rem;
                    line-height: 1.35;
                    margin-bottom: 10px;
                }
                .chess-online-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .chess-online-grid input {
                    margin: 0;
                    text-align: left;
                    font-size: .86rem;
                    padding: 10px 12px;
                }
                .chess-online-actions {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 7px;
                }
                .chess-online-actions button {
                    text-transform: none;
                    padding: 9px 7px;
                    font-size: .72rem;
                    border-radius: 9px;
                }
                .btn-chess-online { background: #16a34a; }
                .btn-chess-watch { background: #2563eb; }
                .btn-chess-leave-online { background: #64748b; }
                .btn-chess-copy-room { background: #7c3aed; }
                .chess-online-status {
                    margin-top: 8px;
                    color: #cbd5e1;
                    font-size: .76rem;
                    line-height: 1.35;
                    background: rgba(15,23,42,.72);
                    border-left: 4px solid #22c55e;
                    border-radius: 8px;
                    padding: 8px;
                }
                .chess-room-players-panel {
                    margin-top: 8px;
                    display: none;
                    background: linear-gradient(135deg, rgba(15,23,42,.92), rgba(2,6,23,.92));
                    border: 1px solid rgba(56,189,248,.28);
                    border-radius: 10px;
                    padding: 9px;
                    color: #e2e8f0;
                    font-size: .76rem;
                    line-height: 1.35;
                }
                .chess-room-players-title {
                    color: #38bdf8;
                    font-weight: 1000;
                    text-transform: uppercase;
                    letter-spacing: .45px;
                    font-size: .72rem;
                    margin-bottom: 6px;
                }
                .chess-room-player-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    border-bottom: 1px solid rgba(255,255,255,.06);
                    padding: 4px 0;
                }
                .chess-room-player-row:last-child { border-bottom: none; }
                .chess-room-player-label { color: #94a3b8; font-weight: 900; }
                .chess-room-player-name { color: #fff; text-align: right; word-break: break-word; }
                .chess-room-player-name.empty { color: #facc15; }
                .chess-room-player-name.me { color: #86efac; font-weight: 1000; }

                /* 📹 FASE 22 - VÍDEO E ÁUDIO DO XADREZ, SEPARADO DA DAMAS */
                .chess-call-panel {
                    display: none;
                    margin-top: 12px;
                    background: linear-gradient(135deg, #020617, #111827);
                    border: 1px solid rgba(56,189,248,.45);
                    border-radius: 14px;
                    padding: 12px;
                    text-align: left;
                    box-shadow: 0 10px 24px rgba(0,0,0,.38);
                }
                .chess-call-panel.online-visible { display: block; }
                .chess-call-panel.call-active {
                    position: static;
                    left: auto;
                    bottom: auto;
                    top: auto;
                    right: auto;
                    transform: none;
                    width: 100%;
                    max-width: 520px;
                    margin: 10px auto 12px auto;
                    padding: 12px;
                    z-index: auto;
                    border-color: rgba(56,189,248,.65);
                    box-shadow: 0 10px 24px rgba(0,0,0,.38);
                    backdrop-filter: none;
                }
                .chess-call-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,.08);
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                }
                .chess-call-panel.call-active .chess-call-header {
                    cursor: default;
                    touch-action: auto;
                    justify-content: space-between;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                }
                .chess-call-panel.call-active .chess-call-header:active { cursor: default; }
                .chess-call-title { color:#38bdf8; font-weight:1000; font-size:.86rem; text-transform:uppercase; letter-spacing:.45px; }
                .chess-call-status { color:#cbd5e1; font-size:.74rem; line-height:1.25; text-align:right; max-width: 230px; }
                .chess-call-panel.call-active .chess-call-title { font-size:.86rem; }
                .chess-call-panel.call-active .chess-call-title::after { content:''; }
                .chess-call-panel.call-active .chess-call-status { display:block; }
                .chess-call-panel.call-active .chess-call-note { display:block; }
                .chess-call-videos { display:none; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
                .chess-call-panel.call-active .chess-call-videos { display:grid; gap:8px; margin-bottom:10px; }
                .chess-video-tile { position:relative; overflow:hidden; border-radius:10px; background:#020617; border:1px solid #1e293b; aspect-ratio:4/3; min-height:110px; height:var(--fase35-video-height, 150px); }
                .chess-call-panel.call-active .chess-video-tile { aspect-ratio:auto; border-color:rgba(255,255,255,.18); }
                .chess-video-tile video { width:100%; height:100%; object-fit:cover; display:block; background:#020617; }
                #chess-local-video { transform:scaleX(-1); }
                .chess-video-label { position:absolute; left:6px; bottom:6px; background:rgba(0,0,0,.64); color:#fff; border-radius:999px; padding:3px 8px; font-size:.68rem; font-weight:900; }
                .chess-call-panel.call-active .chess-video-label { font-size:.68rem; padding:3px 8px; }
                .chess-call-controls { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
                .chess-call-controls button { padding:9px 6px; font-size:.72rem; text-transform:none; border-radius:8px; }
                .btn-chess-call-start { background:#0284c7; }
                .btn-chess-call-start:hover:not(:disabled) { background:#0369a1; }
                .btn-chess-call-end { background:#dc2626; }
                .btn-chess-call-end:hover:not(:disabled) { background:#b91c1c; }
                .chess-call-muted { background:#475569 !important; }
                .chess-call-note { margin-top:8px; color:#94a3b8; font-size:.72rem; line-height:1.32; }
                .chess-call-panel.call-active #chess-start-video-call-btn,
                .chess-call-panel.call-active #chess-start-audio-call-btn { display:none; }
                .chess-call-panel.call-active .chess-call-controls { grid-template-columns:1fr 1fr; gap:8px; }
                .chess-call-panel.call-active .chess-call-controls button { padding:10px 8px; font-size:.76rem; line-height:1.15; }
                .chess-call-panel.call-active #chess-end-call-btn { grid-column:auto; }
                @media (max-width: 520px) {
                    .chess-call-controls { grid-template-columns:1fr 1fr; }
                    .chess-call-panel.call-active { width:100%; bottom:auto; }
                    .chess-call-panel.call-active .chess-call-controls { grid-template-columns:1fr 1fr; }
                    .chess-call-panel.call-active #chess-end-call-btn { grid-column:1 / -1; }
                }

                .chess-material-panel {
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: linear-gradient(135deg, #07111f, #020617);
                    border: 1px solid rgba(250,204,21,.34);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                    color: #e2e8f0;
                }
                .chess-material-title {
                    color: #facc15;
                    font-weight: 1000;
                    text-transform: uppercase;
                    font-size: .78rem;
                    letter-spacing: .5px;
                    margin-bottom: 7px;
                }
                .chess-material-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .chess-material-box {
                    background: rgba(15,23,42,.78);
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 10px;
                    padding: 8px;
                    min-height: 72px;
                }
                .chess-material-label {
                    color: #94a3b8;
                    font-size: .72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .chess-material-pieces {
                    font-size: 1.35rem;
                    line-height: 1.25;
                    min-height: 30px;
                    word-break: break-word;
                }
                .chess-material-empty { color: #64748b; font-size: .78rem; }
                .chess-material-score {
                    margin-top: 5px;
                    color: #86efac;
                    font-size: .72rem;
                    font-weight: 900;
                }
                .chess-material-note {
                    margin-top: 7px;
                    color: #94a3b8;
                    font-size: .72rem;
                    line-height: 1.35;
                }

                .chess-chat-panel {
                    display: none;
                    max-width: 520px;
                    margin: 12px auto 0 auto;
                    background: #020617;
                    border: 1px solid rgba(148,163,184,.28);
                    border-radius: 12px;
                    padding: 10px;
                    text-align: left;
                }
                .chess-chat-title {
                    color: #93c5fd;
                    font-weight: 900;
                    font-size: .78rem;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }
                .chess-chat-messages {
                    height: 110px;
                    overflow-y: auto;
                    background: #0f172a;
                    border-radius: 8px;
                    padding: 8px;
                    color: #dbeafe;
                    font-size: .8rem;
                    line-height: 1.45;
                    margin-bottom: 8px;
                }
                .chess-chat-row { word-break: break-word; margin-bottom: 4px; }
                .chess-chat-row strong { color: #38bdf8; }
                .chess-chat-input-row { display: grid; grid-template-columns: 1fr auto; gap: 7px; }
                .chess-chat-input-row input { margin: 0; text-align: left; padding: 9px 10px; font-size: .84rem; }
                .chess-chat-input-row button { width: auto; padding: 9px 13px; font-size: .76rem; text-transform: none; }
                .chess-status-online-pill {
                    display: inline-block;
                    margin-left: 6px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: rgba(34,197,94,.14);
                    border: 1px solid rgba(34,197,94,.4);
                    color: #86efac;
                    font-size: .68rem;
                    font-weight: 900;
                }


                /* ✅ FASE 7.1 - TABULEIRO FIXO: evita a tela ficar pulando quando atualiza status, chat, placar ou Firebase */
                #chess-screen, #chess-screen .chess-card, #chess-screen .chess-board-wrap, #chess-screen .chess-board {
                    overflow-anchor: none;
                }
                #chess-screen .chess-card {
                    contain: layout paint;
                }
                #chess-screen .chess-board-wrap {
                    position: relative;
                    min-height: min(520px, calc(100vw - 52px));
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #chess-screen .chess-coord-shell {
                    width: 100%;
                }
                #chess-screen .chess-board {
                    flex: 0 0 auto;
                    transform: translateZ(0);
                    will-change: auto;
                }
                #chess-status {
                    min-height: 58px;
                    display: flex;
                    align-items: center;
                }
                #chess-online-status {
                    min-height: 44px;
                }
                #chess-room-players-panel {
                    min-height: 104px;
                }
                #chess-material-panel {
                    min-height: 132px;
                }
                #chess-history-panel {
                    min-height: 152px;
                }

                /* ✅ FASE 9 - LAYOUT FOCO: evita o jogador se perder na tela e deixa o tabuleiro mais confortável */
                #chess-screen .chess-title {
                    margin-bottom: 4px;
                }
                #chess-screen .chess-subtitle {
                    margin-bottom: 10px;
                    font-size: .82rem;
                }
                #chess-screen .chess-online-panel {
                    margin-bottom: 10px;
                }
                #chess-screen .chess-board-wrap {
                    scroll-margin-top: 18px;
                }
                .btn-chess-focus {
                    background: #0f766e;
                }
                .btn-chess-flip { background: #b45309; }
                .btn-chess-flip:hover:not(:disabled) { background: #92400e; }
                .btn-chess-focus:hover:not(:disabled) {
                    background: #0d9488;
                }
                body.chess-focus-mode #chess-screen .chess-room-players-panel,
                body.chess-focus-mode #chess-screen #chess-online-status,
                body.chess-focus-mode #chess-screen .chess-subtitle {
                    display: none !important;
                }
                body.chess-focus-mode #chess-screen .chess-online-panel {
                    padding: 10px;
                }
                body.chess-focus-mode #chess-screen .chess-online-desc,
                body.chess-focus-mode #chess-screen .chess-online-grid {
                    display: none !important;
                }
                body.chess-focus-mode #chess-screen .chess-online-actions {
                    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
                    gap: 7px;
                }
                body.chess-focus-mode #chess-screen .chess-board-wrap {
                    max-width: min(520px, 94vw);
                    margin-top: 8px;
                }
                @media (max-width: 520px) {
                    .chess-promotion-options { grid-template-columns: repeat(2, 1fr); }
                    .chess-online-grid, .chess-online-actions, .chess-material-grid { grid-template-columns: 1fr; }
                    .chess-chat-input-row { grid-template-columns: 1fr; }
                }
            `;
            document.head.appendChild(style);
        }

        function instalarUiXadrezFase5() {
            const actions = document.querySelector('#chess-screen .chess-actions');
            if (actions && !document.getElementById('chess-undo-btn')) {
                const undo = document.createElement('button');
                undo.id = 'chess-undo-btn';
                undo.className = 'btn-chess-undo';
                undo.type = 'button';
                undo.textContent = 'Desfazer Jogada';
                actions.insertBefore(undo, actions.children[1] || null);
                actions.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
            }

            const card = document.querySelector('#chess-screen .chess-card');
            if (card && !document.getElementById('chess-online-panel')) {
                const online = document.createElement('div');
                online.id = 'chess-online-panel';
                online.className = 'chess-online-panel';
                online.innerHTML = `
                    <div class="chess-online-title">🌐 Xadrez Online — Fase 36.12 Estável</div>
                    <div class="chess-online-desc">Entre em uma sala de Xadrez separada da Damas. O tabuleiro abre somente depois de clicar em Entrar/Jogar ou Assistir.</div>
                    <div class="chess-online-grid">
                        <input id="chess-online-name" type="text" maxlength="18" placeholder="Seu nome">
                        <input id="chess-online-room" type="text" maxlength="18" placeholder="Código da sala, ex: xadrez1">
                    </div>
                    <div class="chess-online-actions">
                        <button id="chess-online-join-btn" class="btn-chess-online" type="button">Entrar/Jogar</button>
                        <button id="chess-online-watch-btn" class="btn-chess-watch" type="button">Assistir</button>
                        <button id="chess-online-copy-btn" class="btn-chess-copy-room" type="button">Copiar sala</button>
                        <button id="chess-sound-btn" class="btn-chess-sound off" type="button">Ativar alerta</button>
                        <button id="chess-focus-btn" class="btn-chess-focus" type="button">Foco no tabuleiro</button>
                        <button id="chess-flip-btn" class="btn-chess-flip" type="button">Virar tabuleiro</button>
                        <button id="chess-online-leave-btn" class="btn-chess-leave-online" type="button">Sair online</button>
                    </div>
                    <div id="chess-online-status" class="chess-online-status">Modo local ativo. O Xadrez online usa o caminho <strong>chessRooms</strong>, separado da Damas.</div>
                    <div id="chess-room-players-panel" class="chess-room-players-panel">
                        <div class="chess-room-players-title">👥 Jogadores da sala</div>
                        <div id="chess-room-players-list"></div>
                    </div>
                    <div id="chess-call-panel" class="chess-call-panel call-compact">
                        <div class="chess-call-header">
                            <div class="chess-call-title">📹 Vídeo e áudio do Xadrez</div>
                            <div id="chess-call-status" class="chess-call-status">Entre em uma sala online para liberar a chamada.</div>
                            <button id="chess-call-toggle-btn" class="chess-call-toggle-btn" type="button" aria-expanded="false">+</button>
                        </div>
                        <div class="chess-call-videos">
                            <div class="chess-video-tile">
                                <video id="chess-local-video" autoplay muted playsinline></video>
                                <div id="chess-local-label" class="chess-video-label">Você</div>
                            </div>
                            <div class="chess-video-tile">
                                <video id="chess-remote-video" autoplay playsinline></video>
                                <audio id="chess-remote-audio" autoplay playsinline></audio>
                                <div id="chess-remote-label" class="chess-video-label">Oponente</div>
                            </div>
                        </div>
                        <div class="chess-call-controls">
                            <button id="chess-start-video-call-btn" class="btn-chess-call-start" type="button">Iniciar vídeo</button>
                            <button id="chess-start-audio-call-btn" class="btn-chess-call-start" type="button">Somente áudio</button>
                            <button id="chess-toggle-mic-btn" type="button">🎙️ Mic</button>
                            <button id="chess-toggle-camera-btn" type="button">📷 Cam</button>
                            <button id="chess-unlock-audio-btn" type="button">🔊 Som</button>
                            <button id="chess-call-size-minus-btn" type="button">➖ Menor</button>
                            <button id="chess-call-size-plus-btn" type="button">➕ Maior</button>
                            <button id="chess-end-call-btn" class="btn-chess-call-end" type="button">Encerrar</button>
                        </div>
                        <div class="chess-call-note">A chamada usa <strong>chessRooms/sala/call</strong>, separada da Damas. Vídeo/áudio só aparece para jogadores; espectador fica sem câmera e microfone.</div>
                    </div>
                `;
                const status = document.getElementById('chess-status');
                if (status) card.insertBefore(online, status);
                else card.insertBefore(online, card.firstChild?.nextSibling || null);
            }

            // ✅ PROFISSIONAL 06: garante que os torneios publicados apareçam no menu público do Xadrez,
            // mas somente como aviso/assistir/copiar link. Edição continua só no Admin.
            garantirPainelPublicoTorneiosXadrez();
            carregarTorneiosPublicosXadrez(true);
            removerPainelRankingGeralXadrez();

            if (card && !document.getElementById('chess-training-panel')) {
                const training = document.createElement('div');
                training.id = 'chess-training-panel';
                training.className = 'chess-training-panel';
                training.innerHTML = `
                    <div class="chess-section-kicker">Treino do Xadrez</div>
                    <div class="chess-training-title">🤖 Escolha como treinar</div>
                    <div class="chess-training-desc">O tabuleiro só abre depois da escolha. Você joga com as brancas e a máquina responde com as pretas.</div>
                    <div class="chess-training-actions modern">
                        <button id="chess-training-easy-btn" class="btn-chess-training easy" type="button">
                            <span>🌱 Fácil</span>
                            <small>Para começar sem pressão</small>
                        </button>
                        <button id="chess-training-medium-btn" class="btn-chess-training medium" type="button">
                            <span>🔵 Médio</span>
                            <small>Mais equilibrado</small>
                        </button>
                        <button id="chess-training-hard-btn" class="btn-chess-training hard" type="button">
                            <span>🔥 Difícil</span>
                            <small>Máquina mais forte</small>
                        </button>
                        <button id="chess-training-learn-btn" class="btn-chess-training learn" type="button">
                            <span>🎓 Aprender do Zero</span>
                            <small>Nomes, cores e dicas</small>
                        </button>
                    </div>
                    <button id="chess-pieces-lesson-btn" class="btn-chess-lesson" type="button">📚 Conhecer as peças antes de jogar</button>
                    <div id="chess-pieces-lesson-panel" class="chess-pieces-lesson-panel" style="display:none;">
                        <div class="chess-lesson-title">📚 Aprenda o básico do Xadrez</div>
                        <div class="chess-lesson-grid">
                            <div class="chess-lesson-item"><strong>♔ Rei</strong><span>É a peça principal. Anda 1 casa para qualquer lado. Não pode ficar em perigo.</span></div>
                            <div class="chess-lesson-item"><strong>♕ Dama</strong><span>É a peça mais forte. Anda reto e diagonal, quantas casas estiverem livres.</span></div>
                            <div class="chess-lesson-item"><strong>♖ Torre</strong><span>Anda em linha reta: para frente, para trás e para os lados.</span></div>
                            <div class="chess-lesson-item"><strong>♗ Bispo</strong><span>Anda somente na diagonal, quantas casas estiverem livres.</span></div>
                            <div class="chess-lesson-item"><strong>♘ Cavalo</strong><span>Anda em formato de L. É a única peça que pula por cima das outras.</span></div>
                            <div class="chess-lesson-item"><strong>♙ Peão</strong><span>Anda para frente, mas captura na diagonal. No primeiro movimento pode andar 2 casas.</span></div>
                        </div>
                        <div class="chess-color-legend">
                            <div><b class="leg-yellow"></b> Amarelo: peça escolhida</div>
                            <div><b class="leg-green"></b> Verde: pode andar</div>
                            <div><b class="leg-red"></b> Vermelho: pode capturar</div>
                            <div><b class="leg-blue"></b> Azul: última jogada</div>
                        </div>
                    </div>
                    <div id="chess-training-status" class="chess-training-status">Escolha um modo acima para abrir o tabuleiro.</div>
                    <div id="chess-training-coach" class="chess-training-coach" style="display:none;">
                        <strong>🎓 Professor de Xadrez:</strong>
                        <span id="chess-training-coach-text">No modo Aprender eu explico a peça, mostro as cores e dou uma ideia simples para sua próxima jogada.</span>
                        <button id="chess-training-tip-btn" type="button">Mostrar dica</button>
                    </div>
                    <div id="chess-beginner-box" class="chess-beginner-box" style="display:none;">
                        <div class="chess-beginner-title">📚 Aula rápida para quem nunca jogou</div>
                        <div><strong>Como jogar:</strong> clique em uma peça branca. A casa amarela é a peça escolhida. A bolinha verde é onde ela pode andar. O vermelho significa que você pode capturar: clique na peça vermelha para comer.</div>
                        <div class="chess-legend-row">
                            <div class="chess-legend-pill yellow">🟨 escolhida</div>
                            <div class="chess-legend-pill green">🟢 pode andar</div>
                            <div class="chess-legend-pill red">🔴 pode capturar</div>
                        </div>
                        <div class="chess-beginner-grid">
                            <div class="chess-beginner-item">♔ <strong>Rei:</strong> anda 1 casa. Se cair, acaba o jogo.</div>
                            <div class="chess-beginner-item">♕ <strong>Dama:</strong> anda longe em linha, coluna e diagonal.</div>
                            <div class="chess-beginner-item">♖ <strong>Torre:</strong> anda reto, para frente, para trás e lados.</div>
                            <div class="chess-beginner-item">♗ <strong>Bispo:</strong> anda só nas diagonais.</div>
                            <div class="chess-beginner-item">♘ <strong>Cavalo:</strong> anda em L e pode pular peças.</div>
                            <div class="chess-beginner-item">♙ <strong>Peão:</strong> anda para frente, mas captura na diagonal.</div>
                        </div>
                    </div>
                `;
                const onlinePanel = document.getElementById('chess-online-panel');
                if (onlinePanel) onlinePanel.insertAdjacentElement('afterend', training);
                else {
                    const status = document.getElementById('chess-status');
                    if (status) card.insertBefore(training, status);
                    else card.appendChild(training);
                }
            }


            if (card && !document.getElementById('chess-training-ranking-panel')) {
                const ranking = document.createElement('div');
                ranking.id = 'chess-training-ranking-panel';
                ranking.className = 'chess-training-ranking-panel chess-rank-collapsed';
                ranking.innerHTML = `
                    <div class="chess-training-ranking-head">
                        <div>
                            <div class="chess-training-ranking-title">🏆 Ranking do Treino de Xadrez</div>
                            <div id="chess-training-ranking-badge" class="chess-training-ranking-badge">Separado da Damas</div>
                        </div>
                        <button id="chess-ranking-toggle-btn" class="chess-ranking-toggle-btn" type="button" aria-expanded="false">+</button>
                    </div>
                    <div class="chess-training-ranking-grid">
                        <div class="chess-training-ranking-stat"><div id="chess-rank-points" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Pontos</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-wins" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Vitórias</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-games" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Partidas</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-losses" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Derrotas</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-draws" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Empates</div></div>
                        <div class="chess-training-ranking-stat"><div id="chess-rank-streak" class="chess-training-ranking-number">0</div><div class="chess-training-ranking-label">Sequência</div></div>
                    </div>
                    <div class="chess-training-ranking-details">
                        <div class="chess-training-ranking-line"><strong>Melhor nível vencido:</strong><br><span id="chess-rank-best">Nenhum ainda</span></div>
                        <div class="chess-training-ranking-line"><strong>Último resultado:</strong><br><span id="chess-rank-last">Nenhuma partida finalizada</span></div>
                    </div>
                    <div class="chess-training-ranking-actions">
                        <button id="chess-ranking-refresh-btn" class="btn-chess-ranking-refresh" type="button">Atualizar ranking</button>
                        <button id="chess-ranking-clear-btn" class="btn-chess-ranking-clear" type="button">Limpar ranking</button>
                    </div>
                    <div class="chess-training-ranking-note">Pontuação: Aprender +5, Fácil +10, Médio +20 e Difícil +35 por vitória. Empate soma 2 pontos. Este ranking é local e não mistura com a Damas.</div>
                `;
                const trainingPanel = document.getElementById('chess-training-panel');
                if (trainingPanel) trainingPanel.insertAdjacentElement('afterend', ranking);
                else card.appendChild(ranking);
            }




            // ✅ FASE 28: painel de conquistas removido do menu para deixar a tela mais limpa.

            // ✅ FASE 28: menu rápido removido. O menu agora começa direto nas áreas principais.
            const addChessMenuLabel = (id, html, beforeId) => {
                if (!card || document.getElementById(id)) return;
                const label = document.createElement('div');
                label.id = id;
                label.className = 'chess-menu-section-label';
                label.innerHTML = html;
                const beforeEl = document.getElementById(beforeId);
                if (beforeEl) card.insertBefore(label, beforeEl);
                else card.appendChild(label);
            };
            addChessMenuLabel('chess-menu-play-label', '<span>1.</span> Jogar — online, assistir ou treinar', 'chess-online-panel');
            addChessMenuLabel('chess-menu-learn-label', '<span>2.</span> Aprender — modos de treino e peças', 'chess-training-panel');

            const scrollChessMenuTo = (targetId) => {
                const el = document.getElementById(targetId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            // Fase 28: sem botões do menu rápido; rolagem manual normal do usuário.

            if (card && !document.getElementById('chess-material-panel')) {
                const material = document.createElement('div');
                material.id = 'chess-material-panel';
                material.className = 'chess-material-panel';
                material.innerHTML = `
                    <div class="chess-material-title">⚔️ Placar de material</div>
                    <div class="chess-material-grid">
                        <div class="chess-material-box">
                            <div class="chess-material-label">⚪ Brancas capturaram</div>
                            <div id="chess-material-white" class="chess-material-pieces"><span class="chess-material-empty">Nada ainda</span></div>
                            <div id="chess-material-white-score" class="chess-material-score">Vantagem: 0</div>
                        </div>
                        <div class="chess-material-box">
                            <div class="chess-material-label">⚫ Pretas capturaram</div>
                            <div id="chess-material-black" class="chess-material-pieces"><span class="chess-material-empty">Nada ainda</span></div>
                            <div id="chess-material-black-score" class="chess-material-score">Vantagem: 0</div>
                        </div>
                    </div>
                    <div id="chess-material-note" class="chess-material-note">O placar atualiza sozinho conforme as peças são capturadas.</div>
                `;
                const boardWrap = card.querySelector('.chess-board-wrap');
                if (boardWrap) boardWrap.insertAdjacentElement('afterend', material);
                else card.appendChild(material);
            }

            if (card && !document.getElementById('chess-history-panel')) {
                const history = document.createElement('div');
                history.id = 'chess-history-panel';
                history.className = 'chess-history-panel';
                history.innerHTML = `
                    <div class="chess-history-head">
                        <div class="chess-history-title">📜 Histórico de jogadas</div>
                        <div class="chess-history-actions">
                            <button id="chess-history-toggle-btn" class="btn-history-toggle" type="button">Ver jogadas</button>
                            <button id="chess-history-clear-btn" class="btn-history-clear" type="button">Limpar visual</button>
                        </div>
                    </div>
                    <div class="chess-history-body">
                        <div id="chess-history-list" class="chess-history-list"><div class="chess-history-empty">Nenhuma jogada ainda.</div></div>
                        <div class="chess-history-note">O histórico mostra as jogadas da partida atual de forma simples. Limpar visual não volta a jogada.</div>
                    </div>
                `;
                const warning = card.querySelector('.chess-warning');
                if (warning) card.insertBefore(history, warning);
                else card.appendChild(history);
            }

            renderRankingTreinoXadrez();
            renderConquistasXadrez();

            if (card && !document.getElementById('chess-chat-panel')) {
                const chat = document.createElement('div');
                chat.id = 'chess-chat-panel';
                chat.className = 'chess-chat-panel';
                chat.innerHTML = `
                    <div class="chess-chat-title">💬 Chat da sala de Xadrez</div>
                    <div id="chess-chat-messages" class="chess-chat-messages"><div class="chess-chat-row"><strong>Sistema:</strong> Entre em uma sala online para usar o chat.</div></div>
                    <div class="chess-chat-input-row">
                        <input id="chess-chat-input" type="text" maxlength="180" placeholder="Digite sua mensagem...">
                        <button id="chess-chat-send-btn" type="button">Enviar</button>
                    </div>
                `;
                const warning = card.querySelector('.chess-warning');
                if (warning) card.insertBefore(chat, warning);
                else card.appendChild(chat);
            }

            if (!document.getElementById('chess-promotion-modal')) {
                const modal = document.createElement('div');
                modal.id = 'chess-promotion-modal';
                modal.className = 'chess-promotion-modal';
                modal.innerHTML = `
                    <div class="chess-promotion-card">
                        <h2>Promover peão</h2>
                        <p>Escolha em qual peça o peão será transformado.</p>
                        <div class="chess-promotion-options">
                            <button type="button" data-piece="queen">♕<span>Dama</span></button>
                            <button type="button" data-piece="rook">♖<span>Torre</span></button>
                            <button type="button" data-piece="bishop">♗<span>Bispo</span></button>
                            <button type="button" data-piece="knight">♘<span>Cavalo</span></button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const warning = document.querySelector('#chess-screen .chess-warning');
            if (warning) {
                warning.innerHTML = '✅ Fase 29 ativa: Xadrez Online com estabilidade reforçada, tabuleiro grande e travado visualmente, vídeo/áudio separado da Damas e atualizações do Firebase mais leves.';
            }
        }

        function pecaXadrezValida(piece) {
            if (!piece || typeof piece !== 'object') return false;
            if (piece.color !== 'white' && piece.color !== 'black') return false;
            return ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(piece.type);
        }

        function tabuleiroXadrezTemFormatoValido(board) {
            // Firebase Realtime Database apaga valores null dentro de arrays.
            // Por isso, uma linha vazia pode voltar como "buraco" no array.
            // Não usamos every/map direto porque eles pulam buracos e deixam passar tabuleiro quebrado.
            if (!board || typeof board !== 'object') return false;
            for (let r = 0; r < 8; r++) {
                const row = board[r];
                if (!row || typeof row !== 'object') return false;
                for (let c = 0; c < 8; c++) {
                    const cell = row[c];
                    if (cell === null || cell === undefined || cell === '' || cell === 0 || cell === false) continue;
                    if (!pecaXadrezValida(cell)) return false;
                }
            }
            return true;
        }

        function limparTabuleiroXadrezRecebido(board) {
            if (!tabuleiroXadrezTemFormatoValido(board)) return null;
            const limpo = Array.from({ length: 8 }, () => Array(8).fill(null));
            for (let r = 0; r < 8; r++) {
                const row = board[r] || {};
                for (let c = 0; c < 8; c++) {
                    const piece = row[c];
                    if (!pecaXadrezValida(piece)) {
                        limpo[r][c] = null;
                    } else {
                        limpo[r][c] = {
                            color: piece.color,
                            type: piece.type,
                            moved: !!piece.moved
                        };
                    }
                }
            }
            return limpo;
        }

        function serializarTabuleiroXadrezParaFirebase(board) {
            const limpo = limparTabuleiroXadrezRecebido(board) || (() => {
                criarTabuleiroInicial();
                return limparTabuleiroXadrezRecebido(chessBoard);
            })();
            // Nunca enviar null para o Firebase nas casas vazias.
            // Usamos string vazia para preservar as 8 linhas e as 8 colunas.
            return Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => {
                    const piece = limpo?.[r]?.[c];
                    return pecaXadrezValida(piece)
                        ? { color: piece.color, type: piece.type, moved: !!piece.moved }
                        : '';
                })
            );
        }

        function contarPecasXadrez(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            if (!limpo) return 0;
            let total = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (pecaXadrezValida(limpo[r][c])) total++;
                }
            }
            return total;
        }

        function temReisDoXadrez(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            if (!limpo) return false;
            let whiteKing = false;
            let blackKing = false;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = limpo[r][c];
                    if (p && p.type === 'king' && p.color === 'white') whiteKing = true;
                    if (p && p.type === 'king' && p.color === 'black') blackKing = true;
                }
            }
            return whiteKing && blackKing;
        }

        function tabuleiroXadrezPrecisaRestaurar(board) {
            const limpo = limparTabuleiroXadrezRecebido(board);
            return !limpo || !temReisDoXadrez(limpo) || contarPecasXadrez(limpo) < 2;
        }

        function clonarTabuleiro(board) {
            return limparTabuleiroXadrezRecebido(board);
        }

        function garantirTabuleiroXadrezPronto(motivo = '') {
            if (!tabuleiroXadrezPrecisaRestaurar(chessBoard)) return false;
            criarTabuleiroInicial();
            if (motivo) lastMoveMessage = motivo;
            return true;
        }

        function normalizarCampoXadrez(valor) {
            return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, 18);
        }

        function normalizarSalaXadrez(valor) {
            return String(valor || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(0, 24);
        }

        function escapeHtmlXadrez(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        function getChessUid() {
            if (typeof playerId !== 'undefined' && playerId) return playerId;
            let id = localStorage.getItem('tabuleiroArenaChessUid');
            if (!id) {
                id = 'local-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem('tabuleiroArenaChessUid', id);
            }
            return id;
        }

        function atualizarStatusOnlineXadrez(texto) {
            const el = document.getElementById('chess-online-status');
            if (el) el.innerHTML = texto;
        }

        function nomeJogadorSalaXadrez(jogador) {
            return jogador && jogador.name ? escapeHtmlXadrez(jogador.name) : '';
        }

        function jogadorAtualEh(jogador) {
            const uid = getChessUid();
            return !!(jogador && jogador.id && jogador.id === uid);
        }

        function contarEspectadoresXadrez() {
            return Object.values(chessRoomSpectators || {}).filter(s => s && s.id).length;
        }


        function calcularMaterialXadrez() {
            const valores = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
            const ordem = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
            const simbolos = {
                white: { queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
                black: { queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
            };
            const inicial = {
                white: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1, king: 1 },
                black: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1, king: 1 }
            };
            const atual = {
                white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
                black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
            };

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = chessBoard?.[r]?.[c];
                    if (pecaXadrezValida(p)) atual[p.color][p.type]++;
                }
            }

            const capturadasPorBrancas = [];
            const capturadasPorPretas = [];
            let pontosBrancas = 0;
            let pontosPretas = 0;

            ordem.forEach(tipo => {
                const pretasPerdidas = Math.max(0, inicial.black[tipo] - atual.black[tipo]);
                const brancasPerdidas = Math.max(0, inicial.white[tipo] - atual.white[tipo]);
                for (let i = 0; i < pretasPerdidas; i++) {
                    capturadasPorBrancas.push(simbolos.black[tipo]);
                    pontosBrancas += valores[tipo] || 0;
                }
                for (let i = 0; i < brancasPerdidas; i++) {
                    capturadasPorPretas.push(simbolos.white[tipo]);
                    pontosPretas += valores[tipo] || 0;
                }
            });

            return { capturadasPorBrancas, capturadasPorPretas, pontosBrancas, pontosPretas };
        }

        function renderizarPlacarMaterialXadrez() {
            const whiteEl = document.getElementById('chess-material-white');
            const blackEl = document.getElementById('chess-material-black');
            const whiteScoreEl = document.getElementById('chess-material-white-score');
            const blackScoreEl = document.getElementById('chess-material-black-score');
            const noteEl = document.getElementById('chess-material-note');
            if (!whiteEl || !blackEl) return;

            const material = calcularMaterialXadrez();
            whiteEl.innerHTML = material.capturadasPorBrancas.length ? material.capturadasPorBrancas.join(' ') : '<span class="chess-material-empty">Nada ainda</span>';
            blackEl.innerHTML = material.capturadasPorPretas.length ? material.capturadasPorPretas.join(' ') : '<span class="chess-material-empty">Nada ainda</span>';

            const saldoBrancas = material.pontosBrancas - material.pontosPretas;
            const saldoPretas = material.pontosPretas - material.pontosBrancas;
            if (whiteScoreEl) whiteScoreEl.textContent = saldoBrancas > 0 ? `Vantagem: +${saldoBrancas}` : `Vantagem: ${saldoBrancas}`;
            if (blackScoreEl) blackScoreEl.textContent = saldoPretas > 0 ? `Vantagem: +${saldoPretas}` : `Vantagem: ${saldoPretas}`;

            if (noteEl) {
                if (saldoBrancas > 0) noteEl.textContent = `As brancas estão com vantagem material de ${saldoBrancas} ponto(s).`;
                else if (saldoPretas > 0) noteEl.textContent = `As pretas estão com vantagem material de ${saldoPretas} ponto(s).`;
                else noteEl.textContent = 'Material equilibrado até agora.';
            }
        }


        function atualizarBotaoSomXadrez() {
            const btn = document.getElementById('chess-sound-btn');
            if (!btn) return;
            btn.textContent = chessSoundEnabled ? 'Alerta ligado' : 'Ativar alerta';
            btn.classList.toggle('on', chessSoundEnabled);
            btn.classList.toggle('off', !chessSoundEnabled);
        }

        function tocarAlertaVezXadrez() {
            try {
                if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
            } catch (_) {}
            if (!chessSoundEnabled) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 740;
                gain.gain.setValueAtTime(0.001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.24);
                setTimeout(() => ctx.close?.(), 500);
            } catch (e) {
                console.warn('Som do alerta de vez não tocou:', e);
            }
        }

        function alternarAlertaXadrez() {
            chessSoundEnabled = !chessSoundEnabled;
            atualizarBotaoSomXadrez();
            try { localStorage.setItem('tabuleiroArenaChessSound', chessSoundEnabled ? '1' : '0'); } catch (_) {}
            mostrarToastXadrez(chessSoundEnabled ? '🔔 Alerta de vez ativado.' : '🔕 Alerta de vez desligado.');
            if (chessSoundEnabled) tocarAlertaVezXadrez();
        }

        function verificarAlertaDeVezXadrez(data) {
            if (chessMode !== 'online' || chessIsSpectator || !chessPlayerColor || chessPlayerColor === 'spectator') return;
            const history = Array.isArray(data?.moveHistory) ? data.moveHistory : [];
            const count = history.length;
            const turn = data?.turn === 'black' ? 'black' : 'white';
            const key = `${chessRoomId}|${count}|${turn}|${chessPlayerColor}`;
            if (count > chessLastRemoteMoveCount && turn === chessPlayerColor && key !== chessLastTurnAlertKey) {
                chessLastTurnAlertKey = key;
                setTimeout(() => {
                    mostrarToastXadrez('🔔 Sua vez de jogar no Xadrez Online.');
                    tocarAlertaVezXadrez();
                }, 120);
            }
            chessLastRemoteMoveCount = Math.max(chessLastRemoteMoveCount, count);
        }

        function renderizarListaJogadoresXadrez() {
            const panel = document.getElementById('chess-room-players-panel');
            const list = document.getElementById('chess-room-players-list');
            if (!panel || !list) return;

            if (chessMode !== 'online') {
                panel.style.display = 'none';
                list.innerHTML = '';
                return;
            }

            panel.style.display = 'block';
            const white = chessRoomPlayers?.white || null;
            const black = chessRoomPlayers?.black || null;
            const spectators = Object.values(chessRoomSpectators || {}).filter(s => s && s.id);
            const specNames = spectators.map(s => nomeJogadorSalaXadrez(s)).filter(Boolean);

            const whiteName = white ? nomeJogadorSalaXadrez(white) : 'Aguardando jogador...';
            const blackName = black ? nomeJogadorSalaXadrez(black) : 'Aguardando jogador...';
            const specText = specNames.length ? specNames.join(', ') : 'Nenhum espectador';

            list.innerHTML = `
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">⚪ Brancas</span>
                    <span class="chess-room-player-name ${white ? '' : 'empty'} ${jogadorAtualEh(white) ? 'me' : ''}">${whiteName}${jogadorAtualEh(white) ? ' (você)' : ''}</span>
                </div>
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">⚫ Pretas</span>
                    <span class="chess-room-player-name ${black ? '' : 'empty'} ${jogadorAtualEh(black) ? 'me' : ''}">${blackName}${jogadorAtualEh(black) ? ' (você)' : ''}</span>
                </div>
                <div class="chess-room-player-row">
                    <span class="chess-room-player-label">👀 Espectadores</span>
                    <span class="chess-room-player-name">${specText}</span>
                </div>
            `;
        }

        function atualizarPainelOnlineXadrez() {
            const chat = document.getElementById('chess-chat-panel');
            if (chat) chat.style.display = chessMode === 'online' ? 'block' : 'none';
            const undo = document.getElementById('chess-undo-btn');
            if (undo) undo.disabled = chessMode === 'online' || undoStack.length === 0;
            const joinBtn = document.getElementById('chess-online-join-btn');
            const watchBtn = document.getElementById('chess-online-watch-btn');
            const leaveBtn = document.getElementById('chess-online-leave-btn');
            if (joinBtn) joinBtn.disabled = chessMode === 'online' && !chessIsSpectator;
            if (watchBtn) watchBtn.disabled = chessMode === 'online' && chessIsSpectator;
            if (leaveBtn) leaveBtn.disabled = chessMode !== 'online';

            if (chessMode === 'training') {
                atualizarStatusOnlineXadrez(`🤖 Modo treino ativo no Xadrez. Você joga de <strong>brancas</strong> contra a máquina no nível <strong>${nomeDificuldadeTreinoXadrez()}</strong>. Firebase e Damas não são usados neste modo.`);
                renderizarListaJogadoresXadrez();
                atualizarPainelTreinoXadrez();
                return;
            }

            if (chessMode !== 'online') {
                atualizarStatusOnlineXadrez('Modo local ativo. O Xadrez online usa o caminho <strong>chessRooms</strong>, separado da Damas.');
                renderizarListaJogadoresXadrez();
                atualizarPainelTreinoXadrez();
                return;
            }

            const papel = chessIsSpectator ? 'espectador' : (chessPlayerColor === 'white' ? 'brancas' : 'pretas');
            const vezTexto = chessIsSpectator
                ? 'Você apenas assiste.'
                : (chessPlayerColor === chessTurn ? 'É a sua vez de jogar.' : `Aguarde a vez das ${nomeCor(chessTurn)}.`);
            const faltando = !chessRoomPlayers?.black?.id ? ' Aguardando segundo jogador entrar como pretas.' : '';
            const espectadores = contarEspectadoresXadrez();

            atualizarStatusOnlineXadrez(`Online na sala <strong>${escapeHtmlXadrez(chessRoomId)}</strong> como <strong>${papel}</strong>. ${vezTexto}${faltando} 👀 Espectadores: <strong>${espectadores}</strong>. 🔔 Alerta: <strong>${chessSoundEnabled ? 'ligado' : 'desligado'}</strong>.`);
            renderizarListaJogadoresXadrez();
        }

        function mostrarTabuleiroXadrezAposEscolha() {
            document.body.classList.add('chess-board-visible', 'chess-game-active');
            document.body.classList.remove('chess-menu-active');
            ocultarPainelPublicoXadrezDurantePartida();
            const status = document.getElementById('chess-status');
            if (status) status.style.display = '';
            const wrap = document.querySelector('#chess-screen .chess-board-wrap');
            if (wrap) wrap.style.display = '';
            const actions = document.querySelector('#chess-screen .chess-actions');
            if (actions) actions.style.display = '';
        }

        function ocultarTabuleiroXadrezParaMenu() {
            document.body.classList.remove('chess-board-visible', 'chess-game-active');
            document.body.classList.add('chess-menu-active');
            mostrarPainelPublicoXadrezNoMenu();
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = 'Escolha como deseja jogar. Na parte de treino, você pode conhecer as peças antes de começar. O tabuleiro abrirá só depois de selecionar Online, Treino ou Aprender do Zero.';
            atualizarProfessorXadrez('', null);
            const resultPanel = document.getElementById('chess-result-panel');
            if (resultPanel) resultPanel.style.display = 'none';
            atualizarPainelTreinoXadrez();
            atualizarPainelOnlineXadrez();
        }

        function nomeDificuldadeTreinoXadrez() {
            if (chessTrainingLearnMode) return 'Aprender';
            if (chessTrainingDifficulty === 'facil') return 'Fácil';
            if (chessTrainingDifficulty === 'dificil') return 'Difícil';
            return 'Médio';
        }

        function atualizarPainelTreinoXadrez() {
            const status = document.getElementById('chess-training-status');
            const coach = document.getElementById('chess-training-coach');
            const beginnerBox = document.getElementById('chess-beginner-box');
            const beginnerActive = chessMode === 'training' && chessTrainingLearnMode;
            document.body.classList.toggle('chess-beginner-mode', beginnerActive);
            if (beginnerBox) beginnerBox.style.display = beginnerActive ? 'block' : 'none';
            document.querySelectorAll('#chess-training-panel .btn-chess-training').forEach(btn => btn.classList.remove('active'));
            const id = chessTrainingLearnMode ? 'chess-training-learn-btn' : `chess-training-${chessTrainingDifficulty === 'facil' ? 'easy' : chessTrainingDifficulty === 'dificil' ? 'hard' : 'medium'}-btn`;
            document.getElementById(id)?.classList.add('active');
            if (!status) return;
            if (chessMode !== 'training') {
                status.textContent = 'Treino desligado. Escolha um nível para começar contra a máquina.';
                if (coach) coach.style.display = 'none';
                return;
            }
            const vez = chessTurn === chessHumanColor ? 'Sua vez de jogar.' : 'A máquina está pensando...';
            status.textContent = chessTrainingLearnMode ? `Aprender do Zero ligado. Você joga com as brancas. Clique numa peça branca: verde anda, vermelho captura. ${vez}` : `Treino ligado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas. ${vez}`;
            if (coach) coach.style.display = chessTrainingLearnMode ? 'block' : 'none';
            if (chessTrainingLearnMode && chessTurn === chessHumanColor && !chessGameOver) {
                atualizarProfessorXadrez('Clique em uma peça branca. Eu vou explicar como ela anda e marcar um exemplo no tabuleiro.', null);
                atualizarDicaTreinoXadrez();
            }
        }

        function textoMovimentoPecaXadrez(type) {
            const textos = {
                king: 'O Rei anda 1 casa para qualquer lado. O segredo é nunca deixar o Rei em perigo. Se ele estiver ameaçado, você precisa defender, fugir ou capturar a peça que ameaça.',
                queen: 'A Dama é a peça mais forte. Ela anda quantas casas quiser em linha reta, coluna ou diagonal, desde que o caminho esteja livre.',
                rook: 'A Torre anda em linha reta: para frente, para trás e para os lados. Ela fica muito forte em colunas e linhas abertas.',
                bishop: 'O Bispo anda somente nas diagonais. Cada bispo fica sempre na mesma cor de casa durante a partida.',
                knight: 'O Cavalo anda em formato de L: duas casas para um lado e uma para o outro. Ele é especial porque pode pular por cima das peças.',
                pawn: 'O Peão anda para frente, mas captura na diagonal. No primeiro movimento pode andar duas casas. Quando chega ao fim do tabuleiro, vira outra peça.'
            };
            return textos[type] || 'Clique numa peça sua para ver as casas possíveis.';
        }

        function atualizarProfessorXadrez(texto, exemplo = null) {
            const box = document.getElementById('chess-live-coach');
            const el = document.getElementById('chess-live-coach-text');
            if (!box || !el) return;
            const ativo = chessMode === 'training' && chessTrainingLearnMode && document.body.classList.contains('chess-board-visible');
            box.style.display = ativo ? 'block' : 'none';
            if (ativo && texto) el.textContent = texto;
            chessLearnExampleMove = exemplo;
        }

        function jogadaPodeGerarXequeContra(corDefesa) {
            const atacante = corOposta(corDefesa);
            const movimentos = todosMovimentosLegais(atacante, chessBoard);
            for (const item of movimentos) {
                const temp = clonarTabuleiro(chessBoard);
                if (!temp) continue;
                aplicarMovimentoEmBoard(temp, item.from.row, item.from.col, item.to);
                if (reiEstaEmXeque(temp, corDefesa)) return true;
            }
            return false;
        }

        function feedbackProfessorDepoisDaJogada(peca, fromRow, fromCol, move, estado) {
            if (!(chessMode === 'training' && chessTrainingLearnMode && peca?.color === chessHumanColor)) return;
            if (/Xeque-mate/i.test(estado || '')) {
                atualizarProfessorXadrez('🏆 Excelente! Isso foi xeque-mate. Você protegeu seu Rei e deixou o Rei adversário sem saída.', null);
                return;
            }
            if (/Xeque/i.test(estado || '')) {
                atualizarProfessorXadrez('🔥 Boa! Você colocou o Rei da máquina em xeque. Agora ela será obrigada a se defender.', null);
                return;
            }
            if (jogadaPodeGerarXequeContra(chessHumanColor)) {
                atualizarProfessorXadrez('⚠️ Atenção: sua jogada é legal, mas a máquina pode criar ameaça de xeque. Observe bem o Rei antes da próxima jogada.', null);
                return;
            }
            if (move.capture) {
                atualizarProfessorXadrez('✅ Boa jogada! Você capturou uma peça. Capturar com segurança ajuda a ganhar material e controlar a partida.', null);
                return;
            }
            if (move.castle) {
                atualizarProfessorXadrez('🛡️ Ótimo roque! Você colocou o Rei em mais segurança e aproximou a Torre do jogo.', null);
                return;
            }
            if (peca.type === 'knight' || peca.type === 'bishop') {
                atualizarProfessorXadrez('✅ Boa jogada! Você desenvolveu uma peça. No começo da partida, tirar Cavalo e Bispo da posição inicial ajuda muito.', null);
                return;
            }
            if (peca.type === 'pawn' && Math.abs(move.row - fromRow) === 2) {
                atualizarProfessorXadrez('✅ Bom avanço de peão! Você ganhou espaço. Agora tente desenvolver Cavalos e Bispos.', null);
                return;
            }
            atualizarProfessorXadrez('✅ Jogada feita. Agora observe a resposta da máquina e procure manter seu Rei seguro.', null);
        }

        function reforcarProfessorXequeXadrez(estado) {
            if (!/Xeque/i.test(estado || '')) return;
            if (/Xeque-mate/i.test(estado || '')) {
                atualizarProfessorXadrez('♟️ Xeque-mate! A partida terminou porque o Rei ameaçado não tem fuga, defesa nem captura possível.', null);
            } else {
                atualizarProfessorXadrez('⚠️ Xeque! O Rei está ameaçado. A prioridade é uma destas três: fugir com o Rei, capturar a peça atacante ou bloquear o caminho do ataque.', null);
            }
        }


        function chaveRankingTreinoXadrez() {
            return 'tabuleiroArena.chessTrainingRanking.v20';
        }

        function rankingTreinoXadrezPadrao() {
            return {
                points: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                games: 0,
                streak: 0,
                bestDifficulty: '',
                lastResult: 'Nenhuma partida finalizada',
                byDifficulty: {
                    aprender: { wins: 0, losses: 0, draws: 0, games: 0 },
                    facil: { wins: 0, losses: 0, draws: 0, games: 0 },
                    medio: { wins: 0, losses: 0, draws: 0, games: 0 },
                    dificil: { wins: 0, losses: 0, draws: 0, games: 0 }
                }
            };
        }

        function carregarRankingTreinoXadrez() {
            try {
                const raw = localStorage.getItem(chaveRankingTreinoXadrez());
                const base = rankingTreinoXadrezPadrao();
                if (!raw) return base;
                const data = JSON.parse(raw);
                return {
                    ...base,
                    ...data,
                    byDifficulty: {
                        ...base.byDifficulty,
                        ...(data && data.byDifficulty ? data.byDifficulty : {})
                    }
                };
            } catch (_) {
                return rankingTreinoXadrezPadrao();
            }
        }

        function salvarRankingTreinoXadrez(data) {
            try { localStorage.setItem(chaveRankingTreinoXadrez(), JSON.stringify(data)); } catch (_) {}
        }

        function chaveDificuldadeRankingAtual() {
            if (chessTrainingLearnMode) return 'aprender';
            if (chessTrainingDifficulty === 'facil') return 'facil';
            if (chessTrainingDifficulty === 'dificil') return 'dificil';
            return 'medio';
        }

        function nomeDificuldadeRankingXadrez(chave) {
            const nomes = { aprender: 'Aprender do Zero', facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
            return nomes[chave] || 'Médio';
        }

        function pontosVitoriaRankingXadrez(chave) {
            const pontos = { aprender: 5, facil: 10, medio: 20, dificil: 35 };
            return pontos[chave] || 20;
        }

        function prioridadeDificuldadeRanking(chave) {
            const ordem = { aprender: 1, facil: 2, medio: 3, dificil: 4 };
            return ordem[chave] || 0;
        }

        function renderRankingTreinoXadrez() {
            const data = carregarRankingTreinoXadrez();
            const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
            setText('chess-rank-points', data.points || 0);
            setText('chess-rank-wins', data.wins || 0);
            setText('chess-rank-losses', data.losses || 0);
            setText('chess-rank-draws', data.draws || 0);
            setText('chess-rank-games', data.games || 0);
            setText('chess-rank-streak', data.streak || 0);
            setText('chess-rank-best', data.bestDifficulty ? nomeDificuldadeRankingXadrez(data.bestDifficulty) : 'Nenhum ainda');
            setText('chess-rank-last', data.lastResult || 'Nenhuma partida finalizada');
            const badge = document.getElementById('chess-training-ranking-badge');
            if (badge) badge.textContent = data.games ? `${data.games} partida${data.games === 1 ? '' : 's'} registrada${data.games === 1 ? '' : 's'}` : 'Separado da Damas';
            renderConquistasXadrez();
        }

        function prepararRankingTreinoXadrez() {
            const panel = document.getElementById('chess-training-ranking-panel');
            const btn = document.getElementById('chess-ranking-toggle-btn');
            if (!panel) return;
            let aberto = false;
            try { aberto = localStorage.getItem('tabuleiroArenaChessRankingOpen') === '1'; } catch (_) {}
            panel.classList.toggle('chess-rank-collapsed', !aberto);
            if (btn) {
                btn.textContent = aberto ? '−' : '+';
                btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            }
        }

        function alternarRankingTreinoXadrez() {
            const panel = document.getElementById('chess-training-ranking-panel');
            if (!panel) return;
            const abrir = panel.classList.contains('chess-rank-collapsed');
            panel.classList.toggle('chess-rank-collapsed', !abrir);
            try { localStorage.setItem('tabuleiroArenaChessRankingOpen', abrir ? '1' : '0'); } catch (_) {}
            prepararRankingTreinoXadrez();
        }

        function registrarResultadoRankingTreinoXadrez(textoEstado) {
            if (chessMode !== 'training' || !chessGameOver || chessTrainingResultRecorded) return;
            if (!textoEstado || !/Xeque-mate|Empate|afogamento|venceram|venceu|desistência/i.test(textoEstado)) return;

            const data = carregarRankingTreinoXadrez();
            const diff = chaveDificuldadeRankingAtual();
            const bucket = data.byDifficulty[diff] || { wins: 0, losses: 0, draws: 0, games: 0 };
            const brancasVenceram = /brancas/i.test(textoEstado);
            const pretasVenceram = /pretas/i.test(textoEstado);
            const empate = /Empate|afogamento/i.test(textoEstado);

            data.games = (data.games || 0) + 1;
            bucket.games = (bucket.games || 0) + 1;

            if (empate) {
                data.draws = (data.draws || 0) + 1;
                bucket.draws = (bucket.draws || 0) + 1;
                data.points = (data.points || 0) + 2;
                data.streak = 0;
                data.lastResult = `Empate no modo ${nomeDificuldadeRankingXadrez(diff)} (+2 pontos)`;
            } else if (brancasVenceram && !pretasVenceram) {
                const pontos = pontosVitoriaRankingXadrez(diff);
                data.wins = (data.wins || 0) + 1;
                bucket.wins = (bucket.wins || 0) + 1;
                data.points = (data.points || 0) + pontos;
                data.streak = (data.streak || 0) + 1;
                if (!data.bestDifficulty || prioridadeDificuldadeRanking(diff) > prioridadeDificuldadeRanking(data.bestDifficulty)) data.bestDifficulty = diff;
                data.lastResult = `Vitória no modo ${nomeDificuldadeRankingXadrez(diff)} (+${pontos} pontos)`;
            } else {
                data.losses = (data.losses || 0) + 1;
                bucket.losses = (bucket.losses || 0) + 1;
                data.streak = 0;
                data.lastResult = `Derrota no modo ${nomeDificuldadeRankingXadrez(diff)}`;
            }

            data.byDifficulty[diff] = bucket;
            data.updatedAt = Date.now();
            salvarRankingTreinoXadrez(data);
            registrarConquistasPorResultadoXadrez(textoEstado, data, diff);
            chessTrainingResultRecorded = true;
            renderRankingTreinoXadrez();
        }

        function limparRankingTreinoXadrez() {
            exibirConfirmacao('Limpar ranking do Xadrez', 'Deseja limpar somente o <strong>ranking do treino de Xadrez</strong>?<br><br>A Damas não será alterada.', () => {
                salvarRankingTreinoXadrez(rankingTreinoXadrezPadrao());
                renderRankingTreinoXadrez();
                prepararRankingTreinoXadrez();
                mostrarToastXadrez('🏆 Ranking do treino de Xadrez limpo.');
            });
        }



        function chaveConquistasXadrez() {
            return 'tabuleiroArena.chessAchievements.v21';
        }

        function conquistasXadrezPadrao() {
            return { unlocked: {}, updatedAt: null };
        }

        function listaConquistasXadrez() {
            return [
                { id: 'firstGame', icon: '🎮', name: 'Primeira partida', desc: 'Finalizou uma partida de treino de Xadrez.' },
                { id: 'firstWin', icon: '🏆', name: 'Primeira vitória', desc: 'Venceu a máquina pela primeira vez.' },
                { id: 'firstCapture', icon: '⚔️', name: 'Primeira captura', desc: 'Capturou uma peça adversária no Xadrez.' },
                { id: 'queenHunter', icon: '👑', name: 'Caçador da Dama', desc: 'Capturou a Dama adversária.' },
                { id: 'firstCheck', icon: '⚠️', name: 'Primeiro xeque', desc: 'Colocou o Rei adversário em xeque.' },
                { id: 'firstCheckmate', icon: '♟️', name: 'Primeiro xeque-mate', desc: 'Venceu uma partida com xeque-mate.' },
                { id: 'learnWin', icon: '🎓', name: 'Aprendeu vencendo', desc: 'Venceu no modo Aprender do Zero.' },
                { id: 'winMedium', icon: '🥈', name: 'Venceu no médio', desc: 'Derrotou a máquina no nível médio.' },
                { id: 'winHard', icon: '🥇', name: 'Venceu no difícil', desc: 'Derrotou a máquina no nível difícil.' },
                { id: 'streak3', icon: '🔥', name: 'Sequência 3', desc: 'Conseguiu 3 vitórias seguidas no treino.' },
                { id: 'points100', icon: '💯', name: '100 pontos', desc: 'Chegou a 100 pontos no ranking do treino.' },
                { id: 'castleDone', icon: '🏰', name: 'Rei protegido', desc: 'Fez um roque para proteger o Rei.' }
            ];
        }

        function carregarConquistasXadrez() {
            try {
                const raw = localStorage.getItem(chaveConquistasXadrez());
                const base = conquistasXadrezPadrao();
                if (!raw) return base;
                const data = JSON.parse(raw);
                return { ...base, ...data, unlocked: { ...base.unlocked, ...(data && data.unlocked ? data.unlocked : {}) } };
            } catch (_) {
                return conquistasXadrezPadrao();
            }
        }

        function salvarConquistasXadrez(data) {
            try { localStorage.setItem(chaveConquistasXadrez(), JSON.stringify(data)); } catch (_) {}
        }

        function desbloquearConquistaXadrez(id, silencioso = false) {
            const data = carregarConquistasXadrez();
            if (data.unlocked && data.unlocked[id]) return false;
            const def = listaConquistasXadrez().find(item => item.id === id);
            if (!def) return false;
            data.unlocked[id] = Date.now();
            data.updatedAt = Date.now();
            salvarConquistasXadrez(data);
            renderConquistasXadrez();
            if (!silencioso) mostrarToastXadrez(`🥇 Nova conquista: ${def.name}!`);
            return true;
        }

        function renderConquistasXadrez() {
            const grid = document.getElementById('chess-achievements-grid');
            const badge = document.getElementById('chess-achievements-badge');
            if (!grid) return;
            const data = carregarConquistasXadrez();
            const defs = listaConquistasXadrez();
            const total = defs.length;
            const unlockedCount = defs.filter(item => data.unlocked && data.unlocked[item.id]).length;
            if (badge) badge.textContent = `${unlockedCount}/${total} liberadas`;
            grid.innerHTML = defs.map(item => {
                const ok = !!(data.unlocked && data.unlocked[item.id]);
                return `
                    <div class="chess-achievement-card ${ok ? 'unlocked' : ''}">
                        <div class="chess-achievement-icon">${ok ? item.icon : '🔒'}</div>
                        <div class="chess-achievement-name">${escapeHtmlXadrez(item.name)}</div>
                        <div class="chess-achievement-desc">${escapeHtmlXadrez(ok ? item.desc : 'Bloqueada: continue jogando para liberar.')}</div>
                    </div>
                `;
            }).join('');
        }

        function limparConquistasXadrez() {
            exibirConfirmacao('Limpar conquistas do Xadrez', 'Deseja limpar somente as <strong>conquistas do Xadrez</strong>?<br><br>A Damas e o ranking não serão alterados.', () => {
                salvarConquistasXadrez(conquistasXadrezPadrao());
                renderConquistasXadrez();
                mostrarToastXadrez('🥇 Conquistas do Xadrez limpas.');
            });
        }

        function registrarConquistasPorJogadaXadrez(peca, move, capturedPiece, estadoDepois) {
            if (!peca) return;
            if (capturedPiece && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCapture');
            if (capturedPiece && capturedPiece.type === 'queen' && peca.color === chessHumanColor) desbloquearConquistaXadrez('queenHunter');
            if (move && move.castle && peca.color === chessHumanColor) desbloquearConquistaXadrez('castleDone');
            if (/Xeque/i.test(estadoDepois || '') && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCheck');
            if (/Xeque-mate/i.test(estadoDepois || '') && peca.color === chessHumanColor) desbloquearConquistaXadrez('firstCheckmate');
        }

        function registrarConquistasPorResultadoXadrez(textoEstado, dataRanking, diff) {
            if (chessMode !== 'training' || !textoEstado) return;
            desbloquearConquistaXadrez('firstGame', true);
            const brancasVenceram = /brancas/i.test(textoEstado);
            if (brancasVenceram) {
                desbloquearConquistaXadrez('firstWin');
                if (diff === 'aprender') desbloquearConquistaXadrez('learnWin');
                if (diff === 'medio') desbloquearConquistaXadrez('winMedium');
                if (diff === 'dificil') desbloquearConquistaXadrez('winHard');
            }
            if (/Xeque-mate/i.test(textoEstado) && brancasVenceram) desbloquearConquistaXadrez('firstCheckmate');
            if ((dataRanking.streak || 0) >= 3) desbloquearConquistaXadrez('streak3');
            if ((dataRanking.points || 0) >= 100) desbloquearConquistaXadrez('points100');
        }

        function esconderResultadoAntigoXadrezSeguro() {
            const panel = document.getElementById('chess-result-panel');
            if (panel) {
                panel.style.display = 'none';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.className = 'chess-result-panel';
            }
            const modaisAntigos = ['ta-chess-result-modal', 'ta-chess-result-modal-final'];
            modaisAntigos.forEach((id) => {
                const m = document.getElementById(id);
                if (m) {
                    m.classList.remove('is-open');
                    m.style.display = 'none';
                    m.style.visibility = 'hidden';
                    m.style.opacity = '0';
                    m.setAttribute('aria-hidden', 'true');
                }
            });
            document.body.classList.remove('ta-chess-result-open', 'ta-result-modal-central-active', 'ta-result-modal-final-active');
        }

        function garantirModalResultadoXadrezSeguro() {
            let modal = document.getElementById('ta-chess-result-modal-safe');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'ta-chess-result-modal-safe';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="ta-safe-result-card" role="dialog" aria-modal="true" aria-label="Resultado do Xadrez">
                    <div class="ta-safe-result-icon" id="ta-safe-result-icon">🏆</div>
                    <div class="ta-safe-result-title" id="ta-safe-result-title">Partida encerrada</div>
                    <div class="ta-safe-result-text" id="ta-safe-result-text">A partida terminou.</div>
                    <div class="ta-safe-result-actions">
                        <button id="ta-safe-result-again-btn" type="button">Jogar novamente</button>
                        <button id="ta-safe-result-menu-btn" type="button">Voltar ao menu</button>
                        <button id="ta-safe-result-close-btn" type="button">Continuar olhando</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const fechar = () => fecharModalResultadoXadrezSeguro();
            document.getElementById('ta-safe-result-close-btn')?.addEventListener('click', fechar);
            document.getElementById('ta-safe-result-again-btn')?.addEventListener('click', () => {
                fecharModalResultadoXadrezSeguro();
                resetChessGame();
                focarTabuleiroXadrez(false);
            });
            document.getElementById('ta-safe-result-menu-btn')?.addEventListener('click', () => {
                fecharModalResultadoXadrezSeguro();
                ocultarTabuleiroXadrezParaMenu();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            return modal;
        }

        function fecharModalResultadoXadrezSeguro() {
            const modal = document.getElementById('ta-chess-result-modal-safe');
            if (modal) {
                modal.className = '';
                modal.classList.remove('is-open', 'win', 'loss', 'draw', 'mate');
                modal.setAttribute('aria-hidden', 'true');
            }
            document.body.classList.remove('ta-result-modal-safe-active');
            esconderResultadoAntigoXadrezSeguro();
        }

        function limparResultadoXadrez() {
            fecharModalResultadoXadrezSeguro();
            chessLastResultShown = '';
        }

        function mostrarResultadoXadrezSeTerminou(textoEstado) {
            if (!chessGameOver || !textoEstado) return;

            esconderResultadoAntigoXadrezSeguro();

            if (chessLastResultShown !== textoEstado) {
                chessLastResultShown = textoEstado;
                registrarResultadoRankingTreinoXadrez(textoEstado);
                registrarRankingGeralXadrezOnline(textoEstado);
            }

            let tipo = 'draw';
            let titulo = 'Partida empatada';
            let icone = '🤝';
            let textoAmigavel = textoEstado;
            const terminouPorMate = /Xeque-mate/i.test(textoEstado);
            if (terminouPorMate || /venceram|venceu|desistência/i.test(textoEstado)) {
                const brancasVenceram = /brancas/i.test(textoEstado);
                const pretasVenceram = /pretas/i.test(textoEstado);
                tipo = terminouPorMate ? 'mate' : 'win';
                if (chessMode === 'training') {
                    tipo = brancasVenceram ? (terminouPorMate ? 'mate' : 'win') : 'loss';
                    titulo = brancasVenceram ? 'Você venceu!' : 'A máquina venceu';
                    icone = brancasVenceram ? '🏆' : '♟️';
                    textoAmigavel = brancasVenceram
                        ? `${textoEstado} Parabéns! Você derrotou a máquina.`
                        : `${textoEstado} Continue treinando: proteja melhor o Rei e tente novamente.`;
                } else {
                    titulo = brancasVenceram ? 'Brancas venceram!' : pretasVenceram ? 'Pretas venceram!' : 'Partida finalizada';
                    icone = terminouPorMate ? '♟️' : '🏆';
                }
            }

            if (/Empate|afogamento|material insuficiente|repetição/i.test(textoEstado)) {
                tipo = 'draw';
                titulo = 'Partida empatada';
                icone = '🤝';
            }

            const modal = garantirModalResultadoXadrezSeguro();
            modal.className = `is-open ${tipo}`;
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('ta-result-modal-safe-active');

            const iconEl = document.getElementById('ta-safe-result-icon');
            const titleEl = document.getElementById('ta-safe-result-title');
            const textEl = document.getElementById('ta-safe-result-text');
            if (iconEl) iconEl.textContent = icone;
            if (titleEl) titleEl.textContent = titulo;
            if (textEl) textEl.textContent = textoAmigavel;
        }

        function dicaSelecaoPecaXadrez(peca, row, col, movimentosLegais) {
            const capturas = movimentosLegais.filter(m => m.capture).length;
            const movimentos = movimentosLegais.length - capturas;
            const exemplo = movimentosLegais.find(m => m.capture) || movimentosLegais[0] || null;
            const exemploTexto = exemplo ? ` Exemplo agora: de ${alg(row, col)} para ${alg(exemplo.row, exemplo.col)}${exemplo.capture ? ' para capturar uma peça' : ' para avançar com segurança'}.` : ' Agora essa peça não tem movimento legal.';
            return {
                texto: `${nomePeca[peca.type]} em ${alg(row, col)}. ${textoMovimentoPecaXadrez(peca.type)} Verde = andar (${movimentos}). Vermelho = capturar (${capturas}).${exemploTexto}`,
                exemplo: exemplo ? { from: { row, col }, to: { row: exemplo.row, col: exemplo.col } } : null
            };
        }

        function valorPecaTreinoXadrez(type) {
            return { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 }[type] || 0;
        }

        function valorPosicionalTreinoXadrez(peca, row, col) {
            if (!peca) return 0;
            const centro = Math.abs(3.5 - row) + Math.abs(3.5 - col);
            let bonus = Math.max(0, 7 - centro) * 3;
            const avancado = peca.color === 'black' ? row : (7 - row);

            if (peca.type === 'pawn') bonus += avancado * 7;
            if (peca.type === 'knight' || peca.type === 'bishop') {
                bonus += Math.max(0, 6 - centro) * 7;
                const casaInicial = peca.color === 'black' ? row === 0 : row === 7;
                if (casaInicial) bonus -= 16;
            }
            if (peca.type === 'rook') {
                const colunaAberta = !chessBoard.some(linha => linha[col]?.type === 'pawn');
                if (colunaAberta) bonus += 18;
            }
            if (peca.type === 'queen') {
                const saiuMuitoCedo = peca.color === 'black' ? row > 1 : row < 6;
                if (saiuMuitoCedo) bonus -= 10;
            }
            if (peca.type === 'king') {
                const linhaSegura = peca.color === 'black' ? row <= 1 : row >= 6;
                if (linhaSegura) bonus += 20;
                if (col === 6 || col === 2) bonus += 35; // rei rocado
                if (row >= 2 && row <= 5 && col >= 2 && col <= 5) bonus -= 45;
            }
            return bonus;
        }

        function avaliarMaterialTreinoXadrez(board, corMaquina = 'black') {
            let score = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r]?.[c];
                    if (!p) continue;
                    const v = valorPecaTreinoXadrez(p.type) + valorPosicionalTreinoXadrez(p, r, c);
                    score += p.color === corMaquina ? v : -v;
                }
            }
            return score;
        }

        function avaliarSegurancaReiTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            let score = 0;
            if (reiEstaEmXeque(board, adversario)) score += 95;
            if (reiEstaEmXeque(board, corMaquina)) score -= 180;

            const reiMaquina = encontrarRei(board, corMaquina);
            const reiHumano = encontrarRei(board, adversario);
            const avaliarEscudo = (king, color) => {
                if (!king) return 0;
                const dir = color === 'black' ? 1 : -1;
                let escudo = 0;
                for (const dc of [-1, 0, 1]) {
                    const r = king.row + dir;
                    const c = king.col + dc;
                    if (dentroDoTabuleiro(r, c) && board[r][c]?.type === 'pawn' && board[r][c]?.color === color) escudo += 14;
                }
                return escudo;
            };
            score += avaliarEscudo(reiMaquina, corMaquina);
            score -= avaliarEscudo(reiHumano, adversario);
            return score;
        }

        function avaliarMobilidadeTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            const mobMaquina = todosMovimentosLegais(corMaquina, board).length;
            const mobHumano = todosMovimentosLegais(adversario, board).length;
            return (mobMaquina - mobHumano) * 3;
        }

        function avaliarPecasAmeaçadasTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            let score = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r]?.[c];
                    if (!p || p.type === 'king') continue;
                    const valor = valorPecaTreinoXadrez(p.type);
                    if (p.color === corMaquina && quadradoAtacado(board, r, c, adversario)) score -= valor * 0.22;
                    if (p.color === adversario && quadradoAtacado(board, r, c, corMaquina)) score += valor * 0.18;
                }
            }
            return score;
        }

        function avaliarPosicaoTreinoXadrez(board, corMaquina = 'black') {
            const adversario = corOposta(corMaquina);
            const movMaquina = todosMovimentosLegais(corMaquina, board);
            const movAdversario = todosMovimentosLegais(adversario, board);
            if (!movAdversario.length && reiEstaEmXeque(board, adversario)) return 999999;
            if (!movMaquina.length && reiEstaEmXeque(board, corMaquina)) return -999999;
            if (!movAdversario.length && !reiEstaEmXeque(board, adversario)) return -90;
            if (!movMaquina.length && !reiEstaEmXeque(board, corMaquina)) return 0;
            return avaliarMaterialTreinoXadrez(board, corMaquina)
                + avaliarSegurancaReiTreinoXadrez(board, corMaquina)
                + avaliarMobilidadeTreinoXadrez(board, corMaquina)
                + avaliarPecasAmeaçadasTreinoXadrez(board, corMaquina);
        }

        function aplicarMovimentoTreinoEmClone(board, item, promotionType = 'queen') {
            const temp = clonarTabuleiro(board);
            if (!temp) return null;
            const peca = temp[item.from.row]?.[item.from.col];
            const promover = peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7) ? promotionType : null;
            aplicarMovimentoEmBoard(temp, item.from.row, item.from.col, item.to, { promotionType: promover });
            return temp;
        }

        function detectarMateEmUmTreinoXadrez(cor, board = chessBoard) {
            const adversario = corOposta(cor);
            const movimentos = todosMovimentosLegais(cor, board);
            for (const item of movimentos) {
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (!temp) continue;
                const respostas = todosMovimentosLegais(adversario, temp);
                if (!respostas.length && reiEstaEmXeque(temp, adversario)) return item;
            }
            return null;
        }

        function ordenarMovimentosTreinoXadrez(movimentos, board = chessBoard, corMaquina = 'black') {
            return movimentos.map(item => {
                const peca = board[item.from.row]?.[item.from.col];
                const capturada = item.to.enPassant && item.to.enPassantCapture
                    ? board[item.to.enPassantCapture.row]?.[item.to.enPassantCapture.col]
                    : board[item.to.row]?.[item.to.col];
                let ordem = 0;
                if (capturada) ordem += valorPecaTreinoXadrez(capturada.type) * 10 - valorPecaTreinoXadrez(peca?.type) * 0.4;
                if (item.to.castle) ordem += 90;
                if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) ordem += 900;
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (temp && reiEstaEmXeque(temp, corOposta(corMaquina))) ordem += 160;
                return { ...item, orderScore: ordem };
            }).sort((a, b) => b.orderScore - a.orderScore);
        }

        function minimaxTreinoXadrez(board, depth, alpha, beta, maximizando, corMaquina = 'black') {
            const corDaVez = maximizando ? corMaquina : corOposta(corMaquina);
            const movimentosBase = todosMovimentosLegais(corDaVez, board);
            if (depth === 0 || !movimentosBase.length) return avaliarPosicaoTreinoXadrez(board, corMaquina);

            const movimentos = ordenarMovimentosTreinoXadrez(movimentosBase, board, corDaVez).slice(0, depth >= 2 ? 18 : 28);
            if (maximizando) {
                let melhor = -Infinity;
                for (const item of movimentos) {
                    const temp = aplicarMovimentoTreinoEmClone(board, item);
                    if (!temp) continue;
                    const valor = minimaxTreinoXadrez(temp, depth - 1, alpha, beta, false, corMaquina);
                    melhor = Math.max(melhor, valor);
                    alpha = Math.max(alpha, valor);
                    if (beta <= alpha) break;
                }
                return melhor;
            }
            let pior = Infinity;
            for (const item of movimentos) {
                const temp = aplicarMovimentoTreinoEmClone(board, item);
                if (!temp) continue;
                const valor = minimaxTreinoXadrez(temp, depth - 1, alpha, beta, true, corMaquina);
                pior = Math.min(pior, valor);
                beta = Math.min(beta, valor);
                if (beta <= alpha) break;
            }
            return pior;
        }

        function pontuarJogadaTreinoXadrez(item, corMaquina = 'black', board = chessBoard) {
            const temp = aplicarMovimentoTreinoEmClone(board, item);
            if (!temp) return -999999;
            const peca = board[item.from.row]?.[item.from.col];
            const capturada = item.to.enPassant && item.to.enPassantCapture
                ? board[item.to.enPassantCapture.row]?.[item.to.enPassantCapture.col]
                : board[item.to.row]?.[item.to.col];
            const adversario = corOposta(corMaquina);

            let score = avaliarPosicaoTreinoXadrez(temp, corMaquina);
            if (capturada) score += valorPecaTreinoXadrez(capturada.type) * 0.45;
            if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 820;
            if (item.to.castle) score += 90;

            // Evita entregar peça importante de graça, principalmente Dama e Torre.
            if (peca && peca.type !== 'king' && quadradoAtacado(temp, item.to.row, item.to.col, adversario)) {
                const defendida = quadradoAtacado(temp, item.to.row, item.to.col, corMaquina);
                const penalidade = valorPecaTreinoXadrez(peca.type) * (defendida ? 0.28 : 0.62);
                score -= penalidade;
            }

            const mateHumanoEmUm = detectarMateEmUmTreinoXadrez(adversario, temp);
            if (mateHumanoEmUm) score -= 80000;

            const mateMaquinaEmUm = detectarMateEmUmTreinoXadrez(corMaquina, board);
            if (mateMaquinaEmUm && mateMaquinaEmUm.from.row === item.from.row && mateMaquinaEmUm.from.col === item.from.col && mateMaquinaEmUm.to.row === item.to.row && mateMaquinaEmUm.to.col === item.to.col) {
                score += 120000;
            }

            score += Math.random() * 8;
            return score;
        }

        function escolherJogadaMaquinaXadrez() {
            const movimentos = todosMovimentosLegais('black', chessBoard);
            if (!movimentos.length) return null;

            // Prioridade 1: se tiver xeque-mate em 1, a máquina finaliza.
            const mateAgora = detectarMateEmUmTreinoXadrez('black', chessBoard);
            if (mateAgora) return mateAgora;

            const avaliadosRapidos = movimentos.map(m => ({ ...m, score: pontuarJogadaTreinoXadrez(m, 'black', chessBoard) })).sort((a, b) => b.score - a.score);

            if (chessTrainingDifficulty === 'facil') {
                // Fácil continua humano: às vezes joga aleatório, mas evita entregar a dama/rei de forma absurda.
                const aceitaveis = avaliadosRapidos.filter(m => m.score > avaliadosRapidos[0].score - 900);
                const pool = Math.random() < 0.65 ? movimentos : (aceitaveis.length ? aceitaveis : avaliadosRapidos);
                return pool[Math.floor(Math.random() * pool.length)];
            }

            if (chessTrainingDifficulty === 'medio') {
                // Médio olha as melhores opções, prioriza capturas boas, defesa do rei e xeque.
                const limite = Math.max(2, Math.ceil(avaliadosRapidos.length * 0.28));
                const melhores = avaliadosRapidos.slice(0, limite);
                return melhores[Math.floor(Math.random() * melhores.length)];
            }

            // Difícil: usa uma busca curta de 2 lances para não cair em armadilhas simples.
            const candidatos = ordenarMovimentosTreinoXadrez(movimentos, chessBoard, 'black').slice(0, 18);
            let melhor = null;
            let melhorScore = -Infinity;
            for (const item of candidatos) {
                const temp = aplicarMovimentoTreinoEmClone(chessBoard, item);
                if (!temp) continue;
                let score = minimaxTreinoXadrez(temp, 2, -Infinity, Infinity, false, 'black');
                score += pontuarJogadaTreinoXadrez(item, 'black', chessBoard) * 0.08;
                if (score > melhorScore) {
                    melhorScore = score;
                    melhor = item;
                }
            }
            return melhor || avaliadosRapidos[0];
        }

        function explicarJogadaTreinoXadrez(item) {
            if (!item) return 'Não encontrei uma jogada segura agora.';
            const peca = chessBoard[item.from.row]?.[item.from.col];
            const destino = chessBoard[item.to.row]?.[item.to.col];
            const nome = nomePeca[peca?.type] || 'Peça';
            const captura = destino ? ` capturando ${nomePeca[destino.type].toLowerCase()}` : '';
            const extra = item.to.castle ? ' É uma ideia de roque para proteger o rei.' : item.to.row === 0 && peca?.type === 'pawn' ? ' Também ameaça promoção do peão.' : '';
            return `Boa ideia: mover ${nome} de ${alg(item.from.row, item.from.col)} para ${alg(item.to.row, item.to.col)}${captura}. Essa jogada melhora sua posição sem deixar o rei em xeque.${extra}`;
        }

        function atualizarDicaTreinoXadrez() {
            const texto = document.getElementById('chess-training-coach-text');
            if (!texto) return;
            if (chessMode !== 'training' || chessTurn !== chessHumanColor || chessGameOver) {
                texto.textContent = 'Aguarde sua vez para receber a próxima dica.';
                return;
            }
            const movimentos = todosMovimentosLegais(chessHumanColor, chessBoard);
            if (!movimentos.length) {
                texto.textContent = 'Você não tem movimentos legais nesta posição.';
                return;
            }
            const melhores = movimentos.map(m => ({ ...m, score: pontuarJogadaTreinoXadrez(m, chessHumanColor) })).sort((a,b)=>b.score-a.score);
            texto.textContent = explicarJogadaTreinoXadrez(melhores[0]);
        }

        async function executarJogadaMaquinaXadrez() {
            if (chessMode !== 'training' || chessGameOver || chessTurn !== 'black' || chessAiThinking) return;
            chessAiThinking = true;
            atualizarPainelTreinoXadrez();
            mostrarToastXadrez('🤖 Máquina pensando...');
            await new Promise(resolve => setTimeout(resolve, chessTrainingDifficulty === 'dificil' ? 650 : 420));
            const escolha = escolherJogadaMaquinaXadrez();
            if (!escolha) {
                chessAiThinking = false;
                avaliarEstadoDoJogo('A máquina não tem movimentos legais.');
                renderChessBoard();
                return;
            }
            await executarMovimentoXadrez(escolha.from.row, escolha.from.col, escolha.to);
            chessAiThinking = false;
            atualizarPainelTreinoXadrez();
        }

        async function iniciarTreinoXadrez(nivel = 'medio', aprender = false) {
            try { if (chessMode === 'online') await sairXadrezOnline(false); } catch (_) {}
            chessMode = 'training';
            chessTrainingActive = true;
            chessTrainingDifficulty = nivel;
            chessTrainingLearnMode = !!aprender;
            chessAiThinking = false;
            chessPlayerColor = 'white';
            chessIsSpectator = false;
            chessBoardFlipped = false;
            criarTabuleiroInicial();
            limparResultadoXadrez();
            lastMoveMessage = chessTrainingLearnMode ? 'Aprender do Zero iniciado. Clique em uma peça branca. Verde é andar, vermelho é capturar. Para comer a peça preta, clique na casa vermelha.' : `Modo Treino iniciado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas e a máquina joga com as pretas.`;
            selectedSquare = null;
            legalMoves = [];
            mostrarTabuleiroXadrezAposEscolha();
            renderChessBoard();
            atualizarPainelTreinoXadrez();
            renderRankingTreinoXadrez();
            focarTabuleiroXadrez(false);
            mostrarToastXadrez(`🤖 Modo Treino ${nomeDificuldadeTreinoXadrez()} iniciado.`);
        }

        function salvarEstadoParaDesfazer() {
            if (chessMode === 'online') return;
            undoStack.push({
                board: clonarTabuleiro(chessBoard),
                turn: chessTurn,
                gameOver: chessGameOver,
                lastMove: lastChessMove ? { ...lastChessMove } : null,
                enPassant: enPassantTarget ? { ...enPassantTarget } : null,
                history: [...moveHistory],
                message: lastMoveMessage
            });
            if (undoStack.length > 80) undoStack.shift();
        }

        function desfazerJogada() {
            const previous = undoStack.pop();
            if (!previous) {
                lastMoveMessage = 'Não há jogada para desfazer.';
                atualizarStatus();
                return;
            }
            chessBoard = clonarTabuleiro(previous.board);
            chessTurn = previous.turn;
            chessGameOver = previous.gameOver;
            lastChessMove = previous.lastMove;
            enPassantTarget = previous.enPassant;
            moveHistory = [...previous.history];
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = 'Jogada desfeita.';
            renderChessBoard();
        }

        function dentroDoTabuleiro(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }
        function nomeCor(color) { return color === 'white' ? 'brancas' : 'pretas'; }
        function nomeVencedor(color) { return color === 'white' ? 'Brancas' : 'Pretas'; }
        function corOposta(color) { return color === 'white' ? 'black' : 'white'; }
        function casaLivre(row, col, board = chessBoard) { return dentroDoTabuleiro(row, col) && !board[row][col]; }
        function casaTemAdversario(row, col, color, board = chessBoard) { return dentroDoTabuleiro(row, col) && board[row][col] && board[row][col].color !== color; }
        function alg(row, col) { return `${String.fromCharCode(97 + col)}${8 - row}`; }

        function encontrarRei(board, color) {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.color === color && p.type === 'king') return { row: r, col: c };
                }
            }
            return null;
        }

        function caminhoLivre(board, row, col, dr, dc) {
            let r = row + dr;
            let c = col + dc;
            while (dentroDoTabuleiro(r, c)) {
                if (board[r][c]) return false;
                r += dr;
                c += dc;
            }
            return true;
        }

        function quadradoAtacado(board, row, col, byColor) {
            const pawnDir = byColor === 'white' ? -1 : 1;
            for (const dc of [-1, 1]) {
                const pr = row - pawnDir;
                const pc = col - dc;
                if (dentroDoTabuleiro(pr, pc)) {
                    const p = board[pr][pc];
                    if (p && p.color === byColor && p.type === 'pawn') return true;
                }
            }

            for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                const r = row + dr;
                const c = col + dc;
                const p = dentroDoTabuleiro(r, c) ? board[r][c] : null;
                if (p && p.color === byColor && p.type === 'knight') return true;
            }

            for (const [dr, dc, types] of [
                [1,0,['rook','queen']], [-1,0,['rook','queen']], [0,1,['rook','queen']], [0,-1,['rook','queen']],
                [1,1,['bishop','queen']], [1,-1,['bishop','queen']], [-1,1,['bishop','queen']], [-1,-1,['bishop','queen']]
            ]) {
                let r = row + dr;
                let c = col + dc;
                while (dentroDoTabuleiro(r, c)) {
                    const p = board[r][c];
                    if (p) {
                        if (p.color === byColor && types.includes(p.type)) return true;
                        break;
                    }
                    r += dr;
                    c += dc;
                }
            }

            for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
                const r = row + dr;
                const c = col + dc;
                const p = dentroDoTabuleiro(r, c) ? board[r][c] : null;
                if (p && p.color === byColor && p.type === 'king') return true;
            }

            return false;
        }

        function reiEstaEmXeque(board, color) {
            const king = encontrarRei(board, color);
            if (!king) return false;
            return quadradoAtacado(board, king.row, king.col, corOposta(color));
        }

        function adicionarMovimentoSeValido(moves, row, col, color, board = chessBoard, extra = {}) {
            if (!dentroDoTabuleiro(row, col)) return false;
            const destino = board[row][col];
            if (!destino) {
                moves.push({ row, col, capture: false, ...extra });
                return true;
            }
            if (destino.color !== color) moves.push({ row, col, capture: true, ...extra });
            return false;
        }

        function movimentosLinha(row, col, color, direcoes, board = chessBoard) {
            const moves = [];
            for (const [dr, dc] of direcoes) {
                let r = row + dr;
                let c = col + dc;
                while (dentroDoTabuleiro(r, c)) {
                    const continuar = adicionarMovimentoSeValido(moves, r, c, color, board);
                    if (!continuar) break;
                    r += dr;
                    c += dc;
                }
            }
            return moves;
        }

        function adicionarRoques(row, col, color, board, moves) {
            const king = board[row][col];
            if (!king || king.type !== 'king' || king.moved) return;
            if (reiEstaEmXeque(board, color)) return;

            const opponent = corOposta(color);

            const tryCastle = (side) => {
                const rookCol = side === 'king' ? 7 : 0;
                const rookToCol = side === 'king' ? 5 : 3;
                const kingToCol = side === 'king' ? 6 : 2;
                const emptyCols = side === 'king' ? [5, 6] : [1, 2, 3];
                const safeCols = side === 'king' ? [5, 6] : [3, 2];
                const rook = board[row][rookCol];

                if (!rook || rook.color !== color || rook.type !== 'rook' || rook.moved) return;
                if (emptyCols.some(c => board[row][c])) return;
                if (safeCols.some(c => quadradoAtacado(board, row, c, opponent))) return;

                moves.push({
                    row,
                    col: kingToCol,
                    capture: false,
                    castle: side,
                    rookFrom: { row, col: rookCol },
                    rookTo: { row, col: rookToCol }
                });
            };

            tryCastle('king');
            tryCastle('queen');
        }

        function calcularMovimentosBasicos(row, col, board = chessBoard, incluirRoque = true) {
            const peca = board[row]?.[col];
            if (!peca) return [];
            const { color, type } = peca;
            const moves = [];

            if (type === 'pawn') {
                const dir = color === 'white' ? -1 : 1;
                const startRow = color === 'white' ? 6 : 1;

                if (casaLivre(row + dir, col, board)) {
                    moves.push({ row: row + dir, col, capture: false });
                    if (row === startRow && casaLivre(row + dir * 2, col, board)) {
                        moves.push({ row: row + dir * 2, col, capture: false, doublePawn: true });
                    }
                }

                for (const dc of [-1, 1]) {
                    if (casaTemAdversario(row + dir, col + dc, color, board)) {
                        moves.push({ row: row + dir, col: col + dc, capture: true });
                    }
                }

                if (enPassantTarget && enPassantTarget.color !== color) {
                    if (row === enPassantTarget.pawnRow && Math.abs(col - enPassantTarget.pawnCol) === 1) {
                        const targetRow = row + dir;
                        if (targetRow === enPassantTarget.row && enPassantTarget.col === enPassantTarget.pawnCol) {
                            moves.push({
                                row: enPassantTarget.row,
                                col: enPassantTarget.col,
                                capture: true,
                                enPassant: true,
                                enPassantCapture: { row: enPassantTarget.pawnRow, col: enPassantTarget.pawnCol }
                            });
                        }
                    }
                }

                return moves;
            }

            if (type === 'rook') return movimentosLinha(row, col, color, [[1,0],[-1,0],[0,1],[0,-1]], board);
            if (type === 'bishop') return movimentosLinha(row, col, color, [[1,1],[1,-1],[-1,1],[-1,-1]], board);
            if (type === 'queen') return movimentosLinha(row, col, color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], board);

            if (type === 'knight') {
                for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
                    adicionarMovimentoSeValido(moves, row + dr, col + dc, color, board);
                }
                return moves;
            }

            if (type === 'king') {
                for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
                    adicionarMovimentoSeValido(moves, row + dr, col + dc, color, board);
                }
                if (incluirRoque) adicionarRoques(row, col, color, board, moves);
                return moves;
            }

            return moves;
        }

        function aplicarMovimentoEmBoard(board, fromRow, fromCol, move, options = {}) {
            const peca = board[fromRow][fromCol];
            if (!peca) return board;

            board[move.row][move.col] = { ...peca, moved: true };
            board[fromRow][fromCol] = null;

            if (move.enPassant && move.enPassantCapture) {
                board[move.enPassantCapture.row][move.enPassantCapture.col] = null;
            }

            if (move.castle && move.rookFrom && move.rookTo) {
                const rook = board[move.rookFrom.row][move.rookFrom.col];
                if (rook) {
                    board[move.rookTo.row][move.rookTo.col] = { ...rook, moved: true };
                    board[move.rookFrom.row][move.rookFrom.col] = null;
                }
            }

            if (options.promotionType && peca.type === 'pawn' && (move.row === 0 || move.row === 7)) {
                board[move.row][move.col] = { color: peca.color, type: options.promotionType, moved: true };
            }

            return board;
        }

        function calcularMovimentosLegais(row, col, board = chessBoard) {
            const peca = board[row]?.[col];
            if (!peca) return [];
            const pseudo = calcularMovimentosBasicos(row, col, board, true);
            return pseudo.filter(move => {
                const temp = clonarTabuleiro(board);
                aplicarMovimentoEmBoard(temp, row, col, move);
                return !reiEstaEmXeque(temp, peca.color);
            });
        }

        function todosMovimentosLegais(color, board = chessBoard) {
            let moves = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.color === color) {
                        moves = moves.concat(calcularMovimentosLegais(r, c, board).map(m => ({ from: { row: r, col: c }, to: m })));
                    }
                }
            }
            return moves;
        }

        function avaliarEstadoDoJogo(mensagemBase = '') {
            const emXeque = reiEstaEmXeque(chessBoard, chessTurn);
            const movimentos = todosMovimentosLegais(chessTurn, chessBoard);
            if (movimentos.length === 0 && emXeque) {
                chessGameOver = true;
                return `Xeque-mate! ${nomeVencedor(corOposta(chessTurn))} venceram.`;
            }
            if (movimentos.length === 0 && !emXeque) {
                chessGameOver = true;
                return 'Empate por afogamento: o jogador da vez não tem movimento legal.';
            }

            // REGRA PROFISSIONAL ONLINE:
            // Xeque não termina a partida. O jogador em xeque só pode fazer uma jogada legal
            // que defenda o rei, mas no modo online não mostramos aviso vermelho nem entregamos
            // dica de que o rei está em xeque. Isso evita ajuda visual ao adversário/jogador.
            if (emXeque) {
                if (chessMode === 'online') return mensagemBase || '';
                return `${mensagemBase ? mensagemBase + ' ' : ''}Xeque no rei das ${nomeCor(chessTurn)}.`;
            }
            return mensagemBase || '';
        }


        function mostrarToastXadrez(texto, tipo = 'info') {
            const toast = document.getElementById('chess-toast');
            if (!toast) return;
            toast.textContent = texto;
            toast.className = 'chess-toast show';
            if (tipo === 'check') toast.style.borderColor = 'rgba(239,68,68,.75)';
            else if (tipo === 'mate') toast.style.borderColor = 'rgba(250,204,21,.85)';
            else toast.style.borderColor = 'rgba(56,189,248,.35)';
            clearTimeout(mostrarToastXadrez._t);
            mostrarToastXadrez._t = setTimeout(() => toast.classList.remove('show'), 3600);
        }

        function atualizarStatus(mensagemExtra = null) {
            const status = document.getElementById('chess-status');
            if (!status) return;

            status.classList.remove('chess-status-check', 'chess-status-mate', 'chess-status-draw');

            const textoEstado = avaliarEstadoDoJogo(mensagemExtra ?? lastMoveMessage);
            const textoFinal = chessGameOver
                ? textoEstado
                : `Vez das ${nomeCor(chessTurn)}.${textoEstado ? ' ' + textoEstado : ''}`;

            status.textContent = textoFinal;

            if (/Xeque-mate/i.test(textoFinal)) status.classList.add('chess-status-mate');
            else if (/Empate|afogamento/i.test(textoFinal)) status.classList.add('chess-status-draw');
            else if (/Xeque/i.test(textoFinal)) status.classList.add('chess-status-check');

            mostrarResultadoXadrezSeTerminou(textoEstado || textoFinal);

            const onlinePill = chessMode === 'online' ? ` <span class="chess-status-online-pill">ONLINE ${chessIsSpectator ? 'ESPECTADOR' : (chessPlayerColor === 'white' ? 'BRANCAS' : 'PRETAS')}</span>` : '';
            if (onlinePill) status.innerHTML = escapeHtmlXadrez(textoFinal) + onlinePill;

            const undo = document.getElementById('chess-undo-btn');
            if (undo) undo.disabled = chessMode === 'online' || undoStack.length === 0;
            atualizarPainelOnlineXadrez();
        }

        function renderHistorico() {
            const panel = document.getElementById('chess-history-panel');
            const list = document.getElementById('chess-history-list');
            const btn = document.getElementById('chess-history-toggle-btn');
            if (!list) return;

            if (panel) panel.classList.toggle('chess-history-collapsed', !chessHistoryPanelOpen);
            if (btn) btn.textContent = chessHistoryPanelOpen ? 'Ocultar jogadas' : 'Ver jogadas';

            if (!moveHistory.length) {
                list.innerHTML = '<div class="chess-history-empty">Nenhuma jogada ainda. Quando a partida começar, as jogadas aparecerão aqui.</div>';
                return;
            }

            const pares = [];
            for (let i = 0; i < moveHistory.length; i += 2) {
                const n = Math.floor(i / 2) + 1;
                const whiteMove = moveHistory[i] || '';
                const blackMove = moveHistory[i + 1] || '';
                pares.push(`
                    <div class="chess-history-row">
                        <span class="chess-history-move-no">${n}.</span>
                        <div class="chess-history-turns">
                            <span class="chess-history-white">⚪ ${escapeHtmlXadrez(whiteMove || 'Aguardando jogada das brancas...')}</span>
                            ${blackMove ? `<span class="chess-history-black">⚫ ${escapeHtmlXadrez(blackMove)}</span>` : '<span class="chess-history-black">⚫ Aguardando resposta das pretas...</span>'}
                        </div>
                    </div>
                `);
            }
            list.innerHTML = pares.slice(-40).join('');
            list.scrollTop = list.scrollHeight;
        }

        function atualizarCoordenadasXadrez() {
            const letras = chessBoardFlipped ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H'];
            const numeros = chessBoardFlipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
            document.querySelectorAll('#chess-screen .chess-coords-top span, #chess-screen .chess-coords-bottom span').forEach((el, i) => { el.textContent = letras[i] || ''; });
            document.querySelectorAll('#chess-screen .chess-coords-left span, #chess-screen .chess-coords-right span').forEach((el, i) => { el.textContent = numeros[i] || ''; });
            const btn = document.getElementById('chess-flip-btn');
            if (btn) btn.textContent = chessBoardFlipped ? 'Visão pretas' : 'Visão brancas';
        }

        function alternarVisaoTabuleiroXadrez() {
            chessBoardFlipped = !chessBoardFlipped;
            selectedSquare = null;
            legalMoves = [];
            lastMoveMessage = chessBoardFlipped
                ? 'Tabuleiro virado: visão das pretas ativada.'
                : 'Tabuleiro normal: visão das brancas ativada.';
            renderChessBoard();
            mostrarToastXadrez(chessBoardFlipped ? '🔄 Visão das pretas ativada.' : '🔄 Visão das brancas ativada.');
        }

        function renderChessBoard() {
            const boardEl = document.getElementById('chess-board');
            if (!boardEl) return;
            document.body.classList.toggle('chess-mode-online', chessMode === 'online');
            document.body.classList.toggle('chess-mode-training', chessMode === 'training');
            const freezeOnlineViewport = chessMode === 'online' && document.body.classList.contains('chess-board-visible') && window.__chessRemoteApplyingXadrez30 === true;
            const savedOnlineScrollY = freezeOnlineViewport ? window.scrollY : null;
            const boardRectBefore = boardEl.getBoundingClientRect();
            const shouldKeepBoardStill = chessMode !== 'online' && !freezeOnlineViewport && document.body.classList.contains('chess-selected') && boardRectBefore.top > -80 && boardRectBefore.top < window.innerHeight;
            garantirTabuleiroXadrezPronto('Tabuleiro restaurado automaticamente. Entre em uma sala nova ou clique em Nova Partida se a sala antiga estava vazia.');
            boardEl.innerHTML = '';
            boardEl.style.display = 'grid';
            boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
            boardEl.style.gridTemplateRows = 'repeat(8, 1fr)';
            boardEl.style.width = '100%';
            boardEl.style.aspectRatio = '1 / 1';
            const reiEmXeque = reiEstaEmXeque(chessBoard, chessTurn);
            const kingPos = reiEmXeque ? encontrarRei(chessBoard, chessTurn) : null;

            atualizarCoordenadasXadrez();

            for (let displayRow = 0; displayRow < 8; displayRow++) {
                for (let displayCol = 0; displayCol < 8; displayCol++) {
                    const row = chessBoardFlipped ? 7 - displayRow : displayRow;
                    const col = chessBoardFlipped ? 7 - displayCol : displayCol;
                    const square = document.createElement('div');
                    square.className = `chess-square ${(row + col) % 2 === 0 ? 'chess-light' : 'chess-dark'}`;
                    square.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863';
                    square.style.minWidth = '0';
                    square.style.minHeight = '0';
                    square.dataset.row = String(row);
                    square.dataset.col = String(col);
                    square.setAttribute('role', 'button');
                    square.setAttribute('aria-label', `Casa ${alg(row, col)}`);

                    const mostrarAjudasVisuaisXadrez = chessMode === 'training' || (chessProfessorPrivadoAtivo && chessMode === 'online');
                    const mostrarProfessorAprenderXadrez = chessMode === 'training' && chessTrainingLearnMode;

                    if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) square.classList.add('selected');
                    if (mostrarProfessorAprenderXadrez && chessLearnExampleMove && chessLearnExampleMove.from && chessLearnExampleMove.from.row === row && chessLearnExampleMove.from.col === col) square.classList.add('learn-example-from');
                    if (mostrarProfessorAprenderXadrez && chessLearnExampleMove && chessLearnExampleMove.to && chessLearnExampleMove.to.row === row && chessLearnExampleMove.to.col === col) square.classList.add('learn-example-to');
                    if (mostrarAjudasVisuaisXadrez && lastChessMove && lastChessMove.from.row === row && lastChessMove.from.col === col) square.classList.add('last-from');
                    if (mostrarAjudasVisuaisXadrez && lastChessMove && lastChessMove.to.row === row && lastChessMove.to.col === col) square.classList.add('last-to');
                    if (mostrarAjudasVisuaisXadrez && kingPos && kingPos.row === row && kingPos.col === col) square.classList.add('check');

                    const move = legalMoves.find(m => m.row === row && m.col === col);
                    if (move && mostrarAjudasVisuaisXadrez) {
                        square.classList.add(move.capture ? 'capture' : 'legal');
                        if (move.castle) square.classList.add('castle');
                        if (move.enPassant) square.classList.add('en-passant');
                    }

                    const peca = chessBoard[row]?.[col] || null;
                    if (pecaXadrezValida(peca)) {
                        const span = document.createElement('span');
                        span.className = `chess-piece ${peca.color}`;
                        span.style.fontSize = 'clamp(2rem, 8vw, 3.7rem)';
                        span.style.lineHeight = '1';
                        span.style.position = 'relative';
                        span.style.zIndex = '2';
                        span.style.color = peca.color === 'white' ? '#ffffff' : '#111827';
                        span.dataset.name = nomePeca[peca.type] || '';
                        span.title = `${nomePeca[peca.type] || 'Peça'} ${peca.color === 'white' ? 'branca' : 'preta'}`;
                        span.textContent = pecasUnicode[peca.color]?.[peca.type] || '';
                        square.appendChild(span);
                    }

                    square.addEventListener('click', () => handleChessSquareClick(row, col));
                    boardEl.appendChild(square);
                }
            }
            renderHistorico();
            renderizarPlacarMaterialXadrez();
            atualizarStatus();
            if (freezeOnlineViewport) {
                requestAnimationFrame(() => {
                    if (typeof savedOnlineScrollY === 'number' && Math.abs(window.scrollY - savedOnlineScrollY) > 1) {
                        window.scrollTo({ top: savedOnlineScrollY, behavior: 'auto' });
                    }
                });
            } else if (shouldKeepBoardStill) {
                requestAnimationFrame(() => {
                    const boardRectAfter = boardEl.getBoundingClientRect();
                    const diff = boardRectAfter.top - boardRectBefore.top;
                    if (Math.abs(diff) > 1 && Math.abs(diff) < window.innerHeight) {
                        window.scrollTo({ top: window.scrollY + diff, behavior: 'auto' });
                    }
                });
            }
        }


        function estadoXadrezParaFirebase() {
            return {
                board: serializarTabuleiroXadrezParaFirebase(chessBoard),
                turn: chessTurn,
                gameOver: chessGameOver,
                lastMoveMessage,
                lastChessMove,
                enPassantTarget,
                moveHistory,
                updatedAt: Date.now()
            };
        }

        async function publicarEstadoXadrezOnline(extra = {}) {
            if (chessMode !== 'online' || !chessRoomRef || chessOnlineSyncing) return;
            try {
                await update(chessRoomRef, { ...estadoXadrezParaFirebase(), ...extra });
            } catch (e) {
                console.warn('Erro ao sincronizar Xadrez online:', e);
                mostrarToastXadrez('⚠️ Não consegui sincronizar a jogada online.', 'check');
            }
        }

        function aplicarEstadoXadrezRemoto(data) {
            if (!data) return;
            chessCurrentRoomData = data || {};
            chessOnlineSyncing = true;
            chessRoomPlayers = data.players && typeof data.players === 'object' ? data.players : { white: null, black: null };
            chessRoomSpectators = data.spectators && typeof data.spectators === 'object' ? data.spectators : {};

            const remotoLimpo = clonarTabuleiro(data.board);
            if (remotoLimpo && !tabuleiroXadrezPrecisaRestaurar(remotoLimpo)) {
                chessBoard = remotoLimpo;
            } else {
                // ✅ PROFISSIONAL 18: espectador nunca repara a sala no Firebase.
                // Se por algum motivo o snapshot vier incompleto, ele apenas aguarda nova sincronização.
                if (chessIsSpectator) {
                    lastMoveMessage = data.lastMoveMessage || 'Aguardando sincronização do tabuleiro online.';
                } else {
                    criarTabuleiroInicial();
                    lastMoveMessage = 'A sala online estava sem peças ou sem tabuleiro válido. O Xadrez restaurou a posição inicial automaticamente.';
                    if (chessRoomRef) {
                        setTimeout(() => {
                            try {
                                update(chessRoomRef, { ...estadoXadrezParaFirebase(), repairedAt: Date.now() });
                            } catch (e) {
                                console.warn('Não consegui reparar a sala online no Firebase:', e);
                            }
                        }, 80);
                    }
                }
            }

            chessTurn = data.turn === 'black' ? 'black' : 'white';
            chessGameOver = !!data.gameOver;
            if (data.lastMoveMessage) lastMoveMessage = data.lastMoveMessage;
            lastChessMove = data.lastChessMove || null;
            enPassantTarget = data.enPassantTarget || null;
            moveHistory = Array.isArray(data.moveHistory) ? data.moveHistory : [];
            selectedSquare = null;
            legalMoves = [];
            verificarAlertaDeVezXadrez(data);
            renderChessBoard();
            chessOnlineSyncing = false;
        }

        async function garantirAuthXadrezOnline() {
            try {
                if (typeof auth !== 'undefined' && auth.currentUser) {
                    playerId = auth.currentUser.uid;
                    return true;
                }

                if (typeof signInAnonymously === 'function' && typeof auth !== 'undefined') {
                    const cred = await signInAnonymously(auth);
                    playerId = cred?.user?.uid || auth.currentUser?.uid || playerId;
                    return !!playerId;
                }
            } catch (e) {
                console.warn('Auth do Xadrez online ainda não disponível:', e);
            }

            return !!getChessUid();
        }



        /* ✅ FASE 36.12 - FUNÇÕES DIRETAS: controles online dentro do tabuleiro real */
        function controlesOnlineXadrezAtivos3612() {
            return chessMode === 'online' && !!chessRoomId && document.body.classList.contains('chess-board-visible') && !chessIsSpectator;
        }

        function garantirControlesOnlineNoTabuleiro3612(forcarOnline = false) {
            const online = !!forcarOnline || controlesOnlineXadrezAtivos3612();
            document.body.classList.toggle('chess-online-active-3612', online);

            const actions = document.querySelector('#chess-screen .chess-actions');
            const back = document.getElementById('chess-back-btn-bottom');
            if (actions) {
                let sair = document.getElementById('chess-board-leave-online-btn');
                if (!sair) {
                    sair = document.createElement('button');
                    sair.id = 'chess-board-leave-online-btn';
                    sair.className = 'btn-chess-leave-online-board';
                    sair.type = 'button';
                    sair.textContent = 'Sair da sala';
                }
                if (sair.parentNode !== actions) {
                    if (back && back.parentNode === actions) actions.insertBefore(sair, back);
                    else actions.appendChild(sair);
                }
                sair.disabled = !online;
                sair.style.setProperty('display', online ? 'block' : 'none', 'important');
                sair.style.setProperty('visibility', online ? 'visible' : 'hidden', 'important');
                sair.style.setProperty('opacity', online ? '1' : '0', 'important');
            }

            const callPanel = document.getElementById('chess-call-panel');
            const chatPanel = document.getElementById('chess-chat-panel');
            if (callPanel && actions) {
                const parent = actions.parentNode;
                if (parent) {
                    if (chatPanel && chatPanel.parentNode === parent) parent.insertBefore(callPanel, chatPanel);
                    else if (callPanel.previousElementSibling !== actions) actions.insertAdjacentElement('afterend', callPanel);
                }
                callPanel.classList.remove('fase36-call-panel', 'fase36-call-open', 'fase35-call-panel', 'fase35-call-open', 'fase34-call-closed');
                if (!callPanel.classList.contains('call-active')) callPanel.classList.add('call-compact');
                ['left','right','top','bottom','transform','position','zIndex','width','maxWidth'].forEach((prop) => {
                    try { callPanel.style[prop] = ''; } catch (_) {}
                });
                const title = callPanel.querySelector('.chess-call-title');
                if (title) title.textContent = '📹 Câmera e áudio';
                const status = document.getElementById('chess-call-status');
                if (status && !callPanel.classList.contains('call-active')) status.textContent = 'Fica abaixo do tabuleiro e não cobre as peças.';
                const toggle = document.getElementById('chess-call-toggle-btn');
                if (toggle) {
                    toggle.style.display = '';
                    toggle.textContent = callPanel.classList.contains('call-compact') && !callPanel.classList.contains('call-active') ? '+' : '−';
                }
                callPanel.style.setProperty('display', online ? 'block' : 'none', 'important');
                callPanel.style.setProperty('visibility', online ? 'visible' : 'hidden', 'important');
                callPanel.style.setProperty('opacity', online ? '1' : '0', 'important');
            }
        }

        async function entrarXadrezOnline(assistir = false) {
            instalarUiXadrezFase5();

            const nameInput = document.getElementById('chess-online-name');
            const roomInput = document.getElementById('chess-online-room');

            chessPlayerName = normalizarCampoXadrez(nameInput?.value) || normalizarCampoXadrez(document.getElementById('name-input')?.value) || 'Jogador';
            chessRoomId = normalizarSalaXadrez(roomInput?.value) || 'xadrez';

            if (nameInput) nameInput.value = chessPlayerName;
            if (roomInput) roomInput.value = chessRoomId;

            try {
                atualizarStatusOnlineXadrez('Conectando ao Xadrez online...');

                await garantirAuthXadrezOnline();
                const uid = getChessUid();
                if (!uid) throw new Error('Não consegui gerar o ID do jogador.');

                // Sai de qualquer escuta antiga antes de entrar em uma nova sala.
                sairXadrezOnline(false);

                chessMode = 'online';
                chessIsSpectator = assistir;
                chessPlayerColor = 'spectator';
                chessOnlineReady = false;
                chessRoomRef = ref(db, `chessRooms/${chessRoomId}`);
                chessLastRemoteMoveCount = 0;
                chessLastTurnAlertKey = '';

                const agora = Date.now();
                const snap = await get(chessRoomRef);
                let sala = snap.exists() && snap.val() && typeof snap.val() === 'object' ? snap.val() : {};

                sala.createdAt = sala.createdAt || agora;
                sala.updatedAt = agora;
                sala.mode = 'xadrez';

                // ✅ PROFISSIONAL 18: espectador nunca pode restaurar/resetar tabuleiro.
                // Antes, ao assistir uma sala em andamento, o sistema validava a sala e podia escrever
                // o tabuleiro inicial novamente. Agora somente jogador/admin pode reparar sala quebrada.
                const boardLimpoDaSala = clonarTabuleiro(sala.board);
                if (!boardLimpoDaSala || tabuleiroXadrezPrecisaRestaurar(boardLimpoDaSala)) {
                    if (!assistir) {
                        criarTabuleiroInicial();
                        const estado = estadoXadrezParaFirebase();
                        sala.board = estado.board;
                        sala.turn = estado.turn;
                        sala.gameOver = false;
                        sala.lastMoveMessage = 'Sala criada/restaurada com o tabuleiro inicial do Xadrez. Fase 12 online ativa.';
                        sala.lastChessMove = null;
                        sala.enPassantTarget = null;
                        sala.moveHistory = [];
                        sala.repairedAt = agora;
                    }
                } else {
                    sala.board = boardLimpoDaSala;
                }

                sala.players = sala.players && typeof sala.players === 'object' ? sala.players : {};
                sala.spectators = sala.spectators && typeof sala.spectators === 'object' ? sala.spectators : {};

                if (sala.isAuthorized === false && !(await usuarioEhAdminSeguro())) {
                    chessMode = 'local';
                    chessRoomRef = null;
                    chessOnlineReady = false;
                    atualizarPainelOnlineXadrez();
                    mostrarToastXadrez('🛡️ Esta sala de Xadrez está bloqueada pelo administrador.', 'check');
                    return;
                }

                // Limpa o próprio usuário de posições antigas dentro da mesma sala.
                if (sala.players.white?.id === uid) delete sala.players.white;
                if (sala.players.black?.id === uid) delete sala.players.black;
                if (sala.spectators[uid]) delete sala.spectators[uid];

                if (assistir) {
                    chessPlayerColor = 'spectator';
                    chessIsSpectator = true;
                    sala.spectators[uid] = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else if (!sala.players.white || !sala.players.white.id) {
                    chessPlayerColor = 'white';
                    chessIsSpectator = false;
                    sala.players.white = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else if (!sala.players.black || !sala.players.black.id) {
                    chessPlayerColor = 'black';
                    chessIsSpectator = false;
                    sala.players.black = { id: uid, name: chessPlayerName, connectedAt: agora };
                } else {
                    chessPlayerColor = 'spectator';
                    chessIsSpectator = true;
                    sala.spectators[uid] = { id: uid, name: chessPlayerName, connectedAt: agora };
                    mostrarToastXadrez('👀 Sala cheia. Você entrou como espectador.');
                }

                if (chessPlayerColor === 'black') chessBoardFlipped = true;
                else if (chessPlayerColor === 'white') chessBoardFlipped = false;
                atualizarCoordenadasXadrez();

                chessRoomPlayers = sala.players;
                chessRoomSpectators = sala.spectators;
                if (!sala.lastMoveMessage || /^Fase 5/i.test(String(sala.lastMoveMessage))) {
                    sala.lastMoveMessage = 'Fase 12 ativa: sala online com painel Admin próprio, controle de salas, desistência, visão das pretas, alerta de vez, chat, histórico e placar.';
                }

                // ✅ PROFISSIONAL 18: quem entra como espectador só grava presença em /spectators.
                // Não usamos set() na sala inteira, porque isso pode sobrescrever board/turn/moveHistory
                // e reiniciar a partida dos jogadores que já estavam jogando.
                if (chessIsSpectator) {
                    await update(chessRoomRef, {
                        [`spectators/${uid}`]: { id: uid, name: chessPlayerName, connectedAt: agora },
                        updatedAt: agora,
                        mode: 'xadrez'
                    });
                } else {
                    await set(chessRoomRef, sala);
                }

                try {
                    if (chessPlayerColor === 'white' || chessPlayerColor === 'black') {
                        onDisconnect(ref(db, `chessRooms/${chessRoomId}/players/${chessPlayerColor}`)).remove();
                    } else {
                        onDisconnect(ref(db, `chessRooms/${chessRoomId}/spectators/${uid}`)).remove();
                    }
                } catch (presenceError) {
                    console.warn('Presença online do Xadrez não registrada:', presenceError);
                }

                chessUnsubscribeRoom = onValue(chessRoomRef, (snapshot) => {
                    const data = snapshot.val() || {};
                    aplicarEstadoXadrezRemoto(data);
                    atualizarPainelOnlineXadrez();
                    atualizarPainelChamadaXadrez();
                    setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 0);
                });

                iniciarChatXadrezOnline();
                chessOnlineReady = true;
                atualizarPainelOnlineXadrez();
                atualizarPainelChamadaXadrez();
                if (!chessIsSpectator) escutarSinalizacaoChamadaXadrez();
                mostrarToastXadrez(`🌐 Conectado na sala ${chessRoomId}. Você está como ${chessIsSpectator ? 'espectador' : nomeCor(chessPlayerColor)}.`);
                mostrarTabuleiroXadrezAposEscolha();
                garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator);
                setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 120);
                setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 700);
                focarTabuleiroXadrez(true);
            } catch (e) {
                console.error('Erro detalhado ao entrar no Xadrez online:', e);
                chessMode = 'local';
                chessRoomRef = null;
                chessOnlineReady = false;
                chessIsSpectator = false;
                chessPlayerColor = 'white';
                atualizarPainelOnlineXadrez();
                const detalheErroXadrez = e?.code || e?.message || 'erro desconhecido';
                mostrarToastXadrez(`⚠️ Erro ao entrar no Xadrez online: ${detalheErroXadrez}`, 'check');
            }
        }

        function sairXadrezOnline(mostrarMensagem = true) {
            try { encerrarChamadaXadrez(false); } catch (_) {}
            try {
                if (chessUnsubscribeRoom) chessUnsubscribeRoom();
                if (chessUnsubscribeChat) chessUnsubscribeChat();
                chessUnsubscribeRoom = null;
                chessUnsubscribeChat = null;
                const uid = getChessUid();
                if (chessRoomId && chessMode === 'online') {
                    if (chessPlayerColor === 'white' || chessPlayerColor === 'black') remove(ref(db, `chessRooms/${chessRoomId}/players/${chessPlayerColor}`));
                    if (chessIsSpectator) remove(ref(db, `chessRooms/${chessRoomId}/spectators/${uid}`));
                }
            } catch (e) { console.warn('Erro ao sair do Xadrez online:', e); }
            chessMode = 'local';
            chessRoomRef = null;
            chessOnlineReady = false;
            chessIsSpectator = false;
            chessPlayerColor = 'white';
            chessRoomPlayers = { white: null, black: null };
            chessRoomSpectators = {};
            chessLastRemoteMoveCount = 0;
            chessLastTurnAlertKey = '';
            atualizarPainelOnlineXadrez();
            atualizarPainelChamadaXadrez();
            if (mostrarMensagem) {
                ocultarTabuleiroXadrezParaMenu();
                mostrarToastXadrez('Modo local ativado. Você saiu da sala online. Escolha um modo para abrir o tabuleiro novamente.');
            }
        }

        function iniciarChatXadrezOnline() {
            const box = document.getElementById('chess-chat-messages');
            if (!box || !chessRoomId) return;
            if (chessUnsubscribeChat) chessUnsubscribeChat();
            chessUnsubscribeChat = onValue(ref(db, `chessRooms/${chessRoomId}/chat`), (snap) => {
                const data = snap.val() || {};
                const msgs = Object.values(data).sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-60);
                if (!msgs.length) {
                    box.innerHTML = '<div class="chess-chat-row"><strong>Sistema:</strong> Nenhuma mensagem ainda.</div>';
                    return;
                }
                box.innerHTML = msgs.map(m => `<div class="chess-chat-row"><strong>${escapeHtmlXadrez(m.name || 'Jogador')}:</strong> ${escapeHtmlXadrez(m.text || '')}</div>`).join('');
                box.scrollTop = box.scrollHeight;
            });
        }

        async function enviarChatXadrezOnline() {
            const input = document.getElementById('chess-chat-input');
            if (!input || chessMode !== 'online' || !chessRoomId) return;
            const text = input.value.trim();
            if (!text) return;
            if (chessCurrentRoomData && chessCurrentRoomData.chatBlocked) {
                mostrarToastXadrez('🔇 O chat desta sala foi travado pelo administrador.', 'check');
                return;
            }
            input.value = '';
            await push(ref(db, `chessRooms/${chessRoomId}/chat`), { name: chessPlayerName || 'Jogador', text, createdAt: Date.now() });
        }

        async function reiniciarXadrezOnlineOuLocal() {
            if (chessMode !== 'online') {
                resetChessGame();
                return;
            }
            if (chessIsSpectator) {
                mostrarToastXadrez('👀 Espectador não pode reiniciar a partida.', 'check');
                return;
            }
            criarTabuleiroInicial();
            await publicarEstadoXadrezOnline({ restartedBy: chessPlayerName || chessPlayerColor, restartedAt: Date.now(), rankingResultKey: null, rankingResultRegisteredAt: null, winner: null, resignedBy: null });
            await push(ref(db, `chessRooms/${chessRoomId}/chat`), { name: 'Sistema', text: `${chessPlayerName || 'Jogador'} reiniciou a partida.`, createdAt: Date.now() });
            renderChessBoard();
            mostrarToastXadrez('♟️ Partida online reiniciada.');
        }

        async function copiarSalaXadrez() {
            const roomInput = document.getElementById('chess-online-room');
            const sala = normalizarSalaXadrez(roomInput?.value) || chessRoomId || 'xadrez';
            const texto = `♟️ Convite para jogar Xadrez Arena

Entre no Tabuleiro Arena, escolha Xadrez Arena e use a sala: ${sala}

Link: ${location.origin}${location.pathname}`;
            try {
                await navigator.clipboard.writeText(texto);
                mostrarToastXadrez('📋 Código da sala copiado.');
            } catch (_) {
                mostrarToastXadrez(`Sala: ${sala}`);
            }
        }

        function escolherPromocao(color) {
            return new Promise(resolve => {
                const modal = document.getElementById('chess-promotion-modal');
                if (!modal) return resolve('queen');

                const botoes = modal.querySelectorAll('[data-piece]');
                botoes.forEach(btn => {
                    const type = btn.getAttribute('data-piece');
                    const symbol = pecasUnicode[color][type] || '';
                    btn.firstChild.textContent = symbol;
                });

                modal.style.display = 'flex';

                const onClick = (event) => {
                    const btn = event.target.closest('[data-piece]');
                    if (!btn) return;
                    const choice = btn.getAttribute('data-piece') || 'queen';
                    modal.style.display = 'none';
                    modal.removeEventListener('click', onClick);
                    resolve(choice);
                };

                modal.addEventListener('click', onClick);
            });
        }

        function textoPecaComCor(peca) {
            if (!peca) return 'peça';
            return `${nomePeca[peca.type]} ${peca.color === 'white' ? 'branco' : 'preto'}`;
        }

        function criarRegistroHistoricoXadrez(peca, fromRow, fromCol, move, capturedPiece = null, promotionType = null, estadoDepois = '') {
            const cor = peca.color === 'white' ? 'Brancas' : 'Pretas';
            const origem = alg(fromRow, fromCol);
            const destino = alg(move.row, move.col);
            let texto = `${cor}: ${nomePeca[peca.type]} ${origem} → ${destino}`;

            if (move.castle) {
                texto = `${cor}: Rei fez ${move.castle === 'king' ? 'roque pequeno' : 'roque grande'}`;
            } else if (capturedPiece) {
                texto = `${cor}: ${nomePeca[peca.type]} ${origem} capturou ${textoPecaComCor(capturedPiece)} em ${destino}`;
            } else if (move.enPassant) {
                texto = `${cor}: Peão ${origem} capturou en passant em ${destino}`;
            }

            if (promotionType) texto += ` e virou ${nomePeca[promotionType]}`;
            if (/Xeque-mate/i.test(estadoDepois)) texto += ' — xeque-mate!';
            else if (/Xeque/i.test(estadoDepois)) texto += ' — xeque!';
            else if (/Empate|afogamento/i.test(estadoDepois)) texto += ' — empate.';

            if (chessTrainingLearnMode && peca.color === chessHumanColor) {
                if (capturedPiece) texto += ' Boa captura: você ganhou material.';
                else if (peca.type === 'pawn') texto += ' Peões ajudam a abrir caminho para as peças.';
                else if (peca.type === 'knight' || peca.type === 'bishop') texto += ' Boa ideia: desenvolver Cavalo e Bispo ajuda no começo.';
                else if (peca.type === 'king' && move.castle) texto += ' Excelente: o roque ajuda a proteger o Rei.';
            }
            return texto;
        }

        function alternarHistoricoXadrez(forcar = null) {
            const panel = document.getElementById('chess-history-panel');
            const btn = document.getElementById('chess-history-toggle-btn');
            if (typeof forcar === 'boolean') chessHistoryPanelOpen = forcar;
            else chessHistoryPanelOpen = !chessHistoryPanelOpen;
            if (panel) panel.classList.toggle('chess-history-collapsed', !chessHistoryPanelOpen);
            if (btn) btn.textContent = chessHistoryPanelOpen ? 'Ocultar jogadas' : 'Ver jogadas';
            if (chessHistoryPanelOpen) renderHistorico();
        }

        function limparHistoricoVisualXadrez() {
            const list = document.getElementById('chess-history-list');
            if (list) list.innerHTML = '<div class="chess-history-empty">Histórico visual limpo. As jogadas continuam salvas na partida.</div>';
            mostrarToastXadrez('📜 Histórico visual limpo. A partida não foi alterada.');
        }

        function criarNotacao(peca, fromRow, fromCol, move, promotionType = null) {
            if (move.castle) return move.castle === 'king' ? 'O-O' : 'O-O-O';
            const prefix = peca.type === 'pawn' ? '' : nomePeca[peca.type][0];
            const capture = move.capture ? 'x' : '-';
            const promo = promotionType ? `=${nomePeca[promotionType]}` : '';
            const ep = move.enPassant ? ' e.p.' : '';
            return `${prefix}${alg(fromRow, fromCol)}${capture}${alg(move.row, move.col)}${promo}${ep}`;
        }


        async function desistirXadrez() {
            if (chessGameOver) {
                mostrarToastXadrez('A partida já terminou.', 'check');
                return;
            }
            if (chessMode === 'online' && chessIsSpectator) {
                mostrarToastXadrez('👀 Espectador não pode desistir pela partida.', 'check');
                return;
            }

            const corDesistente = chessMode === 'online' ? chessPlayerColor : chessTurn;
            if (corDesistente !== 'white' && corDesistente !== 'black') {
                mostrarToastXadrez('Não foi possível identificar o jogador para desistir.', 'check');
                return;
            }

            exibirConfirmacao('Desistir da partida?', `Você está prestes a desistir.<br><br>As <strong>${nomeVencedor(corOposta(corDesistente))}</strong> vencerão por desistência.`, async () => {
                const vencedor = corOposta(corDesistente);
                chessGameOver = true;
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = `${chessPlayerName || nomeVencedor(corDesistente)} desistiu. ${nomeVencedor(vencedor)} venceram por desistência.`;
                moveHistory.push(`${nomeVencedor(corDesistente)} desistiram`);
                renderChessBoard();
                mostrarToastXadrez(`🏳️ ${lastMoveMessage}`, 'mate');

                await publicarEstadoXadrezOnline({
                    winner: vencedor,
                    resignedBy: {
                        color: corDesistente,
                        name: chessPlayerName || nomeVencedor(corDesistente),
                        at: Date.now()
                    }
                });
                registrarRankingGeralXadrezOnline(lastMoveMessage, { winnerOverride: vencedor, reason: 'desistencia' });
            });
            return;
        }

        async function executarMovimentoXadrez(fromRow, fromCol, move) {
            if (chessGameOver) return;
            const peca = chessBoard[fromRow][fromCol];
            if (!peca) return;

            salvarEstadoParaDesfazer();

            let promotionType = null;
            if (peca.type === 'pawn' && (move.row === 0 || move.row === 7)) {
                promotionType = (chessMode === 'training' && peca.color !== chessHumanColor) ? 'queen' : await escolherPromocao(peca.color);
            }

            const previousEnPassant = enPassantTarget;
            const capturedPiece = move.enPassant
                ? (chessBoard[fromRow] ? chessBoard[fromRow][move.col] : null)
                : (chessBoard[move.row] ? chessBoard[move.row][move.col] : null);
            aplicarMovimentoEmBoard(chessBoard, fromRow, fromCol, move, { promotionType });

            lastChessMove = { from: { row: fromRow, col: fromCol }, to: { row: move.row, col: move.col } };

            enPassantTarget = null;
            if (peca.type === 'pawn' && move.doublePawn) {
                const dir = peca.color === 'white' ? -1 : 1;
                enPassantTarget = {
                    row: fromRow + dir,
                    col: fromCol,
                    pawnRow: move.row,
                    pawnCol: move.col,
                    color: peca.color
                };
            }

            const notation = criarNotacao(peca, fromRow, fromCol, move, promotionType);
            const moverColor = peca.color;

            selectedSquare = null;
            legalMoves = [];
            chessLearnExampleMove = null;
            chessTurn = corOposta(chessTurn);

            let msg = `${nomePeca[peca.type]} ${alg(fromRow, fromCol)} para ${alg(move.row, move.col)}.`;
            if (move.castle) msg = move.castle === 'king' ? 'Roque pequeno realizado.' : 'Roque grande realizado.';
            if (move.enPassant) msg = 'Captura en passant realizada.';
            if (promotionType) msg = `Peão promovido para ${nomePeca[promotionType]}.`;
            lastMoveMessage = msg;

            // ✅ PROFISSIONAL 39 — sincronização leve antes do robô pintar o tabuleiro.
            // O professor por cores pode fazer muita coisa visual; primeiro avisamos o Firebase
            // do novo tabuleiro e da nova vez para o outro aparelho não ficar preso em “aguardando”.
            if (chessMode === 'online' && chessRoomRef && !chessOnlineSyncing) {
                try {
                    publicarEstadoXadrezOnline({ quickSync39: Date.now() });
                } catch (_) {}
            }

            renderChessBoard();
            const estado = avaliarEstadoDoJogo(msg);
            moveHistory.push(criarRegistroHistoricoXadrez(peca, fromRow, fromCol, move, capturedPiece, promotionType, estado) || notation);
            registrarConquistasPorJogadaXadrez(peca, move, capturedPiece, estado);
            renderHistorico();
            atualizarStatus();
            reforcarProfessorXequeXadrez(estado);
            if (moverColor === chessHumanColor) feedbackProfessorDepoisDaJogada(peca, fromRow, fromCol, move, estado);
            if (/Xeque-mate/i.test(estado)) mostrarToastXadrez('♟️ XEQUE-MATE! ' + estado, 'mate');
            else if (/Xeque/i.test(estado)) {
                mostrarToastXadrez('⚠️ XEQUE! ' + estado, 'check');
            }
            else if (/Empate|afogamento/i.test(estado)) mostrarToastXadrez('🤝 ' + estado, 'mate');
            else mostrarToastXadrez('✅ ' + msg);

            await publicarEstadoXadrezOnline();

            if (chessMode === 'training' && !chessGameOver && chessTurn === 'black') {
                setTimeout(() => executarJogadaMaquinaXadrez(), 260);
            } else if (chessMode === 'training') {
                atualizarPainelTreinoXadrez();
            }
        }

        async function handleChessSquareClick(row, col) {
            if (chessGameOver) return;
            if (chessMode === 'online') {
                if (chessIsSpectator) {
                    mostrarToastXadrez('👀 Espectador apenas assiste a partida.', 'check');
                    return;
                }
                if (chessPlayerColor !== chessTurn) {
                    mostrarToastXadrez(`Aguarde. Agora é a vez das ${nomeCor(chessTurn)}.`, 'check');
                    return;
                }
            }
            if (chessMode === 'training') {
                if (chessAiThinking || chessTurn !== chessHumanColor) {
                    mostrarToastXadrez('🤖 Aguarde a máquina fazer a jogada dela.', 'check');
                    return;
                }
            }

            const peca = chessBoard[row][col];

            // ✅ FASE 13.6: captura corrigida.
            // Antes o treino bloqueava o clique em peça preta antes de verificar se ela era uma captura legal.
            // Agora, se uma peça já está selecionada, primeiro tenta executar a jogada marcada.
            if (selectedSquare) {
                const move = legalMoves.find(m => m.row === row && m.col === col);
                if (move) {
                    await executarMovimentoXadrez(selectedSquare.row, selectedSquare.col, move);
                    return;
                }

                if (peca && peca.color !== chessTurn) {
                    lastMoveMessage = chessTrainingLearnMode
                        ? 'Essa peça só pode ser capturada quando estiver marcada em vermelho. Clique primeiro na sua peça branca e depois na marca vermelha.'
                        : 'Essa captura não é permitida para a peça escolhida.';
                    mostrarToastXadrez(lastMoveMessage, 'check');
                    selectedSquare = null;
                    legalMoves = [];
                    renderChessBoard();
                    return;
                }
            }

            if (chessMode === 'training' && peca && peca.color !== chessHumanColor) {
                mostrarToastXadrez('No treino você joga com as brancas. As pretas são da máquina. Para comer uma preta, selecione uma peça branca e clique na marca vermelha.', 'check');
                selectedSquare = null;
                legalMoves = [];
                renderChessBoard();
                return;
            }

            if (chessMode === 'online' && peca && peca.color !== chessPlayerColor) {
                mostrarToastXadrez(`Você está com as ${nomeCor(chessPlayerColor)}. Para capturar, selecione sua peça primeiro e clique na casa da captura.`, 'check');
                selectedSquare = null;
                legalMoves = [];
                renderChessBoard();
                return;
            }

            if (!peca) {
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = chessTrainingLearnMode
                    ? 'Clique em uma peça branca primeiro. Depois clique numa bolinha verde para andar ou numa marca vermelha para capturar.'
                    : 'Escolha uma peça da sua cor.';
                atualizarProfessorXadrez(lastMoveMessage, null);
                renderChessBoard();
                return;
            }

            if (peca.color !== chessTurn) {
                selectedSquare = null;
                legalMoves = [];
                lastMoveMessage = `Agora é a vez das ${nomeCor(chessTurn)}.`;
                renderChessBoard();
                return;
            }

            selectedSquare = { row, col };
            legalMoves = calcularMovimentosLegais(row, col, chessBoard);
            const capturas = legalMoves.filter(m => m.capture).length;
            const movimentos = legalMoves.length - capturas;
            const dicaProfessor = chessTrainingLearnMode ? dicaSelecaoPecaXadrez(peca, row, col, legalMoves) : null;
            lastMoveMessage = legalMoves.length
                ? (chessTrainingLearnMode
                    ? `${nomePeca[peca.type]} selecionado em ${alg(row, col)}. Verde = andar (${movimentos}). Vermelho = capturar (${capturas}). Clique direto na marca para jogar.`
                    : `Peça selecionada. Escolha a casa de destino para jogar.`)
                : 'Essa peça não tem movimento legal agora.';
            atualizarProfessorXadrez(dicaProfessor?.texto || '', dicaProfessor?.exemplo || null);
            renderChessBoard();
        }

        function focarTabuleiroXadrez(modoFoco = true) {
            const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
            if (modoFoco) document.body.classList.add('chess-focus-mode');
            if (boardWrap) {
                setTimeout(() => {
                    try { boardWrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    catch (_) { boardWrap.scrollIntoView(); }
                }, 120);
            }
            const btn = document.getElementById('chess-focus-btn');
            if (btn) btn.textContent = document.body.classList.contains('chess-focus-mode') ? 'Modo normal' : 'Foco no tabuleiro';
        }

        function alternarFocoTabuleiroXadrez() {
            const ativo = document.body.classList.toggle('chess-focus-mode');
            const btn = document.getElementById('chess-focus-btn');
            if (btn) btn.textContent = ativo ? 'Modo normal' : 'Foco no tabuleiro';
            focarTabuleiroXadrez(false);
        }

        function esconderPainelAdminXadrezForaDoAdmin() {
            const painelAdminXadrez = document.getElementById('chess-admin-panel');
            if (painelAdminXadrez && !document.body.classList.contains('chess-admin-only')) {
                painelAdminXadrez.style.display = 'none';
                painelAdminXadrez.setAttribute('aria-hidden', 'true');
            }
        }



        function restaurarMenuOnlineXadrez() {
            const online = document.getElementById('chess-online-panel');
            if (online) {
                online.style.display = '';
                online.removeAttribute('aria-hidden');
            }
            const status = document.getElementById('chess-online-status');
            if (status) status.style.display = '';
            const players = document.getElementById('chess-room-players-panel');
            if (players && chessMode !== 'online') players.style.display = 'none';
            const call = document.getElementById('chess-call-panel');
            if (call) call.classList.remove('online-visible', 'call-active');
        }

        function abrirXadrezArena() {
            // ✅ PROFISSIONAL 03: quando o jogador abre o Xadrez normal, o Admin do Xadrez fica fechado.
            esconderPainelAdminXadrezForaDoAdmin();
            // ✅ FASE 13.4: garante que o Xadrez comum nunca herde o modo Admin.
            // Isso evita tela vazia/travada depois de sair da administração do Xadrez.
            document.body.classList.remove('platform-start-active', 'mode-selecting', 'game-selected', 'chess-admin-only', 'chess-focus-mode', 'chess-board-visible', 'chess-game-active');
            esconderPainelAdminXadrezForaDoAdmin();
            document.body.classList.add('chess-selected', 'chess-menu-active');

            const hub = document.getElementById('games-hub-panel');
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');
            const chess = document.getElementById('chess-screen');

            if (hub) hub.style.display = 'none';
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            if (chess) chess.style.display = 'block';

            instalarUiXadrezFase5();
            restaurarMenuOnlineXadrez();
            garantirPainelPublicoTorneiosXadrez();
            carregarTorneiosPublicosXadrez(true);
            removerPainelRankingGeralXadrez();
            if (!chessBoard.length) criarTabuleiroInicial();
            ocultarTabuleiroXadrezParaMenu();
            renderChessBoard();
            renderRankingTreinoXadrez();
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        function voltarParaModalidades() {
            try { encerrarChamadaXadrez(false); } catch (_) {}
            // ✅ FASE 13.4: remove também o modo Admin do Xadrez ao voltar para o hub.
            document.body.classList.remove('chess-selected', 'game-selected', 'chess-focus-mode', 'chess-admin-only', 'chess-beginner-mode', 'chess-board-visible', 'chess-menu-active', 'chess-game-active', 'chess-mode-online', 'chess-mode-training');
            esconderPainelAdminXadrezForaDoAdmin();
            document.body.classList.add('platform-start-active', 'mode-selecting');

            const hub = document.getElementById('games-hub-panel');
            const chess = document.getElementById('chess-screen');
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');

            if (hub) hub.style.display = 'block';
            if (chess) chess.style.display = 'none';
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function resetChessGame() {
            const manterTreino = chessMode === 'training';
            criarTabuleiroInicial();
            limparResultadoXadrez();
            if (manterTreino) {
                chessMode = 'training';
                chessTrainingActive = true;
                lastMoveMessage = `Modo Treino reiniciado no nível ${nomeDificuldadeTreinoXadrez()}. Você joga com as brancas.`;
            }
            renderChessBoard();
            atualizarPainelTreinoXadrez();
            renderRankingTreinoXadrez();
            mostrarToastXadrez(manterTreino ? '🤖 Treino reiniciado. Brancas começam.' : '♟️ Nova partida de Xadrez iniciada. Brancas começam.');
        }


        function tabuleiroInicialXadrezAdminSerializado() {
            const p = (color, type) => ({ color, type, moved: false });
            const vazio = () => Array(8).fill('');
            return [
                [p('black','rook'), p('black','knight'), p('black','bishop'), p('black','queen'), p('black','king'), p('black','bishop'), p('black','knight'), p('black','rook')],
                Array.from({ length: 8 }, () => p('black','pawn')),
                vazio(), vazio(), vazio(), vazio(),
                Array.from({ length: 8 }, () => p('white','pawn')),
                [p('white','rook'), p('white','knight'), p('white','bishop'), p('white','queen'), p('white','king'), p('white','bishop'), p('white','knight'), p('white','rook')]
            ];
        }

        function estadoInicialSalaXadrezAdmin(salaId) {
            return {
                id: salaId,
                mode: 'xadrez',
                board: tabuleiroInicialXadrezAdminSerializado(),
                turn: 'white',
                gameOver: false,
                lastMoveMessage: 'Fase 12 ativa: sala de Xadrez criada pelo painel Admin.',
                lastChessMove: null,
                enPassantTarget: null,
                moveHistory: [],
                players: {},
                spectators: {},
                chat: null,
                isAuthorized: true,
                chatBlocked: false,
                createdByAdminUid: getChessUid() || (auth.currentUser ? auth.currentUser.uid : ''),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastAdminAction: 'criada_pelo_admin_xadrez',
                lastAdminAt: Date.now()
            };
        }

        function instalarPainelAdminXadrez() {
            instalarUiXadrezFase5();
            const card = document.querySelector('#chess-screen .chess-card');
            if (!card) return;

            if (!document.getElementById('chess-admin-style')) {
                const style = document.createElement('style');
                style.id = 'chess-admin-style';
                style.textContent = `
                    .chess-admin-panel { display:none; background:linear-gradient(135deg,#1e1233,#0f172a); border:2px dashed #c084fc; border-radius:14px; padding:14px; margin:14px 0; text-align:left; box-shadow:0 10px 28px rgba(0,0,0,.45); }
                    .chess-admin-title { color:#d8b4fe; font-size:.95rem; font-weight:1000; text-transform:uppercase; margin-bottom:7px; border-bottom:1px solid rgba(216,180,254,.45); padding-bottom:6px; }
                    .chess-admin-desc { color:#cbd5e1; font-size:.78rem; line-height:1.35; margin-bottom:10px; }
                    .chess-admin-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
                    .chess-admin-grid button { padding:10px 7px; font-size:.72rem; text-transform:none; border-radius:8px; }
                    .chess-admin-panel input { margin:0 0 10px 0; text-align:left; border:1px solid #4c1d95; background:#020617; }
                    .chess-admin-list, .chess-admin-chat-monitor { background:#020617; border:1px solid #312e81; border-radius:10px; padding:10px; max-height:240px; overflow-y:auto; font-size:.78rem; color:#e2e8f0; margin-top:10px; }
                    .chess-admin-room-row { padding:9px; border-radius:8px; background:#111827; margin-bottom:7px; border-left:4px solid #22c55e; cursor:pointer; display:flex; justify-content:space-between; gap:8px; }
                    .chess-admin-room-row.blocked { border-left-color:#ef4444; }
                    .chess-admin-room-row:hover { background:#172554; }
                    .chess-admin-tournament-box { margin:12px 0; padding:12px; border:1px solid rgba(34,211,238,.55); border-radius:12px; background:linear-gradient(135deg,rgba(8,47,73,.58),rgba(15,23,42,.84)); }
                    .chess-admin-tournament-title { color:#67e8f9; font-size:.86rem; font-weight:1000; text-transform:uppercase; margin-bottom:8px; border-bottom:1px dashed rgba(103,232,249,.35); padding-bottom:7px; }
                    .chess-admin-small-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                    .chess-admin-small-grid .chess-admin-full { grid-column:1 / -1; }
                    .chess-admin-tournament-box textarea { width:100%; min-height:72px; resize:vertical; margin:0 0 8px 0; text-align:left; border:1px solid #164e63; border-radius:8px; background:#020617; color:#e2e8f0; padding:10px; font-family:inherit; }
                    .chess-admin-tournament-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
                    .chess-admin-tournament-list { margin-top:10px; max-height:180px; overflow-y:auto; }
                    .chess-tournament-card { padding:9px; border-radius:10px; background:rgba(2,6,23,.72); border-left:4px solid #22d3ee; margin-bottom:8px; color:#e2e8f0; }
                    .chess-tournament-card strong { color:#facc15; display:block; margin-bottom:4px; }
                    .chess-tournament-card .mini-action-btn { width:auto; padding:7px 10px; margin-top:7px; font-size:.70rem; border-radius:8px; }
                    .chess-public-tournaments-panel {
                        max-width: 580px;
                        margin: 14px auto 18px auto;
                        background: radial-gradient(circle at top left, rgba(250,204,21,.12), transparent 32%), linear-gradient(135deg, rgba(2,6,23,.94), rgba(15,23,42,.92));
                        border: 1px solid rgba(56,189,248,.40);
                        border-radius: 18px;
                        padding: 14px;
                        text-align: left;
                        box-shadow: 0 16px 34px rgba(0,0,0,.34);
                    }
                    .chess-public-tournaments-title {
                        color:#fde68a;
                        font-size:.90rem;
                        font-weight:1000;
                        text-transform:uppercase;
                        letter-spacing:.45px;
                        margin-bottom:6px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        gap:7px;
                        text-align:center;
                    }
                    .chess-public-tournaments-desc {
                        color:#cbd5e1;
                        font-size:.72rem;
                        line-height:1.35;
                        margin:0 auto 10px auto;
                        max-width: 480px;
                        text-align:center;
                    }
                    .chess-public-tournament-card {
                        background: linear-gradient(135deg, rgba(8,47,73,.72), rgba(15,23,42,.95));
                        border: 1px solid rgba(34,211,238,.42);
                        border-left: 5px solid #22d3ee;
                        border-radius: 16px;
                        padding: 13px;
                        color:#e2e8f0;
                        margin: 10px 0 12px 0;
                        box-shadow: 0 12px 26px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.08);
                    }
                    .chess-public-tournament-head {
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:10px;
                        margin-bottom:9px;
                    }
                    .chess-public-tournament-name {
                        color:#fde68a;
                        font-size:.94rem;
                        font-weight:1000;
                        line-height:1.15;
                    }
                    .chess-public-tournament-badge {
                        color:#bbf7d0;
                        background:rgba(22,163,74,.18);
                        border:1px solid rgba(34,197,94,.46);
                        border-radius:999px;
                        padding:4px 8px;
                        font-size:.62rem;
                        font-weight:1000;
                        white-space:nowrap;
                        text-transform:uppercase;
                    }
                    .chess-public-tournament-info {
                        display:grid;
                        grid-template-columns:repeat(3, minmax(0, 1fr));
                        gap:7px;
                        margin-bottom:9px;
                    }
                    .chess-public-info-chip {
                        background:rgba(15,23,42,.82);
                        border:1px solid rgba(148,163,184,.20);
                        border-radius:11px;
                        padding:7px 8px;
                        min-height:44px;
                    }
                    .chess-public-info-label {
                        color:#94a3b8;
                        font-size:.58rem;
                        font-weight:900;
                        text-transform:uppercase;
                        margin-bottom:2px;
                    }
                    .chess-public-info-value {
                        color:#f8fafc;
                        font-size:.72rem;
                        font-weight:1000;
                        line-height:1.15;
                    }
                    .chess-public-tournament-message {
                        background:rgba(2,6,23,.42);
                        border:1px solid rgba(34,211,238,.18);
                        border-radius:12px;
                        padding:9px 10px;
                        color:#dbeafe;
                        font-size:.72rem;
                        line-height:1.35;
                        margin: 6px 0 11px 0;
                    }
                    .chess-public-link-hidden-note {
                        color:#67e8f9;
                        font-size:.64rem;
                        text-align:center;
                        margin: -3px 0 10px 0;
                        opacity:.92;
                    }
                    .chess-public-tournament-actions {
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:12px;
                        margin-top:10px;
                        align-items:stretch;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-actions button,
                    .chess-public-tournament-actions button.chess-public-watch-btn,
                    .chess-public-tournament-actions button.chess-public-copy-btn {
                        width:100% !important;
                        min-height:50px !important;
                        padding:12px 14px !important;
                        font-size:.76rem !important;
                        line-height:1.1 !important;
                        border-radius:14px !important;
                        text-transform:uppercase !important;
                        letter-spacing:.45px !important;
                        font-weight:1000 !important;
                        display:flex !important;
                        align-items:center !important;
                        justify-content:center !important;
                        gap:8px !important;
                        box-shadow:0 10px 20px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.18) !important;
                        text-shadow:0 1px 2px rgba(0,0,0,.35) !important;
                        margin:0 !important;
                    }
                    #chess-public-tournaments-panel .chess-public-watch-btn {
                        background:linear-gradient(135deg,#0ea5e9,#2563eb) !important;
                        color:#fff !important;
                        border:1px solid rgba(34,211,238,.70) !important;
                    }
                    #chess-public-tournaments-panel .chess-public-copy-btn {
                        background:linear-gradient(135deg,#1e293b,#5b21b6) !important;
                        color:#fff !important;
                        border:1px solid rgba(168,85,247,.70) !important;
                    }
                    #chess-public-tournaments-panel .chess-public-watch-btn:hover,
                    #chess-public-tournaments-panel .chess-public-copy-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
                    #chess-public-tournaments-panel .chess-public-watch-btn:active,
                    #chess-public-tournaments-panel .chess-public-copy-btn:active { transform:translateY(0); filter:brightness(.98); }
                    @media (max-width:560px) {
                        .chess-public-tournaments-panel { padding:12px; border-radius:16px; }
                        .chess-public-tournament-head { align-items:flex-start; flex-direction:column; gap:6px; }
                        .chess-public-tournament-info { grid-template-columns:1fr; }
                        .chess-public-tournament-actions { grid-template-columns:1fr; gap:10px; }
                        .chess-public-tournament-actions button { min-height:46px !important; font-size:.75rem !important; }
                    }
                    /* PROFISSIONAL 14 — card público do torneio realmente organizado */
                    #chess-public-tournaments-panel.chess-public-tournaments-panel {
                        max-width: 760px !important;
                        margin: 18px auto 22px auto !important;
                        padding: 18px !important;
                        border-radius: 22px !important;
                        text-align: left !important;
                        background: radial-gradient(circle at top left, rgba(34,211,238,.16), transparent 34%), linear-gradient(135deg, rgba(2,6,23,.96), rgba(8,47,73,.78)) !important;
                        border: 1px solid rgba(56,189,248,.62) !important;
                        box-shadow: 0 18px 42px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08) !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournaments-title {
                        justify-content: flex-start !important;
                        text-align: left !important;
                        color: #fde68a !important;
                        font-size: 1rem !important;
                        line-height: 1.2 !important;
                        margin: 0 0 6px 0 !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournaments-desc {
                        max-width: none !important;
                        text-align: left !important;
                        color: #dbeafe !important;
                        background: rgba(15,23,42,.50) !important;
                        border: 1px solid rgba(148,163,184,.18) !important;
                        border-left: 4px solid #38bdf8 !important;
                        border-radius: 12px !important;
                        padding: 9px 11px !important;
                        margin: 0 0 13px 0 !important;
                        font-size: .78rem !important;
                        line-height: 1.35 !important;
                    }
                    #chess-public-tournaments-list {
                        display: grid !important;
                        gap: 12px !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-card {
                        display: grid !important;
                        grid-template-columns: 74px minmax(0, 1fr) !important;
                        gap: 14px !important;
                        padding: 16px !important;
                        margin: 0 !important;
                        border-radius: 18px !important;
                        background: linear-gradient(135deg, rgba(15,23,42,.98), rgba(12,74,110,.64)) !important;
                        border: 1px solid rgba(125,211,252,.38) !important;
                        border-left: 5px solid #22d3ee !important;
                        box-shadow: 0 14px 30px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08) !important;
                        color: #e5e7eb !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-icon {
                        width: 62px !important;
                        height: 62px !important;
                        border-radius: 50% !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        font-size: 1.65rem !important;
                        background: radial-gradient(circle, rgba(250,204,21,.24), rgba(15,23,42,.92)) !important;
                        border: 1px solid rgba(250,204,21,.42) !important;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 10px 18px rgba(0,0,0,.25) !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-content {
                        min-width: 0 !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-head {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 10px !important;
                        margin-bottom: 10px !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-name {
                        color: #f8fafc !important;
                        font-size: 1.05rem !important;
                        font-weight: 1000 !important;
                        line-height: 1.15 !important;
                        text-align: left !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-badge {
                        color: #bbf7d0 !important;
                        background: rgba(22,163,74,.30) !important;
                        border: 1px solid rgba(34,197,94,.58) !important;
                        border-radius: 999px !important;
                        padding: 5px 10px !important;
                        font-size: .66rem !important;
                        font-weight: 1000 !important;
                        white-space: nowrap !important;
                        text-transform: uppercase !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-info {
                        display: grid !important;
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        gap: 8px !important;
                        margin: 0 0 10px 0 !important;
                    }
                    #chess-public-tournaments-panel .chess-public-info-chip {
                        background: rgba(15,23,42,.78) !important;
                        border: 1px solid rgba(148,163,184,.22) !important;
                        border-radius: 12px !important;
                        padding: 8px 9px !important;
                        min-height: 48px !important;
                    }
                    #chess-public-tournaments-panel .chess-public-info-label {
                        color: #93c5fd !important;
                        font-size: .58rem !important;
                        font-weight: 1000 !important;
                        text-transform: uppercase !important;
                        letter-spacing: .35px !important;
                        margin-bottom: 3px !important;
                    }
                    #chess-public-tournaments-panel .chess-public-info-value {
                        color: #f8fafc !important;
                        font-size: .78rem !important;
                        font-weight: 1000 !important;
                        line-height: 1.15 !important;
                        white-space: nowrap !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-message {
                        display: block !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        background: rgba(2,6,23,.52) !important;
                        border: 1px solid rgba(34,211,238,.18) !important;
                        border-radius: 13px !important;
                        padding: 10px 12px !important;
                        color: #dbeafe !important;
                        font-size: .78rem !important;
                        line-height: 1.38 !important;
                        margin: 0 0 12px 0 !important;
                        text-align: left !important;
                    }
                    #chess-public-tournaments-panel .chess-public-link-hidden-note {
                        display: none !important;
                    }
                    #chess-public-tournaments-panel .chess-public-tournament-actions {
                        grid-column: 2 / 3 !important;
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 12px !important;
                        margin-top: 2px !important;
                        align-items: stretch !important;
                    }
                    @media (max-width: 560px) {
                        #chess-public-tournaments-panel.chess-public-tournaments-panel {
                            margin: 16px auto 20px auto !important;
                            padding: 14px !important;
                            border-radius: 20px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournaments-title {
                            justify-content: center !important;
                            text-align: center !important;
                            font-size: 1rem !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournaments-desc {
                            text-align: center !important;
                            font-size: .76rem !important;
                            padding: 9px 10px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-card {
                            grid-template-columns: 1fr !important;
                            gap: 10px !important;
                            padding: 14px !important;
                            border-left-width: 1px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-icon {
                            margin: 0 auto !important;
                            width: 58px !important;
                            height: 58px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-head {
                            flex-direction: column !important;
                            align-items: center !important;
                            text-align: center !important;
                            gap: 6px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-name {
                            text-align: center !important;
                            font-size: 1rem !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-info {
                            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                            gap: 6px !important;
                        }
                        #chess-public-tournaments-panel .chess-public-info-chip {
                            padding: 7px 5px !important;
                            min-height: 45px !important;
                            text-align: center !important;
                        }
                        #chess-public-tournaments-panel .chess-public-info-label {
                            font-size: .52rem !important;
                        }
                        #chess-public-tournaments-panel .chess-public-info-value {
                            font-size: .66rem !important;
                            white-space: normal !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-message {
                            text-align: center !important;
                            font-size: .75rem !important;
                        }
                        #chess-public-tournaments-panel .chess-public-tournament-actions {
                            grid-column: auto !important;
                            grid-template-columns: 1fr !important;
                            gap: 10px !important;
                        }
                    }
                    body.chess-board-visible #chess-public-tournaments-panel,
                    body.chess-admin-only #chess-public-tournaments-panel { display:none !important; }
                    .chess-global-ranking-panel {
                        max-width: 560px;
                        margin: 0 auto 14px auto;
                        background: linear-gradient(135deg, rgba(15,23,42,.86), rgba(30,64,175,.34));
                        border: 1px solid rgba(59,130,246,.44);
                        border-radius: 16px;
                        padding: 12px;
                        text-align: left;
                        box-shadow: 0 12px 28px rgba(0,0,0,.28);
                    }
                    .chess-global-ranking-title {
                        color:#93c5fd;
                        font-size:.86rem;
                        font-weight:1000;
                        text-transform:uppercase;
                        letter-spacing:.45px;
                        margin-bottom:5px;
                    }
                    .chess-global-ranking-desc {
                        color:#cbd5e1;
                        font-size:.76rem;
                        line-height:1.35;
                        margin-bottom:8px;
                    }
                    .chess-global-ranking-row {
                        display:grid;
                        grid-template-columns: 34px 1fr auto;
                        align-items:center;
                        gap:8px;
                        padding:8px;
                        border-radius:10px;
                        background:rgba(2,6,23,.68);
                        border-left:4px solid rgba(59,130,246,.8);
                        margin-bottom:7px;
                        color:#e2e8f0;
                    }
                    .chess-global-ranking-pos { color:#facc15; font-weight:1000; font-size:.82rem; }
                    .chess-global-ranking-name { font-weight:900; color:#fff; font-size:.82rem; }
                    .chess-global-ranking-meta { color:#94a3b8; font-size:.70rem; line-height:1.3; }
                    .chess-global-ranking-points { color:#86efac; font-weight:1000; font-size:.78rem; text-align:right; }
                    body.chess-board-visible #chess-global-ranking-panel,
                    body.chess-admin-only #chess-global-ranking-panel { display:none !important; }
                    /* ✅ FASE 13.8 - MENU LIMPO DO XADREZ: tabuleiro aparece só depois da escolha */
                    body.chess-selected:not(.chess-board-visible) #chess-status,
                    body.chess-selected:not(.chess-board-visible) #chess-toast,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-board-wrap,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-actions,
                    body.chess-selected:not(.chess-board-visible) #chess-screen .chess-action-note {
                        display: none !important;
                    }
                    body.chess-board-visible #chess-online-panel,
                    body.chess-board-visible #chess-training-panel {
                        margin-bottom: 12px;
                    }
                    .chess-online-panel, .chess-training-panel {
                        max-width: 560px;
                        margin: 0 auto 14px auto;
                        background: rgba(2, 6, 23, .72);
                        border: 1px solid rgba(148, 163, 184, .18);
                        border-radius: 18px;
                        padding: 14px;
                        text-align: left;
                        box-shadow: 0 12px 28px rgba(0,0,0,.32);
                        backdrop-filter: blur(10px);
                    }
                    .chess-online-panel {
                        border-color: rgba(56,189,248,.30);
                        background: linear-gradient(135deg, rgba(8,47,73,.52), rgba(2,6,23,.82));
                    }
                    .chess-training-panel {
                        border-color: rgba(46,204,113,.28);
                        background: linear-gradient(135deg, rgba(5,46,22,.42), rgba(2,6,23,.86));
                    }
                    .chess-training-title {
                        color: #86efac;
                        font-weight: 1000;
                        text-transform: uppercase;
                        font-size: .88rem;
                        letter-spacing: .55px;
                        margin-bottom: 5px;
                    }
                    .chess-training-desc {
                        color: #cbd5e1;
                        font-size: .80rem;
                        line-height: 1.42;
                        margin-bottom: 12px;
                    }
                    .chess-training-actions {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 9px;
                    }
                    .chess-training-actions button.btn-chess-training {
                        min-height: 74px;
                        padding: 12px 10px !important;
                        font-size: .82rem !important;
                        text-transform: none !important;
                        text-align: center !important;
                        border-radius: 16px !important;
                        border: 1px solid rgba(255,255,255,.14) !important;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 10px 22px rgba(0,0,0,.24) !important;
                        transform: none !important;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        gap: 6px;
                        position: relative;
                        overflow: hidden;
                    }
                    .chess-training-actions button.btn-chess-training::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: linear-gradient(180deg, rgba(255,255,255,.16), transparent 42%);
                        pointer-events: none;
                    }
                    .btn-chess-training span {
                        position: relative;
                        z-index: 1;
                        font-weight: 1000;
                        color:#fff;
                        font-size: .98rem;
                        letter-spacing: .2px;
                    }
                    .btn-chess-training small {
                        position: relative;
                        z-index: 1;
                        font-size: .70rem;
                        color: rgba(226,232,240,.92);
                        font-weight: 800;
                        letter-spacing: .2px;
                        margin-top: 1px;
                    }
                    .btn-chess-training.easy {
                        background: linear-gradient(135deg, #16a34a, #0f766e) !important;
                        border-color: rgba(110,231,183,.42) !important;
                    }
                    .btn-chess-training.medium {
                        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                        border-color: rgba(147,197,253,.42) !important;
                    }
                    .btn-chess-training.hard {
                        background: linear-gradient(135deg, #f97316, #dc2626) !important;
                        border-color: rgba(253,186,116,.42) !important;
                    }
                    .btn-chess-training.learn {
                        background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important;
                        border-color: rgba(196,181,253,.45) !important;
                    }
                    .btn-chess-training:hover:not(:disabled) {
                        transform: translateY(-2px) !important;
                        border-color: rgba(255,255,255,.30) !important;
                        filter: brightness(1.06);
                    }
                    .btn-chess-training.active {
                        outline: 2px solid #f8fafc !important;
                        box-shadow: 0 0 0 4px rgba(255,255,255,.10), 0 0 18px rgba(255,255,255,.16) !important;
                    }
                    .chess-training-status {
                        margin-top: 10px;
                        color: #e2e8f0;
                        background: rgba(2, 6, 23, .78);
                        border-radius: 12px;
                        padding: 10px;
                        font-size: .79rem;
                        line-height: 1.38;
                        border: 1px solid rgba(46,204,113,.28);
                        border-left: 4px solid #2ecc71;
                    }
                    .chess-training-coach {
                        margin-top: 9px;
                        color: #e2e8f0;
                        background: rgba(124,58,237,.16);
                        border: 1px solid rgba(216,180,254,.28);
                        border-radius: 10px;
                        padding: 9px;
                        font-size: .79rem;
                        line-height: 1.38;
                    }
                    .chess-training-coach strong { color:#d8b4fe; display:block; margin-bottom: 4px; }
                    .chess-training-coach button {
                        margin-top: 8px;
                        width: auto;
                        padding: 7px 10px;
                        font-size: .72rem;
                        text-transform: none;
                        border-radius: 7px;
                        background:#6d28d9;
                    }
                    .chess-beginner-box {
                        margin-top: 9px;
                        background: linear-gradient(135deg, rgba(2,6,23,.96), rgba(30,41,59,.92));
                        border: 1px solid rgba(56,189,248,.38);
                        border-radius: 10px;
                        padding: 10px;
                        color: #e2e8f0;
                        font-size: .78rem;
                        line-height: 1.38;
                    }
                    .chess-beginner-title {
                        color: #38bdf8;
                        font-weight: 1000;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        letter-spacing: .4px;
                    }
                    .chess-beginner-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 7px;
                        margin-top: 7px;
                    }
                    .chess-beginner-item {
                        background: #020617;
                        border: 1px solid rgba(148,163,184,.18);
                        border-radius: 8px;
                        padding: 7px;
                    }
                    .chess-beginner-item strong { color:#facc15; }
                    .chess-legend-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 6px;
                        margin-top: 8px;
                    }
                    .chess-legend-pill {
                        background:#020617;
                        border-radius: 999px;
                        padding: 6px 7px;
                        text-align:center;
                        font-size:.7rem;
                        border:1px solid rgba(255,255,255,.10);
                    }
                    .chess-legend-pill.green { color:#86efac; }
                    .chess-legend-pill.red { color:#fca5a5; }
                    .chess-legend-pill.yellow { color:#fde68a; }
                    body.chess-beginner-mode .chess-piece::after {
                        content: attr(data-name);
                        position: absolute;
                        left: 50%;
                        bottom: -12px;
                        transform: translateX(-50%);
                        background: rgba(2,6,23,.82);
                        color: #fff;
                        border-radius: 999px;
                        padding: 1px 5px;
                        font-size: clamp(.48rem, 1.7vw, .62rem);
                        font-weight: 900;
                        line-height: 1.2;
                        white-space: nowrap;
                        border: 1px solid rgba(255,255,255,.18);
                        text-shadow: none;
                        pointer-events: none;
                    }
                    body.chess-beginner-mode .chess-square.capture::before {
                        content: 'capturar';
                        position: absolute;
                        top: 4px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 3;
                        background: rgba(127,29,29,.88);
                        color: #fff;
                        border-radius: 999px;
                        padding: 2px 6px;
                        font-size: clamp(.48rem, 1.6vw, .62rem);
                        font-weight: 1000;
                        pointer-events: none;
                    }
                    body.chess-admin-only #chess-training-panel { display: none !important; }
                    @media(max-width:560px){ .chess-training-actions { grid-template-columns: 1fr; } .chess-beginner-grid, .chess-legend-row { grid-template-columns: 1fr; } }

                    /* ✅ FASE 12.1: ADMIN LIMPO — esconde tudo que é do jogo quando abrir o Admin do Xadrez */
                    body.chess-admin-only #chess-status,
                    body.chess-admin-only #chess-toast,
                    body.chess-admin-only .chess-board-wrap,
                    body.chess-admin-only #chess-material-panel,
                    body.chess-admin-only #chess-history-panel,
                    body.chess-admin-only .chess-actions,
                    body.chess-admin-only .chess-action-note,
                    body.chess-admin-only .chess-warning {
                        display: none !important;
                    }
                    /* ✅ PROFISSIONAL 03: segurança visual do Admin do Xadrez.
                       O painel administrativo do Xadrez fica totalmente invisível fora do modo admin,
                       mesmo que o HTML já tenha sido criado antes no navegador. */
                    body:not(.chess-admin-only) #chess-admin-panel {
                        display: none !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                        height: 0 !important;
                        max-height: 0 !important;
                        overflow: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: 0 !important;
                    }
                    body.chess-admin-only #chess-admin-panel {
                        display: block !important;
                        visibility: visible !important;
                        pointer-events: auto !important;
                        height: auto !important;
                        max-height: none !important;
                    }
                    body.chess-admin-only .chess-card {
                        max-width: 660px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    body.chess-admin-only .chess-subtitle {
                        margin-bottom: 10px;
                    }
                    @media(max-width:560px){ .chess-admin-grid { grid-template-columns:1fr; } }
                `;
                document.head.appendChild(style);
            }

            if (!document.getElementById('chess-admin-panel')) {
                const panel = document.createElement('div');
                panel.id = 'chess-admin-panel';
                panel.className = 'chess-admin-panel';
                panel.innerHTML = `
                    <div class="chess-admin-title">🛡️ Painel Admin do Xadrez</div>
                    <div class="chess-admin-desc">Controle próprio do Xadrez, igual à Damas, usando o caminho <strong>chessRooms</strong>. Esta tela é somente administração: sem tabuleiro, sem placar e sem histórico do jogo. A Damas continua preservada.</div>
                    <input id="chess-admin-room-input" type="text" maxlength="18" placeholder="Código da sala de Xadrez, ex: xadrez10">
                    <div class="chess-admin-grid">
                        <button id="chess-admin-create-btn" type="button" style="background:#22c55e;">Liberar / criar sala</button>
                        <button id="chess-admin-block-btn" type="button" style="background:#dc2626;">Bloquear sala</button>
                        <button id="chess-admin-chat-btn" type="button" style="background:#f97316;">Travar / destravar chat</button>
                        <button id="chess-admin-kick-btn" type="button" style="background:#facc15; color:#111;">Expulsar jogadores</button>
                        <button id="chess-admin-clear-chat-btn" type="button" style="background:#b45309;">Limpar mensagens</button>
                        <button id="chess-admin-reset-btn" type="button" style="background:#7c3aed;">Resetar tabuleiro</button>
                        <button id="chess-admin-delete-btn" type="button" style="background:#991b1b;">Excluir sala</button>
                        <button id="chess-admin-monitor-chat-btn" type="button" style="background:#2563eb;">Monitorar chat</button>
                    </div>

                    <div class="chess-admin-tournament-box">
                        <div class="chess-admin-tournament-title">🏆 Central de Torneios do Xadrez</div>
                        <div class="chess-admin-desc">Use esta área para marcar torneios de Xadrez, gerar aviso para WhatsApp e definir a sala oficial da rodada.</div>
                        <div class="chess-admin-small-grid">
                            <input id="chess-tournament-name-input" class="chess-admin-full" type="text" maxlength="60" placeholder="Nome do torneio. Ex: Torneio de Xadrez de Sábado">
                            <input id="chess-tournament-date-input" type="datetime-local">
                            <input id="chess-tournament-room-input" type="text" maxlength="18" placeholder="Sala principal. Ex: xadrez10">
                            <textarea id="chess-tournament-message-input" class="chess-admin-full" rows="3" placeholder="Mensagem do aviso para WhatsApp"></textarea>
                        </div>
                        <div class="chess-admin-tournament-actions">
                            <button id="chess-admin-create-tournament-btn" type="button" style="background:#2563eb;">Criar / publicar torneio</button>
                            <button id="chess-admin-whatsapp-tournament-btn" type="button" style="background:#22c55e;">Gerar avisos WhatsApp</button>
                        </div>
                        <div id="chess-admin-tournament-list" class="chess-admin-tournament-list"><div style="color:#94a3b8; font-style:italic;">Torneios de Xadrez criados aparecerão aqui.</div></div>
                        <div id="chess-admin-whatsapp-list" class="chess-admin-tournament-list"></div>
                    </div>

                    <div id="chess-admin-panorama" class="chess-admin-desc">📊 Sincronizando salas de Xadrez...</div>
                    <div id="chess-admin-rooms-list" class="chess-admin-list">Carregando salas...</div>
                    <div id="chess-admin-chat-monitor" class="chess-admin-chat-monitor" style="display:none;">Selecione uma sala e clique em monitorar chat.</div>
                `;
                const online = document.getElementById('chess-online-panel');
                if (online) online.insertAdjacentElement('afterend', panel);
                else card.insertBefore(panel, document.getElementById('chess-status') || card.firstChild);
                if (!document.body.classList.contains('chess-admin-only')) {
                    panel.style.display = 'none';
                    panel.setAttribute('aria-hidden', 'true');
                }

                document.getElementById('chess-admin-create-btn')?.addEventListener('click', adminCriarLiberarSalaXadrez);
                document.getElementById('chess-admin-block-btn')?.addEventListener('click', adminBloquearSalaXadrez);
                document.getElementById('chess-admin-chat-btn')?.addEventListener('click', adminAlternarChatXadrez);
                document.getElementById('chess-admin-kick-btn')?.addEventListener('click', adminExpulsarJogadoresXadrez);
                document.getElementById('chess-admin-clear-chat-btn')?.addEventListener('click', adminLimparChatXadrez);
                document.getElementById('chess-admin-reset-btn')?.addEventListener('click', adminResetarSalaXadrez);
                document.getElementById('chess-admin-delete-btn')?.addEventListener('click', adminExcluirSalaXadrez);
                document.getElementById('chess-admin-monitor-chat-btn')?.addEventListener('click', adminMonitorarChatXadrez);
                document.getElementById('chess-admin-create-tournament-btn')?.addEventListener('click', criarTorneioXadrezAdmin);
                document.getElementById('chess-admin-whatsapp-tournament-btn')?.addEventListener('click', gerarAvisosXadrezWhatsapp);
                carregarTorneiosXadrezAdmin();
            }
        }

        function formatarDataTorneioXadrez(valor) {
            if (!valor) return 'Data a definir';
            try {
                const d = new Date(valor);
                if (Number.isNaN(d.getTime())) return String(valor);
                return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            } catch (_) {
                return String(valor);
            }
        }

        function linkPublicoTorneioXadrez(sala, modo = 'assistir') {
            const salaLimpa = normalizarSalaXadrez(sala || '');
            const url = new URL(location.origin + location.pathname);
            url.searchParams.set('jogo', 'xadrez');
            if (salaLimpa) url.searchParams.set('sala', salaLimpa);
            url.searchParams.set('modo', modo || 'assistir');
            // mantém compatibilidade com os links antigos da Profissional 06
            if ((modo || 'assistir') === 'assistir') url.searchParams.set('assistir', '1');
            return url.toString();
        }

        function montarConviteTorneioXadrez(torneio) {
            const nome = somenteTextoSeguro(torneio?.name || 'Torneio de Xadrez', 60);
            const sala = normalizarSalaXadrez(torneio?.room || '');
            const dataTxt = formatarDataTorneioXadrez(torneio?.date);
            const mensagem = textoAvisoSeguro(torneio?.message || 'Entre e acompanhe o torneio de Xadrez.', 220);
            const link = torneio?.publicLink || linkPublicoTorneioXadrez(sala, 'assistir');
            return `🏆 Convite oficial — Tabuleiro Arena

♟️ Torneio de Xadrez: ${nome}
📅 Data/Hora: ${dataTxt}
${sala ? '🏠 Sala: ' + sala.toUpperCase() + '\n' : ''}
${mensagem}

👀 Para assistir online, acesse:
${link}

Compartilhe com os amigos e entre no horário marcado.`;
        }

        async function copiarLinkPublicoTorneioXadrez(torneio) {
            const texto = montarConviteTorneioXadrez(torneio);
            try {
                await navigator.clipboard.writeText(texto);
                mostrarToastXadrez('📋 Convite do torneio copiado.');
            } catch (_) {
                mostrarToastXadrez('📋 Copie pelo link direto do torneio.');
            }
        }

        async function assistirTorneioPublicoXadrez(torneio) {
            const sala = normalizarSalaXadrez(torneio?.room || '');
            if (!sala) {
                exibirAlertaDoSistema('Torneio de Xadrez', 'Este torneio ainda não tem sala definida.');
                return;
            }
            const nameInput = document.getElementById('chess-online-name');
            const roomInput = document.getElementById('chess-online-room');
            if (nameInput && !normalizarCampoXadrez(nameInput.value)) nameInput.value = 'Espectador';
            if (roomInput) roomInput.value = sala;
            await entrarXadrezOnline(true);
        }

        function ocultarPainelPublicoXadrezDurantePartida() {
            const torneios = document.getElementById('chess-public-tournaments-panel');
            const ranking = document.getElementById('chess-global-ranking-panel');
            if (torneios) torneios.style.setProperty('display', 'none', 'important');
            if (ranking) ranking.style.setProperty('display', 'none', 'important');
        }

        function mostrarPainelPublicoXadrezNoMenu() {
            const torneios = document.getElementById('chess-public-tournaments-panel');
            if (torneios && torneios.dataset.temTorneio === '1') torneios.style.removeProperty('display');
            removerPainelRankingGeralXadrez();
        }

        function removerPainelRankingGeralXadrez() {
            const ranking = document.getElementById('chess-global-ranking-panel');
            if (ranking) ranking.remove();
        }

        function mensagemPublicaLimpaTorneioXadrez(torneio) {
            let msg = String(torneio?.message || '').trim();
            msg = msg.replace(/https?:\/\/\S+/gi, '').trim();
            msg = msg.replace(/🔗\s*O link.*$/i, '').trim();
            msg = msg.replace(/📅\s*Data:.*$/i, '').trim();
            msg = msg.replace(/\s*Data:\s*\d{1,2}\/\d{1,2}\/\d{2,4}.*$/i, '').trim();
            msg = msg.replace(/\s*Hor[aá]rio:\s*\d{1,2}:\d{2}.*$/i, '').trim();
            msg = msg.replace(/\s*Sala:\s*\S+.*$/i, '').trim();
            msg = msg.replace(/\s*Entre p.*$/i, '').trim();
            msg = msg.replace(/\s+/g, ' ').trim();
            if (!msg || /convite oficial|convite especial|tabuleiro arena/i.test(msg)) {
                return 'Convite especial! Participe ou acompanhe nosso torneio de Xadrez no Tabuleiro Arena.';
            }
            if (msg.length > 130) msg = msg.slice(0, 130).trim() + '...';
            return msg;
        }

        function criarCardTorneioPublicoXadrez(torneio, id) {
            // PROFISSIONAL 15 — card público do torneio organizado de verdade, com estilo direto no próprio card.
            // Motivo: evitar que CSS antigo/cache deixe o texto solto e embolado no menu público do Xadrez.
            const card = document.createElement('div');
            card.className = 'chess-public-tournament-card chess-public-tournament-card-v15';
            card.style.cssText = [
                'box-sizing:border-box',
                'width:100%',
                'max-width:620px',
                'margin:12px auto 0 auto',
                'padding:16px',
                'border-radius:18px',
                'background:linear-gradient(135deg,rgba(2,6,23,.98),rgba(12,74,110,.60))',
                'border:1px solid rgba(125,211,252,.40)',
                'box-shadow:0 14px 32px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.08)',
                'display:block',
                'text-align:left',
                'color:#e5e7eb',
                'overflow:hidden'
            ].join(';');

            const nome = somenteTextoSeguro(torneio?.name || 'Torneio de Xadrez', 60);
            const sala = normalizarSalaXadrez(torneio?.room || '');
            const mensagem = mensagemPublicaLimpaTorneioXadrez(torneio);
            const dataTxt = formatarDataTorneioXadrez(torneio?.date);
            const partesData = dataTxt.split(',').map(p => p.trim());
            const diaTxt = partesData[0] || 'A definir';
            const horaTxt = partesData[1] || 'A definir';
            const salaTxt = (sala || 'a definir').toUpperCase();

            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <div style="width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.65rem;background:radial-gradient(circle,rgba(250,204,21,.26),rgba(15,23,42,.94));border:1px solid rgba(250,204,21,.44);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 10px 18px rgba(0,0,0,.25);flex:0 0 auto;">🏆</div>
                    <div style="min-width:0;flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <div style="font-size:1.02rem;font-weight:1000;line-height:1.15;color:#f8fafc;">${escapeHtmlXadrez(nome)}</div>
                            <div style="background:rgba(22,163,74,.32);color:#bbf7d0;border:1px solid rgba(34,197,94,.60);border-radius:999px;padding:4px 10px;font-size:.66rem;font-weight:1000;text-transform:uppercase;line-height:1;">Aberto</div>
                        </div>
                        <div style="font-size:.72rem;color:#bfdbfe;margin-top:4px;line-height:1.3;">Torneio oficial publicado pelo administrador</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px 0;">
                    <div style="background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.23);border-radius:13px;padding:9px 8px;text-align:center;min-height:52px;box-sizing:border-box;">
                        <div style="color:#93c5fd;font-size:.56rem;font-weight:1000;text-transform:uppercase;letter-spacing:.35px;margin-bottom:4px;">📅 Data</div>
                        <div style="color:#f8fafc;font-size:.76rem;font-weight:1000;line-height:1.15;">${escapeHtmlXadrez(diaTxt)}</div>
                    </div>
                    <div style="background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.23);border-radius:13px;padding:9px 8px;text-align:center;min-height:52px;box-sizing:border-box;">
                        <div style="color:#93c5fd;font-size:.56rem;font-weight:1000;text-transform:uppercase;letter-spacing:.35px;margin-bottom:4px;">🕘 Horário</div>
                        <div style="color:#f8fafc;font-size:.76rem;font-weight:1000;line-height:1.15;">${escapeHtmlXadrez(horaTxt)}</div>
                    </div>
                    <div style="background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.23);border-radius:13px;padding:9px 8px;text-align:center;min-height:52px;box-sizing:border-box;">
                        <div style="color:#93c5fd;font-size:.56rem;font-weight:1000;text-transform:uppercase;letter-spacing:.35px;margin-bottom:4px;">🏠 Sala</div>
                        <div style="color:#f8fafc;font-size:.76rem;font-weight:1000;line-height:1.15;">${escapeHtmlXadrez(salaTxt)}</div>
                    </div>
                </div>
                <div style="background:rgba(2,6,23,.52);border:1px solid rgba(34,211,238,.18);border-radius:13px;padding:10px 12px;color:#dbeafe;font-size:.78rem;line-height:1.38;margin:0 0 12px 0;text-align:center;box-sizing:border-box;">
                    ${escapeHtmlXadrez(mensagem)}
                </div>
            `;

            const actions = document.createElement('div');
            actions.className = 'chess-public-tournament-actions';
            actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:2px;align-items:stretch;';

            const assistir = document.createElement('button');
            assistir.type = 'button';
            assistir.className = 'chess-public-watch-btn';
            assistir.setAttribute('style', [
                'width:100% !important',
                'min-height:50px !important',
                'padding:12px 14px !important',
                'border-radius:14px !important',
                'background:linear-gradient(135deg,#0ea5e9,#2563eb) !important',
                'color:#fff !important',
                'border:1px solid rgba(34,211,238,.72) !important',
                'box-shadow:0 10px 20px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.18) !important',
                'font-size:.78rem !important',
                'font-weight:1000 !important',
                'text-transform:uppercase !important',
                'letter-spacing:.45px !important',
                'display:flex !important',
                'align-items:center !important',
                'justify-content:center !important',
                'gap:8px !important',
                'margin:0 !important'
            ].join(';'));
            assistir.textContent = '👀 Assistir online';
            assistir.onclick = () => assistirTorneioPublicoXadrez(torneio);

            const copiar = document.createElement('button');
            copiar.type = 'button';
            copiar.className = 'chess-public-copy-btn';
            copiar.setAttribute('style', [
                'width:100% !important',
                'min-height:50px !important',
                'padding:12px 14px !important',
                'border-radius:14px !important',
                'background:linear-gradient(135deg,#1e293b,#5b21b6) !important',
                'color:#fff !important',
                'border:1px solid rgba(168,85,247,.72) !important',
                'box-shadow:0 10px 20px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.18) !important',
                'font-size:.78rem !important',
                'font-weight:1000 !important',
                'text-transform:uppercase !important',
                'letter-spacing:.45px !important',
                'display:flex !important',
                'align-items:center !important',
                'justify-content:center !important',
                'gap:8px !important',
                'margin:0 !important'
            ].join(';'));
            copiar.textContent = '📋 Copiar convite';
            copiar.onclick = () => copiarLinkPublicoTorneioXadrez(torneio);

            actions.appendChild(assistir);
            actions.appendChild(copiar);
            card.appendChild(actions);

            // Ajuste simples para telas estreitas sem depender de CSS externo.
            if (window.matchMedia && window.matchMedia('(max-width: 560px)').matches) {
                card.style.padding = '14px';
                card.querySelectorAll('[style*="grid-template-columns:repeat(3"]').forEach(el => {
                    el.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
                    el.style.gap = '6px';
                });
                actions.style.gridTemplateColumns = '1fr';
                actions.style.gap = '10px';
            }

            return card;
        }

        function garantirPainelPublicoTorneiosXadrez() {
            const card = document.querySelector('#chess-screen .chess-card');
            if (!card) return null;
            let panel = document.getElementById('chess-public-tournaments-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'chess-public-tournaments-panel';
                panel.className = 'chess-public-tournaments-panel chess-public-tournaments-panel-v15';
                panel.setAttribute('style', [
                    'box-sizing:border-box',
                    'width:100%',
                    'max-width:760px',
                    'margin:18px auto 22px auto',
                    'padding:18px',
                    'border-radius:22px',
                    'background:radial-gradient(circle at top left,rgba(34,211,238,.16),transparent 34%),linear-gradient(135deg,rgba(2,6,23,.96),rgba(8,47,73,.78))',
                    'border:1px solid rgba(56,189,248,.62)',
                    'box-shadow:0 18px 42px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08)',
                    'text-align:left',
                    'color:#e5e7eb',
                    'overflow:hidden'
                ].join(';'));
                panel.innerHTML = `
                    <div class="chess-public-tournaments-title" style="display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;color:#fde68a;font-size:1.02rem;font-weight:1000;line-height:1.2;margin:0 0 6px 0;">🏆 Torneios marcados</div>
                    <div class="chess-public-tournaments-desc" style="box-sizing:border-box;max-width:620px;margin:0 auto 14px auto;padding:9px 12px;border-radius:13px;background:rgba(15,23,42,.54);border:1px solid rgba(148,163,184,.18);color:#dbeafe;font-size:.78rem;line-height:1.35;text-align:center;">Acompanhe os torneios oficiais publicados pelo administrador.</div>
                    <div id="chess-public-tournaments-list" style="display:grid;gap:12px;"><div class="tiny-muted">Carregando torneios...</div></div>
                `;
            }
            const onlinePanel = document.getElementById('chess-online-panel');
            const trainingPanel = document.getElementById('chess-training-panel');
            if (onlinePanel && onlinePanel.nextElementSibling !== panel) {
                onlinePanel.insertAdjacentElement('afterend', panel);
            } else if (!onlinePanel && trainingPanel && trainingPanel.previousElementSibling !== panel) {
                card.insertBefore(panel, trainingPanel);
            } else if (!panel.parentNode) {
                card.appendChild(panel);
            }
            return panel;
        }

        let chessTournamentsPublicUnsubscribe = null;
        function carregarTorneiosPublicosXadrez(forcar = false) {
            garantirPainelPublicoTorneiosXadrez();
            const list = document.getElementById('chess-public-tournaments-list');
            const panel = document.getElementById('chess-public-tournaments-panel');
            if (!list || !panel) return;
            if (chessTournamentsPublicUnsubscribe) {
                if (!forcar) return;
                try { chessTournamentsPublicUnsubscribe(); } catch (_) {}
                chessTournamentsPublicUnsubscribe = null;
            }
            chessTournamentsPublicUnsubscribe = onValue(ref(db, 'chessTournaments'), (snapshot) => {
                limparElemento(list);
                const data = snapshot.val() || {};
                const itens = Object.entries(data)
                    .map(([id, t]) => [id, t || {}])
                    .filter(([, t]) => String(t.status || 'aberto') !== 'encerrado')
                    .sort((a, b) => numeroSeguro(a[1].date ? new Date(a[1].date).getTime() : a[1].createdAt) - numeroSeguro(b[1].date ? new Date(b[1].date).getTime() : b[1].createdAt))
                    .slice(0, 5);
                if (!itens.length) {
                    panel.dataset.temTorneio = '0';
                    panel.style.display = 'none';
                    list.appendChild(criarTexto('div', 'Nenhum torneio de Xadrez publicado no momento.', 'tiny-muted'));
                    return;
                }
                panel.dataset.temTorneio = '1';
                if (document.body.classList.contains('chess-board-visible')) {
                    panel.style.setProperty('display', 'none', 'important');
                } else {
                    panel.style.removeProperty('display');
                }
                itens.forEach(([id, t]) => list.appendChild(criarCardTorneioPublicoXadrez(t, id)));
            });
        }

        let chessRankingPublicUnsubscribe = null;

        function garantirPainelRankingGeralXadrez() {
            // PROFISSIONAL 16: ranking público foi retirado do menu do Xadrez.
            // O registro do ranking continua ativo por trás; a tela de ranking será feita em um menu próprio depois.
            removerPainelRankingGeralXadrez();
            return null;
        }

        function criarLinhaRankingGeralXadrez(jogador, posicao) {
            const row = document.createElement('div');
            row.className = 'chess-global-ranking-row';
            const nome = nomeSeguro(jogador?.name || 'Jogador');
            const pontos = numeroSeguro(jogador?.points);
            const vitorias = numeroSeguro(jogador?.wins);
            const derrotas = numeroSeguro(jogador?.losses);
            const empates = numeroSeguro(jogador?.draws);
            const mates = numeroSeguro(jogador?.checkmates);
            const mesPontos = numeroSeguro(jogador?.monthPoints);
            row.innerHTML = `
                <div class="chess-global-ranking-pos">#${posicao}</div>
                <div>
                    <div class="chess-global-ranking-name">${escapeHtmlXadrez(nome)}</div>
                    <div class="chess-global-ranking-meta">${vitorias}V • ${derrotas}D • ${empates}E • ${mates} mates • mês: ${mesPontos} pts</div>
                </div>
                <div class="chess-global-ranking-points">${pontos} pts</div>
            `;
            return row;
        }

        function carregarRankingGeralXadrez(forcar = false) {
            // PROFISSIONAL 16: não mostra ranking geral solto no menu nem em cima do tabuleiro.
            // Mantém apenas as funções de registro para uma futura tela própria de ranking.
            removerPainelRankingGeralXadrez();
        }

        function jogadorRankingXadrezId(player, cor) {
            const id = somenteTextoSeguro(player?.id || '', 80).replace(/[^a-zA-Z0-9_-]/g, '');
            if (id) return id;
            const nome = somenteTextoSeguro(player?.name || cor || 'jogador', 50).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            return `anon_${cor || 'player'}_${nome || 'jogador'}`;
        }

        async function atualizarRankingGeralJogadorXadrez(player, cor, resultado, meta = {}) {
            if (!player && !cor) return;
            const id = jogadorRankingXadrezId(player, cor);
            const nome = nomeSeguro(player?.name || (cor === 'white' ? 'Brancas' : 'Pretas'));
            const monthKey = new Date().toISOString().slice(0, 7);
            await runTransaction(ref(db, `chessRanking/${id}`), (atual) => {
                const base = atual && typeof atual === 'object' ? atual : {};
                const data = {
                    id,
                    name: nome,
                    lastColor: cor || base.lastColor || '',
                    games: numeroSeguro(base.games),
                    wins: numeroSeguro(base.wins),
                    losses: numeroSeguro(base.losses),
                    draws: numeroSeguro(base.draws),
                    checkmates: numeroSeguro(base.checkmates),
                    points: numeroSeguro(base.points),
                    monthKey: base.monthKey === monthKey ? base.monthKey : monthKey,
                    monthPoints: base.monthKey === monthKey ? numeroSeguro(base.monthPoints) : 0,
                    monthWins: base.monthKey === monthKey ? numeroSeguro(base.monthWins) : 0,
                    monthGames: base.monthKey === monthKey ? numeroSeguro(base.monthGames) : 0,
                    createdAt: base.createdAt || Date.now(),
                    updatedAt: Date.now()
                };
                data.games += 1;
                data.monthGames += 1;
                if (resultado === 'draw') {
                    data.draws += 1;
                    data.points += 1;
                    data.monthPoints += 1;
                } else if (resultado === 'win') {
                    data.wins += 1;
                    data.points += 3;
                    data.monthPoints += 3;
                    data.monthWins += 1;
                    if (meta.checkmate) data.checkmates += 1;
                } else if (resultado === 'loss') {
                    data.losses += 1;
                }
                return data;
            });
        }

        async function registrarRankingGeralXadrezOnline(textoEstado, opts = {}) {
            try {
                if (chessMode !== 'online' || !chessRoomId || !chessRoomRef || chessIsSpectator) return;
                const texto = String(textoEstado || lastMoveMessage || '');
                if (!/Xeque-mate|Empate|afogamento|desist/i.test(texto)) return;
                const players = (chessCurrentRoomData && chessCurrentRoomData.players) || chessRoomPlayers || {};
                const white = players.white || null;
                const black = players.black || null;
                if (!white && !black) return;
                const empate = /Empate|afogamento/i.test(texto);
                const winner = opts.winnerOverride || (/brancas/i.test(texto) ? 'white' : /pretas/i.test(texto) ? 'black' : '');
                const checkmate = /Xeque-mate/i.test(texto);
                const keyBase = `${chessRoomId}_${chessCurrentRoomData?.createdAt || 'sala'}_${(moveHistory || []).length}_${texto.slice(0, 80)}`;
                const key = keyBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
                const tx = await runTransaction(ref(db, `chessRooms/${chessRoomId}/rankingResultKey`), (current) => current || key);
                if (tx?.snapshot?.val() !== key) return;

                if (empate || !winner) {
                    await atualizarRankingGeralJogadorXadrez(white, 'white', 'draw');
                    await atualizarRankingGeralJogadorXadrez(black, 'black', 'draw');
                } else {
                    await atualizarRankingGeralJogadorXadrez(white, 'white', winner === 'white' ? 'win' : 'loss', { checkmate: checkmate && winner === 'white' });
                    await atualizarRankingGeralJogadorXadrez(black, 'black', winner === 'black' ? 'win' : 'loss', { checkmate: checkmate && winner === 'black' });
                }
                await update(ref(db, `chessRooms/${chessRoomId}`), { rankingResultRegisteredAt: Date.now() });
                carregarRankingGeralXadrez(true);
            } catch (e) {
                console.warn('Ranking geral do Xadrez não foi registrado:', e);
            }
        }

        function aplicarLinkDiretoTorneioXadrez() {
            try {
                const params = new URLSearchParams(location.search);
                if ((params.get('jogo') || '').toLowerCase() !== 'xadrez') return;
                const sala = normalizarSalaXadrez(params.get('sala') || '');
                abrirXadrezArena();
                const roomInput = document.getElementById('chess-online-room');
                const nameInput = document.getElementById('chess-online-name');
                if (roomInput && sala) roomInput.value = sala;
                if (nameInput && !normalizarCampoXadrez(nameInput.value)) nameInput.value = 'Espectador';
                const modo = (params.get('modo') || '').toLowerCase();
                const assistirDireto = params.get('assistir') === '1' || modo === 'assistir';
                if (assistirDireto && sala) {
                    setTimeout(() => entrarXadrezOnline(true), 700);
                }
            } catch (_) {}
        }

        function criarCardTorneioXadrez(torneio, id) {
            const card = document.createElement('div');
            card.className = 'chess-tournament-card';
            const nome = somenteTextoSeguro(torneio?.name || 'Torneio de Xadrez', 60);
            const sala = normalizarSalaXadrez(torneio?.room || '') || 'a definir';
            const status = somenteTextoSeguro(torneio?.status || 'aberto', 20);
            const mensagem = textoAvisoSeguro(torneio?.message || 'Participe do torneio de Xadrez e acompanhe as salas oficiais.', 180);
            card.innerHTML = `
                <strong>♟️ ${escapeHtmlXadrez(nome)}</strong>
                <div style="color:#cbd5e1; font-size:.75rem; line-height:1.35;">📅 ${escapeHtmlXadrez(formatarDataTorneioXadrez(torneio?.date))} • Sala: ${escapeHtmlXadrez(String(sala).toUpperCase())} • Status: ${escapeHtmlXadrez(status)}</div>
                <div style="color:#94a3b8; font-size:.74rem; line-height:1.35; margin-top:5px;">${escapeHtmlXadrez(mensagem)}</div>
            `;
            const actions = document.createElement('div');
            actions.style.display = 'grid';
            actions.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
            actions.style.gap = '8px';
            actions.style.marginTop = '8px';
            const usarSala = document.createElement('button');
            usarSala.className = 'mini-action-btn';
            usarSala.type = 'button';
            usarSala.textContent = 'Usar sala no painel';
            usarSala.onclick = () => {
                const salaInput = document.getElementById('chess-admin-room-input');
                const torneioInput = document.getElementById('chess-tournament-room-input');
                if (salaInput && sala !== 'a definir') salaInput.value = sala;
                if (torneioInput && sala !== 'a definir') torneioInput.value = sala;
            };
            actions.appendChild(usarSala);
            if (status !== 'encerrado') {
                const encerrar = document.createElement('button');
                encerrar.className = 'mini-action-btn';
                encerrar.type = 'button';
                encerrar.style.background = '#dc2626';
                encerrar.textContent = 'Encerrar';
                encerrar.onclick = async () => {
                    if (!(await exigirAdminSeguro())) return;
                    await update(ref(db, `chessTournaments/${id}`), { status: 'encerrado', closedAt: Date.now(), updatedAt: Date.now() });
                    mostrarToastXadrez('🏁 Torneio de Xadrez encerrado.');
                };
                actions.appendChild(encerrar);
            }
            const excluir = document.createElement('button');
            excluir.className = 'mini-action-btn';
            excluir.type = 'button';
            excluir.style.background = '#991b1b';
            excluir.textContent = 'Excluir torneio';
            excluir.onclick = async () => {
                if (!(await exigirAdminSeguro())) return;
                const ok = window.confirm(`Excluir o torneio "${nome}" de vez?`);
                if (!ok) return;
                await remove(ref(db, `chessTournaments/${id}`));
                mostrarToastXadrez('🗑️ Torneio de Xadrez excluído.');
            };
            actions.appendChild(excluir);
            card.appendChild(actions);
            return card;
        }

        async function criarTorneioXadrezAdmin() {
            if (!(await exigirAdminSeguro())) return;
            const nome = somenteTextoSeguro(document.getElementById('chess-tournament-name-input')?.value || '', 60);
            const data = document.getElementById('chess-tournament-date-input')?.value || '';
            const salaDigitada = document.getElementById('chess-tournament-room-input')?.value || document.getElementById('chess-admin-room-input')?.value || '';
            const sala = normalizarSalaXadrez(salaDigitada);
            const mensagem = textoAvisoSeguro(document.getElementById('chess-tournament-message-input')?.value || '', 240);
            if (!nome) {
                exibirAlertaDoSistema('Torneio de Xadrez', 'Digite o nome do torneio.');
                return;
            }
            const novoRef = push(ref(db, 'chessTournaments'));
            await set(novoRef, {
                game: 'xadrez',
                name: nome,
                date: data || '',
                room: sala || '',
                message: mensagem || `Novo torneio de Xadrez: ${nome}. Entre no Tabuleiro Arena para participar!`,
                publicLink: linkPublicoTorneioXadrez(sala, 'assistir'),
                status: 'aberto',
                createdBy: auth.currentUser?.uid || '',
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            if (sala) {
                await update(ref(db, `chessRooms/${sala}`), { isAuthorized: true, tournamentRoom: true, updatedAt: Date.now(), lastAdminAction: 'sala_vinculada_torneio_xadrez' });
            }
            mostrarToastXadrez(`🏆 Torneio de Xadrez publicado: ${nome}`);
            exibirAlertaDoSistema('Torneio publicado 🏆', `O torneio de Xadrez <strong>${nome}</strong> foi criado no painel do Xadrez.`);
        }

        let chessTournamentsAdminUnsubscribe = null;
        function carregarTorneiosXadrezAdmin() {
            const list = document.getElementById('chess-admin-tournament-list');
            if (!list) return;
            limparTorneiosEncerradosAntigos('chessTournaments', 'Xadrez');
            if (chessTournamentsAdminUnsubscribe) chessTournamentsAdminUnsubscribe();
            chessTournamentsAdminUnsubscribe = onValue(ref(db, 'chessTournaments'), (snapshot) => {
                limparElemento(list);
                const data = snapshot.val();
                if (!data) {
                    list.appendChild(criarTexto('div', 'Nenhum torneio de Xadrez criado ainda.', 'tiny-muted'));
                    return;
                }
                const itens = Object.entries(data)
                    .map(([id, t]) => [id, t || {}])
                    .sort((a, b) => numeroSeguro(b[1].createdAt) - numeroSeguro(a[1].createdAt))
                    .slice(0, 8);
                if (!itens.length) {
                    list.appendChild(criarTexto('div', 'Nenhum torneio de Xadrez criado ainda.', 'tiny-muted'));
                    return;
                }
                itens.forEach(([id, t]) => list.appendChild(criarCardTorneioXadrez(t, id)));
            });
        }

        async function gerarAvisosXadrezWhatsapp() {
            if (!(await exigirAdminSeguro())) return;
            const box = document.getElementById('chess-admin-whatsapp-list');
            if (!box) return;
            limparElemento(box);
            const sala = normalizarSalaXadrez(document.getElementById('chess-tournament-room-input')?.value || document.getElementById('chess-admin-room-input')?.value || '');
            const nomeTorneio = somenteTextoSeguro(document.getElementById('chess-tournament-name-input')?.value || 'Torneio de Xadrez', 60);
            const mensagemBase = textoAvisoSeguro(document.getElementById('chess-tournament-message-input')?.value || `Olá! Temos torneio de Xadrez no Tabuleiro Arena: ${nomeTorneio}. ${sala ? 'Sala: ' + sala.toUpperCase() : 'Entre no app para participar.'}`, 240);
            const snap = await get(ref(db, 'players'));
            const players = snap.val() || {};
            const autorizados = Object.values(players).filter(p => p && p.whatsappConsent && p.whatsapp);
            if (!autorizados.length) {
                box.appendChild(criarTexto('div', 'Nenhum jogador com WhatsApp autorizado foi encontrado.', 'tiny-muted'));
                return;
            }
            autorizados.slice(0, 40).forEach(p => {
                const row = document.createElement('div');
                row.className = 'chess-tournament-card';
                const nome = nomeSeguro(p.name || 'Jogador');
                const telefone = telefoneSeguro(p.whatsapp || '');
                const convite = montarConviteTorneioXadrez({
                    name: nomeTorneio,
                    room: sala,
                    date: document.getElementById('chess-tournament-date-input')?.value || '',
                    message: mensagemBase,
                    publicLink: linkPublicoTorneioXadrez(sala, 'assistir')
                });
                const msg = encodeURIComponent(convite);
                row.innerHTML = `<strong>📲 ${escapeHtmlXadrez(nome)}</strong><div style="color:#94a3b8; font-size:.75rem;">${escapeHtmlXadrez(telefone)}</div>`;
                const btn = document.createElement('button');
                btn.className = 'mini-action-btn';
                btn.type = 'button';
                btn.style.background = '#22c55e';
                btn.textContent = 'Enviar WhatsApp';
                btn.onclick = () => window.open(`https://wa.me/${telefone}?text=${msg}`, '_blank');
                row.appendChild(btn);
                box.appendChild(row);
            });
        }

        async function abrirAdminXadrezCentral() {
            if (!(await exigirAdminSeguro())) {
                exibirAlertaDoSistema('Acesso negado 🛡️', 'Entre primeiro com o login do administrador.');
                return;
            }
            instalarPainelAdminXadrez();
            // ✅ FASE 13.4: Admin do Xadrez fica isolado e não carrega tabuleiro na administração.
            document.body.classList.remove('platform-start-active','mode-selecting','game-selected','domino-selected','chess-focus-mode','chess-beginner-mode');
            document.body.classList.remove('chess-menu-active', 'chess-game-active', 'chess-board-visible');
            document.body.classList.add('chess-selected', 'chess-admin-only');
            const hub = document.getElementById('games-hub-panel');
            if (hub) hub.style.display = 'none';
            const lobby = document.getElementById('lobby-screen');
            const game = document.getElementById('game-screen');
            if (lobby) lobby.style.display = 'none';
            if (game) game.style.display = 'none';
            const chess = document.getElementById('chess-screen');
            if (chess) chess.style.display = 'block';
            const panel = document.getElementById('chess-admin-panel');
            if (panel) {
                panel.style.display = 'block';
                panel.setAttribute('aria-hidden', 'false');
            }
            const online = document.getElementById('chess-online-panel');
            if (online) online.style.display = 'none';
            atualizarStatusOnlineXadrez('🛡️ Modo administrador do Xadrez ativo. Só o painel administrativo fica visível.');
            ativarDashboardAdminXadrez();
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function obterSalaAdminXadrez() {
            const input = document.getElementById('chess-admin-room-input');
            const sala = normalizarSalaXadrez(input?.value || '');
            if (!sala) {
                exibirAlertaDoSistema('Sala obrigatória', 'Digite ou selecione o código da sala de Xadrez.');
                return '';
            }
            return sala;
        }

        function ativarDashboardAdminXadrez() {
            instalarPainelAdminXadrez();
            if (chessAdminUnsubscribeRooms) chessAdminUnsubscribeRooms();
            chessAdminUnsubscribeRooms = onValue(ref(db, 'chessRooms'), (snap) => {
                const list = document.getElementById('chess-admin-rooms-list');
                const panorama = document.getElementById('chess-admin-panorama');
                if (!list || !panorama) return;
                const data = snap.val() || {};
                const ids = Object.keys(data).sort();
                if (!ids.length) {
                    panorama.innerHTML = '📊 PANORAMA XADREZ: 0 salas registradas.';
                    list.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Nenhuma sala de Xadrez criada ainda.</div>';
                    return;
                }
                let liberadas = 0;
                list.innerHTML = '';
                ids.forEach(id => {
                    const sala = data[id] || {};
                    const ativa = sala.isAuthorized !== false;
                    if (ativa) liberadas++;
                    const white = sala.players?.white?.name || 'Aguardando brancas';
                    const black = sala.players?.black?.name || 'Aguardando pretas';
                    const specs = sala.spectators && typeof sala.spectators === 'object' ? Object.keys(sala.spectators).length : 0;
                    const chat = sala.chatBlocked ? ' • CHAT OFF' : '';
                    const row = document.createElement('div');
                    row.className = 'chess-admin-room-row' + (ativa ? '' : ' blocked');
                    row.innerHTML = `<div><strong>${escapeHtmlXadrez(id.toUpperCase())}</strong><div style="color:#94a3b8; margin-top:3px;">⚪ ${escapeHtmlXadrez(white)} vs ⚫ ${escapeHtmlXadrez(black)} • 👀 ${specs}${chat}</div></div><div style="color:${ativa ? '#22c55e' : '#ef4444'}; font-weight:900;">${ativa ? 'LIBERADA' : 'BLOQUEADA'}</div>`;
                    row.addEventListener('click', () => {
                        const input = document.getElementById('chess-admin-room-input');
                        if (input) input.value = id;
                    });
                    list.appendChild(row);
                });
                panorama.innerHTML = `📊 PANORAMA XADREZ: ${ids.length} salas | <span style="color:#22c55e;">${liberadas} liberadas</span> | <span style="color:#ef4444;">${ids.length - liberadas} bloqueadas</span>`;
            });
        }

        async function adminCriarLiberarSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const r = ref(db, `chessRooms/${sala}`);
            const snap = await get(r);
            if (!snap.exists()) {
                await set(r, estadoInicialSalaXadrezAdmin(sala));
                mostrarToastXadrez(`🛡️ Sala ${sala} criada e liberada pelo Admin.`);
            } else {
                await update(r, { isAuthorized: true, lastAdminAction: 'liberada_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
                mostrarToastXadrez(`🛡️ Sala ${sala} liberada.`);
            }
        }

        async function adminBloquearSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { isAuthorized: false, lastAdminAction: 'bloqueada_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🛡️ Sala ${sala} bloqueada.`);
        }

        async function adminAlternarChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const r = ref(db, `chessRooms/${sala}`);
            const snap = await get(r);
            const atual = snap.val()?.chatBlocked === true;
            await update(r, { chatBlocked: !atual, lastAdminAction: !atual ? 'chat_travado_admin_xadrez' : 'chat_liberado_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`💬 Chat da sala ${sala} ${!atual ? 'travado' : 'liberado'}.`);
        }

        async function adminExpulsarJogadoresXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { players: {}, spectators: {}, lastAdminAction: 'jogadores_expulsos_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🚪 Jogadores e espectadores removidos da sala ${sala}.`);
        }

        async function adminLimparChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            await update(ref(db, `chessRooms/${sala}`), { chat: null, lastAdminAction: 'chat_limpo_admin_xadrez', lastAdminAt: Date.now(), updatedAt: Date.now() });
            mostrarToastXadrez(`🧹 Chat da sala ${sala} limpo.`);
        }

        async function adminResetarSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const estado = estadoInicialSalaXadrezAdmin(sala);
            await update(ref(db, `chessRooms/${sala}`), { board: estado.board, turn: 'white', gameOver: false, lastMoveMessage: 'Partida resetada pelo administrador do Xadrez.', lastChessMove: null, enPassantTarget: null, moveHistory: [], rankingResultKey: null, rankingResultRegisteredAt: null, winner: null, resignedBy: null, updatedAt: Date.now(), lastAdminAction: 'tabuleiro_resetado_admin_xadrez', lastAdminAt: Date.now() });
            mostrarToastXadrez(`♟️ Tabuleiro da sala ${sala} resetado.`);
        }

        async function adminExcluirSalaXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            exibirConfirmacao('Excluir sala de Xadrez', `Tem certeza de que deseja excluir a sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>?`, async () => {
                await remove(ref(db, `chessRooms/${sala}`));
                mostrarToastXadrez(`❌ Sala ${sala} excluída.`);
            });
        }

        async function adminMonitorarChatXadrez() {
            if (!(await exigirAdminSeguro())) return;
            const sala = obterSalaAdminXadrez(); if (!sala) return;
            const monitor = document.getElementById('chess-admin-chat-monitor');
            if (!monitor) return;
            monitor.style.display = 'block';
            monitor.innerHTML = `💬 Monitorando chat da sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>...`;
            if (chessAdminUnsubscribeChat) chessAdminUnsubscribeChat();
            chessAdminUnsubscribeChat = onValue(ref(db, `chessRooms/${sala}/chat`), (snap) => {
                const msgs = Object.values(snap.val() || {}).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).slice(-80);
                if (!msgs.length) {
                    monitor.innerHTML = `💬 Sala <strong>${escapeHtmlXadrez(sala.toUpperCase())}</strong>: nenhuma mensagem.`;
                    return;
                }
                monitor.innerHTML = `<div style="color:#38bdf8; font-weight:900; margin-bottom:6px;">💬 Chat da sala ${escapeHtmlXadrez(sala.toUpperCase())}</div>` + msgs.map(m => `<div><strong style="color:#38bdf8;">${escapeHtmlXadrez(m.name || 'Jogador')}:</strong> ${escapeHtmlXadrez(m.text || '')}</div>`).join('');
                monitor.scrollTop = monitor.scrollHeight;
            });
        }



        // ================================================================
        // 📹 FASE 22 - CHAMADA DE VÍDEO/ÁUDIO DO XADREZ ONLINE
        // Caminho próprio: chessRooms/{sala}/call. Não usa nem altera a chamada da Damas.
        // ================================================================
        let chessCallPeer = null;
        let chessLocalCallStream = null;
        let chessCallUnsubscribe = null;
        let chessCallRemoteApplied = false;
        let chessCallSessionId = '';
        let chessProcessedRemoteCandidates = new Set();
        let chessLocalMicEnabled = true;
        let chessLocalCameraEnabled = true;
        let chessCallFloatingWidth = Number(localStorage.getItem('tabuleiroArenaChessCallHeight') || 150);
        chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth));

        function chessCallElements() {
            return {
                panel: document.getElementById('chess-call-panel'),
                status: document.getElementById('chess-call-status'),
                localVideo: document.getElementById('chess-local-video'),
                remoteVideo: document.getElementById('chess-remote-video'),
                remoteAudio: document.getElementById('chess-remote-audio'),
                startVideo: document.getElementById('chess-start-video-call-btn'),
                startAudio: document.getElementById('chess-start-audio-call-btn'),
                end: document.getElementById('chess-end-call-btn'),
                mic: document.getElementById('chess-toggle-mic-btn'),
                cam: document.getElementById('chess-toggle-camera-btn'),
                unlock: document.getElementById('chess-unlock-audio-btn'),
                minus: document.getElementById('chess-call-size-minus-btn'),
                plus: document.getElementById('chess-call-size-plus-btn'),
                toggle: document.getElementById('chess-call-toggle-btn'),
                localLabel: document.getElementById('chess-local-label'),
                remoteLabel: document.getElementById('chess-remote-label')
            };
        }

        function setChessCallStatus(texto) {
            const { status } = chessCallElements();
            if (status) status.innerText = texto;
        }

        function podeUsarChamadaXadrez() {
            return chessMode === 'online' && chessRoomId && !chessIsSpectator && (chessPlayerColor === 'white' || chessPlayerColor === 'black');
        }

        function oponenteChamadaXadrez() {
            return chessPlayerColor === 'white' ? 'black' : 'white';
        }

        function atualizarLabelsChamadaXadrez() {
            const { localLabel, remoteLabel } = chessCallElements();
            if (chessIsSpectator) {
                if (localLabel) localLabel.innerText = 'Brancas';
                if (remoteLabel) remoteLabel.innerText = 'Pretas';
                return;
            }
            if (localLabel) localLabel.innerText = chessPlayerColor === 'white' ? 'Você • Brancas' : 'Você • Pretas';
            if (remoteLabel) remoteLabel.innerText = chessPlayerColor === 'white' ? 'Oponente • Pretas' : 'Oponente • Brancas';
        }

        function atualizarPainelChamadaXadrez() {
            const els = chessCallElements();
            if (!els.panel) return;
            const online = chessMode === 'online' && !!chessRoomId;
            els.panel.classList.toggle('online-visible', online);
            els.panel.classList.toggle('call-active', !!chessLocalCallStream);
            atualizarLabelsChamadaXadrez();

            if (!online) {
                els.panel.classList.remove('online-visible', 'call-active');
                setChessCallStatus('Entre em uma sala online para liberar a chamada.');
                return;
            }

            if (chessIsSpectator) {
                setChessCallStatus('Espectador: sem câmera e sem microfone nesta fase.');
                if (els.startVideo) { els.startVideo.disabled = true; els.startVideo.style.display = 'none'; }
                if (els.startAudio) { els.startAudio.disabled = true; els.startAudio.style.display = 'none'; }
                if (els.mic) { els.mic.disabled = true; els.mic.style.display = 'none'; }
                if (els.cam) { els.cam.disabled = true; els.cam.style.display = 'none'; }
                if (els.end) { els.end.disabled = true; els.end.innerText = 'Encerrar'; }
                return;
            }

            if (els.startVideo) { els.startVideo.disabled = !!chessLocalCallStream; els.startVideo.style.display = ''; }
            if (els.startAudio) { els.startAudio.disabled = !!chessLocalCallStream; els.startAudio.style.display = ''; }
            if (els.end) { els.end.disabled = !chessLocalCallStream; els.end.innerText = 'Encerrar'; }
            if (els.mic) { els.mic.disabled = !chessLocalCallStream; els.mic.style.display = ''; }
            if (els.cam) { els.cam.disabled = !chessLocalCallStream; els.cam.style.display = ''; }
            if (els.unlock) els.unlock.style.display = '';

            if (chessLocalCallStream) {
                restaurarPosicaoChamadaXadrez();
            } else {
                setChessCallStatus('Disponível para os dois jogadores da sala de Xadrez.');
            }
        }

        function explicarErroMidiaXadrez(erro) {
            const nomeErro = erro?.name || '';
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') return 'A chamada precisa abrir em link HTTPS. Use o link publicado na Vercel.';
            if (nomeErro === 'NotAllowedError' || nomeErro === 'PermissionDeniedError') return 'Câmera ou microfone bloqueados. Libere as permissões do navegador para este site.';
            if (nomeErro === 'NotFoundError' || nomeErro === 'DevicesNotFoundError') return 'Este aparelho não encontrou câmera ou microfone disponível.';
            if (nomeErro === 'NotReadableError' || nomeErro === 'TrackStartError') return 'Câmera ou microfone estão ocupados por outro aplicativo. Feche outras chamadas e tente de novo.';
            return 'Não foi possível acessar câmera ou microfone. Confira as permissões do navegador.';
        }

        async function prepararMidiaXadrez(somenteAudio = false) {
            if (chessLocalCallStream) return chessLocalCallStream;
            const els = chessCallElements();
            try {
                if (somenteAudio) {
                    chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                } else {
                    try {
                        chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } }, audio: true });
                    } catch (erroVideo) {
                        chessLocalCallStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        mostrarToastXadrez('📵 Câmera não liberada. Chamada iniciada somente com áudio.', 'check');
                    }
                }
            } catch (erroMidia) {
                throw new Error(explicarErroMidiaXadrez(erroMidia));
            }
            chessLocalMicEnabled = true;
            chessLocalCameraEnabled = chessLocalCallStream.getVideoTracks().some(t => t.enabled);
            if (els.localVideo) els.localVideo.srcObject = chessLocalCallStream;
            if (els.panel) els.panel.classList.add('call-active');
            atualizarBotoesMidiaXadrez();
            restaurarPosicaoChamadaXadrez();
            return chessLocalCallStream;
        }

        function atualizarBotoesMidiaXadrez() {
            const { mic, cam } = chessCallElements();
            if (mic) {
                mic.innerText = chessLocalMicEnabled ? '🎙️ Mic' : '🔇 Mudo';
                mic.classList.toggle('chess-call-muted', !chessLocalMicEnabled);
            }
            if (cam) {
                cam.innerText = chessLocalCameraEnabled ? '📷 Cam' : '📵 Sem cam';
                cam.classList.toggle('chess-call-muted', !chessLocalCameraEnabled);
            }
        }

        function criarPeerChamadaXadrez() {
            if (chessCallPeer) return chessCallPeer;
            chessCallPeer = new RTCPeerConnection(rtcConfigGratis);
            const els = chessCallElements();

            chessCallPeer.ontrack = (event) => {
                let remoteStream = event.streams && event.streams[0];
                if (!remoteStream) {
                    remoteStream = els.remoteVideo?.srcObject instanceof MediaStream ? els.remoteVideo.srcObject : new MediaStream();
                }
                if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
                    try { remoteStream.addTrack(event.track); } catch (_) {}
                }
                if (els.remoteVideo) {
                    els.remoteVideo.srcObject = remoteStream;
                    els.remoteVideo.muted = true;
                    els.remoteVideo.play?.().catch(() => {});
                }
                if (els.remoteAudio) {
                    els.remoteAudio.srcObject = remoteStream;
                    els.remoteAudio.muted = false;
                    els.remoteAudio.volume = 1;
                    els.remoteAudio.play?.().catch(() => setChessCallStatus('Vídeo conectado. Toque em 🔊 Som para liberar o áudio.'));
                }
                setChessCallStatus('Conectado ✅');
                els.panel?.classList.add('call-active');
                restaurarPosicaoChamadaXadrez();
            };

            chessCallPeer.onicecandidate = async (event) => {
                if (!event.candidate || !chessRoomId || !chessPlayerColor) return;
                try {
                    await push(ref(db, `chessRooms/${chessRoomId}/call/candidates/${chessPlayerColor}`), {
                        ...event.candidate.toJSON(),
                        sessionId: chessCallSessionId,
                        createdAt: Date.now()
                    });
                } catch (e) { console.warn('Falha ao enviar ICE do Xadrez:', e); }
            };

            chessCallPeer.onconnectionstatechange = () => {
                const estado = chessCallPeer?.connectionState || 'new';
                if (estado === 'new') setChessCallStatus('Preparando conexão...');
                if (estado === 'connecting') setChessCallStatus('Conectando chamada...');
                if (estado === 'connected') setChessCallStatus('Conectado ✅');
                if (estado === 'disconnected') setChessCallStatus('Conexão instável. Tentando reconectar...');
                if (estado === 'failed') setChessCallStatus('A rede bloqueou a conexão direta. Tente trocar de internet ou usar somente áudio.');
                if (estado === 'closed') setChessCallStatus('Chamada encerrada.');
            };

            if (chessLocalCallStream) {
                chessLocalCallStream.getTracks().forEach(track => chessCallPeer.addTrack(track, chessLocalCallStream));
            }
            return chessCallPeer;
        }

        function limparListenerChamadaXadrez() {
            try { if (typeof chessCallUnsubscribe === 'function') chessCallUnsubscribe(); } catch (_) {}
            chessCallUnsubscribe = null;
        }

        async function iniciarChamadaXadrez(somenteAudio = false) {
            if (!podeUsarChamadaXadrez()) {
                mostrarToastXadrez('📹 A chamada do Xadrez funciona somente para os dois jogadores da sala online.', 'check');
                atualizarPainelChamadaXadrez();
                return;
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                mostrarToastXadrez('⚠️ Navegador sem suporte a câmera/microfone. Use Chrome ou Edge atualizado.', 'check');
                return;
            }
            chessCallSessionId = `${Date.now()}_${chessPlayerColor}_${getChessUid()}`;
            chessProcessedRemoteCandidates = new Set();
            chessCallRemoteApplied = false;
            setChessCallStatus('Pedindo permissão da câmera e microfone...');
            try {
                await prepararMidiaXadrez(somenteAudio);
                if (chessPlayerColor === 'white') {
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/offer`));
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/answer`));
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/candidates`));
                } else {
                    await remove(ref(db, `chessRooms/${chessRoomId}/call/candidates/${chessPlayerColor}`));
                }
                await update(ref(db, `chessRooms/${chessRoomId}/call`), { status: 'active', updatedAt: Date.now() });
                await update(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`), {
                    color: chessPlayerColor,
                    name: chessPlayerName || nomeCor(chessPlayerColor),
                    sessionId: chessCallSessionId,
                    joinedAt: Date.now()
                });
                try { onDisconnect(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`)).remove(); } catch (_) {}
                criarPeerChamadaXadrez();
                escutarSinalizacaoChamadaXadrez();
                atualizarPainelChamadaXadrez();
                setChessCallStatus(chessPlayerColor === 'white' ? 'Aguardando as pretas iniciarem a chamada...' : 'Aguardando convite das brancas...');
            } catch (e) {
                encerrarChamadaXadrez(false);
                mostrarToastXadrez('⚠️ ' + (e.message || 'Não foi possível iniciar a chamada.'), 'check');
            }
        }

        function escutarSinalizacaoChamadaXadrez() {
            limparListenerChamadaXadrez();
            if (!chessRoomId) return;
            chessCallUnsubscribe = onValue(ref(db, `chessRooms/${chessRoomId}/call`), async (snap) => {
                const callData = snap.val() || {};
                if (callData.status === 'ended' && callData.endedBy !== getChessUid() && chessLocalCallStream) {
                    encerrarChamadaXadrez(false);
                    setChessCallStatus('O oponente encerrou a chamada.');
                    return;
                }

                const participants = callData.participants || {};
                const temWhite = Object.values(participants).some(p => p?.color === 'white');
                const temBlack = Object.values(participants).some(p => p?.color === 'black');

                if (chessLocalCallStream && chessPlayerColor === 'white' && temWhite && temBlack && !callData.offer?.sdp) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                        await pc.setLocalDescription(offer);
                        await set(ref(db, `chessRooms/${chessRoomId}/call/offer`), {
                            type: offer.type,
                            sdp: offer.sdp,
                            fromColor: 'white',
                            sessionId: chessCallSessionId,
                            createdAt: Date.now()
                        });
                        setChessCallStatus('Convite enviado. Esperando resposta das pretas...');
                    } catch (e) { console.warn('Erro criando oferta do Xadrez:', e); setChessCallStatus('Falha ao criar convite da chamada.'); }
                }

                if (chessLocalCallStream && chessPlayerColor === 'black' && callData.offer?.sdp && !chessCallRemoteApplied) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: callData.offer.type, sdp: callData.offer.sdp }));
                        chessCallRemoteApplied = true;
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await set(ref(db, `chessRooms/${chessRoomId}/call/answer`), {
                            type: answer.type,
                            sdp: answer.sdp,
                            fromColor: 'black',
                            sessionId: chessCallSessionId,
                            createdAt: Date.now()
                        });
                        setChessCallStatus('Resposta enviada. Conectando...');
                    } catch (e) { console.warn('Erro respondendo chamada do Xadrez:', e); setChessCallStatus('Falha ao responder chamada.'); }
                }

                if (chessLocalCallStream && chessPlayerColor === 'white' && callData.answer?.sdp && !chessCallRemoteApplied) {
                    try {
                        const pc = criarPeerChamadaXadrez();
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: callData.answer.type, sdp: callData.answer.sdp }));
                        chessCallRemoteApplied = true;
                        setChessCallStatus('Resposta recebida. Conectando...');
                    } catch (e) { console.warn('Erro aplicando resposta do Xadrez:', e); setChessCallStatus('Falha ao aplicar resposta da chamada.'); }
                }

                if (chessLocalCallStream && callData.candidates) {
                    const outro = oponenteChamadaXadrez();
                    const lista = callData.candidates[outro] || {};
                    for (const [candId, cand] of Object.entries(lista)) {
                        const chave = `${outro}_${candId}`;
                        if (chessProcessedRemoteCandidates.has(chave)) continue;
                        try {
                            const pc = criarPeerChamadaXadrez();
                            if (!pc.remoteDescription || !cand?.candidate) continue;
                            await pc.addIceCandidate(new RTCIceCandidate(cand));
                            chessProcessedRemoteCandidates.add(chave);
                        } catch (e) { console.warn('ICE remoto do Xadrez aguardando:', e); }
                    }
                }
            });
        }

        function encerrarChamadaXadrez(notificarFirebase = true) {
            try { limparListenerChamadaXadrez(); } catch (_) {}
            try { if (chessCallPeer) chessCallPeer.close(); } catch (_) {}
            chessCallPeer = null;
            chessCallRemoteApplied = false;
            chessProcessedRemoteCandidates = new Set();

            if (chessLocalCallStream) {
                try { chessLocalCallStream.getTracks().forEach(t => t.stop()); } catch (_) {}
            }
            chessLocalCallStream = null;
            const els = chessCallElements();
            if (els.localVideo) els.localVideo.srcObject = null;
            if (els.remoteVideo) els.remoteVideo.srcObject = null;
            if (els.remoteAudio) els.remoteAudio.srcObject = null;
            if (els.panel) {
                els.panel.classList.remove('call-active');
                els.panel.style.left = '';
                els.panel.style.top = '';
                els.panel.style.right = '';
                els.panel.style.bottom = '';
                els.panel.style.transform = '';
            }
            if (notificarFirebase && chessRoomId) {
                update(ref(db, `chessRooms/${chessRoomId}/call`), { status: 'ended', endedBy: getChessUid(), endedAt: Date.now() }).catch(() => {});
                remove(ref(db, `chessRooms/${chessRoomId}/call/participants/${getChessUid()}`)).catch(() => {});
            }
            atualizarPainelChamadaXadrez();
        }

        function alternarMicXadrez() {
            if (!chessLocalCallStream) return;
            chessLocalMicEnabled = !chessLocalMicEnabled;
            chessLocalCallStream.getAudioTracks().forEach(t => t.enabled = chessLocalMicEnabled);
            atualizarBotoesMidiaXadrez();
        }

        function alternarCameraXadrez() {
            if (!chessLocalCallStream) return;
            const videos = chessLocalCallStream.getVideoTracks();
            if (!videos.length) {
                mostrarToastXadrez('📵 Esta chamada começou sem câmera.', 'check');
                return;
            }
            chessLocalCameraEnabled = !chessLocalCameraEnabled;
            videos.forEach(t => t.enabled = chessLocalCameraEnabled);
            atualizarBotoesMidiaXadrez();
        }

        function liberarSomXadrez() {
            const { remoteAudio, remoteVideo } = chessCallElements();
            if (remoteAudio) {
                remoteAudio.muted = false;
                remoteAudio.volume = 1;
                remoteAudio.play?.().then(() => setChessCallStatus('Som liberado 🔊')).catch(() => setChessCallStatus('Toque novamente ou aumente o volume do aparelho.'));
            }
            remoteVideo?.play?.().catch(() => {});
        }

        function aplicarTamanhoChamadaXadrez() {
            const { panel } = chessCallElements();
            if (!panel) return;
            chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth || 150));
            panel.style.setProperty('--fase35-video-height', `${chessCallFloatingWidth}px`);
            panel.dataset.callVideoHeight = String(chessCallFloatingWidth);
            try { localStorage.setItem('tabuleiroArenaChessCallHeight', String(chessCallFloatingWidth)); } catch (_) {}
        }

        function redimensionarChamadaXadrez(delta) {
            chessCallFloatingWidth = Math.max(110, Math.min(240, (chessCallFloatingWidth || 150) + delta));
            aplicarTamanhoChamadaXadrez();
        }

        function manterChamadaXadrezNaTela() {
            const { panel } = chessCallElements();
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.transform = '';
            panel.style.width = '';
            panel.style.maxWidth = '';
            aplicarTamanhoChamadaXadrez();
        }

        function restaurarPosicaoChamadaXadrez() {
            const { panel } = chessCallElements();
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.transform = '';
            panel.style.width = '';
            panel.style.maxWidth = '';
            aplicarTamanhoChamadaXadrez();
        }

        function ativarArrastarChamadaXadrez() {
            // Fase 36: arraste desativado de propósito.
            // A câmera do Xadrez agora fica fixa abaixo do tabuleiro para não cobrir as peças no celular.
            const { panel } = chessCallElements();
            if (!panel) return;
            const header = panel.querySelector('.chess-call-header');
            if (header) {
                header.dataset.chessDragReady = '0';
                header.style.cursor = 'default';
                header.style.touchAction = 'auto';
            }
        }

        function ligarEventosChamadaXadrez() {
            const els = chessCallElements();
            if (!els.panel || els.panel.dataset.chessCallBound === '1') return;
            els.panel.dataset.chessCallBound = '1';
            els.startVideo?.addEventListener('click', () => iniciarChamadaXadrez(false));
            els.startAudio?.addEventListener('click', () => iniciarChamadaXadrez(true));
            els.end?.addEventListener('click', () => encerrarChamadaXadrez(true));
            els.mic?.addEventListener('click', alternarMicXadrez);
            els.cam?.addEventListener('click', alternarCameraXadrez);
            els.unlock?.addEventListener('click', liberarSomXadrez);
            els.minus?.addEventListener('click', () => redimensionarChamadaXadrez(-40));
            els.plus?.addEventListener('click', () => redimensionarChamadaXadrez(40));
            els.toggle?.addEventListener('click', () => window.alternarPainelChamadaXadrezCompacto?.());
            ativarArrastarChamadaXadrez();
            atualizarPainelChamadaXadrez();
        }

        function iniciarModuloXadrez() {
            instalarCssXadrezFase5();
            instalarUiXadrezFase5();
            ligarEventosChamadaXadrez();
            try { chessSoundEnabled = localStorage.getItem('tabuleiroArenaChessSound') === '1'; } catch (_) {}
            atualizarBotaoSomXadrez();
            criarTabuleiroInicial();
            document.getElementById('chess-back-btn')?.addEventListener('click', voltarParaModalidades);
            document.getElementById('chess-back-btn-bottom')?.addEventListener('click', async () => { if (chessMode === 'online' && chessRoomId) await sairXadrezOnline(false); voltarParaModalidades(); });
            document.getElementById('chess-reset-btn')?.addEventListener('click', reiniciarXadrezOnlineOuLocal);
            document.getElementById('chess-new-btn')?.addEventListener('click', reiniciarXadrezOnlineOuLocal);
            document.getElementById('chess-resign-btn')?.addEventListener('click', desistirXadrez);
            document.getElementById('chess-board-leave-online-btn')?.addEventListener('click', async () => { await sairXadrezOnline(false); ocultarTabuleiroXadrezParaMenu(); mostrarToastXadrez('🚪 Você saiu da sala online. A vaga foi liberada.'); });
            document.getElementById('chess-undo-btn')?.addEventListener('click', desfazerJogada);
            document.getElementById('chess-online-join-btn')?.addEventListener('click', () => entrarXadrezOnline(false));
            document.getElementById('chess-online-watch-btn')?.addEventListener('click', () => entrarXadrezOnline(true));
            document.getElementById('chess-online-leave-btn')?.addEventListener('click', () => sairXadrezOnline(true));
            document.getElementById('chess-online-copy-btn')?.addEventListener('click', copiarSalaXadrez);
            document.getElementById('chess-sound-btn')?.addEventListener('click', alternarAlertaXadrez);
            document.getElementById('chess-focus-btn')?.addEventListener('click', alternarFocoTabuleiroXadrez);
            document.getElementById('chess-flip-btn')?.addEventListener('click', alternarVisaoTabuleiroXadrez);
            document.getElementById('chess-chat-send-btn')?.addEventListener('click', enviarChatXadrezOnline);
            document.getElementById('chess-history-toggle-btn')?.addEventListener('click', () => alternarHistoricoXadrez());
            document.getElementById('chess-history-clear-btn')?.addEventListener('click', limparHistoricoVisualXadrez);
            document.getElementById('chess-ranking-refresh-btn')?.addEventListener('click', () => { renderRankingTreinoXadrez(); mostrarToastXadrez('🏆 Ranking do Xadrez atualizado.'); });
            document.getElementById('chess-ranking-clear-btn')?.addEventListener('click', limparRankingTreinoXadrez);
            document.getElementById('chess-ranking-toggle-btn')?.addEventListener('click', alternarRankingTreinoXadrez);
            prepararRankingTreinoXadrez();
            // Fase 28: painel de conquistas removido da interface; conquistas internas permanecem sem aparecer no menu.
            document.getElementById('chess-chat-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') enviarChatXadrezOnline(); });
            document.getElementById('chess-training-easy-btn')?.addEventListener('click', () => iniciarTreinoXadrez('facil', false));
            document.getElementById('chess-training-medium-btn')?.addEventListener('click', () => iniciarTreinoXadrez('medio', false));
            document.getElementById('chess-training-hard-btn')?.addEventListener('click', () => iniciarTreinoXadrez('dificil', false));
            document.getElementById('chess-training-learn-btn')?.addEventListener('click', () => iniciarTreinoXadrez('medio', true));
            setTimeout(aplicarLinkDiretoTorneioXadrez, 300);
            document.getElementById('chess-training-tip-btn')?.addEventListener('click', atualizarDicaTreinoXadrez);
            document.getElementById('chess-result-close-btn')?.addEventListener('click', () => { const p = document.getElementById('chess-result-panel'); if (p) p.style.display = 'none'; });
            document.getElementById('chess-result-again-btn')?.addEventListener('click', () => { resetChessGame(); focarTabuleiroXadrez(false); });
            document.getElementById('chess-result-menu-btn')?.addEventListener('click', () => { limparResultadoXadrez(); ocultarTabuleiroXadrezParaMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
            document.getElementById('central-admin-xadrez-btn')?.addEventListener('click', abrirAdminXadrezCentral);
        }



        /* ✅ FASE 29 - XADREZ ONLINE ESTÁVEL
           Esta fase fica DENTRO do módulo do Xadrez, então consegue mexer apenas no Xadrez
           sem tocar na Damas. Corrige o problema de o Firebase atualizar chamada/chat/presença
           e forçar renderização do tabuleiro, fazendo a tela subir. */
        function instalarFase29XadrezOnlineEstavel() {
            window.__tabuleiroArenaXadrezFase29InternaAtiva = true;

            let ultimaAssinaturaRemotaXadrez29 = '';
            let ultimoHtmlBarraJogadoresXadrez29 = '';

            function assinaturaTabuleiroXadrez29(board) {
                const limpo = limparTabuleiroXadrezRecebido(board);
                if (!limpo) return 'sem-tabuleiro';
                let out = '';
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = limpo[r]?.[c];
                        out += p ? `${p.color[0]}${p.type[0]}${p.moved ? '1' : '0'}` : '--';
                    }
                }
                return out;
            }

            function assinaturaEstadoRemotoXadrez29(data) {
                if (!data || typeof data !== 'object') return 'vazio';
                const hist = Array.isArray(data.moveHistory) ? data.moveHistory.length : 0;
                const last = data.lastChessMove
                    ? `${data.lastChessMove?.from?.row ?? ''},${data.lastChessMove?.from?.col ?? ''}-${data.lastChessMove?.to?.row ?? ''},${data.lastChessMove?.to?.col ?? ''}`
                    : 'sem-ultima';
                const ep = data.enPassantTarget ? `${data.enPassantTarget.row ?? ''},${data.enPassantTarget.col ?? ''}` : 'sem-ep';
                const msg = String(data.lastMoveMessage || '').slice(0, 90);
                return [assinaturaTabuleiroXadrez29(data.board), data.turn === 'black' ? 'black' : 'white', data.gameOver ? 'fim' : 'jogo', hist, last, ep, msg].join('|');
            }

            function capturarTravaViewportXadrez29() {
                const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!wrap || chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) return null;
                const rect = wrap.getBoundingClientRect();
                return {
                    scrollY: window.scrollY,
                    top: rect.top,
                    left: rect.left,
                    height: rect.height,
                    activeId: document.activeElement && document.activeElement.id ? document.activeElement.id : ''
                };
            }

            function restaurarTravaViewportXadrez29(lock) {
                if (!lock) return;
                document.body.classList.add('chess-stabilizing-online');
                const restaurar = () => {
                    const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                    if (!wrap) {
                        document.body.classList.remove('chess-stabilizing-online');
                        return;
                    }
                    const after = wrap.getBoundingClientRect();
                    const diff = after.top - lock.top;
                    if (window.__chessRemoteApplyingXadrez30 === true && Math.abs(diff) > 14 && Math.abs(diff) < Math.max(260, window.innerHeight * 0.85)) {
                        window.scrollTo({ top: Math.max(0, window.scrollY + diff), behavior: 'auto' });
                    }
                    if (lock.activeId) {
                        const active = document.getElementById(lock.activeId);
                        if (active && document.activeElement !== active && /INPUT|TEXTAREA|BUTTON/.test(active.tagName)) {
                            try { active.focus({ preventScroll: true }); } catch (_) {}
                        }
                    }
                    setTimeout(() => document.body.classList.remove('chess-stabilizing-online'), 80);
                };
                requestAnimationFrame(() => {
                    restaurar();
                    requestAnimationFrame(restaurar);
                });
            }

            function nomeSeguroJogadorXadrez29(player, fallback) {
                return player && player.name ? escapeHtmlXadrez(player.name) : escapeHtmlXadrez(fallback || 'Aguardando');
            }

            function souEuJogadorXadrez29(player) {
                return !!(player && player.id && player.id === getChessUid());
            }

            function garantirBarraJogadoresXadrez29() {
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!boardWrap) return null;
                let bar = document.getElementById('chess-game-players-bar');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'chess-game-players-bar';
                    bar.className = 'chess-game-players-bar';
                    boardWrap.insertAdjacentElement('beforebegin', bar);
                }
                return bar;
            }

            function atualizarBarraJogadoresXadrez29(force = false) {
                const bar = garantirBarraJogadoresXadrez29();
                if (!bar) return;
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) {
                    bar.style.display = 'none';
                    return;
                }
                const white = chessRoomPlayers?.white || null;
                const black = chessRoomPlayers?.black || null;
                const whiteName = nomeSeguroJogadorXadrez29(white, 'Aguardando brancas');
                const blackName = nomeSeguroJogadorXadrez29(black, 'Aguardando pretas');
                const html = `
                    <div class="chess-game-players-side">
                        <span>⚪</span><span class="chess-game-players-name ${souEuJogadorXadrez29(white) ? 'me' : ''}">${whiteName}${souEuJogadorXadrez29(white) ? ' (você)' : ''}</span>
                    </div>
                    <div class="chess-game-players-vs">contra</div>
                    <div class="chess-game-players-side">
                        <span class="chess-game-players-name ${souEuJogadorXadrez29(black) ? 'me' : ''}">${blackName}${souEuJogadorXadrez29(black) ? ' (você)' : ''}</span><span>⚫</span>
                    </div>
                `;
                if (force || html !== ultimoHtmlBarraJogadoresXadrez29) {
                    bar.innerHTML = html;
                    ultimoHtmlBarraJogadoresXadrez29 = html;
                }
                bar.style.display = 'flex';
            }

            function garantirChatRecolhivelXadrez29() {
                const chat = document.getElementById('chess-chat-panel');
                if (!chat) return;
                const title = chat.querySelector('.chess-chat-title');
                if (!title) return;
                if (!document.getElementById('chess-chat-toggle-mini')) {
                    title.innerHTML = '<span>💬 Chat</span><button id="chess-chat-toggle-mini" class="chess-chat-toggle-mini" type="button">+</button>';
                    title.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        const collapsed = chat.classList.toggle('chat-collapsed');
                        const btn = document.getElementById('chess-chat-toggle-mini');
                        if (btn) btn.textContent = collapsed ? '+' : '−';
                    });
                }
                if (document.body.classList.contains('chess-board-visible') && chessMode === 'online') {
                    chat.classList.add('chat-collapsed');
                    const btn = document.getElementById('chess-chat-toggle-mini');
                    if (btn) btn.textContent = '+';
                }
            }

            function compactarTelaOnlineXadrez29() {
                document.body.classList.toggle('chess-mode-online', chessMode === 'online');
                document.body.classList.toggle('chess-mode-training', chessMode === 'training');
                const boardVisible = document.body.classList.contains('chess-board-visible');
                const history = document.getElementById('chess-history-panel');
                if (history && boardVisible) history.style.display = 'none';
                const material = document.getElementById('chess-material-panel');
                if (material && boardVisible) material.style.display = 'none';
                const roomPanel = document.getElementById('chess-room-players-panel');
                if (roomPanel && boardVisible) roomPanel.style.display = 'none';
                const quickMenu = document.getElementById('chess-menu-organizer');
                if (quickMenu) quickMenu.style.display = 'none';
                const achievements = document.getElementById('chess-achievements-panel');
                if (achievements) achievements.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat && boardVisible) {
                    chat.style.display = chessMode === 'online' ? 'block' : 'none';
                    if (chessMode === 'online') chat.classList.add('chat-collapsed');
                }
                garantirChatRecolhivelXadrez29();
                atualizarBarraJogadoresXadrez29();
            }

            function inserirSeloFase29Xadrez() {
                const title = document.querySelector('#chess-screen .chess-title');
                if (!title || document.getElementById('chess-online-stability-pill')) return;
                const pill = document.createElement('div');
                pill.id = 'chess-online-stability-pill';
                pill.className = 'chess-online-stability-pill';
                pill.textContent = 'Fase 29 • Firebase mais leve';
                title.insertAdjacentElement('afterend', pill);
            }

            const renderOriginalXadrez29 = renderChessBoard;
            renderChessBoard = function renderChessBoardFase29() {
                const lock = window.__chessRemoteApplyingXadrez30 === true ? capturarTravaViewportXadrez29() : null;
                renderOriginalXadrez29.apply(this, arguments);
                inserirSeloFase29Xadrez();
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const aplicarOriginalXadrez29 = aplicarEstadoXadrezRemoto;
            aplicarEstadoXadrezRemoto = function aplicarEstadoXadrezRemotoFase29(data) {
                if (!data) return;
                chessCurrentRoomData = data || {};
                chessRoomPlayers = data.players && typeof data.players === 'object' ? data.players : { white: null, black: null };
                chessRoomSpectators = data.spectators && typeof data.spectators === 'object' ? data.spectators : {};

                const assinatura = assinaturaEstadoRemotoXadrez29(data);
                const boardJaExiste = !!document.querySelector('#chess-board .chess-square');
                const soMudouPresencaChatOuChamada = assinatura === ultimaAssinaturaRemotaXadrez29 && boardJaExiste;

                if (soMudouPresencaChatOuChamada) {
                    verificarAlertaDeVezXadrez(data);
                    renderizarListaJogadoresXadrez();
                    compactarTelaOnlineXadrez29();
                    return;
                }

                ultimaAssinaturaRemotaXadrez29 = assinatura;
                const lock = capturarTravaViewportXadrez29();
                window.__chessRemoteApplyingXadrez30 = true;
                try {
                    aplicarOriginalXadrez29.call(this, data);
                } finally {
                    window.__chessRemoteApplyingXadrez30 = false;
                }
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const mostrarOriginalXadrez29 = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase29() {
                const lock = capturarTravaViewportXadrez29();
                mostrarOriginalXadrez29.apply(this, arguments);
                inserirSeloFase29Xadrez();
                compactarTelaOnlineXadrez29();
                restaurarTravaViewportXadrez29(lock);
            };

            const ocultarOriginalXadrez29 = ocultarTabuleiroXadrezParaMenu;
            ocultarTabuleiroXadrezParaMenu = function ocultarTabuleiroXadrezParaMenuFase29() {
                ocultarOriginalXadrez29.apply(this, arguments);
                const bar = document.getElementById('chess-game-players-bar');
                if (bar) bar.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat) chat.classList.remove('chat-collapsed');
            };

            const atualizarPainelOriginalXadrez29 = atualizarPainelOnlineXadrez;
            atualizarPainelOnlineXadrez = function atualizarPainelOnlineXadrezFase29() {
                atualizarPainelOriginalXadrez29.apply(this, arguments);
                compactarTelaOnlineXadrez29();
            };

            const renderPlayersOriginalXadrez29 = renderizarListaJogadoresXadrez;
            renderizarListaJogadoresXadrez = function renderizarListaJogadoresXadrezFase29() {
                renderPlayersOriginalXadrez29.apply(this, arguments);
                atualizarBarraJogadoresXadrez29();
            };

            const renderHistoricoOriginalXadrez29 = renderHistorico;
            renderHistorico = function renderHistoricoFase29() {
                if (document.body.classList.contains('chess-board-visible')) {
                    const panel = document.getElementById('chess-history-panel');
                    if (panel) panel.style.display = 'none';
                    return;
                }
                renderHistoricoOriginalXadrez29.apply(this, arguments);
            };

            const entrarOriginalXadrez29 = entrarXadrezOnline;
            entrarXadrezOnline = async function entrarXadrezOnlineFase29() {
                ultimaAssinaturaRemotaXadrez29 = '';
                ultimoHtmlBarraJogadoresXadrez29 = '';
                return entrarOriginalXadrez29.apply(this, arguments);
            };

            const sairOriginalXadrez29 = sairXadrezOnline;
            sairXadrezOnline = function sairXadrezOnlineFase29() {
                ultimaAssinaturaRemotaXadrez29 = '';
                ultimoHtmlBarraJogadoresXadrez29 = '';
                return sairOriginalXadrez29.apply(this, arguments);
            };

            const resultadoOriginalXadrez29 = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function mostrarResultadoXadrezSeTerminouFase29() {
                resultadoOriginalXadrez29.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const limparResultadoOriginalXadrez29 = limparResultadoXadrez;
            limparResultadoXadrez = function limparResultadoXadrezFase29() {
                limparResultadoOriginalXadrez29.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                inserirSeloFase29Xadrez();
                garantirBarraJogadoresXadrez29();
                garantirChatRecolhivelXadrez29();
                compactarTelaOnlineXadrez29();
            });
        }

        instalarFase29XadrezOnlineEstavel();


        /* ✅ FASE 30 - AJUSTE FINO DO TABULEIRO NO CELULAR
           Corrige o tabuleiro descentralizado e evita micro-movimentos na hora de tocar nas peças.
           Mantém Damas intacta. */
        function instalarFase30XadrezTabuleiroCentralizado() {
            window.__tabuleiroArenaXadrezFase30InternaAtiva = true;
            window.__chessRemoteApplyingXadrez30 = false;

            function atualizarSeloFase30() {
                const pill = document.getElementById('chess-online-stability-pill');
                if (pill) pill.textContent = 'Fase 36 • Tabuleiro estável';
                const clean = document.querySelector('#chess-screen .chess-clean-game-pill');
                if (clean && /Online/i.test(clean.textContent || '')) {
                    clean.textContent = '🎯 Online estável + tabuleiro centralizado';
                }
                const warning = document.querySelector('#chess-screen .chess-warning');
                if (warning) {
                    warning.textContent = '✅ Fase 36 ativa: Xadrez Online estável, câmera abaixo do tabuleiro e Damas preservada.';
                }
            }

            function travarLarguraVisualXadrez30() {
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) return;
                const card = document.querySelector('#chess-screen .chess-card');
                const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                const shell = document.querySelector('#chess-screen .chess-coord-shell');
                const board = document.getElementById('chess-board');
                if (card) {
                    card.style.maxWidth = '100%';
                    card.style.width = '100%';
                    card.style.minHeight = 'auto';
                }
                if (wrap) {
                    wrap.style.width = '100%';
                    wrap.style.maxWidth = window.innerWidth <= 560 ? 'calc(100vw - 20px)' : '640px';
                    wrap.style.marginLeft = 'auto';
                    wrap.style.marginRight = 'auto';
                    wrap.style.aspectRatio = 'auto';
                    wrap.style.minHeight = 'auto';
                }
                if (shell) {
                    shell.style.width = '100%';
                    shell.style.aspectRatio = '1 / 1';
                }
                if (board) {
                    board.style.width = '100%';
                    board.style.height = '100%';
                    board.style.aspectRatio = '1 / 1';
                }
            }

            const renderAnteriorFase30 = renderChessBoard;
            renderChessBoard = function renderChessBoardFase30SemToques() {
                renderAnteriorFase30.apply(this, arguments);
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            };

            const mostrarAnteriorFase30 = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase30() {
                mostrarAnteriorFase30.apply(this, arguments);
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            };

            window.addEventListener('orientationchange', () => setTimeout(travarLarguraVisualXadrez30, 350));
            window.addEventListener('resize', () => setTimeout(travarLarguraVisualXadrez30, 80));
            document.addEventListener('DOMContentLoaded', () => {
                atualizarSeloFase30();
                travarLarguraVisualXadrez30();
            });
        }

        instalarFase30XadrezTabuleiroCentralizado();

        /* ✅ PROFISSIONAL 20 — PROFESSOR INTELIGENTE AVANÇADO
           Baseado no Manual Privado do Professor: ativa com # no nome (#Isiquel ou Isiquel#),
           aparece apenas no aparelho do professor e adiciona análise didática da posição.
           Não joga sozinho, não altera partida, Firebase, Damas, Admin, torneios ou sala online. */
        function instalarManualPrivadoProfessorXadrez19() {
            instalarCssManualPrivadoProfessorXadrez19();
            garantirPainelManualPrivadoProfessorXadrez19();

            function detectarProfessorPrivadoPorNomeXadrez19(nome) {
                const raw = String(nome || '').trim();
                return raw.length > 1 && (raw.startsWith('#') || raw.endsWith('#'));
            }

            function limparNomeProfessorPrivadoXadrez19(nome) {
                return String(nome || '')
                    .trim()
                    .replace(/^#+\s*/g, '')
                    .replace(/\s*#+$/g, '')
                    .replace(/\s+/g, ' ')
                    .slice(0, 18);
            }

            function professorPrivadoPodeAparecerXadrez19() {
                return !!(chessProfessorPrivadoAtivo && chessMode === 'online' && document.body.classList.contains('chess-board-visible'));
            }

            function instalarCssManualPrivadoProfessorXadrez19() {
                if (document.getElementById('chess-private-teacher-style-19')) return;
                const style = document.createElement('style');
                style.id = 'chess-private-teacher-style-19';
                style.textContent = `
                    #chess-private-teacher-panel {
                        max-width: 520px;
                        margin: 12px auto 0 auto;
                        background: linear-gradient(135deg, rgba(2,6,23,.98), rgba(15,23,42,.98));
                        border: 1px solid rgba(56,189,248,.42);
                        border-radius: 14px;
                        padding: 10px;
                        text-align: left;
                        box-shadow: 0 14px 36px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);
                        color: #e2e8f0;
                    }
                    #chess-private-teacher-panel .teacher-head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        margin-bottom: 8px;
                    }
                    #chess-private-teacher-panel .teacher-title {
                        color: #7dd3fc;
                        font-size: .78rem;
                        font-weight: 1000;
                        letter-spacing: .45px;
                        text-transform: uppercase;
                    }
                    #chess-private-teacher-panel .teacher-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        margin-left: 6px;
                        padding: 2px 7px;
                        border-radius: 999px;
                        background: rgba(16,185,129,.13);
                        border: 1px solid rgba(16,185,129,.35);
                        color: #86efac;
                        font-size: .64rem;
                        font-weight: 900;
                        vertical-align: middle;
                    }
                    #chess-private-teacher-toggle {
                        width: auto;
                        min-width: 34px;
                        padding: 5px 9px;
                        border-radius: 8px;
                        background: #0f766e;
                        color: white;
                        font-size: .78rem;
                        line-height: 1;
                    }
                    #chess-private-teacher-body { display: block; }
                    #chess-private-teacher-panel.teacher-collapsed #chess-private-teacher-body { display: none; }
                    #chess-private-teacher-text {
                        background: rgba(15,23,42,.84);
                        border: 1px solid rgba(148,163,184,.16);
                        border-radius: 10px;
                        padding: 10px;
                        color: #dbeafe;
                        font-size: .84rem;
                        line-height: 1.45;
                        min-height: 58px;
                    }
                    #chess-private-teacher-text strong { color: #facc15; }
                    #chess-private-teacher-text .muted { color: #94a3b8; }
                    #chess-private-teacher-text .good { color: #86efac; font-weight: 900; }
                    #chess-private-teacher-text .warn { color: #fbbf24; font-weight: 900; }
                    #chess-private-teacher-text .danger { color: #fca5a5; font-weight: 900; }
                    .teacher-tip-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 7px;
                        margin-top: 8px;
                    }
                    .teacher-tip-pill {
                        background: rgba(30,41,59,.72);
                        border: 1px solid rgba(255,255,255,.08);
                        border-radius: 9px;
                        padding: 7px 8px;
                        color: #cbd5e1;
                        font-size: .72rem;
                        line-height: 1.25;
                    }
                    #chess-private-teacher-panel .teacher-analyze-btn {
                        grid-column: 1 / -1;
                        width: 100%;
                        margin-top: 1px;
                        border: 1px solid rgba(56,189,248,.35);
                        background: linear-gradient(135deg, #0f766e, #2563eb);
                        color: #ffffff;
                        font-weight: 1000;
                        border-radius: 10px;
                        padding: 8px 10px;
                        box-shadow: 0 8px 18px rgba(37,99,235,.18);
                    }
                    #chess-private-teacher-text .teacher-section-title {
                        display: block;
                        margin-top: 9px;
                        margin-bottom: 4px;
                        color: #7dd3fc;
                        font-weight: 1000;
                        text-transform: uppercase;
                        font-size: .7rem;
                        letter-spacing: .35px;
                    }
                    #chess-private-teacher-text .teacher-move-list {
                        margin: 7px 0 0 0;
                        padding: 0;
                        list-style: none;
                    }
                    #chess-private-teacher-text .teacher-move-list li {
                        margin-top: 6px;
                        padding: 7px 8px;
                        border-radius: 9px;
                        background: rgba(2,132,199,.12);
                        border: 1px solid rgba(125,211,252,.16);
                        color: #dbeafe;
                    }
                    #chess-private-teacher-text .teacher-move-main { color: #fef3c7; font-weight: 1000; }
                    #chess-private-teacher-text .teacher-score { color: #86efac; font-weight: 1000; }
                    #chess-private-teacher-text .teacher-small { color: #94a3b8; font-size: .75rem; }
                    body:not(.chess-board-visible) #chess-private-teacher-panel,
                    body.chess-menu-active #chess-private-teacher-panel { display: none !important; }
                    @media(max-width:560px){
                        #chess-private-teacher-panel { margin-top: 10px; padding: 9px; }
                        .teacher-tip-grid { grid-template-columns: 1fr; }
                        #chess-private-teacher-text { font-size: .8rem; }
                    }
                `;
                document.head.appendChild(style);
            }

            function garantirPainelManualPrivadoProfessorXadrez19() {
                if (document.getElementById('chess-private-teacher-panel')) return document.getElementById('chess-private-teacher-panel');
                const actions = document.querySelector('#chess-screen .chess-actions');
                const card = document.querySelector('#chess-screen .chess-card');
                if (!actions && !card) return null;
                const panel = document.createElement('div');
                panel.id = 'chess-private-teacher-panel';
                panel.style.display = 'none';
                panel.innerHTML = `
                    <div class="teacher-head">
                        <div class="teacher-title">🎓 Professor inteligente <span class="teacher-badge">privado</span></div>
                        <button id="chess-private-teacher-toggle" type="button" aria-label="Recolher manual">−</button>
                    </div>
                    <div id="chess-private-teacher-body">
                        <div id="teacher-prof37-controls" class="teacher-prof37-controls">
                            <div class="prof37-title">
                                <span>🎯 Robô do professor</span>
                                <span data-prof37-state>PRONTO</span>
                            </div>
                            <div class="prof37-grid">
                                <button type="button" data-prof37="window">Janelinha ON</button>
                                <button type="button" data-prof37="colors">Robô cores OFF</button>
                                <button type="button" data-prof37="refresh">Atualizar cores</button>
                                <button type="button" data-prof37="bubble">Abrir balão</button>
                                <button type="button" data-prof37="clear">Limpar cores</button>
                                <button type="button" data-prof37="legend">Legenda</button>
                            </div>
                            <div class="prof37-help" data-prof37-help>
                                Janelinha ON: tocar na peça abre o balão. Robô cores ON: amarelo pisca na peça indicada, verde pisca na casa boa e vermelho marca perigo.
                            </div>
                        </div>
                        <div id="chess-private-teacher-text">
                            Toque em uma peça ou use a análise da posição para receber dicas de ensino neste aparelho.
                        </div>
                        <div class="teacher-tip-grid">
                            <div class="teacher-tip-pill">🟨 peça tocada</div>
                            <div class="teacher-tip-pill">🟢 casas legais</div>
                            <div class="teacher-tip-pill">🔴 captura possível</div>
                            <div class="teacher-tip-pill">🛡️ foco: ensinar, defender e explicar</div>
                            <button id="chess-private-teacher-analyze-btn" class="teacher-analyze-btn" type="button">🔎 Analisar posição</button>
                        </div>
                    </div>
                `;
                if (actions && actions.parentNode) actions.insertAdjacentElement('afterend', panel);
                else card.appendChild(panel);
                const btn = panel.querySelector('#chess-private-teacher-toggle');
                if (btn) {
                    btn.addEventListener('click', () => {
                        chessProfessorPrivadoRecolhido = !chessProfessorPrivadoRecolhido;
                        panel.classList.toggle('teacher-collapsed', chessProfessorPrivadoRecolhido);
                        btn.textContent = chessProfessorPrivadoRecolhido ? '+' : '−';
                    });
                }
                const analyzeBtn = panel.querySelector('#chess-private-teacher-analyze-btn');
                if (analyzeBtn) {
                    analyzeBtn.addEventListener('click', () => {
                        if (!professorPrivadoPodeAparecerXadrez19()) return;
                        atualizarManualPrivadoProfessorXadrez19(criarAnalisePosicaoProfessorXadrez20(chessPlayerColor || chessTurn));
                    });
                }
                return panel;
            }

            function corDaPecaTextoProfessorXadrez19(cor) {
                return cor === 'white' ? 'brancas' : 'pretas';
            }

            function casasMovimentosProfessorXadrez19(movimentos) {
                const casas = (movimentos || []).slice(0, 12).map(m => alg(m.row, m.col));
                if (!casas.length) return 'nenhuma casa legal agora';
                return casas.join(', ') + ((movimentos || []).length > 12 ? '...' : '');
            }

            function diagnosticarPecaProfessorXadrez19(peca, row, col, movimentos) {
                const adversario = corOposta(peca.color);
                const ameacada = quadradoAtacado(chessBoard, row, col, adversario);
                const protegida = quadradoAtacado(chessBoard, row, col, peca.color);
                const capturas = (movimentos || []).filter(m => m.capture);
                const centro = row >= 2 && row <= 5 && col >= 2 && col <= 5;
                const inicio = (peca.color === 'white' && row >= 6) || (peca.color === 'black' && row <= 1);
                let foco = 'Explique para o aluno o objetivo da peça antes de jogar.';

                if (reiEstaEmXeque(chessBoard, peca.color)) {
                    foco = 'O rei desse lado está em xeque: ensine que a prioridade é fugir, bloquear ou capturar a ameaça.';
                } else if (capturas.length) {
                    foco = 'Existe captura possível. Oriente o aluno a conferir se a peça ficará protegida depois da captura.';
                } else if (peca.type === 'king') {
                    foco = 'Com o rei, a aula é segurança: ele não deve entrar em casa atacada.';
                } else if (peca.type === 'pawn') {
                    foco = 'Com peão, ensine estrutura, avanço com apoio e captura somente na diagonal.';
                } else if ((peca.type === 'knight' || peca.type === 'bishop') && inicio) {
                    foco = 'Boa chance para ensinar desenvolvimento: tirar cavalo e bispo ajuda a controlar o centro.';
                } else if (peca.type === 'queen') {
                    foco = 'A dama é forte, mas explique o cuidado para não sair cedo demais e virar alvo.';
                } else if (peca.type === 'rook') {
                    foco = 'A torre fica melhor em coluna aberta. Explique linhas retas e apoio a peões.';
                } else if (centro) {
                    foco = 'Essa peça influencia o centro. Use isso para explicar controle de espaço.';
                }

                const risco = ameacada
                    ? (protegida ? '<span class="warn">A peça está ameaçada, mas parece ter defesa.</span>' : '<span class="danger">A peça está ameaçada e pode estar sem defesa.</span>')
                    : '<span class="good">A peça não parece estar atacada diretamente agora.</span>';

                return { risco, foco, capturas };
            }

            function valorProfessorXadrez20(tipo) {
                return { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 }[tipo] || 0;
            }

            function pecaCapturadaProfessorXadrez20(board, move) {
                if (!move) return null;
                if (move.enPassant && move.enPassantCapture) return board[move.enPassantCapture.row]?.[move.enPassantCapture.col] || null;
                return board[move.row]?.[move.col] || null;
            }

            function centroProfessorXadrez20(row, col) {
                if ((row === 3 || row === 4) && (col === 3 || col === 4)) return 2;
                if (row >= 2 && row <= 5 && col >= 2 && col <= 5) return 1;
                return 0;
            }

            function descreverRazoesProfessorXadrez20(razoes) {
                const unicas = [];
                for (const r of razoes) {
                    if (r && !unicas.includes(r)) unicas.push(r);
                }
                return unicas.slice(0, 3).join(' • ') || 'jogada útil para explicar desenvolvimento, defesa e plano.';
            }

            function pontuarMovimentoProfessorXadrez20(board, item, corBase) {
                const peca = board[item.from.row]?.[item.from.col] || null;
                if (!peca) return null;
                const adversario = corOposta(peca.color);
                const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                if (!temp) return null;

                const capturada = pecaCapturadaProfessorXadrez20(board, item.to);
                const destinoAtacado = peca.type !== 'king' && quadradoAtacado(temp, item.to.row, item.to.col, adversario);
                const destinoDefendido = quadradoAtacado(temp, item.to.row, item.to.col, peca.color);
                const estavaAmeacada = peca.type !== 'king' && quadradoAtacado(board, item.from.row, item.from.col, adversario);
                const ficaAmeacadaSemDefesa = destinoAtacado && !destinoDefendido;
                const daXeque = reiEstaEmXeque(temp, adversario);
                const respostasAdversario = todosMovimentosLegais(adversario, temp);
                const mate = daXeque && respostasAdversario.length === 0;
                const melhora = Math.round((avaliarPosicaoTreinoXadrez(temp, peca.color) - avaliarPosicaoTreinoXadrez(board, peca.color)) / 16);
                const razoes = [];
                let score = 0;

                if (mate) { score += 10000; razoes.push('mostra xeque-mate'); }
                else if (daXeque) { score += 120; razoes.push('cria xeque e obriga resposta'); }

                if (reiEstaEmXeque(board, peca.color)) { score += 180; razoes.push('responde ao xeque'); }

                if (capturada) {
                    const ganho = valorProfessorXadrez20(capturada.type) - (destinoAtacado && !destinoDefendido ? valorProfessorXadrez20(peca.type) * 0.6 : 0);
                    score += Math.max(20, ganho / 2.4);
                    razoes.push(`captura ${nomePeca[capturada.type].toLowerCase()}`);
                }

                if (item.to.castle) { score += 110; razoes.push('faz roque e protege o rei'); }
                if (peca.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) { score += 500; razoes.push('promove peão'); }

                const centro = centroProfessorXadrez20(item.to.row, item.to.col);
                if (centro === 2) { score += 34; razoes.push('ocupa o centro'); }
                else if (centro === 1) { score += 16; razoes.push('melhora controle central'); }

                const saiuBase = (peca.color === 'white' && item.from.row === 7) || (peca.color === 'black' && item.from.row === 0);
                if ((peca.type === 'knight' || peca.type === 'bishop') && saiuBase) { score += 42; razoes.push('desenvolve peça'); }
                if (peca.type === 'queen' && ((peca.color === 'white' && item.to.row < 6) || (peca.color === 'black' && item.to.row > 1))) {
                    score -= 18;
                    razoes.push('cuidado para não expor a dama cedo');
                }
                if (estavaAmeacada && !destinoAtacado) { score += 52; razoes.push('tira peça de ameaça'); }
                if (destinoAtacado && destinoDefendido) { score -= Math.min(55, valorProfessorXadrez20(peca.type) / 20); razoes.push('destino atacado, mas defendido'); }
                if (ficaAmeacadaSemDefesa) { score -= Math.min(160, valorProfessorXadrez20(peca.type) / 7); razoes.push('atenção: pode ficar sem defesa'); }
                if (peca.type === 'king' && destinoAtacado) { score -= 300; razoes.push('rei em casa perigosa'); }

                score += melhora;
                if (melhora > 30) razoes.push('melhora a posição');
                if (melhora < -35) razoes.push('pode piorar a posição');

                return {
                    item,
                    peca,
                    score,
                    razoes: descreverRazoesProfessorXadrez20(razoes),
                    texto: `${nomePeca[peca.type]} ${alg(item.from.row, item.from.col)} → ${alg(item.to.row, item.to.col)}`
                };
            }

            function melhoresMovimentosProfessorXadrez20(cor, board = chessBoard, filtro = null, limite = 3) {
                let movimentos = [];
                if (filtro) {
                    const peca = board[filtro.row]?.[filtro.col];
                    if (peca) {
                        movimentos = calcularMovimentosLegais(filtro.row, filtro.col, board).map(m => ({ from: { row: filtro.row, col: filtro.col }, to: m }));
                    }
                } else {
                    movimentos = todosMovimentosLegais(cor, board);
                }
                return movimentos
                    .map(item => pontuarMovimentoProfessorXadrez20(board, item, cor))
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limite);
            }

            function renderizarSugestoesProfessorXadrez20(lista, titulo = 'Dicas fortes para ensinar') {
                if (!lista || !lista.length) {
                    return '<span class="teacher-section-title">Professor inteligente</span><span class="muted">Não encontrei uma dica forte agora. Use a posição para ensinar segurança do rei e peças protegidas.</span>';
                }
                return `
                    <span class="teacher-section-title">${titulo}</span>
                    <ul class="teacher-move-list">
                        ${lista.map((sug, idx) => `
                            <li>
                                <span class="teacher-move-main">${idx + 1}. ${sug.texto}</span><br>
                                <span class="teacher-small">${sug.razoes}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="teacher-small" style="margin-top:7px;">Use como roteiro de aula: confirme no tabuleiro, explique o motivo e deixe o aluno pensar antes de jogar.</div>
                `;
            }

            function criarAnalisePosicaoProfessorXadrez20(cor = chessTurn) {
                const corAnalise = cor || chessTurn || 'white';
                const emXeque = reiEstaEmXeque(chessBoard, corAnalise);
                const lista = melhoresMovimentosProfessorXadrez20(corAnalise, chessBoard, null, 3);
                const lado = corDaPecaTextoProfessorXadrez19(corAnalise);
                const abertura = emXeque
                    ? `<span class="danger">O rei das ${lado} está em xeque.</span> A aula deve começar mostrando as três defesas: fugir, capturar ou bloquear.`
                    : `Análise didática das ${lado}. Priorize segurança do rei, desenvolvimento e peças protegidas.`;
                return `${abertura}${renderizarSugestoesProfessorXadrez20(lista, 'Melhores dicas da posição')}`;
            }

            function criarDicaManualPrivadoProfessorXadrez19(peca, row, col, movimentos, contexto = '') {
                if (!peca) {
                    return 'Toque em uma peça para preparar uma explicação para o aluno. O manual não altera a partida.';
                }
                const diag = diagnosticarPecaProfessorXadrez19(peca, row, col, movimentos);
                const movimentosQtd = (movimentos || []).length;
                const capturasQtd = diag.capturas.length;
                const vez = chessTurn === peca.color ? 'é a vez desse lado jogar' : 'não é a vez desse lado agora';
                const movimentoTexto = textoMovimentoPecaXadrez(peca.type);
                const sugestoes = melhoresMovimentosProfessorXadrez20(peca.color, chessBoard, { row, col }, 3);
                return `
                    <strong>${nomePeca[peca.type]} ${corDaPecaTextoProfessorXadrez19(peca.color)}</strong> em <strong>${alg(row, col)}</strong> — ${vez}.<br>
                    <span class="muted">${movimentoTexto}</span><br>
                    ${diag.risco}<br>
                    <strong>Casas legais:</strong> ${movimentosQtd} movimento(s), ${capturasQtd} captura(s). <span class="muted">${casasMovimentosProfessorXadrez19(movimentos)}</span><br>
                    <strong>Como explicar:</strong> ${diag.foco}${contexto ? `<br><span class="muted">${contexto}</span>` : ''}
                    ${renderizarSugestoesProfessorXadrez20(sugestoes, 'Melhores dicas dessa peça')}
                `;
            }

            function atualizarManualPrivadoProfessorXadrez19(texto = '') {
                const panel = garantirPainelManualPrivadoProfessorXadrez19();
                const el = document.getElementById('chess-private-teacher-text');
                if (!panel || !el) return;
                const ativo = professorPrivadoPodeAparecerXadrez19();
                panel.style.display = ativo ? 'block' : 'none';
                panel.classList.toggle('teacher-collapsed', chessProfessorPrivadoRecolhido);
                const btn = document.getElementById('chess-private-teacher-toggle');
                if (btn) btn.textContent = chessProfessorPrivadoRecolhido ? '+' : '−';
                if (!ativo) return;
                if (texto) chessProfessorPrivadoTexto = texto;
                if (!chessProfessorPrivadoTexto) {
                    chessProfessorPrivadoTexto = chessPlayerColor === chessTurn
                        ? 'Professor inteligente ligado. Toque em uma peça ou clique em Analisar posição para ver dicas de ensino.'
                        : 'Professor inteligente ligado. Observe a posição do aluno, toque numa peça ou clique em Analisar posição para preparar sua explicação.';
                }
                el.innerHTML = chessProfessorPrivadoTexto;
            }

            function atualizarManualPorPecaProfessorXadrez19(row, col, contexto = '') {
                const peca = chessBoard[row]?.[col] || null;
                const movimentos = peca ? calcularMovimentosLegais(row, col, chessBoard) : [];
                selectedSquare = peca ? { row, col } : null;
                legalMoves = movimentos;
                chessProfessorPrivadoTexto = criarDicaManualPrivadoProfessorXadrez19(peca, row, col, movimentos, contexto);
                atualizarManualPrivadoProfessorXadrez19(chessProfessorPrivadoTexto);
                renderChessBoard();
            }

            function mensagemAposJogadaProfessorXadrez19(peca, fromRow, fromCol, move, estado = '') {
                if (!peca) return '';
                const partes = [];
                partes.push(`<strong>Jogada feita:</strong> ${nomePeca[peca.type]} de ${alg(fromRow, fromCol)} para ${alg(move.row, move.col)}.`);
                if (move.capture) partes.push('<span class="good">Houve captura.</span> Explique que ganhar material é bom quando a peça não fica vulnerável em seguida.');
                if (move.castle) partes.push('<span class="good">Roque realizado.</span> Ótimo momento para ensinar segurança do rei.');
                if (/Xeque-mate/i.test(estado || '')) partes.push('<span class="good">Xeque-mate.</span> Explique que o rei não tem fuga, bloqueio nem captura da ameaça.');
                else if (/Xeque/i.test(estado || '')) partes.push('<span class="warn">Xeque.</span> Explique que o lado ameaçado precisa responder ao rei primeiro.');
                else if (jogadaPodeGerarXequeContra(peca.color)) partes.push('<span class="warn">Atenção didática:</span> depois da jogada, procure mostrar possíveis ameaças contra o rei.');
                else partes.push('Use a posição final para perguntar ao aluno: “qual peça ficou melhor e qual peça precisa de defesa agora?”');
                return partes.join('<br>');
            }

            const entrarOriginalProfessor19 = entrarXadrezOnline;
            entrarXadrezOnline = async function entrarXadrezOnlineProfessor19(assistir = false) {
                const nameInput = document.getElementById('chess-online-name');
                const fallbackInput = document.getElementById('name-input');
                const rawName = String(nameInput?.value || fallbackInput?.value || '').trim();
                const professorSolicitado = detectarProfessorPrivadoPorNomeXadrez19(rawName);
                chessProfessorPrivadoAtivo = professorSolicitado;
                chessProfessorPrivadoTexto = '';
                if (professorSolicitado) {
                    const limpo = limparNomeProfessorPrivadoXadrez19(rawName) || 'Professor';
                    if (nameInput) nameInput.value = limpo;
                    if (fallbackInput && !nameInput) fallbackInput.value = limpo;
                }
                const resp = await entrarOriginalProfessor19.apply(this, arguments);
                // O entrar online chama sairXadrezOnline(false) para limpar escutas antigas.
                // Por isso religamos o manual aqui somente se a conexão online realmente ficou ativa.
                chessProfessorPrivadoAtivo = !!(professorSolicitado && chessMode === 'online');
                if (chessProfessorPrivadoAtivo) {
                    try {
                        const modoKey35 = 'tabuleiro_arena_professor_xadrez_33_modo_toque';
                        const autoKey35 = 'tabuleiro_arena_professor_xadrez_33_auto_direto';
                        if (localStorage.getItem(modoKey35) === null) localStorage.setItem(modoKey35, 'bubble');
                        if (localStorage.getItem(autoKey35) === null) localStorage.setItem(autoKey35, '1');
                    } catch (_) {}
                    setTimeout(() => {
                        try {
                            if (typeof garantirPainelFlutuanteGuiaDiretaXadrez33 === 'function') garantirPainelFlutuanteGuiaDiretaXadrez33();
                            if (typeof atualizarPainelFlutuanteGuiaDiretaXadrez33 === 'function') atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                            if (typeof agendarGuiaDiretaProfessorXadrez33 === 'function') agendarGuiaDiretaProfessorXadrez33(true, 'manual');
                        } catch (_) {}
                    }, 450);
                }
                garantirPainelManualPrivadoProfessorXadrez19();
                atualizarManualPrivadoProfessorXadrez19(chessProfessorPrivadoAtivo
                    ? 'Professor inteligente ligado. Use a aba do professor para deixar a janelinha OFF e ligar o robô por cores no tabuleiro.'
                    : '');
                return resp;
            };

            const sairOriginalProfessor19 = sairXadrezOnline;
            sairXadrezOnline = function sairXadrezOnlineProfessor19() {
                const retorno = sairOriginalProfessor19.apply(this, arguments);
                chessProfessorPrivadoAtivo = false;
                chessProfessorPrivadoTexto = '';
                const panel = document.getElementById('chess-private-teacher-panel');
                if (panel) panel.style.display = 'none';
                return retorno;
            };

            const ocultarOriginalProfessor19 = ocultarTabuleiroXadrezParaMenu;
            ocultarTabuleiroXadrezParaMenu = function ocultarTabuleiroXadrezParaMenuProfessor19() {
                const retorno = ocultarOriginalProfessor19.apply(this, arguments);
                const panel = document.getElementById('chess-private-teacher-panel');
                if (panel) panel.style.display = 'none';
                return retorno;
            };

            const renderOriginalProfessor19 = renderChessBoard;
            renderChessBoard = function renderChessBoardProfessor19() {
                const retorno = renderOriginalProfessor19.apply(this, arguments);
                garantirPainelManualPrivadoProfessorXadrez19();
                atualizarManualPrivadoProfessorXadrez19();
                return retorno;
            };

            const clickOriginalProfessor19 = handleChessSquareClick;
            handleChessSquareClick = async function handleChessSquareClickProfessor19(row, col) {
                if (professorPrivadoPodeAparecerXadrez19()) {
                    const peca = chessBoard[row]?.[col] || null;
                    // Quando não é a vez do professor, ou quando ele toca peça do aluno,
                    // o clique vira apenas consulta pedagógica local e não mexe na sala.
                    if (peca && (chessIsSpectator || chessPlayerColor !== chessTurn || peca.color !== chessPlayerColor)) {
                        atualizarManualPorPecaProfessorXadrez19(row, col, 'Consulta local do professor: nada foi enviado para a sala online.');
                        return;
                    }
                }
                const retorno = await clickOriginalProfessor19.apply(this, arguments);
                if (professorPrivadoPodeAparecerXadrez19()) {
                    if (selectedSquare && chessBoard[selectedSquare.row]?.[selectedSquare.col]) {
                        const peca = chessBoard[selectedSquare.row][selectedSquare.col];
                        const texto = criarDicaManualPrivadoProfessorXadrez19(peca, selectedSquare.row, selectedSquare.col, legalMoves || [], 'Agora escolha uma casa legal, se quiser jogar.');
                        atualizarManualPrivadoProfessorXadrez19(texto);
                    } else {
                        atualizarManualPrivadoProfessorXadrez19();
                    }
                }
                return retorno;
            };

            const moverOriginalProfessor19 = executarMovimentoXadrez;
            executarMovimentoXadrez = async function executarMovimentoXadrezProfessor19(fromRow, fromCol, move) {
                const pecaAntes = chessBoard[fromRow]?.[fromCol] ? { ...chessBoard[fromRow][fromCol] } : null;
                const retorno = await moverOriginalProfessor19.apply(this, arguments);
                if (professorPrivadoPodeAparecerXadrez19() && pecaAntes) {
                    atualizarManualPrivadoProfessorXadrez19(mensagemAposJogadaProfessorXadrez19(pecaAntes, fromRow, fromCol, move, lastMoveMessage || ''));
                }
                return retorno;
            };

            document.addEventListener('DOMContentLoaded', () => {
                garantirPainelManualPrivadoProfessorXadrez19();
                atualizarManualPrivadoProfessorXadrez19();
            });
        }

        instalarManualPrivadoProfessorXadrez19();

        /* =====================================================================
           ✅ PROFISSIONAL 25 — POPUP DIDÁTICO DA PEÇA NO XADREZ ONLINE
           Quando o professor entra com # no nome e toca numa peça no online,
           abre um popup privado explicando o que é a peça, como anda, onde pode
           ir naquele momento e como usar isso na explicação por áudio/vídeo.
           Não aparece para o aluno e não altera Firebase, jogada ou tabuleiro.
        ===================================================================== */
        function instalarPopupDidaticoPecaXadrez25() {
            if (window.__popupPecaXadrez25Instalado) return;
            window.__popupPecaXadrez25Instalado = true;

            // ✅ PROFISSIONAL 39 - ponte segura para as melhorias do professor.
            // As funções originais do Manual Privado ficam dentro de outro bloco.
            // Esta ponte evita erro de ReferenceError e deixa Xadrez/Damas abrirem normalmente.
            function professorPrivadoPodeAparecerXadrez19() {
                try {
                    return !!(chessProfessorPrivadoAtivo && chessMode === 'online' && document.body.classList.contains('chess-board-visible'));
                } catch (_) {
                    return false;
                }
            }

            function atualizarManualPrivadoProfessorXadrez19(texto = '') {
                try {
                    const painel = document.getElementById('chess-private-teacher-panel');
                    const corpo = document.getElementById('chess-private-teacher-body');
                    const textoEl = document.getElementById('chess-private-teacher-text');
                    if (!painel || !textoEl) return;
                    if (!professorPrivadoPodeAparecerXadrez19()) {
                        painel.style.display = 'none';
                        return;
                    }
                    painel.style.display = 'block';
                    if (corpo) corpo.style.display = painel.classList.contains('teacher-collapsed') ? 'none' : 'block';
                    if (texto) chessProfessorPrivadoTexto = texto;
                    if (!chessProfessorPrivadoTexto) {
                        chessProfessorPrivadoTexto = 'Professor inteligente ligado. Use os botões abaixo: <strong>Janelinha ON/OFF</strong> e <strong>Robô cores ON/OFF</strong>.';
                    }
                    textoEl.innerHTML = chessProfessorPrivadoTexto;
                } catch (_) {}
            }

            const explicacoes = {
                king: {
                    movimento: 'Anda uma casa por vez em qualquer direção, mas nunca pode entrar numa casa atacada. Também pode fazer o roque quando as regras permitem.',
                    funcao: 'O Rei é a peça mais importante. A partida inteira gira em torno de proteger o Rei e atacar o Rei adversário.',
                    fala: 'Explique ao aluno: antes de atacar, olhe se o Rei está seguro. Um ataque bonito não vale nada se o Rei ficar exposto.'
                },
                queen: {
                    movimento: 'Anda quantas casas livres quiser na vertical, horizontal e diagonal.',
                    funcao: 'A Dama é a peça mais forte do xadrez. Ela ataca muito, defende muito e cria ameaças rápidas.',
                    fala: 'Explique ao aluno: a Dama é poderosa, mas não deve sair sozinha sem apoio, porque pode virar alvo.'
                },
                rook: {
                    movimento: 'Anda quantas casas livres quiser na vertical e na horizontal.',
                    funcao: 'A Torre domina colunas e linhas. Fica muito forte quando entra em coluna aberta ou no final da partida.',
                    fala: 'Explique ao aluno: Torre gosta de caminho livre. Peão parado na frente da Torre diminui a força dela.'
                },
                bishop: {
                    movimento: 'Anda quantas casas livres quiser pelas diagonais. Um Bispo de casa clara fica sempre nas casas claras; o de casa escura fica nas casas escuras.',
                    funcao: 'O Bispo trabalha em diagonal, cria pressão de longe e pode prender peças importantes.',
                    fala: 'Explique ao aluno: o Bispo parece quieto, mas ataca de longe. Antes de mover, olhe a diagonal inteira.'
                },
                knight: {
                    movimento: 'Anda em formato de L: duas casas para um lado e uma para o outro. É a única peça que pula por cima das outras.',
                    funcao: 'O Cavalo é ótimo para garfos, ataques surpresa e casas centrais. Ele confunde iniciantes porque pula peças.',
                    fala: 'Explique ao aluno: Cavalo no centro ataca mais casas. Cavalo no canto fica fraco.'
                },
                pawn: {
                    movimento: 'Anda uma casa para frente. No primeiro movimento pode andar duas. Captura uma casa na diagonal. Quando chega ao fim do tabuleiro pode virar outra peça.',
                    funcao: 'O Peão parece simples, mas controla casas, protege peças e pode virar Dama no final.',
                    fala: 'Explique ao aluno: Peão não anda para trás. Cada avanço precisa ter propósito, porque depois não dá para voltar.'
                }
            };

            function professorPodeUsarPopup25() {
                return !!(
                    chessProfessorPrivadoAtivo &&
                    chessMode === 'online' &&
                    !chessIsSpectator &&
                    document.body.classList.contains('chess-board-visible') &&
                    Array.isArray(chessBoard)
                );
            }

            function movimentosTexto25(movimentos) {
                if (!movimentos || !movimentos.length) return ['Sem casa legal agora'];
                return movimentos.slice(0, 14).map(m => {
                    let txt = alg(m.row, m.col);
                    if (m.capture) txt += ' captura';
                    if (m.castle) txt += m.castle === 'king' ? ' roque pequeno' : ' roque grande';
                    if (m.enPassant) txt += ' en passant';
                    return txt;
                });
            }

            function corTexto25(cor) {
                return cor === 'white' ? 'branca' : 'preta';
            }

            function criarDadosPopup25(peca, row, col, movimentos) {
                const info = explicacoes[peca.type] || explicacoes.pawn;
                const capturas = (movimentos || []).filter(m => m.capture).length;
                const casas = movimentosTexto25(movimentos);
                const ladoDoProfessor = peca.color === chessPlayerColor;
                let porQueAgora = '';
                if (!movimentos || !movimentos.length) {
                    porQueAgora = 'Nesta posição ela não tem movimento legal. Use isso para ensinar bloqueio, proteção do Rei ou peça presa.';
                } else if (capturas > 0) {
                    porQueAgora = 'Nesta posição existem capturas. É uma boa hora para ensinar ganho de material, troca de peças e cálculo antes de jogar.';
                } else if (peca.type === 'king') {
                    porQueAgora = 'Use esta posição para ensinar segurança do Rei: o Rei só pode ir para casas que não estejam atacadas.';
                } else if (peca.type === 'pawn') {
                    porQueAgora = 'Use esta posição para ensinar controle de casas e avanço com objetivo. Peão avançado demais pode ficar fraco.';
                } else {
                    porQueAgora = 'Use esta peça para mostrar plano de jogo: melhorar posição, atacar com apoio e defender antes de avançar.';
                }
                if (!ladoDoProfessor) {
                    porQueAgora = 'Esta é uma peça do aluno/adversário. Use o popup para explicar o que ela ameaça, como ela se movimenta e como você pode responder com calma.';
                }
                return {
                    jogo: 'Xadrez online',
                    simbolo: pecasUnicode[peca.color]?.[peca.type] || '♟',
                    titulo: `${nomePeca[peca.type] || 'Peça'} ${corTexto25(peca.color)}`,
                    posicao: alg(row, col),
                    oQueE: info.funcao,
                    comoAnda: info.movimento,
                    ondePodeIr: casas,
                    porque: porQueAgora,
                    fraseAula: info.fala
                };
            }

            const clickAnterior25 = handleChessSquareClick;
            handleChessSquareClick = async function handleChessSquareClickPopupProfessor25(row, col) {
                const pecaAntes = chessBoard?.[row]?.[col] || null;
                const clicouDestinoDeJogada = !!(selectedSquare && Array.isArray(legalMoves) && legalMoves.some(m => m.row === row && m.col === col));
                const deveAbrir = !!(professorPodeUsarPopup25() && pecaAntes && !clicouDestinoDeJogada);
                let movimentosAntes = [];
                if (deveAbrir) {
                    try { movimentosAntes = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentosAntes = []; }
                }
                const retorno = await clickAnterior25.apply(this, arguments);
                if (deveAbrir && window.abrirPopupProfessorPeca25) {
                    setTimeout(() => {
                        window.abrirPopupProfessorPeca25(criarDadosPopup25(pecaAntes, row, col, movimentosAntes));
                    }, 60);
                }
                return retorno;
            };
        }

        instalarPopupDidaticoPecaXadrez25();

        /* =====================================================================
           ✅ PROFISSIONAL 26 — POPUP PEQUENO ACIMA DA PEÇA + DICA DIDÁTICA
           Reforça o modo professor: quando tocar na peça, abre um quadro pequeno
           perto da peça com explicação, movimentos e melhor dica didática da posição.
           Não altera Firebase, não joga sozinho e não aparece para o aluno.
        ===================================================================== */
        function instalarPopupProfessorXadrez26() {
            if (window.__popupProfessorXadrez26Instalado) return;
            window.__popupProfessorXadrez26Instalado = true;

            // ✅ PROFISSIONAL 39 - ponte segura dentro do módulo correto do professor.
            // Corrige o travamento da Profissional 37: o código tentava usar funções
            // que pertenciam ao manual privado, mas estavam fora do escopo deste módulo.
            function professorPrivadoPodeAparecerXadrez19() {
                try {
                    return !!(chessProfessorPrivadoAtivo && chessMode === 'online' && document.body.classList.contains('chess-board-visible'));
                } catch (_) {
                    return false;
                }
            }

            function atualizarManualPrivadoProfessorXadrez19(texto = '') {
                try {
                    const painel = document.getElementById('chess-private-teacher-panel');
                    const corpo = document.getElementById('chess-private-teacher-body');
                    const textoEl = document.getElementById('chess-private-teacher-text');
                    if (!painel || !textoEl) return;
                    if (!professorPrivadoPodeAparecerXadrez19()) {
                        painel.style.display = 'none';
                        return;
                    }
                    painel.style.display = 'block';
                    if (corpo) corpo.style.display = painel.classList.contains('teacher-collapsed') ? 'none' : 'block';
                    if (texto) chessProfessorPrivadoTexto = texto;
                    if (!chessProfessorPrivadoTexto) {
                        chessProfessorPrivadoTexto = 'Professor inteligente ligado. Use <strong>Janelinha ON/OFF</strong> e <strong>Robô cores ON/OFF</strong> para ensinar pelo balão ou direto no tabuleiro.';
                    }
                    textoEl.innerHTML = chessProfessorPrivadoTexto;
                } catch (_) {}
            }

            const explicacoes26 = {
                king: {
                    nome: 'Rei',
                    faz: 'O Rei é a peça principal. Ele precisa ficar protegido; se estiver em xeque, a prioridade é resolver o perigo.',
                    anda: 'Anda uma casa em qualquer direção, mas não pode ir para uma casa atacada. Também pode fazer roque quando a regra permite.',
                    aula: 'Ensine que toda jogada precisa respeitar a segurança do Rei. Primeiro segurança, depois ataque.'
                },
                queen: {
                    nome: 'Dama',
                    faz: 'A Dama é a peça mais forte. Ela combina força de Torre e Bispo, atacando linhas, colunas e diagonais.',
                    anda: 'Anda quantas casas livres quiser na vertical, horizontal e diagonal.',
                    aula: 'Ensine que a Dama é forte, mas não deve sair sozinha sem apoio, porque pode virar alvo.'
                },
                rook: {
                    nome: 'Torre',
                    faz: 'A Torre domina colunas e linhas. Ela fica muito forte em coluna aberta e no final da partida.',
                    anda: 'Anda quantas casas livres quiser na horizontal e na vertical.',
                    aula: 'Ensine que Torre precisa de caminho livre. Abrir coluna para a Torre aumenta muito a força dela.'
                },
                bishop: {
                    nome: 'Bispo',
                    faz: 'O Bispo trabalha nas diagonais e cria pressão de longe, principalmente quando a diagonal está aberta.',
                    anda: 'Anda quantas casas livres quiser pelas diagonais.',
                    aula: 'Ensine o aluno a olhar a diagonal inteira antes de jogar; muitas ameaças aparecem de longe.'
                },
                knight: {
                    nome: 'Cavalo',
                    faz: 'O Cavalo cria ataques surpresa, garfos e fica muito forte no centro.',
                    anda: 'Anda em L: duas casas para um lado e uma para o outro. É a única peça que pula por cima das outras.',
                    aula: 'Ensine que Cavalo no centro ataca mais casas. Cavalo no canto costuma ficar fraco.'
                },
                pawn: {
                    nome: 'Peão',
                    faz: 'O Peão controla casas, protege peças e pode virar Dama quando chega ao final.',
                    anda: 'Anda uma casa para frente, pode andar duas no primeiro lance, captura na diagonal e não volta para trás.',
                    aula: 'Ensine que Peão avançado sem proteção vira fraqueza. Cada avanço precisa ter objetivo.'
                }
            };

            function valorPeca26(tipo) {
                return ({ pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 })[tipo] || 0;
            }

            function adversario26(cor) { return cor === 'white' ? 'black' : 'white'; }

            function centro26(row, col) {
                return 7 - (Math.abs(3.5 - row) + Math.abs(3.5 - col));
            }

            function rectQuadradoXadrez26(row, col) {
                try {
                    const el = document.querySelector(`#chess-board .chess-square[data-row="${row}"][data-col="${col}"]`);
                    if (el) {
                        const r = el.getBoundingClientRect();
                        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
                    }
                } catch (_) {}
                return null;
            }

            function analisarMelhorDicaXadrez26(peca, row, col, movimentos) {
                const lista = Array.isArray(movimentos) ? movimentos : [];
                if (!peca || !lista.length) {
                    return 'Melhor orientação: esta peça não tem movimento legal agora. Use isso para explicar peça presa, bloqueio ou necessidade de proteger o Rei antes de atacar.';
                }
                const adv = adversario26(peca.color);
                const avaliadas = lista.map(m => {
                    let score = 0;
                    const razoes = [];
                    const destino = chessBoard?.[m.row]?.[m.col] || null;
                    if (destino) {
                        score += valorPeca26(destino.type) + 120;
                        razoes.push(`ganha material capturando ${nomePeca[destino.type] || 'peça'}`);
                    }
                    if (m.castle) { score += 260; razoes.push('protege o Rei com roque'); }
                    if (m.enPassant) { score += 170; razoes.push('captura especial en passant'); }
                    const centro = centro26(m.row, m.col);
                    if (centro >= 5.5) { score += 75; razoes.push('melhora o controle do centro'); }
                    if ((peca.type === 'knight' || peca.type === 'bishop') && (peca.color === 'white' ? row === 7 : row === 0)) {
                        score += 115; razoes.push('desenvolve peça que estava parada');
                    }
                    if (peca.type === 'pawn' && (m.row === 0 || m.row === 7)) { score += 850; razoes.push('chega perto da promoção'); }
                    let atacado = false, defendido = false;
                    try { atacado = quadradoAtacado(chessBoard, m.row, m.col, adv); } catch (_) {}
                    try { defendido = quadradoAtacado(chessBoard, m.row, m.col, peca.color); } catch (_) {}
                    if (atacado && !defendido && peca.type !== 'king') { score -= Math.min(240, Math.max(80, valorPeca26(peca.type) / 4)); razoes.push('cuidado: destino pode ficar sem defesa'); }
                    if (atacado && defendido && peca.type !== 'king') { score -= 35; razoes.push('destino atacado, mas com defesa'); }
                    if (!atacado) { score += 35; razoes.push('casa mais segura'); }
                    return { move: m, score, razoes };
                }).sort((a, b) => b.score - a.score);

                const best = avaliadas[0];
                if (!best) return 'Melhor orientação: observe ameaças, Rei e peças soltas antes de mover.';
                const destinoAlg = alg(best.move.row, best.move.col);
                const origemAlg = alg(row, col);
                const razoes = best.razoes.length ? best.razoes.slice(0, 3).join(', ') : 'melhora a posição sem criar risco grande';
                const tipo = peca.color === chessPlayerColor ? 'Boa jogada didática para você mostrar' : 'Boa ameaça do aluno para você explicar';
                return `${tipo}: ${origemAlg} → ${destinoAlg}. Motivo: ${razoes}. Frase para aula: “Antes de jogar, veja o que a jogada ganha, o que ela protege e se deixa alguma peça sem defesa.”`;
            }

            function criarDadosPopupXadrez26(peca, row, col, movimentos, anchorRect) {
                const info = explicacoes26[peca.type] || explicacoes26.pawn;
                const capturas = (movimentos || []).filter(m => m.capture).length;
                const casas = (movimentos || []).length
                    ? movimentos.slice(0, 14).map(m => {
                        let txt = alg(m.row, m.col);
                        if (m.capture) txt += ' captura';
                        if (m.castle) txt += m.castle === 'king' ? ' roque pequeno' : ' roque grande';
                        if (m.enPassant) txt += ' en passant';
                        return txt;
                    })
                    : ['Sem casa legal agora'];
                const ladoDoProfessor = peca.color === chessPlayerColor;
                let porque = '';
                if (capturas > 0) porque = 'Esta peça tem captura disponível. Use para ensinar cálculo: capturar só é bom quando não entrega uma peça maior depois.';
                else if (peca.type === 'king') porque = 'Aqui o foco é segurança. O Rei nunca deve entrar em casa atacada.';
                else if (peca.type === 'pawn') porque = 'Aqui o foco é estrutura: peões controlam casas, protegem peças e criam caminhos para promoção.';
                else porque = 'Aqui o foco é melhorar a posição: desenvolver, controlar centro, atacar com apoio e defender peças importantes.';
                if (!ladoDoProfessor) porque = 'Esta é uma peça do aluno. Use para explicar o que ela ameaça e qual resposta mantém sua posição segura.';
                return {
                    jogo: 'Xadrez online',
                    simbolo: pecasUnicode[peca.color]?.[peca.type] || '♟',
                    titulo: `${info.nome} ${peca.color === 'white' ? 'branca' : 'preta'}`,
                    posicao: alg(row, col),
                    oQueE: info.faz,
                    comoAnda: info.anda,
                    ondePodeIr: casas,
                    porque,
                    melhorJogada: analisarMelhorDicaXadrez26(peca, row, col, movimentos),
                    fraseAula: info.aula,
                    anchorRect,
                    row,
                    col
                };
            }


            /* ✅ PROFISSIONAL 35 — ROBÔ CORES VISÍVEL E AUTO NO TABULEIRO
               Base da Profissional 33 preservada: balão arrastável, tamanho ajustável,
               melhores jogadas, robô conselheiro, auto após jogada do aluno e guia direto continuam.
               Mantém Profissional 34 e corrige o ponto principal: quando o robô por cores estiver ON, ele fica visível, recalcula e pinta de verdade no tabuleiro. Amarelo = peça indicada, verde = destino, vermelho = perigo. */
            function instalarCssBubbleProfessorXadrez27() {
                if (document.getElementById('teacher-piece-bubble-27-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-piece-bubble-27-style';
                style.textContent = `
                    #teacher-piece-bubble-27 {
                        position: fixed !important;
                        z-index: 999999 !important;
                        width: min(318px, calc(100vw - 18px));
                        max-height: min(430px, calc(100vh - 18px));
                        overflow: auto;
                        display: none;
                        border-radius: 16px;
                        border: 1px solid rgba(250, 204, 21, .58);
                        background: linear-gradient(180deg, rgba(8,13,28,.98), rgba(3,8,20,.99));
                        color: #eaf6ff;
                        box-shadow: 0 18px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04), 0 0 26px rgba(250,204,21,.18);
                        padding: 10px;
                        font-family: inherit;
                        text-align: left;
                    }
                    #teacher-piece-bubble-27.open { display: block !important; animation: teacherBubble27In .12s ease-out; }
                    @keyframes teacherBubble27In { from { transform: translateY(5px) scale(.98); opacity:.65; } to { transform: translateY(0) scale(1); opacity:1; } }
                    #teacher-piece-bubble-27::after {
                        content: '';
                        position: fixed;
                        left: var(--arrow-left, 24px);
                        top: var(--arrow-top, 24px);
                        width: 13px;
                        height: 13px;
                        transform: rotate(45deg);
                        background: rgba(8,13,28,.98);
                        border-left: 1px solid rgba(250,204,21,.50);
                        border-top: 1px solid rgba(250,204,21,.50);
                        pointer-events: none;
                    }
                    #teacher-piece-bubble-27 .bubble-head-27 {
                        display: flex;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 8px;
                        padding-bottom: 7px;
                        border-bottom: 1px solid rgba(148,163,184,.18);
                    }
                    #teacher-piece-bubble-27 .bubble-titlewrap-27 { display:flex; gap:8px; align-items:center; min-width:0; }
                    #teacher-piece-bubble-27 .bubble-symbol-27 {
                        width: 34px; height: 34px; min-width:34px;
                        border-radius: 12px;
                        display:flex; align-items:center; justify-content:center;
                        font-size: 1.45rem;
                        background: rgba(250,204,21,.16);
                        border: 1px solid rgba(250,204,21,.34);
                        color: #fef3c7;
                    }
                    #teacher-piece-bubble-27 .bubble-title-27 {
                        font-size: .93rem;
                        line-height: 1.12;
                        font-weight: 1000;
                        color: #f8fafc;
                    }
                    #teacher-piece-bubble-27 .bubble-sub-27 {
                        margin-top: 2px;
                        color: #93c5fd;
                        font-size: .68rem;
                        font-weight: 850;
                    }
                    #teacher-piece-bubble-27 .bubble-close-27 {
                        width: 28px; height: 28px; min-width: 28px;
                        border-radius: 10px;
                        border: 1px solid rgba(148,163,184,.25);
                        background: rgba(15,23,42,.86);
                        color: #e5e7eb;
                        font-weight: 1000;
                        cursor: pointer;
                        line-height: 1;
                    }
                    #teacher-piece-bubble-27 .bubble-body-27 { padding-top: 8px; font-size: .76rem; line-height: 1.33; }
                    #teacher-piece-bubble-27 .bubble-section-27 {
                        border: 1px solid rgba(148,163,184,.14);
                        background: rgba(15,23,42,.58);
                        border-radius: 11px;
                        padding: 7px 8px;
                        margin-top: 6px;
                    }
                    #teacher-piece-bubble-27 .bubble-label-27 {
                        display:block;
                        color:#86efac;
                        font-size:.61rem;
                        letter-spacing:.08em;
                        text-transform:uppercase;
                        font-weight:1000;
                        margin-bottom:3px;
                    }
                    #teacher-piece-bubble-27 .bubble-best-27 {
                        border-color: rgba(250,204,21,.30);
                        background: rgba(113,63,18,.22);
                        color:#fef3c7;
                        font-weight: 750;
                    }
                    #teacher-piece-bubble-27 .bubble-audio-27 {
                        border-color: rgba(56,189,248,.27);
                        background: rgba(14,116,144,.16);
                        color:#dff6ff;
                    }
                    #teacher-piece-bubble-27 .bubble-moves-27 {
                        display:flex;
                        flex-wrap:wrap;
                        gap:4px;
                        margin-top:4px;
                    }
                    #teacher-piece-bubble-27 .bubble-move-27 {
                        border-radius:999px;
                        padding:3px 6px;
                        background: rgba(37,99,235,.20);
                        border: 1px solid rgba(96,165,250,.26);
                        color:#bfdbfe;
                        font-size:.66rem;
                        font-weight:900;
                    }
                    #chess-board .chess-square.teacher-selected-27,
                    .chess-square.teacher-selected-27 {
                        outline: 3px solid rgba(250,204,21,.92) !important;
                        outline-offset: -4px !important;
                        box-shadow: inset 0 0 0 3px rgba(250,204,21,.30), 0 0 18px rgba(250,204,21,.38) !important;
                    }

                    /* ✅ PROFISSIONAL 28 — balão do professor arrastável, sem observar a página inteira */
                    #teacher-piece-bubble-27.manual-position-28::after { display: none !important; }
                    #teacher-piece-bubble-27 .bubble-head-27 {
                        cursor: grab;
                        touch-action: none;
                        user-select: none;
                        -webkit-user-select: none;
                        -webkit-touch-callout: none;
                    }
                    #teacher-piece-bubble-27.dragging-28 .bubble-head-27 { cursor: grabbing; }
                    #teacher-piece-bubble-27 .bubble-drag-tip-28 {
                        display: block;
                        margin-top: 3px;
                        color: #fde68a;
                        font-size: .58rem;
                        font-weight: 1000;
                        letter-spacing: .06em;
                        text-transform: uppercase;
                        line-height: 1.12;
                    }
                    #teacher-piece-bubble-27 .bubble-move-tools-28 {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-wrap: wrap;
                        gap: 4px;
                        padding: 7px 0 2px 0;
                        border-bottom: 1px solid rgba(148,163,184,.14);
                    }
                    #teacher-piece-bubble-27 .bubble-move-note-28 {
                        width: 100%;
                        text-align: center;
                        color: #93c5fd;
                        font-size: .61rem;
                        font-weight: 900;
                        letter-spacing: .04em;
                        text-transform: uppercase;
                        line-height: 1.15;
                    }
                    #teacher-piece-bubble-27 .bubble-move-btn-28 {
                        width: 27px;
                        height: 27px;
                        min-width: 27px;
                        padding: 0;
                        border-radius: 999px;
                        border: 1px solid rgba(250,204,21,.24);
                        background: rgba(15,23,42,.92);
                        color: #fef3c7;
                        font-size: .78rem;
                        font-weight: 1000;
                        line-height: 1;
                        box-shadow: none;
                        text-transform: none;
                    }
                    #teacher-piece-bubble-27 .bubble-move-btn-28:hover,
                    #teacher-piece-bubble-27 .bubble-move-btn-28:focus {
                        background: rgba(37,99,235,.92);
                        color: #ffffff;
                        transform: none;
                    }

                    /* ✅ PROFISSIONAL 32 — tamanho do balão ajustável sem quebrar o arraste */
                    #teacher-piece-bubble-27.size-small-32 {
                        width: min(238px, calc(100vw - 12px)) !important;
                        max-height: min(315px, calc(100vh - 12px)) !important;
                        padding: 7px !important;
                        border-radius: 14px !important;
                    }
                    #teacher-piece-bubble-27.size-normal-32 {
                        width: min(318px, calc(100vw - 18px)) !important;
                        max-height: min(430px, calc(100vh - 18px)) !important;
                    }
                    #teacher-piece-bubble-27.size-large-32 {
                        width: min(378px, calc(100vw - 12px)) !important;
                        max-height: min(520px, calc(100vh - 12px)) !important;
                    }
                    #teacher-piece-bubble-27.size-small-32 .bubble-head-27 { gap: 6px; padding-bottom: 5px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-symbol-27 { width: 28px; height: 28px; min-width: 28px; font-size: 1.18rem; border-radius: 10px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-title-27 { font-size: .78rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-sub-27 { font-size: .58rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-drag-tip-28 { font-size: .50rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-move-tools-28 { gap: 3px; padding: 5px 0 1px 0; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-move-note-28 { font-size: .54rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-move-btn-28 { width: 24px; height: 24px; min-width: 24px; font-size: .68rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-body-27 { font-size: .64rem; line-height: 1.24; padding-top: 5px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-section-27 { padding: 5px 6px; margin-top: 4px; border-radius: 9px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-label-27 { font-size: .52rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-guide-tools-29,
                    #teacher-piece-bubble-27.size-small-32 .bubble-robo-tools-30 { gap: 4px; padding: 6px 0 4px 0; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-guide-title-29,
                    #teacher-piece-bubble-27.size-small-32 .bubble-robo-title-30 { font-size: .57rem; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-guide-btn-29,
                    #teacher-piece-bubble-27.size-small-32 .bubble-robo-btn-30 { font-size: .56rem; padding: 6px 5px; border-radius: 9px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-guide-status-29,
                    #teacher-piece-bubble-27.size-small-32 .bubble-robo-status-30 { font-size: .57rem; max-height: 96px; padding: 6px 7px; }
                    #teacher-piece-bubble-27.size-small-32 .bubble-robo-auto-line-31 { font-size: .54rem; }

                    #teacher-piece-bubble-27 .bubble-size-label-32 {
                        min-width: 52px;
                        height: 24px;
                        padding: 0 7px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 999px;
                        border: 1px solid rgba(147,197,253,.28);
                        background: rgba(30,64,175,.30);
                        color: #dbeafe;
                        font-size: .55rem;
                        font-weight: 1000;
                        letter-spacing: .05em;
                        text-transform: uppercase;
                    }

                    @media (max-width: 520px) {
                        #teacher-piece-bubble-27 { width: min(292px, calc(100vw - 12px)); padding: 9px; border-radius: 14px; }
                        #teacher-piece-bubble-27 .bubble-body-27 { font-size: .72rem; }
                        #teacher-piece-bubble-27 .bubble-section-27 { padding: 6px 7px; }
                        #teacher-piece-bubble-27 .bubble-title-27 { font-size: .86rem; }
                        #teacher-piece-bubble-27.size-small-32 { width: min(228px, calc(100vw - 10px)) !important; max-height: min(295px, calc(100vh - 10px)) !important; }
                        #teacher-piece-bubble-27.size-large-32 { width: min(340px, calc(100vw - 10px)) !important; max-height: min(520px, calc(100vh - 10px)) !important; }
                    }
                `;
                document.head.appendChild(style);
            }

            function escapeBubble27(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }

            function garantirBubbleProfessorXadrez27() {
                instalarCssBubbleProfessorXadrez27();
                let bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble) {
                    bubble = document.createElement('div');
                    bubble.id = 'teacher-piece-bubble-27';
                    bubble.innerHTML = `
                        <div class="bubble-head-27">
                            <div class="bubble-titlewrap-27">
                                <div class="bubble-symbol-27">♟</div>
                                <div>
                                    <div class="bubble-title-27">Peça selecionada</div>
                                    <div class="bubble-sub-27">Manual do professor</div>
                                    <div class="bubble-drag-tip-28">↕ segure no topo para arrastar</div>
                                </div>
                            </div>
                            <button class="bubble-close-27" type="button" aria-label="Fechar">×</button>
                        </div>
                        <div class="bubble-move-tools-28" aria-label="Mover e redimensionar balão do professor">
                            <span class="bubble-move-note-28">Toque nas setas ou arraste pelo topo</span>
                            <button class="bubble-move-btn-28" type="button" data-bubble-size-32="minus" aria-label="Diminuir balão">−</button>
                            <span class="bubble-size-label-32" data-bubble-size-label-32>Normal</span>
                            <button class="bubble-move-btn-28" type="button" data-bubble-size-32="plus" aria-label="Aumentar balão">+</button>
                            <button class="bubble-move-btn-28" type="button" data-bubble-move-28="left" aria-label="Mover para esquerda">←</button>
                            <button class="bubble-move-btn-28" type="button" data-bubble-move-28="up" aria-label="Mover para cima">↑</button>
                            <button class="bubble-move-btn-28" type="button" data-bubble-move-28="down" aria-label="Mover para baixo">↓</button>
                            <button class="bubble-move-btn-28" type="button" data-bubble-move-28="right" aria-label="Mover para direita">→</button>
                            <button class="bubble-move-btn-28" type="button" data-bubble-move-28="reset" aria-label="Voltar perto da peça">⟳</button>
                        </div>
                        <div class="bubble-body-27"></div>
                    `;
                    document.body.appendChild(bubble);
                    bubble.querySelector('.bubble-close-27')?.addEventListener('click', () => bubble.classList.remove('open'));
                }
                instalarArrasteBubbleProfessorXadrez28(bubble);
                instalarTamanhoBubbleProfessorXadrez32(bubble);
                instalarGuiaMelhoresJogadasXadrez29(bubble);
                instalarRoboConselheiroProfessorXadrez30(bubble);
                instalarGuiaDiretaRoboProfessorXadrez33(bubble);
                return bubble;
            }

            const BUBBLE_PROFESSOR_XADREZ_28_POS_KEY = 'tabuleiro_arena_teacher_piece_bubble_28_pos';
            const BUBBLE_PROFESSOR_XADREZ_32_SIZE_KEY = 'tabuleiro_arena_teacher_piece_bubble_32_size';
            const BUBBLE_PROFESSOR_XADREZ_32_SIZES = ['small', 'normal', 'large'];
            let bubbleProfessorXadrez28Dragging = false;
            let bubbleProfessorXadrez28StartX = 0;
            let bubbleProfessorXadrez28StartY = 0;
            let bubbleProfessorXadrez28StartLeft = 0;
            let bubbleProfessorXadrez28StartTop = 0;

            function lerTamanhoBubbleProfessorXadrez32() {
                try {
                    const salvo = localStorage.getItem(BUBBLE_PROFESSOR_XADREZ_32_SIZE_KEY) || 'normal';
                    return BUBBLE_PROFESSOR_XADREZ_32_SIZES.includes(salvo) ? salvo : 'normal';
                } catch (_) {
                    return 'normal';
                }
            }

            function nomeTamanhoBubbleProfessorXadrez32(tamanho) {
                if (tamanho === 'small') return 'Pequeno';
                if (tamanho === 'large') return 'Grande';
                return 'Normal';
            }

            function aplicarTamanhoBubbleProfessorXadrez32(bubble, tamanho = 'normal', salvar = true) {
                if (!bubble) return;
                const finalSize = BUBBLE_PROFESSOR_XADREZ_32_SIZES.includes(tamanho) ? tamanho : 'normal';
                bubble.classList.remove('size-small-32', 'size-normal-32', 'size-large-32');
                bubble.classList.add(`size-${finalSize}-32`);
                bubble.dataset.teacherBubbleSize32 = finalSize;
                const label = bubble.querySelector('[data-bubble-size-label-32]');
                if (label) label.textContent = nomeTamanhoBubbleProfessorXadrez32(finalSize);
                if (salvar) {
                    try { localStorage.setItem(BUBBLE_PROFESSOR_XADREZ_32_SIZE_KEY, finalSize); } catch (_) {}
                }
                requestAnimationFrame(() => manterBubbleProfessorXadrez28NaTela());
            }

            function alterarTamanhoBubbleProfessorXadrez32(delta) {
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble) return;
                const atual = bubble.dataset.teacherBubbleSize32 || lerTamanhoBubbleProfessorXadrez32();
                const idx = Math.max(0, BUBBLE_PROFESSOR_XADREZ_32_SIZES.indexOf(atual));
                const novoIdx = limitarBubbleProfessorXadrez28(idx + delta, 0, BUBBLE_PROFESSOR_XADREZ_32_SIZES.length - 1);
                aplicarTamanhoBubbleProfessorXadrez32(bubble, BUBBLE_PROFESSOR_XADREZ_32_SIZES[novoIdx], true);
            }

            function instalarTamanhoBubbleProfessorXadrez32(bubble) {
                if (!bubble) return;
                aplicarTamanhoBubbleProfessorXadrez32(bubble, lerTamanhoBubbleProfessorXadrez32(), false);
                if (bubble.dataset.sizeProfessor32 === '1') return;
                bubble.dataset.sizeProfessor32 = '1';
                bubble.querySelectorAll('[data-bubble-size-32]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-bubble-size-32');
                        if (acao === 'minus') alterarTamanhoBubbleProfessorXadrez32(-1);
                        if (acao === 'plus') alterarTamanhoBubbleProfessorXadrez32(1);
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
            }

            function viewportBubbleProfessorXadrez28() {
                return {
                    width: window.innerWidth || document.documentElement.clientWidth || 360,
                    height: window.innerHeight || document.documentElement.clientHeight || 640
                };
            }

            function limitarBubbleProfessorXadrez28(valor, min, max) {
                if (!Number.isFinite(valor)) return min;
                if (max < min) return min;
                return Math.max(min, Math.min(max, valor));
            }

            function lerPosicaoBubbleProfessorXadrez28() {
                try {
                    const data = JSON.parse(localStorage.getItem(BUBBLE_PROFESSOR_XADREZ_28_POS_KEY) || 'null');
                    if (data && Number.isFinite(data.left) && Number.isFinite(data.top)) return data;
                } catch (_) {}
                return null;
            }

            function salvarPosicaoBubbleProfessorXadrez28(left, top) {
                try {
                    localStorage.setItem(BUBBLE_PROFESSOR_XADREZ_28_POS_KEY, JSON.stringify({
                        left: Math.round(left),
                        top: Math.round(top)
                    }));
                } catch (_) {}
            }

            function aplicarPosicaoBubbleProfessorXadrez28(bubble, left, top, salvar = true) {
                if (!bubble) return;
                const vp = viewportBubbleProfessorXadrez28();
                const margem = 7;
                const rect = bubble.getBoundingClientRect();
                const bw = Math.max(180, Math.min(rect.width || bubble.offsetWidth || 318, vp.width - margem * 2));
                const bh = Math.max(120, Math.min(rect.height || bubble.offsetHeight || 280, vp.height - margem * 2));
                const safeLeft = limitarBubbleProfessorXadrez28(left, margem, Math.max(margem, vp.width - bw - margem));
                const safeTop = limitarBubbleProfessorXadrez28(top, margem, Math.max(margem, vp.height - bh - margem));

                bubble.classList.add('manual-position-28');
                bubble.style.left = `${Math.round(safeLeft)}px`;
                bubble.style.top = `${Math.round(safeTop)}px`;
                bubble.style.right = 'auto';
                bubble.style.bottom = 'auto';
                bubble.style.transform = 'none';
                if (salvar) salvarPosicaoBubbleProfessorXadrez28(safeLeft, safeTop);
            }

            function manterBubbleProfessorXadrez28NaTela() {
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble || !bubble.classList.contains('open') || !bubble.classList.contains('manual-position-28')) return;
                const rect = bubble.getBoundingClientRect();
                aplicarPosicaoBubbleProfessorXadrez28(bubble, rect.left, rect.top, true);
            }

            function pontoBubbleProfessorXadrez28(ev) {
                if (ev.touches && ev.touches[0]) return ev.touches[0];
                if (ev.changedTouches && ev.changedTouches[0]) return ev.changedTouches[0];
                return ev;
            }

            function alvoInterativoBubbleProfessorXadrez28(target) {
                return !!(target && target.closest && target.closest('button,input,textarea,select,a,video,audio'));
            }

            function iniciarArrasteBubbleProfessorXadrez28(ev) {
                if (alvoInterativoBubbleProfessorXadrez28(ev.target)) return;
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble || !bubble.classList.contains('open')) return;
                const ponto = pontoBubbleProfessorXadrez28(ev);
                const rect = bubble.getBoundingClientRect();
                bubbleProfessorXadrez28Dragging = true;
                bubbleProfessorXadrez28StartX = ponto.clientX;
                bubbleProfessorXadrez28StartY = ponto.clientY;
                bubbleProfessorXadrez28StartLeft = rect.left;
                bubbleProfessorXadrez28StartTop = rect.top;
                bubble.classList.add('dragging-28');
                aplicarPosicaoBubbleProfessorXadrez28(bubble, rect.left, rect.top, false);
                try { ev.currentTarget?.setPointerCapture?.(ev.pointerId); } catch (_) {}
                ev.preventDefault?.();
                ev.stopPropagation?.();
            }

            function moverArrasteBubbleProfessorXadrez28(ev) {
                if (!bubbleProfessorXadrez28Dragging) return;
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble) return;
                const ponto = pontoBubbleProfessorXadrez28(ev);
                aplicarPosicaoBubbleProfessorXadrez28(
                    bubble,
                    bubbleProfessorXadrez28StartLeft + (ponto.clientX - bubbleProfessorXadrez28StartX),
                    bubbleProfessorXadrez28StartTop + (ponto.clientY - bubbleProfessorXadrez28StartY),
                    false
                );
                ev.preventDefault?.();
            }

            function pararArrasteBubbleProfessorXadrez28(ev) {
                if (!bubbleProfessorXadrez28Dragging) return;
                bubbleProfessorXadrez28Dragging = false;
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (bubble) {
                    bubble.classList.remove('dragging-28');
                    const rect = bubble.getBoundingClientRect();
                    aplicarPosicaoBubbleProfessorXadrez28(bubble, rect.left, rect.top, true);
                }
                ev?.preventDefault?.();
            }

            function moverPorBotaoBubbleProfessorXadrez28(dx, dy) {
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble) return;
                const rect = bubble.getBoundingClientRect();
                aplicarPosicaoBubbleProfessorXadrez28(bubble, rect.left + dx, rect.top + dy, true);
            }

            function resetarPosicaoBubbleProfessorXadrez28() {
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (!bubble) return;
                try { localStorage.removeItem(BUBBLE_PROFESSOR_XADREZ_28_POS_KEY); } catch (_) {}
                bubble.classList.remove('manual-position-28');
                posicionarBubbleProfessorXadrez27(bubble, bubble._teacherBubble27LastAnchorRect || null);
            }

            function instalarArrasteBubbleProfessorXadrez28(bubble) {
                if (!bubble || bubble.dataset.dragProfessor28 === '1') return;
                bubble.dataset.dragProfessor28 = '1';
                const head = bubble.querySelector('.bubble-head-27');
                if (head) {
                    if ('PointerEvent' in window) {
                        head.addEventListener('pointerdown', iniciarArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('pointermove', moverArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('pointerup', pararArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('pointercancel', pararArrasteBubbleProfessorXadrez28, { passive: false });
                    } else {
                        head.addEventListener('touchstart', iniciarArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('touchmove', moverArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('touchend', pararArrasteBubbleProfessorXadrez28, { passive: false });
                        head.addEventListener('mousedown', iniciarArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('mousemove', moverArrasteBubbleProfessorXadrez28, { passive: false });
                        document.addEventListener('mouseup', pararArrasteBubbleProfessorXadrez28, { passive: false });
                    }
                }
                bubble.querySelectorAll('[data-bubble-move-28]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const dir = btn.getAttribute('data-bubble-move-28');
                        const passo = 48;
                        if (dir === 'left') moverPorBotaoBubbleProfessorXadrez28(-passo, 0);
                        if (dir === 'right') moverPorBotaoBubbleProfessorXadrez28(passo, 0);
                        if (dir === 'up') moverPorBotaoBubbleProfessorXadrez28(0, -passo);
                        if (dir === 'down') moverPorBotaoBubbleProfessorXadrez28(0, passo);
                        if (dir === 'reset') resetarPosicaoBubbleProfessorXadrez28();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
                if (!window.__bubbleProfessorXadrez28ResizeBound) {
                    window.__bubbleProfessorXadrez28ResizeBound = true;
                    window.addEventListener('resize', manterBubbleProfessorXadrez28NaTela);
                }
            }

            function posicionarBubbleProfessorXadrez27(bubble, rect) {
                if (!bubble) return;
                bubble.classList.remove('manual-position-28', 'dragging-28');
                const margem = 8;
                const bw = bubble.offsetWidth || Math.min(318, window.innerWidth - 18);
                const bh = bubble.offsetHeight || 280;
                const centro = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
                let left = Math.round(centro - bw / 2);
                left = Math.max(margem, Math.min(left, window.innerWidth - bw - margem));
                let top = rect ? Math.round(rect.top - bh - 12) : 80;
                let arrowTop = rect ? Math.round(rect.top - 7) : top;
                if (top < margem) {
                    top = rect ? Math.round(rect.bottom + 12) : margem;
                    arrowTop = rect ? Math.round(rect.bottom + 1) : top;
                }
                if (top + bh > window.innerHeight - margem) top = Math.max(margem, window.innerHeight - bh - margem);
                const arrowLeft = Math.max(18, Math.min(centro, window.innerWidth - 18));
                bubble.style.left = `${left}px`;
                bubble.style.top = `${top}px`;
                bubble.style.setProperty('--arrow-left', `${arrowLeft}px`);
                bubble.style.setProperty('--arrow-top', `${arrowTop}px`);
            }

            function abrirBubbleProfessorXadrez27(dados = {}) {
                const bubble = garantirBubbleProfessorXadrez27();
                const movimentos = Array.isArray(dados.ondePodeIr) && dados.ondePodeIr.length
                    ? dados.ondePodeIr.slice(0, 10).map(m => `<span class="bubble-move-27">${escapeBubble27(m)}</span>`).join('')
                    : '<span class="bubble-move-27">Sem casa legal agora</span>';
                const simbolo = bubble.querySelector('.bubble-symbol-27');
                const titulo = bubble.querySelector('.bubble-title-27');
                const sub = bubble.querySelector('.bubble-sub-27');
                const body = bubble.querySelector('.bubble-body-27');
                if (simbolo) simbolo.textContent = dados.simbolo || '♟';
                if (titulo) titulo.textContent = dados.titulo || 'Peça selecionada';
                if (sub) sub.textContent = `${dados.jogo || 'Xadrez online'} • ${dados.posicao || '—'}`;
                if (body) body.innerHTML = `
                    <div class="bubble-section-27">
                        <span class="bubble-label-27">O que é</span>
                        ${escapeBubble27(dados.oQueE || 'Esta peça faz parte da posição e precisa ser analisada antes da jogada.')}
                    </div>
                    <div class="bubble-section-27">
                        <span class="bubble-label-27">O que faz</span>
                        ${escapeBubble27(dados.comoAnda || 'Ela se move conforme a regra da peça e pode atacar ou defender casas importantes.')}
                    </div>
                    <div class="bubble-section-27">
                        <span class="bubble-label-27">Onde pode ir agora</span>
                        <div class="bubble-moves-27">${movimentos}</div>
                    </div>
                    <div class="bubble-section-27 bubble-best-27">
                        <span class="bubble-label-27">Melhor dica na posição</span>
                        ${escapeBubble27(dados.melhorJogada || dados.porque || 'A melhor orientação é olhar o que a peça ganha, o que protege e se fica segura depois do lance.')}
                    </div>
                    <div class="bubble-section-27 bubble-audio-27">
                        <span class="bubble-label-27">Como instruir o aluno</span>
                        “${escapeBubble27(dados.fraseAula || 'Antes de jogar, observe o que a peça ataca, o que ela protege e qual fraqueza ela pode deixar.') }”
                    </div>
                `;
                bubble._teacherBubble27LastAnchorRect = dados.anchorRect || null;
                bubble._teacherBubble27LastDados = dados || {};
                registrarUltimaPecaGuiaXadrez29(dados || {});
                bubble.classList.add('open');
                aplicarTamanhoBubbleProfessorXadrez32(bubble, lerTamanhoBubbleProfessorXadrez32(), false);
                bubble.style.left = '-9999px';
                bubble.style.top = '8px';
                requestAnimationFrame(() => {
                    const posSalva = lerPosicaoBubbleProfessorXadrez28();
                    if (posSalva) aplicarPosicaoBubbleProfessorXadrez28(bubble, posSalva.left, posSalva.top, false);
                    else posicionarBubbleProfessorXadrez27(bubble, dados.anchorRect);
                    if (guiaMelhoresJogadasXadrez29Ativo && guiaMelhoresJogadasXadrez29Modo === 'peca') {
                        mostrarGuiaPecaAtualXadrez29(false);
                    }
                });
            }

            function limparMarcacaoBubbleProfessorXadrez27() {
                document.querySelectorAll('.teacher-selected-27').forEach(el => el.classList.remove('teacher-selected-27'));
            }

            function marcarPecaBubbleProfessorXadrez27(row, col) {
                limparMarcacaoBubbleProfessorXadrez27();
                const el = document.querySelector(`#chess-board .chess-square[data-row="${row}"][data-col="${col}"]`);
                if (el) el.classList.add('teacher-selected-27');
            }


            window.abrirBubbleProfessorXadrez27 = abrirBubbleProfessorXadrez27;

            /* =====================================================================
               ✅ PROFISSIONAL 29 — MELHORES JOGADAS COM CORES NO TABULEIRO
               Recurso privado do professor: não joga, não envia nada para o Firebase,
               não muda a sala online e não aparece para o aluno. Apenas colore o
               tabuleiro local do professor para guiar a explicação em aula.
            ===================================================================== */
            let guiaMelhoresJogadasXadrez29Ativo = false;
            let guiaMelhoresJogadasXadrez29Modo = 'peca';
            let guiaMelhoresJogadasXadrez29Lista = [];
            let guiaMelhoresJogadasXadrez29UltimaPeca = null;

            function instalarCssGuiaMelhoresJogadasXadrez29() {
                if (document.getElementById('teacher-best-guide-29-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-best-guide-29-style';
                style.textContent = `
                    #teacher-piece-bubble-27 .bubble-guide-tools-29 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 5px;
                        padding: 7px 0 2px 0;
                        border-bottom: 1px solid rgba(148,163,184,.14);
                    }
                    #teacher-piece-bubble-27 .bubble-guide-title-29 {
                        grid-column: 1 / -1;
                        color: #bbf7d0;
                        font-size: .61rem;
                        font-weight: 1000;
                        letter-spacing: .06em;
                        text-transform: uppercase;
                        text-align: center;
                        line-height: 1.15;
                    }
                    #teacher-piece-bubble-27 .bubble-guide-btn-29 {
                        border: 1px solid rgba(34,197,94,.28);
                        background: rgba(20,83,45,.62);
                        color: #dcfce7;
                        border-radius: 999px;
                        padding: 7px 6px;
                        font-size: .64rem;
                        font-weight: 1000;
                        line-height: 1.05;
                        text-transform: none;
                        box-shadow: none;
                    }
                    #teacher-piece-bubble-27 .bubble-guide-btn-29[data-guide29="all"] {
                        border-color: rgba(56,189,248,.28);
                        background: rgba(12,74,110,.70);
                        color: #e0f2fe;
                    }
                    #teacher-piece-bubble-27 .bubble-guide-btn-29[data-guide29="clear"] {
                        grid-column: 1 / -1;
                        border-color: rgba(248,113,113,.28);
                        background: rgba(127,29,29,.62);
                        color: #fee2e2;
                    }
                    #teacher-piece-bubble-27 .bubble-guide-status-29 {
                        grid-column: 1 / -1;
                        min-height: 18px;
                        border-radius: 9px;
                        padding: 5px 7px;
                        background: rgba(15,23,42,.62);
                        border: 1px solid rgba(148,163,184,.12);
                        color: #cbd5e1;
                        font-size: .65rem;
                        line-height: 1.22;
                        text-align: center;
                    }
                    #chess-board .chess-square.teacher-best-from-29,
                    .chess-square.teacher-best-from-29 {
                        position: relative !important;
                        outline: 3px solid rgba(250,204,21,.96) !important;
                        outline-offset: -5px !important;
                        box-shadow: inset 0 0 0 3px rgba(250,204,21,.25), 0 0 18px rgba(250,204,21,.42) !important;
                    }
                    #chess-board .chess-square.teacher-best-to-29,
                    .chess-square.teacher-best-to-29 {
                        position: relative !important;
                        outline: 3px solid rgba(255,255,255,.88) !important;
                        outline-offset: -5px !important;
                        box-shadow: inset 0 0 0 4px rgba(255,255,255,.18), 0 0 20px rgba(255,255,255,.36) !important;
                    }
                    #chess-board .chess-square.teacher-best-1-29,
                    .chess-square.teacher-best-1-29 {
                        background: linear-gradient(135deg, #16a34a, #bbf7d0) !important;
                    }
                    #chess-board .chess-square.teacher-best-2-29,
                    .chess-square.teacher-best-2-29 {
                        background: linear-gradient(135deg, #0284c7, #bae6fd) !important;
                    }
                    #chess-board .chess-square.teacher-best-3-29,
                    .chess-square.teacher-best-3-29 {
                        background: linear-gradient(135deg, #7c3aed, #ddd6fe) !important;
                    }
                    #chess-board .chess-square.teacher-best-to-29::after,
                    .chess-square.teacher-best-to-29::after {
                        content: attr(data-teacher-best-label);
                        position: absolute;
                        right: 3px;
                        bottom: 3px;
                        z-index: 6;
                        min-width: 19px;
                        height: 19px;
                        padding: 0 4px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(2,6,23,.88);
                        color: #ffffff;
                        border: 1px solid rgba(255,255,255,.55);
                        font-size: .66rem;
                        font-weight: 1000;
                        line-height: 1;
                    }
                    #chess-board .chess-square.teacher-best-from-29::before,
                    .chess-square.teacher-best-from-29::before {
                        content: attr(data-teacher-best-origin);
                        position: absolute;
                        left: 3px;
                        top: 3px;
                        z-index: 6;
                        min-width: 18px;
                        height: 18px;
                        padding: 0 4px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(250,204,21,.95);
                        color: #111827;
                        border: 1px solid rgba(17,24,39,.24);
                        font-size: .62rem;
                        font-weight: 1000;
                        line-height: 1;
                    }
                    /* ✅ PROFISSIONAL 30 — robô conselheiro do professor */
                    #teacher-piece-bubble-27 .bubble-robo-tools-30 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 5px;
                        padding: 7px 0 3px 0;
                        border-bottom: 1px solid rgba(148,163,184,.14);
                    }
                    #teacher-piece-bubble-27 .bubble-robo-title-30 {
                        grid-column: 1 / -1;
                        color: #fef3c7;
                        font-size: .61rem;
                        font-weight: 1000;
                        letter-spacing: .06em;
                        text-transform: uppercase;
                        text-align: center;
                        line-height: 1.15;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30 {
                        border: 1px solid rgba(250,204,21,.30);
                        background: rgba(113,63,18,.68);
                        color: #fef3c7;
                        border-radius: 999px;
                        padding: 7px 6px;
                        font-size: .63rem;
                        font-weight: 1000;
                        line-height: 1.05;
                        text-transform: none;
                        box-shadow: none;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30[data-robo30="plan"] {
                        border-color: rgba(34,197,94,.30);
                        background: rgba(20,83,45,.72);
                        color: #dcfce7;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30[data-robo30="threat"] {
                        border-color: rgba(248,113,113,.32);
                        background: rgba(127,29,29,.68);
                        color: #fee2e2;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30[data-robo30="clear"] {
                        border-color: rgba(148,163,184,.28);
                        background: rgba(15,23,42,.82);
                        color: #e5e7eb;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30[data-robo30="auto"] {
                        grid-column: 1 / -1;
                        border-color: rgba(56,189,248,.36);
                        background: linear-gradient(90deg, rgba(14,116,144,.84), rgba(37,99,235,.78));
                        color: #dff6ff;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-btn-30.auto-on-31 {
                        border-color: rgba(34,197,94,.70) !important;
                        background: linear-gradient(90deg, rgba(22,101,52,.96), rgba(21,128,61,.90)) !important;
                        color: #dcfce7 !important;
                        box-shadow: 0 0 12px rgba(34,197,94,.26) !important;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-auto-line-31 {
                        display:block;
                        margin-top:5px;
                        padding:5px 6px;
                        border-radius:8px;
                        background: rgba(14,116,144,.16);
                        border: 1px solid rgba(56,189,248,.18);
                        color:#bae6fd;
                        font-weight:900;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-status-30 {
                        grid-column: 1 / -1;
                        min-height: 30px;
                        max-height: 150px;
                        overflow: auto;
                        border-radius: 10px;
                        padding: 7px 8px;
                        background: rgba(3,7,18,.78);
                        border: 1px solid rgba(250,204,21,.16);
                        color: #e5e7eb;
                        font-size: .66rem;
                        line-height: 1.27;
                        text-align: left;
                    }
                    #teacher-piece-bubble-27 .bubble-robo-status-30 strong { color: #fef08a; }
                    #teacher-piece-bubble-27 .bubble-robo-status-30 .robo-good-30 { color: #86efac; font-weight: 1000; }
                    #teacher-piece-bubble-27 .bubble-robo-status-30 .robo-warn-30 { color: #fca5a5; font-weight: 1000; }
                    #teacher-piece-bubble-27 .bubble-robo-status-30 .robo-blue-30 { color: #93c5fd; font-weight: 1000; }
                    #chess-board .chess-square.teacher-robo-from-30,
                    .chess-square.teacher-robo-from-30 {
                        position: relative !important;
                        outline: 3px solid rgba(250,204,21,.98) !important;
                        outline-offset: -4px !important;
                        box-shadow: inset 0 0 0 3px rgba(250,204,21,.30), 0 0 20px rgba(250,204,21,.42) !important;
                    }
                    #chess-board .chess-square.teacher-robo-to-30,
                    .chess-square.teacher-robo-to-30 {
                        position: relative !important;
                        outline: 3px solid rgba(255,255,255,.90) !important;
                        outline-offset: -4px !important;
                        box-shadow: inset 0 0 0 4px rgba(255,255,255,.16), 0 0 22px rgba(255,255,255,.30) !important;
                    }
                    #chess-board .chess-square.teacher-robo-step1-30,
                    .chess-square.teacher-robo-step1-30 { background: linear-gradient(135deg, #15803d, #bbf7d0) !important; }
                    #chess-board .chess-square.teacher-robo-step2-30,
                    .chess-square.teacher-robo-step2-30 { background: linear-gradient(135deg, #b91c1c, #fecaca) !important; }
                    #chess-board .chess-square.teacher-robo-step3-30,
                    .chess-square.teacher-robo-step3-30 { background: linear-gradient(135deg, #1d4ed8, #bfdbfe) !important; }
                    #chess-board .chess-square.teacher-robo-to-30::after,
                    .chess-square.teacher-robo-to-30::after {
                        content: attr(data-teacher-robo-label);
                        position: absolute;
                        right: 3px;
                        bottom: 3px;
                        z-index: 8;
                        min-width: 20px;
                        height: 20px;
                        padding: 0 4px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(2,6,23,.90);
                        color: #ffffff;
                        border: 1px solid rgba(255,255,255,.55);
                        font-size: .63rem;
                        font-weight: 1000;
                        line-height: 1;
                    }
                    #chess-board .chess-square.teacher-robo-from-30::before,
                    .chess-square.teacher-robo-from-30::before {
                        content: attr(data-teacher-robo-origin);
                        position: absolute;
                        left: 3px;
                        top: 3px;
                        z-index: 8;
                        min-width: 20px;
                        height: 20px;
                        padding: 0 4px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(250,204,21,.96);
                        color: #111827;
                        border: 1px solid rgba(17,24,39,.25);
                        font-size: .61rem;
                        font-weight: 1000;
                        line-height: 1;
                    }
                    @media (max-width: 520px) {
                        #teacher-piece-bubble-27 .bubble-guide-tools-29 { gap: 4px; }
                        #teacher-piece-bubble-27 .bubble-guide-btn-29 { font-size: .6rem; padding: 7px 5px; }
                        #teacher-piece-bubble-27 .bubble-guide-status-29 { font-size: .62rem; }
                    }
                `;
                document.head.appendChild(style);
            }

            function instalarGuiaMelhoresJogadasXadrez29(bubble) {
                instalarCssGuiaMelhoresJogadasXadrez29();
                if (!bubble || bubble.querySelector('.bubble-guide-tools-29')) return;
                const tools = document.createElement('div');
                tools.className = 'bubble-guide-tools-29';
                tools.innerHTML = `
                    <div class="bubble-guide-title-29">🎨 melhores jogadas no tabuleiro</div>
                    <button class="bubble-guide-btn-29" type="button" data-guide29="piece">Melhores da peça</button>
                    <button class="bubble-guide-btn-29" type="button" data-guide29="all">Melhores do lado</button>
                    <button class="bubble-guide-btn-29" type="button" data-guide29="clear">Apagar cores</button>
                    <div id="bubble-guide-status-29" class="bubble-guide-status-29">Verde = 1ª melhor, azul = 2ª, roxo = 3ª.</div>
                `;
                const body = bubble.querySelector('.bubble-body-27');
                if (body) bubble.insertBefore(tools, body);
                else bubble.appendChild(tools);

                tools.querySelectorAll('[data-guide29]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-guide29');
                        if (acao === 'piece') mostrarGuiaPecaAtualXadrez29(true);
                        if (acao === 'all') mostrarGuiaLadoAtualXadrez29(true);
                        if (acao === 'clear') desligarGuiaMelhoresJogadasXadrez29(true);
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
            }

            function atualizarStatusGuiaXadrez29(texto) {
                const el = document.getElementById('bubble-guide-status-29');
                if (el) el.innerHTML = texto;
            }

            function registrarUltimaPecaGuiaXadrez29(dados = {}) {
                if (Number.isFinite(Number(dados.row)) && Number.isFinite(Number(dados.col))) {
                    guiaMelhoresJogadasXadrez29UltimaPeca = { row: Number(dados.row), col: Number(dados.col) };
                }
            }

            function limparCoresGuiaMelhoresJogadasXadrez29() {
                document.querySelectorAll('#chess-board .chess-square').forEach(square => {
                    square.classList.remove(
                        'teacher-best-from-29', 'teacher-best-to-29',
                        'teacher-best-1-29', 'teacher-best-2-29', 'teacher-best-3-29',
                        'teacher-robo-from-30', 'teacher-robo-to-30',
                        'teacher-robo-step1-30', 'teacher-robo-step2-30', 'teacher-robo-step3-30'
                    );
                    square.removeAttribute('data-teacher-best-label');
                    square.removeAttribute('data-teacher-best-origin');
                    square.removeAttribute('data-teacher-robo-label');
                    square.removeAttribute('data-teacher-robo-origin');
                    square.removeAttribute('title');
                });
            }

            function desligarGuiaMelhoresJogadasXadrez29(atualizarTexto = false) {
                guiaMelhoresJogadasXadrez29Ativo = false;
                guiaMelhoresJogadasXadrez29Lista = [];
                limparCoresGuiaMelhoresJogadasXadrez29();
                try { limparRoboProfessorXadrez30(false); } catch (_) {}
                if (atualizarTexto) atualizarStatusGuiaXadrez29('Cores apagadas. Toque em uma peça e ligue novamente quando quiser ensinar.');
            }

            function squareGuiaXadrez29(row, col) {
                return document.querySelector(`#chess-board .chess-square[data-row="${row}"][data-col="${col}"]`);
            }

            function textoMovimentoGuiaXadrez29(item) {
                const peca = chessBoard?.[item.from.row]?.[item.from.col] || item.peca || null;
                const nome = nomePeca[peca?.type] || 'Peça';
                let extra = '';
                if (item.to?.capture) extra = ' captura';
                if (item.to?.castle) extra = item.to.castle === 'king' ? ' roque pequeno' : ' roque grande';
                if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) extra = ' promoção';
                return `${nome}: ${alg(item.from.row, item.from.col)} → ${alg(item.to.row, item.to.col)}${extra}`;
            }

            function motivoGuiaXadrez29(item) {
                const peca = chessBoard?.[item.from.row]?.[item.from.col] || item.peca || null;
                const destino = chessBoard?.[item.to.row]?.[item.to.col] || null;
                if (destino) return `ganha material capturando ${nomePeca[destino.type] || 'peça'}`;
                if (item.to?.castle) return 'protege o Rei com roque';
                if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) return 'aproxima o peão da promoção';
                if ((peca?.type === 'knight' || peca?.type === 'bishop') && (peca.color === 'white' ? item.from.row === 7 : item.from.row === 0)) return 'desenvolve peça que estava parada';
                const centro = centro26(item.to.row, item.to.col);
                if (centro >= 5.5) return 'melhora o controle do centro';
                return 'melhora a posição com segurança';
            }

            function pontuarMovimentoGuiaXadrez29(item, cor) {
                try {
                    let score = pontuarJogadaTreinoXadrez(item, cor, chessBoard);
                    const peca = chessBoard?.[item.from.row]?.[item.from.col] || null;
                    const destino = chessBoard?.[item.to.row]?.[item.to.col] || null;
                    if (destino) score += valorPeca26(destino.type) * 0.7;
                    if (item.to?.castle) score += 220;
                    if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 900;
                    if ((peca?.type === 'knight' || peca?.type === 'bishop') && (peca.color === 'white' ? item.from.row === 7 : item.from.row === 0)) score += 120;
                    score += centro26(item.to.row, item.to.col) * 12;
                    return score;
                } catch (_) {
                    return 0;
                }
            }

            function melhoresDaPecaGuiaXadrez29(row, col, limite = 3) {
                const peca = chessBoard?.[row]?.[col] || null;
                if (!peca) return [];
                let movimentos = [];
                try { movimentos = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentos = []; }
                return movimentos
                    .map(move => {
                        const item = { from: { row, col }, to: move, peca };
                        return { ...item, score: pontuarMovimentoGuiaXadrez29(item, peca.color) };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limite);
            }

            function melhoresDoLadoGuiaXadrez29(cor, limite = 3) {
                let movimentos = [];
                try { movimentos = todosMovimentosLegais(cor, chessBoard) || []; } catch (_) { movimentos = []; }
                return movimentos
                    .map(item => ({ ...item, peca: chessBoard?.[item.from.row]?.[item.from.col] || null, score: pontuarMovimentoGuiaXadrez29(item, cor) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limite);
            }

            function pintarGuiaMelhoresJogadasXadrez29(lista = []) {
                limparCoresGuiaMelhoresJogadasXadrez29();
                lista.slice(0, 3).forEach((item, index) => {
                    const ordem = index + 1;
                    const from = squareGuiaXadrez29(item.from.row, item.from.col);
                    const to = squareGuiaXadrez29(item.to.row, item.to.col);
                    const titulo = `${ordem}ª opção: ${textoMovimentoGuiaXadrez29(item)} — ${motivoGuiaXadrez29(item)}`;
                    if (from) {
                        from.classList.add('teacher-best-from-29');
                        from.classList.add(`teacher-best-${ordem}-29`);
                        const antigo = from.getAttribute('data-teacher-best-origin');
                        from.setAttribute('data-teacher-best-origin', antigo ? `${antigo},${ordem}` : String(ordem));
                        from.setAttribute('title', titulo);
                    }
                    if (to) {
                        to.classList.add('teacher-best-to-29');
                        to.classList.add(`teacher-best-${ordem}-29`);
                        to.setAttribute('data-teacher-best-label', `${ordem}ª`);
                        to.setAttribute('title', titulo);
                    }
                });
            }

            function resumoGuiaMelhoresJogadasXadrez29(lista = [], titulo = 'Guia ligado') {
                if (!lista.length) return 'Não encontrei jogada legal para colorir agora.';
                return `<strong>${titulo}:</strong><br>` + lista.map((item, i) => {
                    const cor = i === 0 ? 'verde' : (i === 1 ? 'azul' : 'roxo');
                    return `${i + 1}. ${escapeBubble27(textoMovimentoGuiaXadrez29(item))} <span style="color:#94a3b8;">(${cor})</span>`;
                }).join('<br>');
            }

            function mostrarGuiaPecaAtualXadrez29(atualizarTexto = true) {
                const pos = guiaMelhoresJogadasXadrez29UltimaPeca;
                if (!pos || !chessBoard?.[pos.row]?.[pos.col]) {
                    if (atualizarTexto) atualizarStatusGuiaXadrez29('Toque primeiro em uma peça no tabuleiro para eu mostrar as melhores casas dela.');
                    return;
                }
                const lista = melhoresDaPecaGuiaXadrez29(pos.row, pos.col, 3);
                guiaMelhoresJogadasXadrez29Ativo = true;
                guiaMelhoresJogadasXadrez29Modo = 'peca';
                guiaMelhoresJogadasXadrez29Lista = lista;
                pintarGuiaMelhoresJogadasXadrez29(lista);
                if (atualizarTexto) atualizarStatusGuiaXadrez29(resumoGuiaMelhoresJogadasXadrez29(lista, 'Melhores da peça'));
            }

            function mostrarGuiaLadoAtualXadrez29(atualizarTexto = true) {
                let cor = chessPlayerColor || chessTurn || 'white';
                const pos = guiaMelhoresJogadasXadrez29UltimaPeca;
                if (pos && chessBoard?.[pos.row]?.[pos.col]?.color) cor = chessBoard[pos.row][pos.col].color;
                const lista = melhoresDoLadoGuiaXadrez29(cor, 3);
                guiaMelhoresJogadasXadrez29Ativo = true;
                guiaMelhoresJogadasXadrez29Modo = 'lado';
                guiaMelhoresJogadasXadrez29Lista = lista;
                pintarGuiaMelhoresJogadasXadrez29(lista);
                const lado = cor === 'white' ? 'brancas' : 'pretas';
                if (atualizarTexto) atualizarStatusGuiaXadrez29(resumoGuiaMelhoresJogadasXadrez29(lista, `Melhores das ${lado}`));
            }

            /* =====================================================================
               ✅ PROFISSIONAL 30 — ROBÔ CONSELHEIRO DO PROFESSOR
               O robô analisa localmente a posição do Xadrez no aparelho do professor.
               Ele não executa lances, não altera a partida online e não grava nada no Firebase.
            ===================================================================== */
            let roboProfessorXadrez30Ativo = false;
            let roboProfessorXadrez30Plano = [];
            let roboProfessorXadrez30Modo = '';
            let roboProfessorXadrez30Cor = 'white';
            let roboProfessorXadrez31AutoAtivo = false;
            let roboProfessorXadrez31AutoTimer = null;
            let roboProfessorXadrez31UltimaAssinatura = '';
            let roboProfessorXadrez31UltimaMensagem = '';

            function instalarRoboConselheiroProfessorXadrez30(bubble) {
                if (!bubble || bubble.querySelector('.bubble-robo-tools-30')) return;
                const tools = document.createElement('div');
                tools.className = 'bubble-robo-tools-30';
                tools.innerHTML = `
                    <div class="bubble-robo-title-30">🤖 robô conselheiro da aula</div>
                    <button class="bubble-robo-btn-30" type="button" data-robo30="study">Estudar jogo</button>
                    <button class="bubble-robo-btn-30" type="button" data-robo30="plan">Plano vencedor</button>
                    <button class="bubble-robo-btn-30" type="button" data-robo30="threat">Ameaças aluno</button>
                    <button class="bubble-robo-btn-30" type="button" data-robo30="clear">Limpar robô</button>
                    <button class="bubble-robo-btn-30" type="button" data-robo30="auto">Auto após jogada do aluno: OFF</button>
                    <div id="bubble-robo-status-30" class="bubble-robo-status-30">Toque em uma peça e aperte <strong>Estudar jogo</strong> para receber uma dica forte de ensino. Ligue o <strong>Auto</strong> para atualizar sozinho quando o aluno jogar.</div>
                `;
                const body = bubble.querySelector('.bubble-body-27');
                if (body) bubble.insertBefore(tools, body);
                else bubble.appendChild(tools);

                tools.querySelectorAll('[data-robo30]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-robo30');
                        if (acao === 'study') estudarJogoRoboProfessorXadrez30('estudo');
                        if (acao === 'plan') estudarJogoRoboProfessorXadrez30('plano');
                        if (acao === 'threat') mostrarAmeacasDoAlunoRoboProfessorXadrez30();
                        if (acao === 'clear') limparRoboProfessorXadrez30(true);
                        if (acao === 'auto') alternarAutoRoboProfessorXadrez31();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
                atualizarBotaoAutoRoboProfessorXadrez31();
            }

            function atualizarStatusRoboProfessorXadrez30(html) {
                const el = document.getElementById('bubble-robo-status-30');
                if (el) el.innerHTML = html;
            }

            function corFocoRoboProfessorXadrez30() {
                const pos = guiaMelhoresJogadasXadrez29UltimaPeca;
                if (pos && chessBoard?.[pos.row]?.[pos.col]?.color) return chessBoard[pos.row][pos.col].color;
                return chessPlayerColor || chessTurn || 'white';
            }

            function nomeLadoRoboProfessorXadrez30(cor) {
                return cor === 'white' ? 'brancas' : 'pretas';
            }

            function nomeCurtoPecaRoboProfessorXadrez30(tipo) {
                return nomePeca[tipo] || 'Peça';
            }

            function movimentoIgualRoboProfessorXadrez30(a, b) {
                return !!(a && b &&
                    a.from?.row === b.from?.row && a.from?.col === b.from?.col &&
                    a.to?.row === b.to?.row && a.to?.col === b.to?.col);
            }

            function textoMovimentoRoboProfessorXadrez30(item, board = chessBoard) {
                if (!item) return 'sem lance';
                const peca = board?.[item.from.row]?.[item.from.col] || item.peca || null;
                const nome = nomeCurtoPecaRoboProfessorXadrez30(peca?.type);
                let extra = '';
                const alvo = pecaCapturadaRoboProfessorXadrez30(board, item);
                if (alvo) extra = ` captura ${nomeCurtoPecaRoboProfessorXadrez30(alvo.type)}`;
                if (item.to?.castle) extra = item.to.castle === 'king' ? ' roque pequeno' : ' roque grande';
                if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) extra = ' promoção';
                return `${nome}: ${alg(item.from.row, item.from.col)} → ${alg(item.to.row, item.to.col)}${extra}`;
            }

            function pecaCapturadaRoboProfessorXadrez30(board, item) {
                if (!board || !item) return null;
                if (item.to?.enPassant && item.to?.enPassantCapture) {
                    return board[item.to.enPassantCapture.row]?.[item.to.enPassantCapture.col] || null;
                }
                return board[item.to.row]?.[item.to.col] || null;
            }

            function classificarLanceRoboProfessorXadrez30(item, board = chessBoard, cor = 'white') {
                try {
                    const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                    const adversario = corOposta(cor);
                    const peca = board?.[item.from.row]?.[item.from.col] || item.peca || null;
                    const capturada = pecaCapturadaRoboProfessorXadrez30(board, item);
                    if (temp) {
                        const respostas = todosMovimentosLegais(adversario, temp) || [];
                        if (!respostas.length && reiEstaEmXeque(temp, adversario)) return 'vence por xeque-mate';
                        if (reiEstaEmXeque(temp, adversario)) return 'dá xeque e obriga o aluno a responder';
                    }
                    if (capturada) return `ganha material capturando ${nomeCurtoPecaRoboProfessorXadrez30(capturada.type)}`;
                    if (item.to?.castle) return 'protege o Rei e melhora a segurança';
                    if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) return 'transforma o peão em peça forte';
                    if ((peca?.type === 'knight' || peca?.type === 'bishop') && (peca.color === 'white' ? item.from.row === 7 : item.from.row === 0)) return 'desenvolve peça e aumenta controle do centro';
                    if (centro26(item.to.row, item.to.col) >= 5.5) return 'controla o centro e melhora a posição';
                    if (peca && quadradoAtacado(board, item.from.row, item.from.col, adversario)) return 'tira uma peça de perigo sem perder tempo';
                    return 'lance seguro para melhorar a posição e criar plano';
                } catch (_) {
                    return 'lance útil para estudar com calma';
                }
            }

            /* =====================================================================
               ✅ PROFISSIONAL 40 — CÉREBRO MAIS FORTE DO ROBÔ PROFESSOR
               A Profissional 39 deixou o robô leve e sincronizado. Agora o cálculo
               fica mais forte: ele olha a resposta do aluno, evita peças penduradas,
               procura xeque-mate, captura segura, defesa do Rei e melhor continuação.
               Continua local, privado e sem mexer na partida/Firebase.
            ===================================================================== */
            function valorPecaProfessor40(tipo) {
                try { return valorProfessorXadrez20(tipo); } catch (_) {}
                return ({ pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 })[tipo] || 0;
            }

            function bonusCasaProfessor40(peca, row, col, corBase) {
                if (!peca) return 0;
                const avancar = peca.color === 'white' ? (6 - row) : (row - 1);
                const centro = centro26(row, col);
                let bonus = 0;
                if (peca.type === 'pawn') bonus += Math.max(-2, avancar) * 7 + centro * 3;
                if (peca.type === 'knight') bonus += centro * 13 - ((row === 0 || row === 7 || col === 0 || col === 7) ? 26 : 0);
                if (peca.type === 'bishop') bonus += centro * 9;
                if (peca.type === 'queen') bonus += centro * 4;
                if (peca.type === 'rook') bonus += (row === 0 || row === 7 ? 8 : 0);
                if (peca.type === 'king') {
                    const finalComPoucasPecas = contarMaterialProfessor40(chessBoard, null) <= 2600;
                    bonus += finalComPoucasPecas ? centro * 8 : -centro * 5;
                }
                return peca.color === corBase ? bonus : -bonus;
            }

            function contarMaterialProfessor40(board, cor = null) {
                let total = 0;
                try {
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const p = board?.[r]?.[c];
                            if (!p || p.type === 'king') continue;
                            if (!cor || p.color === cor) total += valorPecaProfessor40(p.type);
                        }
                    }
                } catch (_) {}
                return total;
            }

            function reiProfessor40(board, cor) {
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = board?.[r]?.[c];
                        if (p && p.color === cor && p.type === 'king') return { row: r, col: c };
                    }
                }
                return null;
            }

            function segurancaReiProfessor40(board, corBase) {
                const adversario = corOposta(corBase);
                const meuRei = reiProfessor40(board, corBase);
                const reiAdv = reiProfessor40(board, adversario);
                let score = 0;
                if (meuRei) {
                    if (reiEstaEmXeque(board, corBase)) score -= 550;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (!dr && !dc) continue;
                            const r = meuRei.row + dr, c = meuRei.col + dc;
                            if (r < 0 || r > 7 || c < 0 || c > 7) continue;
                            if (quadradoAtacado(board, r, c, adversario)) score -= 26;
                        }
                    }
                }
                if (reiAdv) {
                    if (reiEstaEmXeque(board, adversario)) score += 380;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (!dr && !dc) continue;
                            const r = reiAdv.row + dr, c = reiAdv.col + dc;
                            if (r < 0 || r > 7 || c < 0 || c > 7) continue;
                            if (quadradoAtacado(board, r, c, corBase)) score += 14;
                        }
                    }
                }
                return score;
            }

            function avaliarPosicaoProfessor40(board, corBase) {
                const adversario = corOposta(corBase);
                let meusMoves = [];
                let movesAdv = [];
                try { meusMoves = todosMovimentosLegais(corBase, board) || []; } catch (_) { meusMoves = []; }
                try { movesAdv = todosMovimentosLegais(adversario, board) || []; } catch (_) { movesAdv = []; }

                if (!movesAdv.length && reiEstaEmXeque(board, adversario)) return 10000000;
                if (!meusMoves.length && reiEstaEmXeque(board, corBase)) return -10000000;
                if (!movesAdv.length && !reiEstaEmXeque(board, adversario)) return -60;
                if (!meusMoves.length && !reiEstaEmXeque(board, corBase)) return 0;

                let score = 0;
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = board?.[r]?.[c];
                        if (!p) continue;
                        const sinal = p.color === corBase ? 1 : -1;
                        const valor = valorPecaProfessor40(p.type);
                        score += sinal * valor;
                        score += bonusCasaProfessor40(p, r, c, corBase);

                        if (p.type !== 'king') {
                            const atacada = quadradoAtacado(board, r, c, corOposta(p.color));
                            const defendida = quadradoAtacado(board, r, c, p.color);
                            if (atacada && !defendida) score += sinal * (-Math.min(420, valor * 0.55));
                            else if (atacada && defendida) score += sinal * (-Math.min(120, valor * 0.16));
                            else if (defendida) score += sinal * Math.min(34, valor * 0.035);
                        }
                    }
                }

                score += (meusMoves.length - movesAdv.length) * 5;
                score += segurancaReiProfessor40(board, corBase);

                try {
                    const meuMate = detectarMateEmUmTreinoXadrez(corBase, board);
                    const mateContra = detectarMateEmUmTreinoXadrez(adversario, board);
                    if (meuMate) score += 280000;
                    if (mateContra) score -= 360000;
                } catch (_) {}

                return score;
            }

            function movimentoDaXequeProfessor40(board, item, cor) {
                try {
                    const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                    return !!(temp && reiEstaEmXeque(temp, corOposta(cor)));
                } catch (_) { return false; }
            }

            function ordenarMovimentosProfessor40(movimentos, board, corBase) {
                const adversario = corOposta(corBase);
                return (movimentos || []).map(item => {
                    const peca = board?.[item.from.row]?.[item.from.col] || null;
                    const alvo = pecaCapturadaRoboProfessorXadrez30(board, item);
                    let ordem = 0;
                    if (alvo) ordem += valorPecaProfessor40(alvo.type) * 16 - valorPecaProfessor40(peca?.type) * 0.55;
                    if (item.to?.castle) ordem += 260;
                    if (peca?.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) ordem += 1500;
                    if (movimentoDaXequeProfessor40(board, item, peca?.color || corBase)) ordem += 430;
                    try {
                        if (peca && quadradoAtacado(board, item.from.row, item.from.col, adversario)) ordem += Math.min(350, valorPecaProfessor40(peca.type) * 0.55);
                        const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                        if (temp && peca && peca.type !== 'king') {
                            const destinoAtacado = quadradoAtacado(temp, item.to.row, item.to.col, adversario);
                            const destinoDefendido = quadradoAtacado(temp, item.to.row, item.to.col, peca.color);
                            if (destinoAtacado && !destinoDefendido) ordem -= valorPecaProfessor40(peca.type) * 2.1;
                            if (destinoAtacado && destinoDefendido) ordem -= valorPecaProfessor40(peca.type) * 0.25;
                        }
                    } catch (_) {}
                    ordem += centro26(item.to.row, item.to.col) * 8;
                    return { ...item, order40: ordem };
                }).sort((a, b) => b.order40 - a.order40);
            }

            function buscaProfessor40(board, corDaVez, profundidade, alpha, beta, corBase) {
                const movimentosBase = todosMovimentosLegais(corDaVez, board) || [];
                if (profundidade <= 0 || !movimentosBase.length) return avaliarPosicaoProfessor40(board, corBase);

                const maximizando = corDaVez === corBase;
                // ✅ PROFISSIONAL 41: limite menor para não travar o online.
                const limite = profundidade >= 3 ? 6 : (profundidade === 2 ? 8 : 12);
                const movimentos = ordenarMovimentosProfessor40(movimentosBase, board, corDaVez).slice(0, limite);

                if (maximizando) {
                    let melhor = -Infinity;
                    for (const item of movimentos) {
                        const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                        if (!temp) continue;
                        const valor = buscaProfessor40(temp, corOposta(corDaVez), profundidade - 1, alpha, beta, corBase);
                        if (valor > melhor) melhor = valor;
                        if (valor > alpha) alpha = valor;
                        if (beta <= alpha) break;
                    }
                    return melhor;
                }

                let pior = Infinity;
                for (const item of movimentos) {
                    const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                    if (!temp) continue;
                    const valor = buscaProfessor40(temp, corOposta(corDaVez), profundidade - 1, alpha, beta, corBase);
                    if (valor < pior) pior = valor;
                    if (valor < beta) beta = valor;
                    if (beta <= alpha) break;
                }
                return pior;
            }

            function melhorGanhoRespostaAlunoProfessor40(boardDepois, corBase) {
                const aluno = corOposta(corBase);
                let pior = 0;
                try {
                    const respostas = ordenarMovimentosProfessor40(todosMovimentosLegais(aluno, boardDepois) || [], boardDepois, aluno).slice(0, 5);
                    respostas.forEach(resp => {
                        const alvo = pecaCapturadaRoboProfessorXadrez30(boardDepois, resp);
                        if (alvo) pior = Math.max(pior, valorPecaProfessor40(alvo.type));
                        const temp = aplicarMovimentoTreinoEmClone(boardDepois, resp, 'queen');
                        if (temp && reiEstaEmXeque(temp, corBase)) pior = Math.max(pior, 420);
                    });
                } catch (_) {}
                return pior;
            }

            function avaliarLanceProfundoRoboProfessorXadrez30(item, board = chessBoard, cor = 'white') {
                try {
                    const peca = board?.[item.from.row]?.[item.from.col] || item.peca || null;
                    const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                    if (!temp || !peca) return -9999999;

                    const adversario = corOposta(cor);
                    const capturada = pecaCapturadaRoboProfessorXadrez30(board, item);
                    const respostas = todosMovimentosLegais(adversario, temp) || [];
                    if (!respostas.length && reiEstaEmXeque(temp, adversario)) return 9000000;

                    // ✅ PROFISSIONAL 41: profundidade reduzida para manter o jogo leve.
                    // O robô continua forte por heurística, mas não trava durante a sincronização online.
                    let score = buscaProfessor40(temp, adversario, 2, -99999999, 99999999, cor);

                    if (capturada) score += valorPecaProfessor40(capturada.type) * 2.15 - valorPecaProfessor40(peca.type) * 0.12;
                    if (reiEstaEmXeque(temp, adversario)) score += 700;
                    if (item.to?.castle) score += 360;
                    if (peca.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 2200;
                    score += centro26(item.to.row, item.to.col) * 24;

                    const mateContra = detectarMateEmUmTreinoXadrez(adversario, temp);
                    if (mateContra) score -= 6500000;

                    const meuMateProximo = detectarMateEmUmTreinoXadrez(cor, temp);
                    if (meuMateProximo) score += 520000;

                    if (peca.type !== 'king' && quadradoAtacado(temp, item.to.row, item.to.col, adversario)) {
                        const defendida = quadradoAtacado(temp, item.to.row, item.to.col, cor);
                        score -= valorPecaProfessor40(peca.type) * (defendida ? 0.34 : 1.55);
                    }

                    score -= melhorGanhoRespostaAlunoProfessor40(temp, cor) * 0.95;

                    return score;
                } catch (_) {
                    return -9999999;
                }
            }

            function melhoresLancesProfundosRoboProfessorXadrez30(cor, board = chessBoard, limite = 5) {
                let movimentos = [];
                try { movimentos = todosMovimentosLegais(cor, board) || []; } catch (_) { movimentos = []; }
                if (!movimentos.length) return [];

                // ✅ PROFISSIONAL 41: calcula menos candidatos por ciclo para não pesar no celular/notebook.
                const candidatos = ordenarMovimentosProfessor40(movimentos, board, cor).slice(0, 12);
                return candidatos.map(item => {
                    const peca = board?.[item.from.row]?.[item.from.col] || null;
                    const score = avaliarLanceProfundoRoboProfessorXadrez30(item, board, cor);
                    return { ...item, peca, score, motivo30: classificarLanceRoboProfessorXadrez30(item, board, cor) };
                }).sort((a, b) => b.score - a.score).slice(0, limite);
            }

            function melhorRespostaRoboProfessorXadrez30(cor, board = chessBoard) {
                const lista = melhoresLancesProfundosRoboProfessorXadrez30(cor, board, 1);
                return lista[0] || null;
            }

            function montarPlanoTresLancesRoboProfessorXadrez30(cor, board = chessBoard) {
                const melhores = melhoresLancesProfundosRoboProfessorXadrez30(cor, board, 3);
                const melhor = melhores[0] || null;
                if (!melhor) return { melhores: [], plano: [] };
                const adversario = corOposta(cor);
                const depoisDoPrimeiro = aplicarMovimentoTreinoEmClone(board, melhor, 'queen');
                const resposta = depoisDoPrimeiro ? melhorRespostaRoboProfessorXadrez30(adversario, depoisDoPrimeiro) : null;
                const depoisDaResposta = resposta ? aplicarMovimentoTreinoEmClone(depoisDoPrimeiro, resposta, 'queen') : depoisDoPrimeiro;
                const continuacao = depoisDaResposta ? melhorRespostaRoboProfessorXadrez30(cor, depoisDaResposta) : null;
                const plano = [
                    { tipo: 'melhor', item: melhor, board, cor, label: '1', titulo: 'Melhor lance' },
                    resposta ? { tipo: 'resposta', item: resposta, board: depoisDoPrimeiro, cor: adversario, label: '2', titulo: 'Resposta provável do aluno' } : null,
                    continuacao ? { tipo: 'continua', item: continuacao, board: depoisDaResposta, cor, label: '3', titulo: 'Continuação para manter vantagem' } : null
                ].filter(Boolean);
                return { melhores, plano };
            }

            function limparRoboProfessorXadrez30(atualizarTexto = false) {
                roboProfessorXadrez30Ativo = false;
                roboProfessorXadrez30Plano = [];
                if (atualizarTexto) {
                    roboProfessorXadrez31AutoAtivo = false;
                    clearTimeout(roboProfessorXadrez31AutoTimer);
                    roboProfessorXadrez31AutoTimer = null;
                    roboProfessorXadrez31UltimaAssinatura = '';
                    atualizarBotaoAutoRoboProfessorXadrez31();
                }
                document.querySelectorAll('#chess-board .chess-square').forEach(square => {
                    square.classList.remove('teacher-robo-from-30', 'teacher-robo-to-30', 'teacher-robo-step1-30', 'teacher-robo-step2-30', 'teacher-robo-step3-30');
                    square.removeAttribute('data-teacher-robo-label');
                    square.removeAttribute('data-teacher-robo-origin');
                    square.removeAttribute('title');
                });
                if (atualizarTexto) atualizarStatusRoboProfessorXadrez30('Robô limpo. Toque em uma peça e peça um novo estudo quando quiser.');
            }

            function pintarPlanoRoboProfessorXadrez30(plano = []) {
                limparRoboProfessorXadrez30(false);
                plano.slice(0, 3).forEach((passo, index) => {
                    const item = passo.item;
                    if (!item) return;
                    const ordem = index + 1;
                    const from = squareGuiaXadrez29(item.from.row, item.from.col);
                    const to = squareGuiaXadrez29(item.to.row, item.to.col);
                    const titulo = `${passo.titulo}: ${textoMovimentoRoboProfessorXadrez30(item, passo.board)} — ${passo.item.motivo30 || classificarLanceRoboProfessorXadrez30(item, passo.board, passo.cor)}`;
                    if (from) {
                        from.classList.add('teacher-robo-from-30', `teacher-robo-step${ordem}-30`);
                        from.setAttribute('data-teacher-robo-origin', passo.label || String(ordem));
                        from.setAttribute('title', titulo);
                    }
                    if (to) {
                        to.classList.add('teacher-robo-to-30', `teacher-robo-step${ordem}-30`);
                        to.setAttribute('data-teacher-robo-label', passo.label || String(ordem));
                        to.setAttribute('title', titulo);
                    }
                });
            }

            function textoPlanoRoboProfessorXadrez30(resultado, cor, modo = 'estudo') {
                const melhores = resultado.melhores || [];
                const plano = resultado.plano || [];
                if (!melhores.length) return 'O robô não encontrou lance legal agora. Verifique se a partida terminou ou se o rei está sem saída.';
                const melhor = melhores[0];
                const vantagem = melhor.score > 900000 ? 'mate encontrado' : (melhor.score > 600 ? 'vantagem forte' : (melhor.score > 80 ? 'boa vantagem' : 'jogada segura'));
                const linhas = [];
                linhas.push(`<strong>Robô estudou as ${nomeLadoRoboProfessorXadrez30(cor)}:</strong> <span class="robo-good-30">${escapeBubble27(vantagem)}</span>.`);
                linhas.push(`<span class="robo-good-30">1)</span> ${escapeBubble27(textoMovimentoRoboProfessorXadrez30(melhor, chessBoard))} — ${escapeBubble27(melhor.motivo30 || classificarLanceRoboProfessorXadrez30(melhor, chessBoard, cor))}.`);
                const resposta = plano.find(p => p.tipo === 'resposta');
                const continuacao = plano.find(p => p.tipo === 'continua');
                if (resposta) linhas.push(`<span class="robo-warn-30">2)</span> Se o aluno responder forte: ${escapeBubble27(textoMovimentoRoboProfessorXadrez30(resposta.item, resposta.board))}.`);
                if (continuacao) linhas.push(`<span class="robo-blue-30">3)</span> Continue com: ${escapeBubble27(textoMovimentoRoboProfessorXadrez30(continuacao.item, continuacao.board))}.`);
                linhas.push(`<strong>Como ensinar:</strong> peça para o aluno explicar 3 perguntas: o que eu ganho, o que eu protejo e qual ameaça eu crio?`);
                if (modo === 'plano') linhas.push(`Cores: <span class="robo-good-30">verde = lance vencedor</span>, <span class="robo-warn-30">vermelho = resposta provável</span>, <span class="robo-blue-30">azul = continuação</span>.`);
                return linhas.join('<br>');
            }

            function estudarJogoRoboProfessorXadrez30(modo = 'estudo') {
                const cor = corFocoRoboProfessorXadrez30();
                roboProfessorXadrez30Cor = cor;
                roboProfessorXadrez30Modo = modo;
                atualizarStatusRoboProfessorXadrez30('🤖 Estudando a posição...');
                try {
                    const resultado = montarPlanoTresLancesRoboProfessorXadrez30(cor, chessBoard);
                    roboProfessorXadrez30Ativo = true;
                    roboProfessorXadrez30Plano = resultado.plano || [];
                    pintarPlanoRoboProfessorXadrez30(roboProfessorXadrez30Plano);
                    atualizarStatusRoboProfessorXadrez30(textoPlanoRoboProfessorXadrez30(resultado, cor, modo));
                } catch (err) {
                    atualizarStatusRoboProfessorXadrez30('Não consegui estudar essa posição agora. Tente tocar em uma peça e apertar de novo.');
                }
            }

            function mostrarAmeacasDoAlunoRoboProfessorXadrez30() {
                const cor = corFocoRoboProfessorXadrez30();
                const aluno = corOposta(cor);
                atualizarStatusRoboProfessorXadrez30('⚠️ Procurando ameaças do aluno...');
                try {
                    const ameaças = melhoresLancesProfundosRoboProfessorXadrez30(aluno, chessBoard, 3);
                    if (!ameaças.length) {
                        limparRoboProfessorXadrez30(false);
                        atualizarStatusRoboProfessorXadrez30('Não encontrei ameaça legal do aluno agora. Aproveite para desenvolver e melhorar suas peças.');
                        return;
                    }
                    const plano = ameaças.map((item, index) => ({ tipo: 'resposta', item, board: chessBoard, cor: aluno, label: `A${index + 1}`, titulo: 'Ameaça do aluno' }));
                    roboProfessorXadrez30Ativo = true;
                    roboProfessorXadrez30Modo = 'ameacas';
                    roboProfessorXadrez30Cor = aluno;
                    roboProfessorXadrez30Plano = plano;
                    pintarPlanoRoboProfessorXadrez30(plano);
                    const html = `<strong>Ameaças do aluno (${nomeLadoRoboProfessorXadrez30(aluno)}):</strong><br>` + ameaças.map((item, i) => {
                        return `<span class="robo-warn-30">A${i + 1})</span> ${escapeBubble27(textoMovimentoRoboProfessorXadrez30(item, chessBoard))} — ${escapeBubble27(item.motivo30 || classificarLanceRoboProfessorXadrez30(item, chessBoard, aluno))}.`;
                    }).join('<br>') + '<br><strong>Como ensinar:</strong> mostre para o aluno que antes de atacar ele precisa enxergar a ameaça do adversário.';
                    atualizarStatusRoboProfessorXadrez30(html);
                } catch (_) {
                    atualizarStatusRoboProfessorXadrez30('Não consegui calcular as ameaças agora. Tente novamente depois de tocar em uma peça.');
                }
            }

            function botaoAutoRoboProfessorXadrez31() {
                return document.querySelector('#teacher-piece-bubble-27 [data-robo30="auto"]');
            }

            function atualizarBotaoAutoRoboProfessorXadrez31() {
                const btn = botaoAutoRoboProfessorXadrez31();
                if (!btn) return;
                btn.classList.toggle('auto-on-31', !!roboProfessorXadrez31AutoAtivo);
                btn.textContent = roboProfessorXadrez31AutoAtivo ? 'Auto após jogada do aluno: ON' : 'Auto após jogada do aluno: OFF';
            }

            function assinaturaAutoRoboProfessorXadrez31() {
                try {
                    return JSON.stringify({
                        turn: chessTurn,
                        color: chessPlayerColor || '',
                        over: !!chessGameOver,
                        moves: Array.isArray(moveHistory) ? moveHistory.length : 0,
                        last: lastChessMove || null,
                        board: chessBoard || []
                    });
                } catch (_) {
                    return `${chessTurn || ''}|${chessPlayerColor || ''}|${Date.now()}`;
                }
            }

            function corRespostaProfessorAutoXadrez31() {
                if (chessPlayerColor === 'white' || chessPlayerColor === 'black') return chessPlayerColor;
                return corFocoRoboProfessorXadrez30();
            }

            function textoUltimaJogadaAlunoAutoXadrez31() {
                try {
                    if (!lastChessMove || !lastChessMove.from || !lastChessMove.to) return 'O aluno mexeu. O robô recalculou sua resposta.';
                    return `Depois da jogada do aluno (${alg(lastChessMove.from.row, lastChessMove.from.col)} → ${alg(lastChessMove.to.row, lastChessMove.to.col)}), esta é a melhor resposta para você ensinar.`;
                } catch (_) {
                    return 'O aluno mexeu. O robô recalculou sua resposta.';
                }
            }

            function atualizarAutoRoboProfessorXadrez31(forcar = false, origem = 'auto') {
                if (!roboProfessorXadrez31AutoAtivo) return;
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;

                const assinatura = assinaturaAutoRoboProfessorXadrez31();
                if (!forcar && assinatura === roboProfessorXadrez31UltimaAssinatura) return;
                roboProfessorXadrez31UltimaAssinatura = assinatura;

                if (chessGameOver) {
                    limparRoboProfessorXadrez30(false);
                    atualizarStatusRoboProfessorXadrez30('Auto ligado, mas a partida terminou. Comece outra posição para o robô voltar a orientar.');
                    return;
                }

                const corProfessor = corRespostaProfessorAutoXadrez31();
                if (chessMode === 'online' && chessPlayerColor && chessTurn !== corProfessor) {
                    limparRoboProfessorXadrez30(false);
                    atualizarStatusRoboProfessorXadrez30(
                        `<span class="bubble-robo-auto-line-31">Auto ligado.</span>` +
                        `Aguardando o aluno jogar. Assim que voltar a vez das ${nomeLadoRoboProfessorXadrez30(corProfessor)}, eu recalculo a melhor resposta para você ensinar.`
                    );
                    return;
                }

                try {
                    const resultado = montarPlanoTresLancesRoboProfessorXadrez30(corProfessor, chessBoard);
                    roboProfessorXadrez30Ativo = true;
                    roboProfessorXadrez30Modo = 'auto31';
                    roboProfessorXadrez30Cor = corProfessor;
                    roboProfessorXadrez30Plano = resultado.plano || [];
                    pintarPlanoRoboProfessorXadrez30(roboProfessorXadrez30Plano);
                    const cabecalho = origem === 'manual'
                        ? '<span class="bubble-robo-auto-line-31">Auto ligado: análise inicial feita.</span>'
                        : `<span class="bubble-robo-auto-line-31">Auto atualizou: ${escapeBubble27(textoUltimaJogadaAlunoAutoXadrez31())}</span>`;
                    atualizarStatusRoboProfessorXadrez30(cabecalho + textoPlanoRoboProfessorXadrez30(resultado, corProfessor, 'plano'));
                } catch (_) {
                    atualizarStatusRoboProfessorXadrez30('Auto ligado, mas não consegui recalcular essa posição agora. Toque em uma peça ou aperte Plano vencedor.');
                }
            }

            function agendarAutoRoboProfessorXadrez31(forcar = false, origem = 'auto') {
                if (!roboProfessorXadrez31AutoAtivo) return;
                clearTimeout(roboProfessorXadrez31AutoTimer);
                roboProfessorXadrez31AutoTimer = setTimeout(() => atualizarAutoRoboProfessorXadrez31(forcar, origem), 160);
            }

            function alternarAutoRoboProfessorXadrez31() {
                roboProfessorXadrez31AutoAtivo = !roboProfessorXadrez31AutoAtivo;
                atualizarBotaoAutoRoboProfessorXadrez31();
                if (roboProfessorXadrez31AutoAtivo) {
                    roboProfessorXadrez31UltimaAssinatura = '';
                    atualizarStatusRoboProfessorXadrez30('Auto ligado. Quando o aluno fizer uma jogada e voltar sua vez, o robô vai recalcular a melhor resposta automaticamente.');
                    agendarAutoRoboProfessorXadrez31(true, 'manual');
                } else {
                    clearTimeout(roboProfessorXadrez31AutoTimer);
                    roboProfessorXadrez31AutoTimer = null;
                    roboProfessorXadrez31UltimaAssinatura = '';
                    atualizarStatusRoboProfessorXadrez30('Auto desligado. Use Estudar jogo, Plano vencedor ou Ameaças aluno quando quiser.');
                }
            }

            function reaplicarRoboProfessorXadrez30() {
                if (!roboProfessorXadrez30Ativo || !roboProfessorXadrez30Plano.length) return;
                pintarPlanoRoboProfessorXadrez30(roboProfessorXadrez30Plano);
            }

            function reaplicarGuiaMelhoresJogadasXadrez29() {
                if (guiaMelhoresJogadasXadrez29Ativo) {
                    if (guiaMelhoresJogadasXadrez29Modo === 'peca') mostrarGuiaPecaAtualXadrez29(false);
                    else if (guiaMelhoresJogadasXadrez29Modo === 'lado') mostrarGuiaLadoAtualXadrez29(false);
                    else pintarGuiaMelhoresJogadasXadrez29(guiaMelhoresJogadasXadrez29Lista);
                }
                reaplicarRoboProfessorXadrez30();
                agendarAutoRoboProfessorXadrez31(false, 'auto');
                agendarGuiaDiretaProfessorXadrez33(false, 'auto');
                atualizarPainelFlutuanteGuiaDiretaXadrez33();
            }

            if (!window.__teacherBestGuideXadrez29RenderHook) {
                window.__teacherBestGuideXadrez29RenderHook = true;
                const renderAnteriorGuia29 = renderChessBoard;
                renderChessBoard = function renderChessBoardGuiaMelhores29() {
                    const retorno = renderAnteriorGuia29.apply(this, arguments);
                    setTimeout(reaplicarGuiaMelhoresJogadasXadrez29, 0);
                    return retorno;
                };
            }


            /* =====================================================================
               ✅ PROFISSIONAL 33 — GUIA DIRETO DO ROBÔ NO TABULEIRO
               O professor escolhe: abrir o balão ao tocar na peça ou deixar o robô
               guiar direto no tabuleiro. Não envia nada para o Firebase e não mexe
               na partida online. É apenas visual no aparelho do professor.
            ===================================================================== */
            const GUIA_DIRETA_XADREZ_33_MODO_KEY = 'tabuleiro_arena_professor_xadrez_33_modo_toque';
            const GUIA_DIRETA_XADREZ_33_AUTO_KEY = 'tabuleiro_arena_professor_xadrez_33_auto_direto';
            let guiaDiretaXadrez33Timer = null;
            let guiaDiretaXadrez33UltimaAssinatura = '';
            let guiaDiretaXadrez33UltimoClique = null;

            function instalarCssGuiaDiretaRoboProfessorXadrez33() {
                if (document.getElementById('teacher-direct-guide-33-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-direct-guide-33-style';
                style.textContent = `
                    #teacher-piece-bubble-27 .bubble-direct-tools-33 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 5px;
                        padding: 7px 0 4px 0;
                        border-bottom: 1px solid rgba(148,163,184,.14);
                    }
                    #teacher-piece-bubble-27 .bubble-direct-title-33 {
                        grid-column: 1 / -1;
                        color: #fde68a;
                        font-size: .61rem;
                        font-weight: 1000;
                        letter-spacing: .06em;
                        text-transform: uppercase;
                        text-align: center;
                        line-height: 1.15;
                    }
                    #teacher-piece-bubble-27 .bubble-direct-btn-33 {
                        border: 1px solid rgba(250,204,21,.30);
                        background: rgba(113,63,18,.68);
                        color: #fef3c7;
                        border-radius: 999px;
                        padding: 7px 6px;
                        font-size: .61rem;
                        font-weight: 1000;
                        line-height: 1.05;
                        text-transform: none;
                        box-shadow: none;
                    }
                    #teacher-piece-bubble-27 .bubble-direct-btn-33.direct-on-33,
                    #teacher-piece-bubble-27 .bubble-direct-btn-33.auto-on-33 {
                        border-color: rgba(34,197,94,.70) !important;
                        background: linear-gradient(90deg, rgba(22,101,52,.96), rgba(21,128,61,.90)) !important;
                        color: #dcfce7 !important;
                        box-shadow: 0 0 12px rgba(34,197,94,.23) !important;
                    }
                    #teacher-piece-bubble-27 .bubble-direct-status-33 {
                        grid-column: 1 / -1;
                        min-height: 26px;
                        max-height: 108px;
                        overflow: auto;
                        border-radius: 10px;
                        padding: 7px 8px;
                        background: rgba(3,7,18,.72);
                        border: 1px solid rgba(250,204,21,.14);
                        color: #e5e7eb;
                        font-size: .62rem;
                        line-height: 1.25;
                    }
                    #teacher-piece-bubble-27 .bubble-direct-status-33 strong,
                    #teacher-direct-guide-33 strong { color: #fef08a; }
                    #teacher-piece-bubble-27 .bubble-direct-status-33 .good-33,
                    #teacher-direct-guide-33 .good-33 { color: #86efac; font-weight: 1000; }
                    #teacher-piece-bubble-27 .bubble-direct-status-33 .bad-33,
                    #teacher-direct-guide-33 .bad-33 { color: #fca5a5; font-weight: 1000; }
                    #teacher-piece-bubble-27 .bubble-direct-status-33 .yellow-33,
                    #teacher-direct-guide-33 .yellow-33 { color: #fde68a; font-weight: 1000; }

                    #teacher-direct-guide-33 {
                        position: fixed;
                        left: 8px;
                        right: auto;
                        top: 74px;
                        bottom: auto;
                        z-index: 999998;
                        display: none;
                        width: min(272px, calc(100vw - 16px));
                        max-width: 560px;
                        margin: 0;
                        border-radius: 15px;
                        border: 2px solid rgba(250,204,21,.72);
                        background: linear-gradient(180deg, rgba(8,13,28,.96), rgba(3,7,18,.98));
                        color: #e5e7eb;
                        box-shadow: 0 16px 38px rgba(0,0,0,.52), 0 0 24px rgba(250,204,21,.18);
                        padding: 8px;
                        font-family: inherit;
                        text-align: left;
                    }
                    #teacher-direct-guide-33.visible-33 { display: block; }
                    #teacher-direct-guide-33 .direct-head-33 {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        font-size: .68rem;
                        font-weight: 1000;
                        color: #fde68a;
                        letter-spacing: .04em;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    #teacher-direct-guide-33 .direct-actions-33 {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
                        gap: 5px;
                        margin-bottom: 6px;
                    }
                    #teacher-direct-guide-33 button {
                        border: 1px solid rgba(148,163,184,.22);
                        background: rgba(15,23,42,.86);
                        color: #e5e7eb;
                        border-radius: 999px;
                        padding: 6px 5px;
                        font-size: .60rem;
                        font-weight: 1000;
                        line-height: 1.05;
                        text-transform: none;
                        box-shadow: none;
                    }
                    #teacher-direct-guide-33 button.active-33 {
                        background: linear-gradient(90deg, rgba(22,101,52,.96), rgba(21,128,61,.90));
                        color: #dcfce7;
                        border-color: rgba(34,197,94,.64);
                    }
                    #teacher-direct-guide-33 .direct-status-33 {
                        border-radius: 11px;
                        border: 1px solid rgba(148,163,184,.14);
                        background: rgba(15,23,42,.72);
                        padding: 7px 8px;
                        max-height: 92px;
                        overflow: auto;
                        font-size: .67rem;
                        line-height: 1.27;
                    }

                    #chess-board .chess-square.teacher-direct-from-33,
                    .chess-square.teacher-direct-from-33 {
                        position: relative !important;
                        outline: 4px solid rgba(250,204,21,.98) !important;
                        outline-offset: -5px !important;
                        box-shadow: inset 0 0 0 5px rgba(250,204,21,.25), 0 0 22px rgba(250,204,21,.70) !important;
                        animation: teacherDirectYellow33 1s ease-in-out infinite !important;
                    }
                    #chess-board .chess-square.teacher-direct-to-33,
                    .chess-square.teacher-direct-to-33 {
                        position: relative !important;
                        outline: 4px solid rgba(34,197,94,.98) !important;
                        outline-offset: -5px !important;
                        box-shadow: inset 0 0 0 5px rgba(34,197,94,.28), 0 0 25px rgba(34,197,94,.76) !important;
                        animation: teacherDirectGreen33 1s ease-in-out infinite !important;
                    }
                    #chess-board .chess-square.teacher-direct-bad-33,
                    .chess-square.teacher-direct-bad-33 {
                        position: relative !important;
                        outline: 4px solid rgba(239,68,68,.98) !important;
                        outline-offset: -5px !important;
                        box-shadow: inset 0 0 0 5px rgba(127,29,29,.45), 0 0 20px rgba(239,68,68,.58) !important;
                        filter: saturate(1.2) contrast(1.08);
                    }
                    #chess-board .chess-square.teacher-direct-from-33::before,
                    .chess-square.teacher-direct-from-33::before,
                    #chess-board .chess-square.teacher-direct-to-33::before,
                    .chess-square.teacher-direct-to-33::before,
                    #chess-board .chess-square.teacher-direct-bad-33::before,
                    .chess-square.teacher-direct-bad-33::before {
                        content: attr(data-teacher-direct-label);
                        position: absolute;
                        left: 3px;
                        top: 3px;
                        z-index: 15;
                        min-width: 20px;
                        height: 20px;
                        padding: 0 4px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(2,6,23,.90);
                        color: #fff;
                        border: 1px solid rgba(255,255,255,.58);
                        font-size: .58rem;
                        font-weight: 1000;
                        line-height: 1;
                        text-shadow: none;
                    }
                    @keyframes teacherDirectYellow33 {
                        0%, 100% { box-shadow: inset 0 0 0 4px rgba(250,204,21,.22), 0 0 12px rgba(250,204,21,.38); }
                        50% { box-shadow: inset 0 0 0 6px rgba(250,204,21,.40), 0 0 30px rgba(250,204,21,.88); }
                    }
                    @keyframes teacherDirectGreen33 {
                        0%, 100% { box-shadow: inset 0 0 0 4px rgba(34,197,94,.22), 0 0 12px rgba(34,197,94,.38); }
                        50% { box-shadow: inset 0 0 0 6px rgba(34,197,94,.42), 0 0 32px rgba(34,197,94,.90); }
                    }
                    #chess-board .chess-square.teacher-direct-from-33::after,
                    .chess-square.teacher-direct-from-33::after,
                    #chess-board .chess-square.teacher-direct-to-33::after,
                    .chess-square.teacher-direct-to-33::after,
                    #chess-board .chess-square.teacher-direct-bad-33::after,
                    .chess-square.teacher-direct-bad-33::after {
                        content: '';
                        position: absolute;
                        inset: 5px;
                        z-index: 4;
                        border-radius: 10px;
                        pointer-events: none;
                    }
                    #chess-board .chess-square.teacher-direct-from-33::after,
                    .chess-square.teacher-direct-from-33::after {
                        background: rgba(250,204,21,.34);
                        border: 3px solid rgba(250,204,21,1);
                        box-shadow: 0 0 24px rgba(250,204,21,.95), inset 0 0 20px rgba(250,204,21,.45);
                        animation: teacherDirectYellow33 0.72s ease-in-out infinite !important;
                    }
                    #chess-board .chess-square.teacher-direct-to-33::after,
                    .chess-square.teacher-direct-to-33::after {
                        background: rgba(34,197,94,.36);
                        border: 3px solid rgba(34,197,94,1);
                        box-shadow: 0 0 26px rgba(34,197,94,.98), inset 0 0 20px rgba(34,197,94,.50);
                        animation: teacherDirectGreen33 0.72s ease-in-out infinite !important;
                    }
                    #chess-board .chess-square.teacher-direct-bad-33::after,
                    .chess-square.teacher-direct-bad-33::after {
                        background: rgba(239,68,68,.30);
                        border: 3px solid rgba(239,68,68,.96);
                        box-shadow: 0 0 18px rgba(239,68,68,.70), inset 0 0 18px rgba(127,29,29,.42);
                    }
                    #chess-board .chess-square.teacher-direct-from-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-to-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-bad-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-from-33 span,
                    #chess-board .chess-square.teacher-direct-to-33 span,
                    #chess-board .chess-square.teacher-direct-bad-33 span {
                        position: relative;
                        z-index: 9;
                    }
                    #teacher-direct-guide-33.teacher-guide-strong-35 {
                        display: block !important;
                    }
                    @media (max-width: 560px) {
                        #teacher-direct-guide-33 {
                            left: 6px;
                            right: auto;
                            top: 72px;
                            bottom: auto;
                            width: min(252px, calc(100vw - 12px));
                            padding: 7px;
                        }
                        #teacher-direct-guide-33 .direct-actions-33 { grid-template-columns: repeat(2, 1fr); }
                        #teacher-direct-guide-33 .direct-status-33 { font-size: .63rem; max-height: 84px; }
                        #teacher-piece-bubble-27.size-small-32 .bubble-direct-tools-33 { gap: 4px; padding: 6px 0 4px 0; }
                        #teacher-piece-bubble-27.size-small-32 .bubble-direct-title-33 { font-size: .56rem; }
                        #teacher-piece-bubble-27.size-small-32 .bubble-direct-btn-33 { font-size: .55rem; padding: 6px 5px; }
                        #teacher-piece-bubble-27.size-small-32 .bubble-direct-status-33 { font-size: .56rem; max-height: 78px; }
                    }
                `;
                document.head.appendChild(style);
            }

            function lerModoToqueGuiaDiretaXadrez33() {
                try {
                    const valor = localStorage.getItem(GUIA_DIRETA_XADREZ_33_MODO_KEY) || 'bubble';
                    return valor === 'direct' ? 'direct' : 'bubble';
                } catch (_) {
                    return 'bubble';
                }
            }

            function salvarModoToqueGuiaDiretaXadrez33(modo) {
                const final = modo === 'direct' ? 'direct' : 'bubble';
                try { localStorage.setItem(GUIA_DIRETA_XADREZ_33_MODO_KEY, final); } catch (_) {}
                atualizarBotoesGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33();
            }

            function autoGuiaDiretaAtivaXadrez33() {
                try { return localStorage.getItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY) === '1'; } catch (_) { return false; }
            }

            function salvarAutoGuiaDiretaXadrez33(ativo) {
                try { localStorage.setItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY, ativo ? '1' : '0'); } catch (_) {}
                if (!ativo) {
                    clearTimeout(guiaDiretaXadrez33Timer);
                    guiaDiretaXadrez33Timer = null;
                    guiaDiretaXadrez33UltimaAssinatura = '';
                }
                atualizarBotoesGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33();
                if (ativo) agendarGuiaDiretaProfessorXadrez33(true, 'manual');
            }

            function corProfessorGuiaDiretaXadrez33() {
                if (chessPlayerColor === 'white' || chessPlayerColor === 'black') return chessPlayerColor;
                return chessTurn || 'white';
            }

            function limparGuiaDiretaProfessorXadrez33() {
                document.querySelectorAll('#chess-board .chess-square').forEach(square => {
                    square.classList.remove('teacher-direct-from-33', 'teacher-direct-to-33', 'teacher-direct-bad-33');
                    square.removeAttribute('data-teacher-direct-label');
                    if (square.getAttribute('data-teacher-direct-title')) {
                        square.removeAttribute('data-teacher-direct-title');
                        square.removeAttribute('title');
                    }
                });
            }

            function assinaturaGuiaDiretaXadrez33() {
                try {
                    return JSON.stringify({
                        turn: chessTurn,
                        color: chessPlayerColor || '',
                        over: !!chessGameOver,
                        moves: Array.isArray(moveHistory) ? moveHistory.length : 0,
                        last: lastChessMove || null,
                        board: chessBoard || []
                    });
                } catch (_) {
                    return `${chessTurn || ''}|${chessPlayerColor || ''}|${Date.now()}`;
                }
            }

            function chaveCasaGuiaDiretaXadrez33(pos) {
                return `${pos?.row},${pos?.col}`;
            }

            function nomePecaCasaGuiaDiretaXadrez33(row, col) {
                const peca = chessBoard?.[row]?.[col] || null;
                return nomeCurtoPecaRoboProfessorXadrez30(peca?.type || 'piece');
            }

            /* =====================================================================
               ✅ PROFISSIONAL 41 — PERIGO RÁPIDO SEM TRAVAR
               Antes o robô avaliava todas as peças ruins com busca profunda. Isso
               ficava pesado durante o online. Agora a parte vermelha usa uma
               análise rápida: captura, peça pendurada, casa atacada, defesa e centro.
               A melhor jogada continua calculada pelo cérebro forte, mas com limite.
            ===================================================================== */
            function pontuarPerigoRapidoProfessor41(item, cor) {
                try {
                    const peca = chessBoard?.[item.from.row]?.[item.from.col] || item.peca || null;
                    if (!peca) return -999999;

                    const adversario = corOposta(cor);
                    const valor = valorPecaProfessor40(peca.type);
                    const capturada = pecaCapturadaRoboProfessorXadrez30(chessBoard, item);
                    let score = 0;

                    try { score += pontuarMovimentoGuiaXadrez29(item, cor) * 0.35; } catch (_) {}
                    if (capturada) score += valorPecaProfessor40(capturada.type) * 1.45 - valor * 0.10;
                    if (item.to?.castle) score += 260;
                    if (peca.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 1700;
                    score += centro26(item.to.row, item.to.col) * 14;

                    const origemAtacada = quadradoAtacado(chessBoard, item.from.row, item.from.col, adversario);
                    const origemDefendida = quadradoAtacado(chessBoard, item.from.row, item.from.col, cor);
                    if (origemAtacada && !origemDefendida) score += Math.min(260, valor * 0.45);

                    const temp = aplicarMovimentoTreinoEmClone(chessBoard, item, 'queen');
                    if (temp && peca.type !== 'king') {
                        const destinoAtacado = quadradoAtacado(temp, item.to.row, item.to.col, adversario);
                        const destinoDefendido = quadradoAtacado(temp, item.to.row, item.to.col, cor);
                        if (destinoAtacado && !destinoDefendido) score -= valor * 1.65;
                        else if (destinoAtacado && destinoDefendido) score -= valor * 0.22;

                        // Penaliza jogada que deixa uma peça importante sem defesa direta.
                        if (!destinoDefendido && valor >= 320 && !capturada) score -= 90;
                    }

                    return score;
                } catch (_) {
                    return -999999;
                }
            }

            function avaliarMovimentosParaNaoMexerXadrez33(cor, melhor) {
                let movimentos = [];
                try { movimentos = todosMovimentosLegais(cor, chessBoard) || []; } catch (_) { movimentos = []; }

                const melhorKey = chaveCasaGuiaDiretaXadrez33(melhor?.from);
                const melhorScore = Number.isFinite(melhor?.score) ? melhor.score : 0;
                const porPeca = new Map();

                movimentos.forEach(move => {
                    const peca = chessBoard?.[move.from.row]?.[move.from.col] || null;
                    if (!peca || peca.color !== cor) return;
                    const item = { ...move, peca };
                    const score = pontuarPerigoRapidoProfessor41(item, cor);
                    const key = chaveCasaGuiaDiretaXadrez33(item.from);
                    const atual = porPeca.get(key);
                    if (!atual || score > atual.score) porPeca.set(key, { item, score, key });
                });

                const adversario = corOposta(cor);
                const perigos = [];
                porPeca.forEach(x => {
                    const peca = chessBoard?.[x.item.from.row]?.[x.item.from.col] || null;
                    const valor = valorPecaProfessor40(peca?.type);
                    let pecaEmRisco = false;
                    try {
                        pecaEmRisco = !!(
                            peca &&
                            peca.type !== 'king' &&
                            quadradoAtacado(chessBoard, x.item.from.row, x.item.from.col, adversario) &&
                            !quadradoAtacado(chessBoard, x.item.from.row, x.item.from.col, cor)
                        );
                    } catch (_) {}

                    const muitoPior = x.key !== melhorKey && (melhorScore - x.score > Math.max(220, valor * 0.45));
                    const ruimMesmo = x.key !== melhorKey && x.score < -150;
                    if (muitoPior || ruimMesmo || (pecaEmRisco && x.key !== melhorKey)) perigos.push(x);
                });

                return perigos
                    .sort((a, b) => a.score - b.score)
                    .slice(0, 5)
                    .map(x => x.item);
            }

            function calcularGuiaDiretaProfessorXadrez33(cor, clicada = null) {
                const melhores = melhoresLancesProfundosRoboProfessorXadrez30(cor, chessBoard, 3);
                const melhor = melhores[0] || null;
                const ruins = melhor ? avaliarMovimentosParaNaoMexerXadrez33(cor, melhor) : [];
                if (clicada && chessBoard?.[clicada.row]?.[clicada.col]?.color === cor && melhor) {
                    const clicadaKey = `${clicada.row},${clicada.col}`;
                    const melhorKey = chaveCasaGuiaDiretaXadrez33(melhor.from);
                    if (clicadaKey !== melhorKey && !ruins.some(item => item.from.row === clicada.row && item.from.col === clicada.col)) {
                        const movimentos = melhoresDaPecaGuiaXadrez29(clicada.row, clicada.col, 1);
                        const item = movimentos[0] || { from: { row: clicada.row, col: clicada.col }, to: { row: clicada.row, col: clicada.col }, peca: chessBoard[clicada.row][clicada.col] };
                        ruins.unshift(item);
                    }
                }
                return { melhores, melhor, ruins };
            }

            function pintarGuiaDiretaProfessorXadrez33(resultado) {
                limparCoresGuiaMelhoresJogadasXadrez29();
                limparRoboProfessorXadrez30(false);
                limparGuiaDiretaProfessorXadrez33();

                const melhores = Array.isArray(resultado?.melhores)
                    ? resultado.melhores.filter(Boolean).slice(0, 3)
                    : (resultado?.melhor ? [resultado.melhor] : []);

                const casasProtegidas = new Set();

                melhores.forEach((item, index) => {
                    const ordem = index + 1;
                    const from = squareGuiaXadrez29(item.from.row, item.from.col);
                    const to = squareGuiaXadrez29(item.to.row, item.to.col);
                    const titulo = `${ordem}ª opção do robô: ${textoMovimentoRoboProfessorXadrez30(item, chessBoard)} — ${item.motivo30 || classificarLanceRoboProfessorXadrez30(item, chessBoard, corProfessorGuiaDiretaXadrez33())}`;
                    const labelPeca = ordem === 1 ? 'PEÇA' : `P${ordem}`;
                    const labelCasa = ordem === 1 ? 'IR' : `IR${ordem}`;

                    if (from) {
                        from.classList.add('teacher-direct-from-33');
                        from.setAttribute('data-teacher-direct-label', labelPeca);
                        from.setAttribute('data-teacher-direct-title', String(ordem));
                        from.setAttribute('title', titulo);
                        casasProtegidas.add(`${item.from.row},${item.from.col}`);
                    }
                    if (to) {
                        to.classList.add('teacher-direct-to-33');
                        to.setAttribute('data-teacher-direct-label', labelCasa);
                        to.setAttribute('data-teacher-direct-title', String(ordem));
                        to.setAttribute('title', titulo);
                        casasProtegidas.add(`${item.to.row},${item.to.col}`);
                    }
                });

                (resultado?.ruins || []).slice(0, 8).forEach(item => {
                    const fromKey = `${item.from.row},${item.from.col}`;
                    const toKey = `${item.to.row},${item.to.col}`;

                    const from = squareGuiaXadrez29(item.from.row, item.from.col);
                    if (from && !casasProtegidas.has(fromKey)) {
                        from.classList.add('teacher-direct-bad-33');
                        from.setAttribute('data-teacher-direct-label', 'NÃO');
                        from.setAttribute('data-teacher-direct-title', '1');
                        from.setAttribute('title', `Evite mexer agora: ${nomePecaCasaGuiaDiretaXadrez33(item.from.row, item.from.col)} em ${alg(item.from.row, item.from.col)} pode perder tempo, peça ou defesa.`);
                    }

                    const to = squareGuiaXadrez29(item.to.row, item.to.col);
                    if (to && !casasProtegidas.has(toKey) && !to.classList.contains('teacher-direct-from-33')) {
                        to.classList.add('teacher-direct-bad-33');
                        to.setAttribute('data-teacher-direct-label', 'NÃO');
                        to.setAttribute('data-teacher-direct-title', '1');
                        to.setAttribute('title', `Evite esta casa agora: ${alg(item.to.row, item.to.col)} pode deixar peça solta, perder material ou enfraquecer a defesa.`);
                    }
                });
            }

            function textoGuiaDiretaProfessorXadrez33(resultado, cor, origem = 'manual') {
                const melhor = resultado?.melhor || null;
                if (!melhor) return 'Não encontrei lance legal agora. Verifique se a partida terminou ou se o rei está sem saída.';
                const peca = chessBoard?.[melhor.from.row]?.[melhor.from.col] || melhor.peca || null;
                const ruins = resultado?.ruins || [];
                const melhores = Array.isArray(resultado?.melhores) ? resultado.melhores.slice(0, 3) : [melhor];
                const cabecalho = origem === 'auto'
                    ? 'Robô por cores atualizou depois da jogada do aluno.'
                    : (origem === 'toque' ? 'Robô por cores atualizado pelo toque.' : 'Robô por cores atualizado.');
                let html = `<strong>${escapeBubble27(cabecalho)}</strong><br>`;
                html += `<span class="yellow-33">Amarelo:</span> peça(s) recomendada(s) para mexer. `;
                html += `<span class="good-33">Verde:</span> casa(s) boas para ir. `;
                html += `<span class="bad-33">Vermelho:</span> evite peça/casa perigosa.<br>`;
                html += `Melhor agora: mexa ${escapeBubble27(nomeCurtoPecaRoboProfessorXadrez30(peca?.type))} em ${escapeBubble27(alg(melhor.from.row, melhor.from.col))} e vá para ${escapeBubble27(alg(melhor.to.row, melhor.to.col))}.<br>`;
                html += `Motivo: ${escapeBubble27(melhor.motivo30 || classificarLanceRoboProfessorXadrez30(melhor, chessBoard, cor))}.`;
                if (melhores.length > 1) {
                    const extras = melhores.slice(1, 3).map((item, idx) => `${idx + 2}) ${nomePecaCasaGuiaDiretaXadrez33(item.from.row, item.from.col)} ${alg(item.from.row, item.from.col)} → ${alg(item.to.row, item.to.col)}`);
                    html += `<br>Outras boas: ${escapeBubble27(extras.join(' | '))}.`;
                }
                if (ruins.length) {
                    const nomes = ruins.slice(0, 4).map(item => `${nomePecaCasaGuiaDiretaXadrez33(item.from.row, item.from.col)} ${alg(item.from.row, item.from.col)}`);
                    html += `<br><span class="bad-33">Não mexer agora:</span> ${escapeBubble27(nomes.join(', '))}.`;
                }
                html += '<br>Frase para aula: “veja a cor do tabuleiro: amarelo prepara, verde executa e vermelho alerta o perigo.”';
                return html;
            }

            function atualizarStatusGuiaDiretaProfessorXadrez33(html) {
                const b = document.getElementById('bubble-direct-status-33');
                if (b) b.innerHTML = html;
                const p = document.getElementById('teacher-direct-guide-status-33');
                if (p) p.innerHTML = html;
            }

            function aplicarGuiaDiretaProfessorXadrez33({ forcar = false, origem = 'manual', clicada = null } = {}) {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const autoLigado = autoGuiaDiretaAtivaXadrez33();
                if (!forcar && modo !== 'direct' && !autoLigado) return;

                // ✅ PROFISSIONAL 39 — modo leve e sincronizado.
                // No online, o robô do professor só calcula quando volta a vez do professor.
                // Isso evita travar o jogo e evita a confusão “no meu aparelho é vez do outro”.
                const cor = corProfessorGuiaDiretaXadrez33();
                if (chessMode === 'online' && chessPlayerColor && chessTurn !== cor) {
                    if (origem !== 'silencioso39') {
                        limparGuiaDiretaProfessorXadrez33();
                        atualizarStatusGuiaDiretaProfessorXadrez33('Aguardando o aluno jogar. Quando voltar sua vez, o robô por cores recalcula sozinho e mostra amarelo, verde e vermelho.');
                    }
                    atualizarPainelFlutuanteGuiaDiretaXadrez33(false);
                    return;
                }

                if (chessGameOver) {
                    limparGuiaDiretaProfessorXadrez33();
                    atualizarStatusGuiaDiretaProfessorXadrez33('A partida terminou. Comece outra posição para o guia voltar a orientar.');
                    atualizarPainelFlutuanteGuiaDiretaXadrez33();
                    return;
                }
                try {
                    const resultado = calcularGuiaDiretaProfessorXadrez33(cor, clicada || guiaDiretaXadrez33UltimoClique);
                    pintarGuiaDiretaProfessorXadrez33(resultado);
                    const textoBase35 = textoGuiaDiretaProfessorXadrez33(resultado, cor, origem);
                    atualizarStatusGuiaDiretaProfessorXadrez33(textoBase35);
                    atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                } catch (_) {
                    atualizarStatusGuiaDiretaProfessorXadrez33('Não consegui calcular o guia direto agora. Toque em uma peça ou abra o balão para tentar novamente.');
                    atualizarPainelFlutuanteGuiaDiretaXadrez33();
                }
            }

            function agendarGuiaDiretaProfessorXadrez33(forcar = false, origem = 'auto') {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const autoLigado = autoGuiaDiretaAtivaXadrez33();
                if (modo !== 'direct' && !autoLigado) return;
                if (chessMode === 'online' && chessPlayerColor && chessTurn !== corProfessorGuiaDiretaXadrez33()) return;
                const assinatura = assinaturaGuiaDiretaXadrez33();
                if (!forcar && assinatura === guiaDiretaXadrez33UltimaAssinatura) return;
                guiaDiretaXadrez33UltimaAssinatura = assinatura;
                clearTimeout(guiaDiretaXadrez33Timer);
                // ✅ PROFISSIONAL 41: espera um pouco mais a sincronização do Firebase/render terminar antes de pintar.
                guiaDiretaXadrez33Timer = setTimeout(() => aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem }), 900);
            }

            function fecharBalaoProfessorXadrez34() {
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (bubble) bubble.classList.remove('open');
            }

            function definirJanelinhaProfessorXadrez34(ligada) {
                if (ligada) {
                    salvarModoToqueGuiaDiretaXadrez33('bubble');
                    atualizarStatusGuiaDiretaProfessorXadrez33('Janelinha ligada. Ao tocar na peça, o quadro de dicas pode abrir. Você ainda pode usar o robô por cores quando quiser.');
                } else {
                    salvarModoToqueGuiaDiretaXadrez33('direct');
                    salvarAutoGuiaDiretaXadrez33(true);
                    fecharBalaoProfessorXadrez34();
                    aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'manual' });
                    atualizarStatusGuiaDiretaProfessorXadrez33('Janelinha OFF. O robô vai guiar direto no tabuleiro por cores: amarelo = peça boa, verde = casa boa, vermelho = perigo.');
                }
                atualizarBotoesGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
            }

            function definirRoboCoresProfessorXadrez34(ligado) {
                salvarAutoGuiaDiretaXadrez33(!!ligado);
                if (ligado) {
                    aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'manual' });
                    atualizarStatusGuiaDiretaProfessorXadrez33('Robô por cores ON. A janelinha continua no estado escolhido: ON abre o balão ao tocar na peça; OFF guia somente pelo tabuleiro. Amarelo = peça boa, verde = casa boa, vermelho = evite.');
                } else {
                    limparGuiaDiretaProfessorXadrez33();
                    atualizarStatusGuiaDiretaProfessorXadrez33('Robô por cores OFF. As cores foram limpas. A janelinha continua funcionando se estiver ON.');
                }
                atualizarBotoesGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                try { atualizarControlesProfessorXadrez37(); } catch (_) {}
            }

            function instalarGuiaDiretaRoboProfessorXadrez33(bubble) {
                instalarCssGuiaDiretaRoboProfessorXadrez33();
                garantirPainelFlutuanteGuiaDiretaXadrez33();
                if (!bubble || bubble.querySelector('.bubble-direct-tools-33')) {
                    atualizarBotoesGuiaDiretaXadrez33();
                    return;
                }
                const tools = document.createElement('div');
                tools.className = 'bubble-direct-tools-33';
                tools.innerHTML = `
                    <div class="bubble-direct-title-33">🎯 professor: janelinha ou robô por cores</div>
                    <button class="bubble-direct-btn-33" type="button" data-direct33="window">Janelinha: ON</button>
                    <button class="bubble-direct-btn-33" type="button" data-direct33="colors">Robô cores: OFF</button>
                    <button class="bubble-direct-btn-33" type="button" data-direct33="refresh">Atualizar cores</button>
                    <button class="bubble-direct-btn-33" type="button" data-direct33="clear">Limpar cores</button>
                    <div id="bubble-direct-status-33" class="bubble-direct-status-33">Use Janelinha OFF para não abrir este quadro. Use Robô cores ON para ele guiar direto no tabuleiro: amarelo = peça boa, verde = casa boa, vermelho = perigo.</div>
                `;
                const body = bubble.querySelector('.bubble-body-27');
                if (body) bubble.insertBefore(tools, body);
                else bubble.appendChild(tools);
                tools.querySelectorAll('[data-direct33]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-direct33');
                        if (acao === 'window' || acao === 'mode') {
                            const janelinhaLigada = lerModoToqueGuiaDiretaXadrez33() === 'direct';
                            definirJanelinhaProfessorXadrez34(janelinhaLigada);
                        }
                        if (acao === 'colors' || acao === 'auto') {
                            definirRoboCoresProfessorXadrez34(!autoGuiaDiretaAtivaXadrez33());
                        }
                        if (acao === 'refresh') aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'manual' });
                        if (acao === 'clear') {
                            limparGuiaDiretaProfessorXadrez33();
                            atualizarStatusGuiaDiretaProfessorXadrez33('Cores limpas. Ligue Robô cores ON para voltar a guiar pelo tabuleiro.');
                            atualizarPainelFlutuanteGuiaDiretaXadrez33();
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
                atualizarBotoesGuiaDiretaXadrez33();
            }

            function garantirPainelFlutuanteGuiaDiretaXadrez33() {
                instalarCssGuiaDiretaRoboProfessorXadrez33();
                let panel = document.getElementById('teacher-direct-guide-33');
                if (panel) return panel;
                panel = document.createElement('div');
                panel.id = 'teacher-direct-guide-33';
                panel.innerHTML = `
                    <div class="direct-head-33"><span>🎓 Robô professor</span><span data-direct33-mini-state>OFF</span></div>
                    <div class="direct-actions-33">
                        <button type="button" data-direct33-mini="window">Janelinha ON</button>
                        <button type="button" data-direct33-mini="colors">Robô cores OFF</button>
                        <button type="button" data-direct33-mini="refresh">Atualizar cores</button>
                        <button type="button" data-direct33-mini="bubble">Abrir balão</button>
                        <button type="button" data-direct33-mini="clear">Limpar</button>
                    </div>
                    <div id="teacher-direct-guide-status-33" class="direct-status-33">Para aparecer no tabuleiro: toque em Robô cores ON. Amarelo pisca na peça certa, verde pisca na casa boa e vermelho marca perigo.</div>
                `;
                document.body.appendChild(panel);
                panel.querySelectorAll('[data-direct33-mini]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-direct33-mini');
                        if (acao === 'bubble') abrirBalaoPeloPainelGuiaDiretaXadrez33();
                        if (acao === 'window' || acao === 'mode') {
                            const janelinhaLigada = lerModoToqueGuiaDiretaXadrez33() === 'direct';
                            definirJanelinhaProfessorXadrez34(janelinhaLigada);
                        }
                        if (acao === 'colors' || acao === 'auto') {
                            definirRoboCoresProfessorXadrez34(!autoGuiaDiretaAtivaXadrez33());
                        }
                        if (acao === 'refresh') aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'manual' });
                        if (acao === 'clear') {
                            limparGuiaDiretaProfessorXadrez33();
                            atualizarStatusGuiaDiretaProfessorXadrez33('Cores limpas.');
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
                atualizarPainelFlutuanteGuiaDiretaXadrez33();
                return panel;
            }

            function abrirBalaoPeloPainelGuiaDiretaXadrez33() {
                salvarModoToqueGuiaDiretaXadrez33('bubble');
                const pos = guiaDiretaXadrez33UltimoClique || guiaMelhoresJogadasXadrez29UltimaPeca || null;
                let row = pos?.row, col = pos?.col;
                if (!Number.isFinite(row) || !Number.isFinite(col) || !chessBoard?.[row]?.[col]) {
                    const melhor = melhorRespostaRoboProfessorXadrez30(corProfessorGuiaDiretaXadrez33(), chessBoard);
                    row = melhor?.from?.row;
                    col = melhor?.from?.col;
                }
                if (Number.isFinite(row) && Number.isFinite(col) && chessBoard?.[row]?.[col]) {
                    tentarAbrirBubbleProfessorXadrez27(row, col);
                }
                atualizarPainelFlutuanteGuiaDiretaXadrez33();
            }

            function atualizarBotoesGuiaDiretaXadrez33() {
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const autoLigado = autoGuiaDiretaAtivaXadrez33();
                const janelinhaOff = modo === 'direct';

                document.querySelectorAll('[data-direct33="window"], [data-direct33="mode"]').forEach(btn => {
                    btn.classList.toggle('direct-on-33', janelinhaOff);
                    btn.textContent = janelinhaOff ? 'Janelinha: OFF' : 'Janelinha: ON';
                });
                document.querySelectorAll('[data-direct33="colors"], [data-direct33="auto"]').forEach(btn => {
                    btn.classList.toggle('auto-on-33', autoLigado);
                    btn.textContent = autoLigado ? 'Robô cores: ON' : 'Robô cores: OFF';
                });

                document.querySelectorAll('[data-direct33-mini="window"], [data-direct33-mini="mode"]').forEach(btn => {
                    btn.classList.toggle('active-33', janelinhaOff);
                    btn.textContent = janelinhaOff ? 'Janelinha OFF' : 'Janelinha ON';
                });
                document.querySelectorAll('[data-direct33-mini="colors"], [data-direct33-mini="auto"]').forEach(btn => {
                    btn.classList.toggle('active-33', autoLigado);
                    btn.textContent = autoLigado ? 'Robô cores ON' : 'Robô cores OFF';
                });
                const state = document.querySelector('[data-direct33-mini-state]');
                if (state) {
                    if (janelinhaOff && autoLigado) state.textContent = 'CORES';
                    else if (janelinhaOff) state.textContent = 'SEM JANELA';
                    else if (autoLigado) state.textContent = 'AUTO';
                    else state.textContent = 'JANELA';
                }
            }

            function atualizarPainelFlutuanteGuiaDiretaXadrez33(mostrar = false) {
                const panel = garantirPainelFlutuanteGuiaDiretaXadrez33();
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const autoLigado = autoGuiaDiretaAtivaXadrez33();
                const pode = !!(professorPrivadoPodeAparecerXadrez19 && professorPrivadoPodeAparecerXadrez19());
                const deveMostrar35 = pode && (mostrar || modo === 'direct' || autoLigado || chessProfessorPrivadoAtivo);
                panel.classList.toggle('visible-33', deveMostrar35);
                panel.classList.toggle('teacher-guide-strong-35', deveMostrar35);
                atualizarBotoesGuiaDiretaXadrez33();
                if (deveMostrar35 && autoLigado && (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())) {
                    clearTimeout(window.__teacherGuideProf39RefreshTimer);
                    window.__teacherGuideProf39RefreshTimer = setTimeout(() => {
                        try { agendarGuiaDiretaProfessorXadrez33(false, 'auto39'); } catch (_) {}
                    }, 420);
                }
            }

            /* ✅ PROFISSIONAL 35 — ROBÔ CORES LIGA E PINTA COM MAIS FORÇA
               Correção do ponto visto no teste: o professor não estava enxergando as cores
               porque o modo podia ficar desligado/salvo como janelinha. Agora, quando o
               professor está ativo, a aba aparece e o robô pode ligar direto, recalcular e
               repintar o tabuleiro depois de cada renderização. */
            function garantirRoboCoresProfessorXadrez35(ativarSeVazio = true) {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return false;
                try {
                    if (ativarSeVazio && localStorage.getItem(GUIA_DIRETA_XADREZ_33_MODO_KEY) === null) {
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_MODO_KEY, 'bubble');
                    }
                    if (ativarSeVazio && localStorage.getItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY) === null) {
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY, '1');
                    }
                } catch (_) {}
                garantirPainelFlutuanteGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                // Profissional 39: não recalcular pesado em todo render; o cálculo fica por mudança real de vez/tabuleiro.
                return true;
            }

            if (!window.__teacherGuideXadrez35RenderHook) {
                window.__teacherGuideXadrez35RenderHook = true;
                const renderAnteriorGuia35 = renderChessBoard;
                renderChessBoard = function renderChessBoardGuiaCoresProfessor35() {
                    const retorno = renderAnteriorGuia35.apply(this, arguments);
                    setTimeout(() => {
                        try { garantirRoboCoresProfessorXadrez35(false); } catch (_) {}
                    }, 30);
                    return retorno;
                };
            }

            let ultimoBubbleProfessorXadrez27 = 0;
            function tentarAbrirBubbleProfessorXadrez27(row, col) {
                try {
                    const peca = chessBoard?.[row]?.[col] || null;
                    const clicouDestinoDeJogada = !!(selectedSquare && Array.isArray(legalMoves) && legalMoves.some(m => m.row === row && m.col === col));
                    const pode = !!(chessProfessorPrivadoAtivo && chessMode === 'online' && !chessIsSpectator && document.body.classList.contains('chess-board-visible') && peca && !clicouDestinoDeJogada);
                    if (!pode) return false;
                    if (lerModoToqueGuiaDiretaXadrez33 && lerModoToqueGuiaDiretaXadrez33() === 'direct') {
                        guiaDiretaXadrez33UltimoClique = { row, col };
                        aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'toque', clicada: { row, col } });
                        ultimoBubbleProfessorXadrez27 = Date.now();
                        return true;
                    }
                    let movimentos = [];
                    try { movimentos = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentos = []; }
                    const rect = rectQuadradoXadrez26(row, col);
                    const dados = criarDadosPopupXadrez26(peca, row, col, movimentos, rect);
                    marcarPecaBubbleProfessorXadrez27(row, col);
                    abrirBubbleProfessorXadrez27(dados);
                    ultimoBubbleProfessorXadrez27 = Date.now();
                    return true;
                } catch (_) {
                    return false;
                }
            }

            document.addEventListener('click', (ev) => {
                const square = ev.target && ev.target.closest ? ev.target.closest('#chess-board .chess-square[data-row][data-col]') : null;
                if (!square) return;
                const row = Number(square.dataset.row);
                const col = Number(square.dataset.col);
                if (!Number.isFinite(row) || !Number.isFinite(col)) return;
                setTimeout(() => {
                    if (Date.now() - ultimoBubbleProfessorXadrez27 < 90) return;
                    tentarAbrirBubbleProfessorXadrez27(row, col);
                }, 25);
            }, true);

            document.addEventListener('click', (ev) => {
                if (!ev.target || !ev.target.closest) return;
                if (ev.target.closest('#teacher-piece-bubble-27')) return;
                if (ev.target.closest('#chess-board .chess-square')) return;
                const bubble = document.getElementById('teacher-piece-bubble-27');
                if (bubble) bubble.classList.remove('open');
            }, true);

            const clickAnterior26 = handleChessSquareClick;
            handleChessSquareClick = async function handleChessSquareClickPopupProfessor26(row, col) {
                const pecaAntes = chessBoard?.[row]?.[col] || null;
                const clicouDestinoDeJogada = !!(selectedSquare && Array.isArray(legalMoves) && legalMoves.some(m => m.row === row && m.col === col));
                const podeAbrir = !!(chessProfessorPrivadoAtivo && chessMode === 'online' && !chessIsSpectator && document.body.classList.contains('chess-board-visible') && pecaAntes && !clicouDestinoDeJogada && (!lerModoToqueGuiaDiretaXadrez33 || lerModoToqueGuiaDiretaXadrez33() !== 'direct'));
                let movimentosAntes = [];
                let anchorRect = null;
                if (podeAbrir) {
                    try { movimentosAntes = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentosAntes = []; }
                    anchorRect = rectQuadradoXadrez26(row, col);
                }
                const retorno = await clickAnterior26.apply(this, arguments);
                if (podeAbrir) {
                    setTimeout(() => {
                        try {
                            marcarPecaBubbleProfessorXadrez27(row, col);
                            abrirBubbleProfessorXadrez27(criarDadosPopupXadrez26(pecaAntes, row, col, movimentosAntes, anchorRect));
                        } catch (_) {
                            if (window.abrirPopupProfessorPeca25) window.abrirPopupProfessorPeca25(criarDadosPopupXadrez26(pecaAntes, row, col, movimentosAntes, anchorRect));
                        }
                    }, 80);
                }
                return retorno;
            };

            /* =====================================================================
               ✅ PROFISSIONAL 36 — CORREÇÃO VISÍVEL DO PROFESSOR
               O usuário testou a Profissional 35 e mostrou que:
               1) o balão da peça podia ficar sem abrir porque o modo estava salvo como Janelinha OFF;
               2) o robô por cores não estava óbvio no tabuleiro.

               Esta correção mantém tudo que ficou bom e acrescenta uma central clara dentro
               da aba "Professor inteligente": Janelinha ON/OFF, Robô cores ON/OFF,
               Atualizar cores e Abrir balão. Também reforça as cores diretamente nas casas.
            ===================================================================== */
            const PROF36_MIGRATION_KEY = 'tabuleiro_arena_prof36_professor_padrao_aplicado';

            function instalarCssProfessorVisivelXadrez36() {
                if (document.getElementById('teacher-prof36-visible-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-prof36-visible-style';
                style.textContent = `
                    #teacher-prof36-controls {
                        margin: 8px 0 9px 0;
                        padding: 8px;
                        border-radius: 13px;
                        border: 1px solid rgba(250,204,21,.32);
                        background: linear-gradient(135deg, rgba(15,23,42,.92), rgba(30,41,59,.76));
                        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
                    }
                    #teacher-prof36-controls .prof36-title {
                        color: #fde68a;
                        font-size: .70rem;
                        font-weight: 1000;
                        text-transform: uppercase;
                        letter-spacing: .05em;
                        margin-bottom: 7px;
                        display: flex;
                        justify-content: space-between;
                        gap: 8px;
                        align-items: center;
                    }
                    #teacher-prof36-controls .prof36-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 6px;
                    }
                    #teacher-prof36-controls button {
                        border-radius: 999px;
                        border: 1px solid rgba(148,163,184,.24);
                        background: rgba(15,23,42,.92);
                        color: #e5e7eb;
                        padding: 8px 6px;
                        font-size: .64rem;
                        font-weight: 1000;
                        line-height: 1.05;
                        text-transform: none;
                        box-shadow: none;
                    }
                    #teacher-prof36-controls button.on36 {
                        background: linear-gradient(90deg, rgba(22,101,52,.96), rgba(21,128,61,.92));
                        color: #dcfce7;
                        border-color: rgba(34,197,94,.72);
                        box-shadow: 0 0 14px rgba(34,197,94,.22);
                    }
                    #teacher-prof36-controls button.warn36 {
                        background: linear-gradient(90deg, rgba(113,63,18,.96), rgba(180,83,9,.90));
                        color: #fef3c7;
                        border-color: rgba(250,204,21,.62);
                    }
                    #teacher-prof36-controls .prof36-help {
                        margin-top: 7px;
                        padding: 6px 7px;
                        border-radius: 10px;
                        background: rgba(2,6,23,.55);
                        border: 1px solid rgba(148,163,184,.15);
                        color: #bfdbfe;
                        font-size: .62rem;
                        line-height: 1.25;
                    }

                    /* Cores bem fortes no tabuleiro: não dependem só de outline. */
                    #chess-board .chess-square.teacher-direct-from-33,
                    .chess-square.teacher-direct-from-33 {
                        background: linear-gradient(135deg, #facc15, #fef08a) !important;
                        outline: 5px solid #facc15 !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(133,77,14,.22), 0 0 34px rgba(250,204,21,.98) !important;
                        animation: teacherProf36Yellow .68s ease-in-out infinite !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-to-33,
                    .chess-square.teacher-direct-to-33 {
                        background: linear-gradient(135deg, #16a34a, #bbf7d0) !important;
                        outline: 5px solid #22c55e !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(20,83,45,.24), 0 0 36px rgba(34,197,94,1) !important;
                        animation: teacherProf36Green .68s ease-in-out infinite !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-bad-33,
                    .chess-square.teacher-direct-bad-33 {
                        background: linear-gradient(135deg, #dc2626, #fecaca) !important;
                        outline: 5px solid #ef4444 !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(127,29,29,.30), 0 0 30px rgba(239,68,68,.86) !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-from-33::before,
                    .chess-square.teacher-direct-from-33::before,
                    #chess-board .chess-square.teacher-direct-to-33::before,
                    .chess-square.teacher-direct-to-33::before,
                    #chess-board .chess-square.teacher-direct-bad-33::before,
                    .chess-square.teacher-direct-bad-33::before {
                        z-index: 60 !important;
                        min-width: 26px !important;
                        height: 22px !important;
                        font-size: .62rem !important;
                        border: 2px solid rgba(255,255,255,.90) !important;
                        box-shadow: 0 3px 8px rgba(0,0,0,.35) !important;
                    }
                    #chess-board .chess-square.teacher-direct-from-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-to-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-bad-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-from-33 span,
                    #chess-board .chess-square.teacher-direct-to-33 span,
                    #chess-board .chess-square.teacher-direct-bad-33 span {
                        position: relative !important;
                        z-index: 50 !important;
                        text-shadow: 0 3px 8px rgba(0,0,0,.45) !important;
                    }
                    @keyframes teacherProf36Yellow {
                        0%, 100% { filter: brightness(1.00) saturate(1.12); }
                        50% { filter: brightness(1.35) saturate(1.55); }
                    }
                    @keyframes teacherProf36Green {
                        0%, 100% { filter: brightness(1.00) saturate(1.12); }
                        50% { filter: brightness(1.35) saturate(1.60); }
                    }
                    @media(max-width:560px){
                        #teacher-prof36-controls { padding: 7px; }
                        #teacher-prof36-controls button { font-size:.59rem; padding:7px 5px; }
                        #teacher-prof36-controls .prof36-help { font-size:.58rem; }
                    }
                `;
                document.head.appendChild(style);
            }

            function aplicarPadraoProfessorXadrez36() {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;
                instalarCssProfessorVisivelXadrez36();
                try {
                    if (localStorage.getItem(PROF36_MIGRATION_KEY) !== '1') {
                        // Restaura o balão por padrão, porque no teste ele ficou sem abrir.
                        // Mantém o robô por cores ligado para o professor enxergar a orientação no tabuleiro.
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_MODO_KEY, 'bubble');
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY, '1');
                        localStorage.setItem(PROF36_MIGRATION_KEY, '1');
                    }
                } catch (_) {}
                garantirControlesProfessorXadrez36();
                atualizarControlesProfessorXadrez36();
                garantirPainelFlutuanteGuiaDiretaXadrez33();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                if (autoGuiaDiretaAtivaXadrez33() && (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())) {
                    agendarGuiaDiretaProfessorXadrez33(false, 'auto36leve39');
                }
            }

            function garantirControlesProfessorXadrez36() {
                instalarCssProfessorVisivelXadrez36();
                const panel = document.getElementById('chess-private-teacher-panel');
                if (!panel) return null;
                const body = document.getElementById('chess-private-teacher-body') || panel;
                let box = document.getElementById('teacher-prof36-controls');
                if (box) return box;
                box = document.createElement('div');
                box.id = 'teacher-prof36-controls';
                box.innerHTML = `
                    <div class="prof36-title"><span>🎯 Controle do robô do professor</span><span data-prof36-state>ATIVO</span></div>
                    <div class="prof36-grid">
                        <button type="button" data-prof36="window">Janelinha ON</button>
                        <button type="button" data-prof36="colors">Robô cores ON</button>
                        <button type="button" data-prof36="refresh">Atualizar cores</button>
                        <button type="button" data-prof36="bubble">Abrir balão</button>
                        <button type="button" data-prof36="clear">Limpar cores</button>
                        <button type="button" data-prof36="help">Legenda</button>
                    </div>
                    <div class="prof36-help" data-prof36-help>
                        Amarelo piscando = peça boa para mexer. Verde piscando = casa boa para ir. Vermelho = perigo/evitar. A janelinha pode ficar ON ou OFF.
                    </div>
                `;
                body.insertBefore(box, body.firstChild || null);

                box.querySelectorAll('[data-prof36]').forEach(btn => {
                    btn.addEventListener('click', ev => {
                        const acao = btn.getAttribute('data-prof36');
                        if (acao === 'window') {
                            const estaOff = lerModoToqueGuiaDiretaXadrez33() === 'direct';
                            definirJanelinhaProfessorXadrez34(estaOff);
                        }
                        if (acao === 'colors') {
                            definirRoboCoresProfessorXadrez34(!autoGuiaDiretaAtivaXadrez33());
                        }
                        if (acao === 'refresh') {
                            aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'manual36' });
                        }
                        if (acao === 'bubble') {
                            salvarModoToqueGuiaDiretaXadrez33('bubble');
                            abrirBalaoPeloPainelGuiaDiretaXadrez33();
                        }
                        if (acao === 'clear') {
                            salvarAutoGuiaDiretaXadrez33(false);
                            limparGuiaDiretaProfessorXadrez33();
                            atualizarStatusGuiaDiretaProfessorXadrez33('Cores limpas. Ligue Robô cores ON quando quiser o guia no tabuleiro.');
                        }
                        if (acao === 'help') {
                            atualizarStatusGuiaDiretaProfessorXadrez33('<strong>Legenda do professor:</strong><br><span class="yellow-33">Amarelo</span> = peça recomendada. <span class="good-33">Verde</span> = casa recomendada. <span class="bad-33">Vermelho</span> = evite agora.');
                        }
                        atualizarControlesProfessorXadrez36();
                        atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                });
                return box;
            }

            function atualizarControlesProfessorXadrez36() {
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const auto = autoGuiaDiretaAtivaXadrez33();
                const box = document.getElementById('teacher-prof36-controls');
                if (!box) return;
                const btnWindow = box.querySelector('[data-prof36="window"]');
                const btnColors = box.querySelector('[data-prof36="colors"]');
                const state = box.querySelector('[data-prof36-state]');
                if (btnWindow) {
                    const off = modo === 'direct';
                    btnWindow.textContent = off ? 'Janelinha OFF' : 'Janelinha ON';
                    btnWindow.classList.toggle('warn36', off);
                    btnWindow.classList.toggle('on36', !off);
                }
                if (btnColors) {
                    btnColors.textContent = auto ? 'Robô cores ON' : 'Robô cores OFF';
                    btnColors.classList.toggle('on36', auto);
                    btnColors.classList.toggle('warn36', !auto);
                }
                if (state) {
                    state.textContent = auto ? 'CORES ON' : 'CORES OFF';
                    state.style.color = auto ? '#86efac' : '#fca5a5';
                }
            }

            function abrirBubbleProfessorXadrez36SePossivel(row, col) {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return false;
                if (lerModoToqueGuiaDiretaXadrez33() === 'direct') return false;
                const peca = chessBoard?.[row]?.[col] || null;
                if (!peca) return false;
                try {
                    let movimentos = [];
                    try { movimentos = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentos = []; }
                    const rect = rectQuadradoXadrez26(row, col);
                    registrarUltimaPecaGuiaXadrez29({ row, col });
                    marcarPecaBubbleProfessorXadrez27(row, col);
                    abrirBubbleProfessorXadrez27(criarDadosPopupXadrez26(peca, row, col, movimentos, rect));
                    return true;
                } catch (_) {
                    return false;
                }
            }

            if (!window.__teacherProf36SquareClick) {
                window.__teacherProf36SquareClick = true;
                document.addEventListener('click', (ev) => {
                    const square = ev.target && ev.target.closest ? ev.target.closest('#chess-board .chess-square[data-row][data-col]') : null;
                    if (!square) return;
                    const row = Number(square.dataset.row);
                    const col = Number(square.dataset.col);
                    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
                    setTimeout(() => {
                        try {
                            aplicarPadraoProfessorXadrez36();
                            if (lerModoToqueGuiaDiretaXadrez33() !== 'direct') abrirBubbleProfessorXadrez36SePossivel(row, col);
                            if (autoGuiaDiretaAtivaXadrez33()) aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'toque36', clicada: { row, col } });
                        } catch (_) {}
                    }, 140);
                }, true);
            }

            if (!window.__teacherProf36RenderHook) {
                window.__teacherProf36RenderHook = true;
                const renderAnteriorProf36 = renderChessBoard;
                renderChessBoard = function renderChessBoardProfessor36() {
                    const retorno = renderAnteriorProf36.apply(this, arguments);
                    setTimeout(() => {
                        try {
                            aplicarPadraoProfessorXadrez36();
                            if (autoGuiaDiretaAtivaXadrez33() && (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())) {
                                agendarGuiaDiretaProfessorXadrez33(false, 'auto36leve39');
                            }
                        } catch (_) {}
                    }, 260);
                    return retorno;
                };
            }

            const mostrarTabuleiroAnteriorProf36 = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaProfessor36() {
                mostrarTabuleiroAnteriorProf36.apply(this, arguments);
                setTimeout(() => {
                    try { aplicarPadraoProfessorXadrez36(); } catch (_) {}
                }, 220);
            };

            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    try { aplicarPadraoProfessorXadrez36(); } catch (_) {}
                }, 500);
            });

            /* =====================================================================
               ✅ PROFISSIONAL 37 — CONTROLE CORRETO NA ABA DO PROFESSOR
               Correção do teste mostrado pelo usuário:
               - a janelinha ficou OFF salva no navegador e parou de abrir ao tocar nas peças;
               - os botões precisavam ficar DENTRO da aba Professor Inteligente, perto do Analisar posição;
               - Robô cores precisa ser independente da janelinha.

               Agora:
               Janelinha ON/OFF e Robô cores ON/OFF ficam dentro da aba do professor.
               Janelinha ON = tocar na peça abre o balão.
               Janelinha OFF + Robô cores ON = orienta só por cores no tabuleiro.
            ===================================================================== */
            const PROF37_MIGRATION_KEY = 'tabuleiro_arena_prof37_janelinha_controle_correto';

            function instalarCssControlesProfessorXadrez37() {
                if (document.getElementById('teacher-prof37-controls-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-prof37-controls-style';
                style.textContent = `
                    #teacher-prof37-controls,
                    .teacher-prof37-controls {
                        display: block !important;
                        margin: 0 0 9px 0 !important;
                        padding: 9px !important;
                        border-radius: 13px !important;
                        border: 1px solid rgba(250,204,21,.38) !important;
                        background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(30,41,59,.86)) !important;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 8px 20px rgba(0,0,0,.18) !important;
                    }
                    #teacher-prof37-controls .prof37-title,
                    .teacher-prof37-controls .prof37-title {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                        color: #fde68a !important;
                        font-size: .70rem !important;
                        font-weight: 1000 !important;
                        letter-spacing: .05em !important;
                        text-transform: uppercase !important;
                        margin-bottom: 8px !important;
                    }
                    #teacher-prof37-controls [data-prof37-state],
                    .teacher-prof37-controls [data-prof37-state] {
                        padding: 2px 7px !important;
                        border-radius: 999px !important;
                        border: 1px solid rgba(56,189,248,.30) !important;
                        background: rgba(14,165,233,.12) !important;
                        color: #bae6fd !important;
                        white-space: nowrap !important;
                    }
                    #teacher-prof37-controls .prof37-grid,
                    .teacher-prof37-controls .prof37-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 6px !important;
                    }
                    #teacher-prof37-controls button,
                    .teacher-prof37-controls button {
                        border-radius: 999px !important;
                        border: 1px solid rgba(148,163,184,.28) !important;
                        background: rgba(15,23,42,.94) !important;
                        color: #e5e7eb !important;
                        padding: 8px 6px !important;
                        font-size: .64rem !important;
                        font-weight: 1000 !important;
                        line-height: 1.05 !important;
                        text-transform: none !important;
                        box-shadow: none !important;
                        min-height: 34px !important;
                    }
                    #teacher-prof37-controls button.prof37-on,
                    .teacher-prof37-controls button.prof37-on {
                        background: linear-gradient(90deg, rgba(22,101,52,.98), rgba(21,128,61,.94)) !important;
                        color: #dcfce7 !important;
                        border-color: rgba(34,197,94,.75) !important;
                        box-shadow: 0 0 13px rgba(34,197,94,.20) !important;
                    }
                    #teacher-prof37-controls button.prof37-off,
                    .teacher-prof37-controls button.prof37-off {
                        background: linear-gradient(90deg, rgba(127,29,29,.96), rgba(185,28,28,.88)) !important;
                        color: #fee2e2 !important;
                        border-color: rgba(248,113,113,.55) !important;
                    }
                    #teacher-prof37-controls button.prof37-warn,
                    .teacher-prof37-controls button.prof37-warn {
                        background: linear-gradient(90deg, rgba(113,63,18,.96), rgba(180,83,9,.90)) !important;
                        color: #fef3c7 !important;
                        border-color: rgba(250,204,21,.62) !important;
                    }
                    #teacher-prof37-controls .prof37-help,
                    .teacher-prof37-controls .prof37-help {
                        margin-top: 7px !important;
                        padding: 7px 8px !important;
                        border-radius: 10px !important;
                        background: rgba(2,6,23,.58) !important;
                        border: 1px solid rgba(148,163,184,.16) !important;
                        color: #bfdbfe !important;
                        font-size: .62rem !important;
                        line-height: 1.28 !important;
                    }
                    #chess-board .chess-square.teacher-direct-from-33,
                    .chess-square.teacher-direct-from-33 {
                        background: radial-gradient(circle at center, #fef08a 0%, #facc15 55%, #a16207 100%) !important;
                        outline: 5px solid #fde047 !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(113,63,18,.24), 0 0 38px rgba(250,204,21,1) !important;
                        animation: teacherProf37PulseYellow .58s ease-in-out infinite !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-to-33,
                    .chess-square.teacher-direct-to-33 {
                        background: radial-gradient(circle at center, #bbf7d0 0%, #22c55e 55%, #166534 100%) !important;
                        outline: 5px solid #4ade80 !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(20,83,45,.28), 0 0 40px rgba(34,197,94,1) !important;
                        animation: teacherProf37PulseGreen .58s ease-in-out infinite !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-bad-33,
                    .chess-square.teacher-direct-bad-33 {
                        background: radial-gradient(circle at center, #fecaca 0%, #ef4444 58%, #7f1d1d 100%) !important;
                        outline: 5px solid #f87171 !important;
                        outline-offset: -6px !important;
                        box-shadow: inset 0 0 0 6px rgba(127,29,29,.32), 0 0 34px rgba(239,68,68,.94) !important;
                        animation: teacherProf37PulseRed .78s ease-in-out infinite !important;
                        position: relative !important;
                    }
                    #chess-board .chess-square.teacher-direct-from-33::before,
                    #chess-board .chess-square.teacher-direct-to-33::before,
                    #chess-board .chess-square.teacher-direct-bad-33::before,
                    .chess-square.teacher-direct-from-33::before,
                    .chess-square.teacher-direct-to-33::before,
                    .chess-square.teacher-direct-bad-33::before {
                        z-index: 70 !important;
                        min-width: 28px !important;
                        height: 22px !important;
                        font-size: .62rem !important;
                        border: 2px solid rgba(255,255,255,.94) !important;
                        box-shadow: 0 4px 10px rgba(0,0,0,.42) !important;
                    }
                    #chess-board .chess-square.teacher-direct-from-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-to-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-bad-33 .chess-piece,
                    #chess-board .chess-square.teacher-direct-from-33 span,
                    #chess-board .chess-square.teacher-direct-to-33 span,
                    #chess-board .chess-square.teacher-direct-bad-33 span {
                        position: relative !important;
                        z-index: 55 !important;
                        text-shadow: 0 3px 8px rgba(0,0,0,.55) !important;
                    }
                    @keyframes teacherProf37PulseYellow {
                        0%,100% { filter: brightness(1) saturate(1.1); transform: scale(1); }
                        50% { filter: brightness(1.45) saturate(1.7); transform: scale(.985); }
                    }
                    @keyframes teacherProf37PulseGreen {
                        0%,100% { filter: brightness(1) saturate(1.12); transform: scale(1); }
                        50% { filter: brightness(1.48) saturate(1.75); transform: scale(.985); }
                    }
                    @keyframes teacherProf37PulseRed {
                        0%,100% { filter: brightness(1) saturate(1.1); }
                        50% { filter: brightness(1.30) saturate(1.55); }
                    }
                    @media(max-width:560px){
                        #teacher-prof37-controls,
                        .teacher-prof37-controls { padding: 8px !important; }
                        #teacher-prof37-controls button,
                        .teacher-prof37-controls button { font-size:.59rem !important; padding:7px 5px !important; }
                        #teacher-prof37-controls .prof37-help,
                        .teacher-prof37-controls .prof37-help { font-size:.58rem !important; }
                    }
                `;
                document.head.appendChild(style);
            }

            function aplicarMigracaoProfessorXadrez37() {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;
                try {
                    if (localStorage.getItem(PROF37_MIGRATION_KEY) !== '1') {
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_MODO_KEY, 'bubble');
                        localStorage.setItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY, '0');
                        localStorage.setItem(PROF37_MIGRATION_KEY, '1');
                    }
                } catch (_) {}
            }

            function garantirControlesProfessorXadrez37() {
                instalarCssControlesProfessorXadrez37();
                const panel = document.getElementById('chess-private-teacher-panel');
                if (!panel) return null;
                const body = document.getElementById('chess-private-teacher-body') || panel;
                let box = document.getElementById('teacher-prof37-controls');
                if (!box) {
                    box = document.createElement('div');
                    box.id = 'teacher-prof37-controls';
                    box.className = 'teacher-prof37-controls';
                    box.innerHTML = `
                        <div class="prof37-title"><span>🎯 Robô do professor</span><span data-prof37-state>PRONTO</span></div>
                        <div class="prof37-grid">
                            <button type="button" data-prof37="window">Janelinha ON</button>
                            <button type="button" data-prof37="colors">Robô cores OFF</button>
                            <button type="button" data-prof37="refresh">Atualizar cores</button>
                            <button type="button" data-prof37="bubble">Abrir balão</button>
                            <button type="button" data-prof37="clear">Limpar cores</button>
                            <button type="button" data-prof37="legend">Legenda</button>
                        </div>
                        <div class="prof37-help" data-prof37-help>Janelinha ON: tocar na peça abre o balão. Robô cores ON: amarelo pisca na peça indicada, verde pisca na casa boa e vermelho marca perigo.</div>
                    `;
                    body.insertBefore(box, body.firstChild || null);
                }
                if (box.dataset.prof37Bound !== '1') {
                    box.dataset.prof37Bound = '1';
                    box.querySelectorAll('[data-prof37]').forEach(btn => {
                        btn.addEventListener('click', ev => {
                            const acao = btn.getAttribute('data-prof37');
                            if (acao === 'window') {
                                const offAgora = lerModoToqueGuiaDiretaXadrez33() === 'direct';
                                if (offAgora) {
                                    salvarModoToqueGuiaDiretaXadrez33('bubble');
                                    atualizarStatusGuiaDiretaProfessorXadrez33('Janelinha ON. Agora, ao tocar numa peça, o balão de dicas volta a abrir. O robô por cores pode ficar ligado junto.');
                                } else {
                                    salvarModoToqueGuiaDiretaXadrez33('direct');
                                    fecharBalaoProfessorXadrez34();
                                    atualizarStatusGuiaDiretaProfessorXadrez33('Janelinha OFF. O balão não abre ao tocar na peça; use Robô cores ON para orientar direto pelo tabuleiro.');
                                }
                            }
                            if (acao === 'colors') {
                                const ligar = !autoGuiaDiretaAtivaXadrez33();
                                salvarAutoGuiaDiretaXadrez33(ligar);
                                if (ligar) {
                                    aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'prof37' });
                                    atualizarStatusGuiaDiretaProfessorXadrez33('Robô cores ON. Ele vai acompanhar o jogo e marcar no tabuleiro: amarelo = peça boa, verde = casa boa, vermelho = perigo.');
                                } else {
                                    limparGuiaDiretaProfessorXadrez33();
                                    atualizarStatusGuiaDiretaProfessorXadrez33('Robô cores OFF. As cores foram limpas. A janelinha continua no estado escolhido.');
                                }
                            }
                            if (acao === 'refresh') {
                                salvarAutoGuiaDiretaXadrez33(true);
                                aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'prof37' });
                                atualizarStatusGuiaDiretaProfessorXadrez33('Cores atualizadas. Amarelo = peça indicada, verde = destino, vermelho = perigo.');
                            }
                            if (acao === 'bubble') {
                                salvarModoToqueGuiaDiretaXadrez33('bubble');
                                abrirBalaoPeloPainelGuiaDiretaXadrez33();
                                atualizarStatusGuiaDiretaProfessorXadrez33('Balão aberto. Se não houver peça selecionada, toque em uma peça no tabuleiro.');
                            }
                            if (acao === 'clear') {
                                salvarAutoGuiaDiretaXadrez33(false);
                                limparGuiaDiretaProfessorXadrez33();
                                atualizarStatusGuiaDiretaProfessorXadrez33('Cores limpas. Ligue Robô cores ON quando quiser orientação no tabuleiro.');
                            }
                            if (acao === 'legend') {
                                atualizarStatusGuiaDiretaProfessorXadrez33('<strong>Legenda:</strong><br><span class="yellow-33">Amarelo piscando</span> = peça recomendada para mexer.<br><span class="good-33">Verde piscando</span> = casa recomendada para ir.<br><span class="bad-33">Vermelho</span> = peça/casa perigosa para evitar.');
                            }
                            atualizarControlesProfessorXadrez37();
                            atualizarBotoesGuiaDiretaXadrez33();
                            atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                            ev.preventDefault();
                            ev.stopPropagation();
                        });
                    });
                }
                atualizarControlesProfessorXadrez37();
                return box;
            }

            function atualizarControlesProfessorXadrez37() {
                const box = document.getElementById('teacher-prof37-controls');
                if (!box) return;
                const modo = lerModoToqueGuiaDiretaXadrez33();
                const auto = autoGuiaDiretaAtivaXadrez33();
                const off = modo === 'direct';
                const btnWindow = box.querySelector('[data-prof37="window"]');
                const btnColors = box.querySelector('[data-prof37="colors"]');
                const state = box.querySelector('[data-prof37-state]');
                const help = box.querySelector('[data-prof37-help]');
                if (btnWindow) {
                    btnWindow.textContent = off ? 'Janelinha OFF' : 'Janelinha ON';
                    btnWindow.classList.toggle('prof37-on', !off);
                    btnWindow.classList.toggle('prof37-off', off);
                }
                if (btnColors) {
                    btnColors.textContent = auto ? 'Robô cores ON' : 'Robô cores OFF';
                    btnColors.classList.toggle('prof37-on', auto);
                    btnColors.classList.toggle('prof37-off', !auto);
                }
                if (state) {
                    if (!off && auto) state.textContent = 'BALÃO + CORES';
                    else if (!off) state.textContent = 'JANELA ON';
                    else if (auto) state.textContent = 'SÓ CORES';
                    else state.textContent = 'OFF';
                    state.style.color = auto || !off ? '#86efac' : '#fca5a5';
                }
                if (help) {
                    help.innerHTML = off
                        ? 'Janelinha OFF: o balão não abre sozinho. Ligue <strong>Robô cores ON</strong> para o tabuleiro guiar por cores.'
                        : 'Janelinha ON: tocar numa peça abre o balão. Você também pode ligar <strong>Robô cores ON</strong> para ver amarelo, verde e vermelho no tabuleiro.';
                }
            }

            function abrirBubbleProfessorXadrez37SePossivel(row, col) {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return false;
                if (lerModoToqueGuiaDiretaXadrez33() === 'direct') return false;
                const peca = chessBoard?.[row]?.[col] || null;
                if (!peca) return false;
                try {
                    let movimentos = [];
                    try { movimentos = calcularMovimentosLegais(row, col, chessBoard) || []; } catch (_) { movimentos = []; }
                    const rect = rectQuadradoXadrez26(row, col);
                    guiaDiretaXadrez33UltimoClique = { row, col };
                    try { registrarUltimaPecaGuiaXadrez29({ row, col }); } catch (_) {}
                    marcarPecaBubbleProfessorXadrez27(row, col);
                    abrirBubbleProfessorXadrez27(criarDadosPopupXadrez26(peca, row, col, movimentos, rect));
                    return true;
                } catch (_) {
                    return false;
                }
            }

            function iniciarProfessorXadrez37() {
                if (!professorPrivadoPodeAparecerXadrez19 || !professorPrivadoPodeAparecerXadrez19()) return;
                aplicarMigracaoProfessorXadrez37();
                garantirControlesProfessorXadrez37();
                atualizarControlesProfessorXadrez37();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                if (autoGuiaDiretaAtivaXadrez33() && (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())) agendarGuiaDiretaProfessorXadrez33(false, 'prof37leve39');
            }

            if (!window.__teacherProf37ManualWrapper) {
                window.__teacherProf37ManualWrapper = true;
                const atualizarManualAnterior37 = atualizarManualPrivadoProfessorXadrez19;
                atualizarManualPrivadoProfessorXadrez19 = function atualizarManualPrivadoProfessorXadrez37(texto = '') {
                    const retorno = atualizarManualAnterior37.apply(this, arguments);
                    setTimeout(() => { try { iniciarProfessorXadrez37(); } catch (_) {} }, 0);
                    return retorno;
                };
            }

            if (!window.__teacherProf37ClickFix) {
                window.__teacherProf37ClickFix = true;
                document.addEventListener('click', (ev) => {
                    const square = ev.target && ev.target.closest ? ev.target.closest('#chess-board .chess-square[data-row][data-col]') : null;
                    if (!square) return;
                    const row = Number(square.dataset.row);
                    const col = Number(square.dataset.col);
                    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
                    setTimeout(() => {
                        try {
                            iniciarProfessorXadrez37();
                            if (lerModoToqueGuiaDiretaXadrez33() !== 'direct') abrirBubbleProfessorXadrez37SePossivel(row, col);
                            if (autoGuiaDiretaAtivaXadrez33()) aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'toque37', clicada: { row, col } });
                        } catch (_) {}
                    }, 170);
                }, true);
            }

            if (!window.__teacherProf37RenderHook) {
                window.__teacherProf37RenderHook = true;
                const renderAnteriorProf37 = renderChessBoard;
                renderChessBoard = function renderChessBoardProfessor37() {
                    const retorno = renderAnteriorProf37.apply(this, arguments);
                    setTimeout(() => { try { iniciarProfessorXadrez37(); } catch (_) {} }, 160);
                    return retorno;
                };
            }

            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => { try { iniciarProfessorXadrez37(); } catch (_) {} }, 700);
            });

            /* =====================================================================
               ✅ PROFISSIONAL 39 — ROBÔ POR CORES LEVE E SINCRONIZADO
               O robô do professor continua top, mas agora não pesa na jogada online.
               Ele espera a vez do professor voltar, calcula uma vez, pinta o tabuleiro
               e não fica recalculando sem necessidade enquanto o aluno pensa.
            ===================================================================== */
            if (!window.__teacherProf39LeveSync) {
                window.__teacherProf39LeveSync = true;
                let prof39Timer = null;
                let prof39UltimaAssinatura = '';

                function prof39AssinaturaLeve() {
                    try {
                        return JSON.stringify({
                            turn: chessTurn,
                            color: chessPlayerColor || '',
                            over: !!chessGameOver,
                            last: lastChessMove || null,
                            hist: Array.isArray(moveHistory) ? moveHistory.length : 0,
                            board: chessBoard || []
                        });
                    } catch (_) {
                        return String(Date.now());
                    }
                }

                function prof39PodeCalcular() {
                    try {
                        return !!(
                            professorPrivadoPodeAparecerXadrez19 &&
                            professorPrivadoPodeAparecerXadrez19() &&
                            autoGuiaDiretaAtivaXadrez33() &&
                            !chessGameOver &&
                            (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())
                        );
                    } catch (_) {
                        return false;
                    }
                }

                function prof39AgendarCalculo(motivo = 'auto39', forcar = false) {
                    clearTimeout(prof39Timer);
                    if (!prof39PodeCalcular()) {
                        try {
                            if (chessMode === 'online' && chessPlayerColor && chessTurn !== corProfessorGuiaDiretaXadrez33()) {
                                atualizarStatusGuiaDiretaProfessorXadrez33('Aguardando o aluno jogar. Quando voltar sua vez, o robô por cores atualiza sozinho.');
                            }
                        } catch (_) {}
                        return;
                    }
                    const assinatura = prof39AssinaturaLeve();
                    if (!forcar && assinatura === prof39UltimaAssinatura) return;
                    prof39UltimaAssinatura = assinatura;
                    prof39Timer = setTimeout(() => {
                        try { aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: motivo }); } catch (_) {}
                    }, 1050);
                }

                const aplicarRemotoAnterior39 = aplicarEstadoXadrezRemoto;
                aplicarEstadoXadrezRemoto = function aplicarEstadoXadrezRemotoProf39(data) {
                    const retorno = aplicarRemotoAnterior39.apply(this, arguments);
                    setTimeout(() => prof39AgendarCalculo('apos-jogada-aluno41', false), 1200);
                    return retorno;
                };

                const publicarAnterior39 = publicarEstadoXadrezOnline;
                publicarEstadoXadrezOnline = async function publicarEstadoXadrezOnlineProf39(extra = {}) {
                    // mantém a publicação original, só evita que o robô tente calcular junto com a sincronização
                    const retorno = await publicarAnterior39.apply(this, arguments);
                    setTimeout(() => prof39AgendarCalculo('apos-minha-jogada41', false), 1400);
                    return retorno;
                };

                document.addEventListener('click', (ev) => {
                    const btn = ev.target && ev.target.closest ? ev.target.closest('[data-prof36="refresh"], [data-prof37="refresh"], [data-direct33="refresh"], [data-direct33-mini="refresh"]') : null;
                    if (!btn) return;
                    setTimeout(() => prof39AgendarCalculo('manual39', true), 120);
                }, true);
            }

        }

            /* =====================================================================
               ✅ PROFISSIONAL 42 — PRONTA PARA RAIZ + ROBÔ EM 3 NÍVEIS
               Base: Profissional 41 aprovada pelo usuário.
               Objetivo:
               - manter o jogo leve para publicar na raiz;
               - deixar o Robô Cores desligado por padrão em aparelhos novos;
               - permitir 3 níveis: Leve, Forte e Aula;
               - o professor escolhe o nível dentro da aba Professor Inteligente;
               - não mexe na Damas, Admin, Firebase, salas, ranking ou torneios.
            ===================================================================== */
            const PROF42_ROBO_NIVEL_KEY = 'tabuleiro_arena_professor_robo_nivel_42';
            const PROF42_PADRAO_RAIZ_KEY = 'tabuleiro_arena_prof42_padrao_raiz_aplicado';

            function nivelRoboProfessor42() {
                try {
                    const v = localStorage.getItem(PROF42_ROBO_NIVEL_KEY) || 'leve';
                    return ['leve', 'forte', 'aula'].includes(v) ? v : 'leve';
                } catch (_) {
                    return 'leve';
                }
            }

            function nomeNivelRoboProfessor42(nivel = nivelRoboProfessor42()) {
                if (nivel === 'forte') return 'Forte';
                if (nivel === 'aula') return 'Aula';
                return 'Leve';
            }

            function descricaoNivelRoboProfessor42(nivel = nivelRoboProfessor42()) {
                if (nivel === 'forte') return 'Forte: analisa mais candidatos e protege melhor contra resposta do aluno. Use quando quiser mais precisão.';
                if (nivel === 'aula') return 'Aula: prioriza explicação simples, jogadas seguras, defesa do Rei e material. Bom para ensinar sem pesar.';
                return 'Leve: melhor para celular e partida online. Guia por cores sem ficar travando o jogo.';
            }

            function salvarNivelRoboProfessor42(nivel) {
                const final = ['leve', 'forte', 'aula'].includes(nivel) ? nivel : 'leve';
                try { localStorage.setItem(PROF42_ROBO_NIVEL_KEY, final); } catch (_) {}
                atualizarControlesProfessor42();
                atualizarPainelFlutuanteGuiaDiretaXadrez33(true);
                if (autoGuiaDiretaAtivaXadrez33() && (!chessPlayerColor || chessTurn === corProfessorGuiaDiretaXadrez33())) {
                    clearTimeout(guiaDiretaXadrez33Timer);
                    guiaDiretaXadrez33UltimaAssinatura = '';
                    guiaDiretaXadrez33Timer = setTimeout(() => {
                        try { aplicarGuiaDiretaProfessorXadrez33({ forcar: true, origem: 'nivel42' }); } catch (_) {}
                    }, final === 'forte' ? 850 : 420);
                }
            }

            function aplicarPadraoRaizProfessor42() {
                try {
                    if (localStorage.getItem(PROF42_PADRAO_RAIZ_KEY) !== '1') {
                        // Em aparelhos novos, o robô fica desligado para o jogo abrir leve.
                        // Quem já ligou antes mantém sua escolha, para não bagunçar o professor.
                        if (localStorage.getItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY) === null) {
                            localStorage.setItem(GUIA_DIRETA_XADREZ_33_AUTO_KEY, '0');
                        }
                        if (localStorage.getItem(GUIA_DIRETA_XADREZ_33_MODO_KEY) === null) {
                            localStorage.setItem(GUIA_DIRETA_XADREZ_33_MODO_KEY, 'bubble');
                        }
                        if (localStorage.getItem(PROF42_ROBO_NIVEL_KEY) === null) {
                            localStorage.setItem(PROF42_ROBO_NIVEL_KEY, 'leve');
                        }
                        localStorage.setItem(PROF42_PADRAO_RAIZ_KEY, '1');
                    }
                } catch (_) {}
            }

            function instalarCssProfessor42() {
                if (document.getElementById('teacher-prof42-style')) return;
                const style = document.createElement('style');
                style.id = 'teacher-prof42-style';
                style.textContent = `
                    #teacher-prof42-level {
                        margin: 8px 0 0 0 !important;
                        padding: 8px !important;
                        border-radius: 12px !important;
                        border: 1px solid rgba(96,165,250,.34) !important;
                        background: linear-gradient(135deg, rgba(15,23,42,.94), rgba(30,41,59,.80)) !important;
                    }
                    #teacher-prof42-level .prof42-line {
                        display: grid !important;
                        grid-template-columns: 1fr auto !important;
                        align-items: center !important;
                        gap: 7px !important;
                    }
                    #teacher-prof42-level .prof42-title {
                        color: #bfdbfe !important;
                        font-size: .67rem !important;
                        font-weight: 1000 !important;
                        letter-spacing: .04em !important;
                        text-transform: uppercase !important;
                    }
                    #teacher-prof42-level select {
                        min-width: 92px !important;
                        border-radius: 999px !important;
                        border: 1px solid rgba(147,197,253,.48) !important;
                        background: rgba(2,6,23,.92) !important;
                        color: #e0f2fe !important;
                        padding: 6px 8px !important;
                        font-size: .65rem !important;
                        font-weight: 900 !important;
                        outline: none !important;
                    }
                    #teacher-prof42-level .prof42-desc {
                        margin-top: 6px !important;
                        color: #cbd5e1 !important;
                        font-size: .62rem !important;
                        line-height: 1.25 !important;
                    }
                    #teacher-prof42-level .prof42-root {
                        margin-top: 5px !important;
                        color: #86efac !important;
                        font-size: .58rem !important;
                        font-weight: 900 !important;
                        line-height: 1.2 !important;
                    }
                    #teacher-direct-guide-33 .prof42-mini {
                        margin-top: 6px !important;
                        padding-top: 6px !important;
                        border-top: 1px solid rgba(148,163,184,.18) !important;
                        display: grid !important;
                        grid-template-columns: auto 1fr !important;
                        gap: 5px !important;
                        align-items: center !important;
                        font-size: .60rem !important;
                    }
                    #teacher-direct-guide-33 .prof42-mini select {
                        width: 100% !important;
                        min-width: 0 !important;
                        border-radius: 999px !important;
                        border: 1px solid rgba(147,197,253,.38) !important;
                        background: rgba(2,6,23,.90) !important;
                        color: #e0f2fe !important;
                        padding: 5px 6px !important;
                        font-size: .60rem !important;
                        font-weight: 900 !important;
                    }
                `;
                document.head.appendChild(style);
            }

            function garantirControlesProfessor42() {
                aplicarPadraoRaizProfessor42();
                instalarCssProfessor42();

                const box37 = document.getElementById('teacher-prof37-controls') || document.querySelector('.teacher-prof37-controls');
                if (box37 && !document.getElementById('teacher-prof42-level')) {
                    const bloco = document.createElement('div');
                    bloco.id = 'teacher-prof42-level';
                    bloco.innerHTML = `
                        <div class="prof42-line">
                            <span class="prof42-title">Força do robô</span>
                            <select id="teacher-prof42-level-select" aria-label="Força do robô do professor">
                                <option value="leve">Leve</option>
                                <option value="forte">Forte</option>
                                <option value="aula">Aula</option>
                            </select>
                        </div>
                        <div class="prof42-desc" data-prof42-desc></div>
                        <div class="prof42-root">✅ Versão segura para raiz: robô inicia OFF em aparelho novo.</div>
                    `;
                    box37.appendChild(bloco);
                    const select = bloco.querySelector('#teacher-prof42-level-select');
                    select?.addEventListener('change', () => salvarNivelRoboProfessor42(select.value));
                }

                const mini = document.getElementById('teacher-direct-guide-33');
                if (mini && !mini.querySelector('.prof42-mini')) {
                    const blocoMini = document.createElement('div');
                    blocoMini.className = 'prof42-mini';
                    blocoMini.innerHTML = `
                        <span>Força</span>
                        <select id="teacher-prof42-mini-select" aria-label="Força do robô do professor">
                            <option value="leve">Leve</option>
                            <option value="forte">Forte</option>
                            <option value="aula">Aula</option>
                        </select>
                    `;
                    mini.appendChild(blocoMini);
                    const selectMini = blocoMini.querySelector('#teacher-prof42-mini-select');
                    selectMini?.addEventListener('change', () => salvarNivelRoboProfessor42(selectMini.value));
                }

                atualizarControlesProfessor42();
            }

            function atualizarControlesProfessor42() {
                const nivel = nivelRoboProfessor42();
                document.querySelectorAll('#teacher-prof42-level-select, #teacher-prof42-mini-select').forEach(sel => {
                    if (sel && sel.value !== nivel) sel.value = nivel;
                });
                document.querySelectorAll('[data-prof42-desc]').forEach(el => {
                    el.textContent = descricaoNivelRoboProfessor42(nivel);
                });
                const p = document.getElementById('teacher-direct-guide-status-33');
                if (p && autoGuiaDiretaAtivaXadrez33() && p.innerHTML && !p.innerHTML.includes('Modo do robô')) {
                    p.innerHTML += `<br><strong>Modo do robô:</strong> ${nomeNivelRoboProfessor42(nivel)}.`;
                }
            }

            function scoreRapidoProfessor42(item, board, cor, modo = 'leve') {
                try {
                    const peca = board?.[item.from.row]?.[item.from.col] || item.peca || null;
                    const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                    if (!peca || !temp) return -9999999;
                    const adversario = corOposta(cor);
                    const alvo = pecaCapturadaRoboProfessorXadrez30(board, item);
                    const respostas = todosMovimentosLegais(adversario, temp) || [];
                    if (!respostas.length && reiEstaEmXeque(temp, adversario)) return 9000000;

                    let score = avaliarPosicaoProfessor40(temp, cor);
                    if (alvo) score += valorPecaProfessor40(alvo.type) * (modo === 'aula' ? 2.2 : 2.55) - valorPecaProfessor40(peca.type) * 0.08;
                    if (reiEstaEmXeque(temp, adversario)) score += modo === 'aula' ? 520 : 780;
                    if (item.to?.castle) score += 430;
                    if (peca.type === 'pawn' && (item.to.row === 0 || item.to.row === 7)) score += 2600;
                    score += centro26(item.to.row, item.to.col) * (modo === 'aula' ? 28 : 20);

                    const mateContra = detectarMateEmUmTreinoXadrez(adversario, temp);
                    if (mateContra) score -= 8000000;

                    if (peca.type !== 'king' && quadradoAtacado(temp, item.to.row, item.to.col, adversario)) {
                        const defendida = quadradoAtacado(temp, item.to.row, item.to.col, cor);
                        score -= valorPecaProfessor40(peca.type) * (defendida ? 0.46 : 2.15);
                    }

                    const respostasOrdenadas = ordenarMovimentosProfessor40(respostas, temp, adversario).slice(0, modo === 'forte' ? 7 : 4);
                    let piorResposta = 0;
                    respostasOrdenadas.forEach(resp => {
                        const alvoResp = pecaCapturadaRoboProfessorXadrez30(temp, resp);
                        const after = aplicarMovimentoTreinoEmClone(temp, resp, 'queen');
                        let dano = alvoResp ? valorPecaProfessor40(alvoResp.type) * 2.25 : 0;
                        if (after && reiEstaEmXeque(after, cor)) dano += 560;
                        if (after && detectarMateEmUmTreinoXadrez(adversario, after)) dano += 2000000;
                        piorResposta = Math.max(piorResposta, dano);
                    });
                    score -= piorResposta;

                    if (modo === 'aula') {
                        // No modo aula, favorece lance fácil de explicar: captura segura, roque, peça desenvolvida e centro.
                        if ((peca.type === 'knight' || peca.type === 'bishop') && (peca.color === 'white' ? item.from.row === 7 : item.from.row === 0)) score += 180;
                        if (alvo && !quadradoAtacado(temp, item.to.row, item.to.col, adversario)) score += 260;
                    }

                    return score;
                } catch (_) {
                    return -9999999;
                }
            }

            function melhoresLancesProfessor42(cor, board = chessBoard, limite = 5) {
                let movimentos = [];
                try { movimentos = todosMovimentosLegais(cor, board) || []; } catch (_) { movimentos = []; }
                if (!movimentos.length) return [];

                const nivel = nivelRoboProfessor42();
                const maxCandidatos = nivel === 'forte' ? 14 : (nivel === 'aula' ? 9 : 7);
                const candidatos = ordenarMovimentosProfessor40(movimentos, board, cor).slice(0, maxCandidatos);

                return candidatos.map(item => {
                    const peca = board?.[item.from.row]?.[item.from.col] || null;
                    let score = scoreRapidoProfessor42(item, board, cor, nivel);

                    if (nivel === 'forte') {
                        // Forte sem travar: aprofunda só nos melhores candidatos e com limite.
                        try {
                            const temp = aplicarMovimentoTreinoEmClone(board, item, 'queen');
                            if (temp) score += buscaProfessor40(temp, corOposta(cor), 2, -99999999, 99999999, cor) * 0.34;
                        } catch (_) {}
                    }

                    return {
                        ...item,
                        peca,
                        score,
                        motivo30: classificarLanceRoboProfessorXadrez30(item, board, cor),
                        nivel42: nivel
                    };
                }).sort((a, b) => b.score - a.score).slice(0, limite);
            }

            const melhoresLancesProfundosOriginal42 = melhoresLancesProfundosRoboProfessorXadrez30;
            melhoresLancesProfundosRoboProfessorXadrez30 = function melhoresLancesProfundosRoboProfessorXadrez42(cor, board = chessBoard, limite = 5) {
                try {
                    const nivel = nivelRoboProfessor42();
                    if (nivel === 'leve' && limite <= 1) {
                        // Para tarefas pequenas, usa cálculo mais leve ainda.
                        return melhoresLancesProfessor42(cor, board, limite);
                    }
                    if (nivel === 'forte' || nivel === 'aula' || nivel === 'leve') {
                        return melhoresLancesProfessor42(cor, board, limite);
                    }
                } catch (_) {}
                return melhoresLancesProfundosOriginal42(cor, board, limite);
            };

            const textoGuiaDiretaOriginal42 = textoGuiaDiretaProfessorXadrez33;
            textoGuiaDiretaProfessorXadrez33 = function textoGuiaDiretaProfessorXadrez42(resultado, cor, origem = 'manual') {
                let html = textoGuiaDiretaOriginal42.apply(this, arguments);
                const nivel = nivelRoboProfessor42();
                const melhor = resultado?.melhor || null;
                if (melhor) {
                    html += `<br><strong>Modo do robô:</strong> ${nomeNivelRoboProfessor42(nivel)}.`;
                    if (nivel === 'forte') html += ' O robô olhou mais respostas do aluno antes de indicar.';
                    if (nivel === 'aula') html += ' Use a explicação como roteiro: segurança, material e plano simples.';
                    if (nivel === 'leve') html += ' Indicação rápida para não travar a aula online.';
                }
                return html;
            };

            const atualizarPainelAnterior42 = atualizarPainelFlutuanteGuiaDiretaXadrez33;
            atualizarPainelFlutuanteGuiaDiretaXadrez33 = function atualizarPainelFlutuanteGuiaDiretaXadrez42(mostrar = false) {
                const retorno = atualizarPainelAnterior42.apply(this, arguments);
                setTimeout(() => { try { garantirControlesProfessor42(); } catch (_) {} }, 0);
                return retorno;
            };

            const controles37Anterior42 = atualizarControlesProfessorXadrez37;
            atualizarControlesProfessorXadrez37 = function atualizarControlesProfessorXadrez37Prof42() {
                const retorno = controles37Anterior42.apply(this, arguments);
                try { garantirControlesProfessor42(); } catch (_) {}
                return retorno;
            };

            const manualAnterior42 = atualizarManualPrivadoProfessorXadrez19;
            atualizarManualPrivadoProfessorXadrez19 = function atualizarManualPrivadoProfessorXadrez42(texto = '') {
                const retorno = manualAnterior42.apply(this, arguments);
                setTimeout(() => { try { garantirControlesProfessor42(); } catch (_) {} }, 0);
                return retorno;
            };

            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => { try { garantirControlesProfessor42(); } catch (_) {} }, 900);
            });


        instalarPopupProfessorXadrez26();

        window.abrirXadrezArena = abrirXadrezArena;
        window.resetChessGame = resetChessGame;
        window.desfazerJogadaXadrez = desfazerJogada;
        window.entrarXadrezOnline = entrarXadrezOnline;
        window.sairXadrezOnline = sairXadrezOnline;
        window.iniciarTreinoXadrez = iniciarTreinoXadrez;
        window.abrirAdminXadrezCentral = abrirAdminXadrezCentral;
        window.iniciarChamadaXadrez = iniciarChamadaXadrez;
        window.encerrarChamadaXadrez = encerrarChamadaXadrez;

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarModuloXadrez);
        else iniciarModuloXadrez();
    })();


    // 🎲 Tabuleiro Arena: seletor de modalidades sem mexer na lógica da Damas
    (function prepararHubTabuleiroArena() {
        const abrirDamas = () => {
            document.body.classList.remove('platform-start-active');
            document.body.classList.remove('mode-selecting');
            document.body.classList.add('game-selected');
            const hub = document.getElementById('games-hub-panel');
            if (hub) hub.style.display = 'none';
            const lobby = document.getElementById('lobby-screen');
            if (lobby) {
                lobby.style.display = 'block';
                lobby.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        const voltarModalidades = () => {
            document.body.classList.add('platform-start-active');
            document.body.classList.add('mode-selecting');
            document.body.classList.remove('game-selected');
            document.body.classList.remove('chess-selected', 'chess-focus-mode', 'chess-menu-active', 'chess-game-active', 'chess-board-visible');
            const chessScreen = document.getElementById('chess-screen');
            if (chessScreen) chessScreen.style.display = 'none';
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen && gameScreen.style.display !== 'none') {
                if (typeof leaveGame === 'function') leaveGame();
                else gameScreen.style.display = 'none';
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        const avisarEmBreve = (jogo) => {
            const texto = `<strong>${jogo} Arena</strong> já está planejado para entrar na plataforma Tabuleiro Arena.<br><br>Primeiro vamos manter Damas Arena estável e profissional; depois essa modalidade poderá usar a mesma base de salas, ranking, torneios, chat e vídeo/áudio.`;
            if (typeof exibirAlertaDoSistema === 'function') exibirAlertaDoSistema(`${jogo} em breve`, texto);
            else alert(`${jogo} Arena em breve!`);
        };
        const ligarCard = (id, acao) => {
            const card = document.getElementById(id);
            if (!card) return;
            card.addEventListener('click', acao);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    acao();
                }
            });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                ligarCard('game-card-damas', abrirDamas);
                const backBtn = document.getElementById('back-to-games-btn');
                if (backBtn) backBtn.addEventListener('click', voltarModalidades);
                ligarCard('game-card-xadrez', () => { if (typeof abrirXadrezArena === 'function') abrirXadrezArena(); else avisarEmBreve('Xadrez'); });
            });
        } else {
            ligarCard('game-card-damas', abrirDamas);
            const backBtn = document.getElementById('back-to-games-btn');
            if (backBtn) backBtn.addEventListener('click', voltarModalidades);
            ligarCard('game-card-xadrez', () => { if (typeof abrirXadrezArena === 'function') abrirXadrezArena(); else avisarEmBreve('Xadrez'); });
        }
    })();

    // Dominó removido temporariamente para manter a Damas Arena estável.


        /* ✅ FASE 15 - AULA DAS PEÇAS NO TREINO DO XADREZ */
        (function instalarAulaPecasXadrezFase15() {
            function bindLessonButton() {
                const btn = document.getElementById('chess-pieces-lesson-btn');
                const panel = document.getElementById('chess-pieces-lesson-panel');
                if (!btn || !panel || btn.dataset.boundFase15 === '1') return;
                btn.dataset.boundFase15 = '1';
                btn.addEventListener('click', function () {
                    const aberto = panel.style.display !== 'none';
                    panel.style.display = aberto ? 'none' : 'block';
                    btn.textContent = aberto ? '📚 Conhecer as peças antes de jogar' : '📕 Fechar explicação das peças';
                    if (!aberto) {
                        const status = document.getElementById('chess-training-status');
                        if (status) status.textContent = 'Leia as peças abaixo. Depois escolha Fácil, Médio, Difícil ou Aprender do Zero para abrir o tabuleiro.';
                    }
                });
            }

            const antigoEnsure = window.ensureChessOnlinePanel;
            if (typeof antigoEnsure === 'function') {
                window.ensureChessOnlinePanel = function () {
                    const retorno = antigoEnsure.apply(this, arguments);
                    setTimeout(bindLessonButton, 0);
                    return retorno;
                };
            }

            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(bindLessonButton, 300);
            });

            setInterval(bindLessonButton, 1200);
        })();



        /* ✅ FASE 27 - CORREÇÕES DO ONLINE: nomes, chat recolhível, sem histórico e tabuleiro estável */
        (function fase27OnlineLimpoTabuleiroEstavel(){
            if (window.__tabuleiroArenaXadrezFase29InternaAtiva) return;
            function safeNameChess27(player, fallback) {
                try { return escapeHtmlXadrez(player?.name || fallback || 'Aguardando'); }
                catch (_) { return String(player?.name || fallback || 'Aguardando'); }
            }
            function isMeChess27(player) {
                try { return !!(player && player.id && typeof uid !== 'undefined' && player.id === uid); }
                catch (_) { return false; }
            }
            function ensurePlayersBarChess27() {
                const card = document.querySelector('#chess-screen .chess-card');
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                if (!card || !boardWrap) return null;
                let bar = document.getElementById('chess-game-players-bar');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'chess-game-players-bar';
                    bar.className = 'chess-game-players-bar';
                    boardWrap.insertAdjacentElement('beforebegin', bar);
                }
                return bar;
            }
            window.updateChessGamePlayersBarFase27 = function updateChessGamePlayersBarFase27() {
                const bar = ensurePlayersBarChess27();
                if (!bar) return;
                if (chessMode !== 'online' || !document.body.classList.contains('chess-board-visible')) {
                    bar.style.display = 'none';
                    return;
                }
                const white = chessRoomPlayers?.white || null;
                const black = chessRoomPlayers?.black || null;
                const whiteName = safeNameChess27(white, 'Aguardando brancas');
                const blackName = safeNameChess27(black, 'Aguardando pretas');
                bar.innerHTML = `
                    <div class="chess-game-players-side">
                        <span>⚪</span><span class="chess-game-players-name ${isMeChess27(white) ? 'me' : ''}">${whiteName}${isMeChess27(white) ? ' (você)' : ''}</span>
                    </div>
                    <div class="chess-game-players-vs">contra</div>
                    <div class="chess-game-players-side">
                        <span class="chess-game-players-name ${isMeChess27(black) ? 'me' : ''}">${blackName}${isMeChess27(black) ? ' (você)' : ''}</span><span>⚫</span>
                    </div>
                `;
                bar.style.display = 'flex';
            };
            function ensureChatToggleChess27() {
                const chat = document.getElementById('chess-chat-panel');
                if (!chat) return;
                const title = chat.querySelector('.chess-chat-title');
                if (!title) return;
                if (!document.getElementById('chess-chat-toggle-mini')) {
                    title.innerHTML = '<span>💬 Chat</span><button id="chess-chat-toggle-mini" class="chess-chat-toggle-mini" type="button">+</button>';
                    const toggle = () => {
                        const collapsed = chat.classList.toggle('chat-collapsed');
                        const btn = document.getElementById('chess-chat-toggle-mini');
                        if (btn) btn.textContent = collapsed ? '+' : '−';
                    };
                    title.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        toggle();
                    });
                }
                if (document.body.classList.contains('chess-board-visible') && chessMode === 'online') {
                    chat.classList.add('chat-collapsed');
                    const btn = document.getElementById('chess-chat-toggle-mini');
                    if (btn) btn.textContent = '+';
                }
            }
            function compactarTelaOnlineChess27() {
                document.body.classList.toggle('chess-mode-online', chessMode === 'online');
                document.body.classList.toggle('chess-mode-training', chessMode === 'training');
                const history = document.getElementById('chess-history-panel');
                if (history && document.body.classList.contains('chess-board-visible')) history.style.display = 'none';
                const material = document.getElementById('chess-material-panel');
                if (material && document.body.classList.contains('chess-board-visible')) material.style.display = 'none';
                const roomPanel = document.getElementById('chess-room-players-panel');
                if (roomPanel && document.body.classList.contains('chess-board-visible')) roomPanel.style.display = 'none';
                ensureChatToggleChess27();
                window.updateChessGamePlayersBarFase27?.();
            }

            const oldMostrarTabuleiro = mostrarTabuleiroXadrezAposEscolha;
            mostrarTabuleiroXadrezAposEscolha = function() {
                oldMostrarTabuleiro.apply(this, arguments);
                compactarTelaOnlineChess27();
            };

            const oldOcultarTabuleiro = ocultarTabuleiroXadrezParaMenu;
            ocultarTabuleiroXadrezParaMenu = function() {
                oldOcultarTabuleiro.apply(this, arguments);
                const bar = document.getElementById('chess-game-players-bar');
                if (bar) bar.style.display = 'none';
                const chat = document.getElementById('chess-chat-panel');
                if (chat) chat.classList.remove('chat-collapsed');
            };

            const oldAtualizarPainelOnline = atualizarPainelOnlineXadrez;
            atualizarPainelOnlineXadrez = function() {
                oldAtualizarPainelOnline.apply(this, arguments);
                const chat = document.getElementById('chess-chat-panel');
                if (chat && document.body.classList.contains('chess-board-visible')) {
                    chat.style.display = chessMode === 'online' ? 'block' : 'none';
                    if (chessMode === 'online') chat.classList.add('chat-collapsed');
                }
                compactarTelaOnlineChess27();
            };

            const oldRenderPlayers = renderizarListaJogadoresXadrez;
            renderizarListaJogadoresXadrez = function() {
                oldRenderPlayers.apply(this, arguments);
                window.updateChessGamePlayersBarFase27?.();
            };

            const oldRenderHistorico = renderHistorico;
            renderHistorico = function() {
                if (document.body.classList.contains('chess-board-visible')) {
                    const panel = document.getElementById('chess-history-panel');
                    if (panel) panel.style.display = 'none';
                    return;
                }
                oldRenderHistorico.apply(this, arguments);
            };

            const oldRenderBoard = renderChessBoard;
            renderChessBoard = function() {
                const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
                const shouldLock = chessMode === 'online' && document.body.classList.contains('chess-board-visible') && boardWrap;
                const beforeTop = shouldLock ? boardWrap.getBoundingClientRect().top : null;
                oldRenderBoard.apply(this, arguments);
                compactarTelaOnlineChess27();
                if (shouldLock) {
                    requestAnimationFrame(() => {
                        const wrap = document.querySelector('#chess-screen .chess-board-wrap');
                        if (!wrap) return;
                        const afterTop = wrap.getBoundingClientRect().top;
                        const diff = afterTop - beforeTop;
                        if (Math.abs(diff) > 1 && Math.abs(diff) < window.innerHeight * 0.85) {
                            window.scrollTo({ top: Math.max(0, window.scrollY + diff), behavior: 'auto' });
                        }
                    });
                }
            };

            const oldMostrarResultado = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function() {
                oldMostrarResultado.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const oldLimparResultado = limparResultadoXadrez;
            limparResultadoXadrez = function() {
                oldLimparResultado.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                ensurePlayersBarChess27();
                ensureChatToggleChess27();
                compactarTelaOnlineChess27();
            });
        })();


        /* ✅ FASE 35 - AJUSTES FINAIS DE LIMPEZA DO XADREZ ONLINE
           Não altera Damas. Só organiza Xadrez: ranking recolhível, chamada compacta e modais profissionais. */
        function instalarFase31XadrezTelaLimpa() {
            window.__tabuleiroArenaXadrezFase31TelaLimpa = true;

            function atualizarBotaoChamadaCompacta() {
                const els = chessCallElements();
                if (!els.panel || !els.toggle) return;
                const compacto = els.panel.classList.contains('call-compact') && !els.panel.classList.contains('call-active');
                els.toggle.textContent = compacto ? '+' : '−';
                els.toggle.setAttribute('aria-expanded', compacto ? 'false' : 'true');
            }

            function alternarPainelChamadaXadrezCompactoFase31() {
                const els = chessCallElements();
                if (!els.panel || els.panel.classList.contains('call-active')) return;
                const abrir = els.panel.classList.contains('call-compact');
                els.panel.classList.toggle('call-compact', !abrir);
                els.panel.dataset.userOpened = abrir ? '1' : '0';
                atualizarBotaoChamadaCompacta();
            }
            window.alternarPainelChamadaXadrezCompacto = alternarPainelChamadaXadrezCompactoFase31;

            const oldAtualizarPainelChamada = atualizarPainelChamadaXadrez;
            atualizarPainelChamadaXadrez = function atualizarPainelChamadaXadrezFase31() {
                oldAtualizarPainelChamada.apply(this, arguments);
                const els = chessCallElements();
                if (!els.panel) return;
                if (els.panel.classList.contains('call-active')) {
                    els.panel.classList.remove('call-compact');
                    centralizarChamadaXadrezFase31();
                } else if (els.panel.dataset.userOpened !== '1') {
                    els.panel.classList.add('call-compact');
                }
                atualizarBotaoChamadaCompacta();
            };

            aplicarTamanhoChamadaXadrez = function aplicarTamanhoChamadaXadrezFase31() {
                const { panel } = chessCallElements();
                if (!panel) return;
                chessCallFloatingWidth = Math.max(110, Math.min(240, chessCallFloatingWidth || 150));
                panel.style.setProperty('--fase35-video-height', `${chessCallFloatingWidth}px`);
                panel.style.left = '';
                panel.style.right = '';
                panel.style.top = '';
                panel.style.bottom = '';
                panel.style.transform = '';
                panel.style.width = '';
                panel.style.maxWidth = '';
                try { localStorage.setItem('tabuleiroArenaChessCallHeight', String(chessCallFloatingWidth)); } catch (_) {}
            };

            function centralizarChamadaXadrezFase31() {
                const { panel } = chessCallElements();
                if (!panel) return;
                aplicarTamanhoChamadaXadrez();
            }
            window.centralizarChamadaXadrezFase31 = centralizarChamadaXadrezFase31;

            restaurarPosicaoChamadaXadrez = function restaurarPosicaoChamadaXadrezFase31() {
                centralizarChamadaXadrezFase31();
            };

            const oldRedimensionarChamada = redimensionarChamadaXadrez;
            redimensionarChamadaXadrez = function redimensionarChamadaXadrezFase31(delta) {
                chessCallFloatingWidth = Math.max(110, Math.min(240, (chessCallFloatingWidth || 150) + delta));
                aplicarTamanhoChamadaXadrez();
            };

            const oldMostrarResultado31 = mostrarResultadoXadrezSeTerminou;
            mostrarResultadoXadrezSeTerminou = function mostrarResultadoXadrezSeTerminouFase31() {
                oldMostrarResultado31.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel && panel.style.display !== 'none' && document.body.classList.contains('chess-board-visible')) {
                    panel.classList.add('show-front');
                }
            };

            const oldLimparResultado31 = limparResultadoXadrez;
            limparResultadoXadrez = function limparResultadoXadrezFase31() {
                oldLimparResultado31.apply(this, arguments);
                const panel = document.getElementById('chess-result-panel');
                if (panel) panel.classList.remove('show-front');
            };

            document.addEventListener('DOMContentLoaded', () => {
                prepararRankingTreinoXadrez?.();
                atualizarPainelChamadaXadrez?.();
                atualizarBotaoChamadaCompacta();
            });

            window.addEventListener('resize', () => {
                centralizarChamadaXadrezFase31();
            });
        }

        instalarFase31XadrezTelaLimpa();


/* ======================================================================
   FASE 36 ESTÁVEL - CORREÇÃO FINAL DE ESTABILIDADE
   - Não cria dock extra.
   - Mantém apenas o painel nativo #chess-call-panel.
   - Move esse único painel para baixo do tabuleiro.
   - Não usa MutationObserver nem loop que mexe no DOM toda hora.
   - Mantém ranking do treino abrindo pelo botão + nativo.
   ====================================================================== */
(function instalarFase36EstavelSemDuplicarCamera() {
    if (window.__tabuleiroArenaFase36EstavelSemDuplicarCamera) return;
    window.__tabuleiroArenaFase36EstavelSemDuplicarCamera = true;

    function removerDocksDuplicadosFase36() {
        document.querySelectorAll('#fase36-camera-dock, .fase36-camera-dock').forEach(function (el) {
            el.remove();
        });
    }

    function limparPainelChamadaFase36(panel) {
        if (!panel) return;
        panel.classList.remove('fase36-call-panel', 'fase36-call-open', 'fase35-call-panel', 'fase35-call-open', 'fase34-call-closed', 'fase343-movida', 'fase344-posicao-manual', 'fase343-posicao-inicial-ok');
        panel.style.left = '';
        panel.style.right = '';
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.transform = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.position = '';
        panel.style.zIndex = '';
        panel.style.marginLeft = '';
        panel.style.marginRight = '';

        const toggle = document.getElementById('chess-call-toggle-btn');
        if (toggle) {
            toggle.style.display = '';
            toggle.removeAttribute('aria-hidden');
        }

        const title = panel.querySelector('.chess-call-title');
        if (title) title.textContent = '📹 Câmera e áudio';

        const note = panel.querySelector('.chess-call-note');
        if (note) note.innerHTML = 'A chamada fica fixa abaixo do tabuleiro do Xadrez e não cobre as peças. Não usa a câmera da Damas.';
    }

    function posicionarChamadaAbaixoDoTabuleiroFase36() {
        removerDocksDuplicadosFase36();
        const panel = document.getElementById('chess-call-panel');
        const boardWrap = document.querySelector('#chess-screen .chess-board-wrap');
        if (!panel || !boardWrap) return;

        limparPainelChamadaFase36(panel);

        if (boardWrap.nextElementSibling !== panel) {
            boardWrap.insertAdjacentElement('afterend', panel);
        }

        if (typeof atualizarBotaoChamadaCompacta === 'function') {
            try { atualizarBotaoChamadaCompacta(); } catch (_) {}
        } else {
            const toggle = document.getElementById('chess-call-toggle-btn');
            if (toggle) {
                const fechado = panel.classList.contains('call-compact') && !panel.classList.contains('call-active');
                toggle.textContent = fechado ? '+' : '−';
                toggle.setAttribute('aria-expanded', fechado ? 'false' : 'true');
            }
        }
    }

    function reforcarRankingNativoFase36() {
        const panel = document.getElementById('chess-training-ranking-panel');
        const btn = document.getElementById('chess-ranking-toggle-btn');
        if (!panel || !btn || btn.dataset.fase36RankingSeguro === '1') return;
        btn.dataset.fase36RankingSeguro = '1';
        btn.addEventListener('click', function () {
            setTimeout(function () {
                const aberto = !panel.classList.contains('chess-rank-collapsed');
                btn.textContent = aberto ? '−' : '+';
                btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            }, 0);
        });
    }

    const oldMostrarTabuleiroFase36 = typeof mostrarTabuleiroXadrezAposEscolha === 'function' ? mostrarTabuleiroXadrezAposEscolha : null;
    if (oldMostrarTabuleiroFase36) {
        mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaFase36Estavel() {
            oldMostrarTabuleiroFase36.apply(this, arguments);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 0);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 180);
        };
    }

    const oldAtualizarPainelChamadaFase36 = typeof atualizarPainelChamadaXadrez === 'function' ? atualizarPainelChamadaXadrez : null;
    if (oldAtualizarPainelChamadaFase36) {
        atualizarPainelChamadaXadrez = function atualizarPainelChamadaXadrezFase36Estavel() {
            oldAtualizarPainelChamadaFase36.apply(this, arguments);
            posicionarChamadaAbaixoDoTabuleiroFase36();
        };
    }

    const oldAtualizarPainelOnlineFase36 = typeof atualizarPainelOnlineXadrez === 'function' ? atualizarPainelOnlineXadrez : null;
    if (oldAtualizarPainelOnlineFase36) {
        atualizarPainelOnlineXadrez = function atualizarPainelOnlineXadrezFase36Estavel() {
            oldAtualizarPainelOnlineFase36.apply(this, arguments);
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 0);
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 300);
        setTimeout(reforcarRankingNativoFase36, 350);
    });

    document.addEventListener('click', function (ev) {
        const alvo = ev.target;
        if (!alvo || !alvo.closest) return;
        if (alvo.closest('#chess-online-join-btn, #chess-online-watch-btn, #chess-online-leave-btn, #chess-start-video-call-btn, #chess-start-audio-call-btn, #chess-end-call-btn, #chess-call-toggle-btn, #chess-training-easy-btn, #chess-training-medium-btn, #chess-training-hard-btn, #chess-training-learn-btn')) {
            setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 160);
            setTimeout(reforcarRankingNativoFase36, 180);
        }
    });

    window.addEventListener('resize', function () {
        setTimeout(posicionarChamadaAbaixoDoTabuleiroFase36, 80);
    });

    /* ✅ PROFISSIONAL 17 — Torneio público firme + inscrição de interessados
       Mantém o torneio somente no menu do Xadrez, corrige o card que embolava ao voltar da sala
       e cria lista de interessados para o Admin do Xadrez. */
    function instalarEstiloProf17TorneiosXadrez() {
        if (document.getElementById('chess-prof17-tournament-style')) return;
        const style = document.createElement('style');
        style.id = 'chess-prof17-tournament-style';
        style.textContent = `
            #chess-public-tournaments-panel.prof17-tournament-panel {
                max-width:760px !important;
                margin:18px auto 22px auto !important;
                padding:16px !important;
                border-radius:22px !important;
                background:radial-gradient(circle at top left,rgba(34,211,238,.14),transparent 35%),linear-gradient(135deg,rgba(2,6,23,.96),rgba(8,47,73,.78)) !important;
                border:1px solid rgba(56,189,248,.58) !important;
                box-shadow:0 18px 42px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08) !important;
                color:#e5e7eb !important;
                overflow:hidden !important;
                text-align:left !important;
            }
            #chess-public-tournaments-panel.prof17-tournament-panel .chess-public-tournaments-title {
                display:flex !important; align-items:center !important; justify-content:flex-start !important;
                gap:8px !important; color:#fde68a !important; font-size:1rem !important; font-weight:1000 !important;
                line-height:1.2 !important; margin:0 0 8px 0 !important; text-align:left !important;
            }
            #chess-public-tournaments-panel.prof17-tournament-panel .chess-public-tournaments-desc {
                box-sizing:border-box !important; max-width:none !important; margin:0 0 14px 0 !important;
                padding:9px 12px !important; border-radius:13px !important; background:rgba(15,23,42,.52) !important;
                border:1px solid rgba(148,163,184,.18) !important; border-left:4px solid #38bdf8 !important;
                color:#dbeafe !important; font-size:.78rem !important; line-height:1.35 !important; text-align:left !important;
            }
            #chess-public-tournaments-panel .chess-public-tournament-card-v17 {
                display:block !important;
                box-sizing:border-box !important;
                width:100% !important;
                max-width:620px !important;
                margin:12px auto 0 auto !important;
                padding:16px !important;
                border-radius:18px !important;
                background:linear-gradient(135deg,rgba(2,6,23,.98),rgba(12,74,110,.60)) !important;
                border:1px solid rgba(125,211,252,.42) !important;
                box-shadow:0 14px 32px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.08) !important;
                color:#e5e7eb !important;
                text-align:left !important;
                overflow:hidden !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-main { display:block !important; min-width:0 !important; }
            #chess-public-tournaments-panel .prof17-tournament-top {
                display:flex !important; align-items:center !important; gap:12px !important; margin-bottom:12px !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-icon {
                width:52px !important; height:52px !important; border-radius:50% !important; flex:0 0 auto !important;
                display:flex !important; align-items:center !important; justify-content:center !important; font-size:1.55rem !important;
                background:radial-gradient(circle,rgba(250,204,21,.26),rgba(15,23,42,.94)) !important;
                border:1px solid rgba(250,204,21,.44) !important;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 10px 18px rgba(0,0,0,.25) !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-name-row {
                display:flex !important; align-items:center !important; flex-wrap:wrap !important; gap:8px !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-name {
                color:#f8fafc !important; font-size:1.02rem !important; font-weight:1000 !important; line-height:1.15 !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-badge {
                background:rgba(22,163,74,.32) !important; color:#bbf7d0 !important;
                border:1px solid rgba(34,197,94,.60) !important; border-radius:999px !important;
                padding:4px 10px !important; font-size:.66rem !important; font-weight:1000 !important;
                text-transform:uppercase !important; line-height:1 !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-sub { color:#bfdbfe !important; font-size:.72rem !important; line-height:1.3 !important; margin-top:4px !important; }
            #chess-public-tournaments-panel .prof17-tournament-info {
                display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important;
                gap:8px !important; margin:0 0 12px 0 !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-info-box {
                background:rgba(15,23,42,.78) !important; border:1px solid rgba(148,163,184,.23) !important;
                border-radius:13px !important; padding:9px 8px !important; text-align:center !important;
                min-height:52px !important; box-sizing:border-box !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-info-label {
                color:#93c5fd !important; font-size:.56rem !important; font-weight:1000 !important;
                text-transform:uppercase !important; letter-spacing:.35px !important; margin-bottom:4px !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-info-value {
                color:#f8fafc !important; font-size:.76rem !important; font-weight:1000 !important; line-height:1.15 !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-message {
                background:rgba(2,6,23,.52) !important; border:1px solid rgba(34,211,238,.18) !important;
                border-radius:13px !important; padding:10px 12px !important; color:#dbeafe !important;
                font-size:.78rem !important; line-height:1.38 !important; margin:0 0 12px 0 !important;
                text-align:center !important; box-sizing:border-box !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-actions {
                display:grid !important; grid-template-columns:1fr 1fr !important; gap:12px !important; margin-top:2px !important;
            }
            #chess-public-tournaments-panel .prof17-tournament-actions button {
                width:100% !important; min-height:50px !important; padding:12px 14px !important; border-radius:14px !important;
                color:#fff !important; font-size:.78rem !important; font-weight:1000 !important; text-transform:uppercase !important;
                letter-spacing:.45px !important; display:flex !important; align-items:center !important; justify-content:center !important;
                gap:8px !important; margin:0 !important; border:1px solid rgba(255,255,255,.16) !important;
                box-shadow:0 10px 20px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.18) !important;
            }
            #chess-public-tournaments-panel .prof17-watch-btn { background:linear-gradient(135deg,#0ea5e9,#22d3ee) !important; }
            #chess-public-tournaments-panel .prof17-copy-btn { background:linear-gradient(135deg,#1e293b,#7c3aed) !important; }
            .chess-tournament-interest-panel {
                margin:14px auto 0 auto; max-width:620px; padding:14px; border-radius:18px;
                border:1px solid rgba(34,197,94,.38); background:linear-gradient(135deg,rgba(6,78,59,.55),rgba(15,23,42,.92));
                box-shadow:0 12px 26px rgba(0,0,0,.28); color:#e2e8f0;
            }
            .chess-tournament-interest-title { color:#bbf7d0; font-weight:1000; font-size:.94rem; margin-bottom:5px; }
            .chess-tournament-interest-desc { color:#dbeafe; font-size:.74rem; line-height:1.35; margin-bottom:10px; }
            .chess-tournament-interest-toggle { width:100%; min-height:44px; border-radius:13px; background:linear-gradient(135deg,#16a34a,#22c55e); color:white; font-weight:1000; }
            .chess-tournament-interest-form { display:none; margin-top:10px; grid-template-columns:1fr 1fr; gap:8px; }
            .chess-tournament-interest-form.open { display:grid; }
            .chess-tournament-interest-form input, .chess-tournament-interest-form select {
                width:100%; box-sizing:border-box; border-radius:10px; border:1px solid rgba(148,163,184,.25); background:#020617; color:#e2e8f0; padding:10px; font-family:inherit;
            }
            .chess-tournament-interest-form .full { grid-column:1 / -1; }
            .chess-tournament-interest-send { grid-column:1 / -1; min-height:43px; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#2563eb); color:#fff; font-weight:1000; }
            .chess-admin-interests-box { margin:12px 0; padding:12px; border:1px solid rgba(34,197,94,.45); border-radius:12px; background:linear-gradient(135deg,rgba(6,78,59,.45),rgba(15,23,42,.88)); }
            .chess-admin-interest-row { padding:9px; border-radius:10px; background:rgba(2,6,23,.66); border-left:4px solid #22c55e; margin-bottom:8px; color:#e2e8f0; }
            .chess-admin-interest-row.called { opacity:.78; border-left-color:#94a3b8; }
            .chess-admin-interest-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:7px; }
            .chess-admin-interest-actions button { width:auto !important; padding:7px 10px !important; border-radius:8px !important; font-size:.68rem !important; }
            @media (max-width:560px) {
                #chess-public-tournaments-panel.prof17-tournament-panel { padding:12px !important; border-radius:18px !important; }
                #chess-public-tournaments-panel .chess-public-tournament-card-v17 { padding:13px !important; border-radius:16px !important; }
                #chess-public-tournaments-panel .prof17-tournament-top { align-items:flex-start !important; }
                #chess-public-tournaments-panel .prof17-tournament-info { grid-template-columns:1fr !important; }
                #chess-public-tournaments-panel .prof17-tournament-actions { grid-template-columns:1fr !important; gap:10px !important; }
                .chess-tournament-interest-form { grid-template-columns:1fr; }
            }
            body.chess-board-visible #chess-public-tournaments-panel,
            body.chess-admin-only #chess-public-tournaments-panel { display:none !important; }
        `;
        document.head.appendChild(style);
    }

    function separarDataHoraTorneioXadrez(valor) {
        const bruto = formatarDataTorneioXadrez(valor);
        const partes = String(bruto || '').split(',').map(p => p.trim()).filter(Boolean);
        return {
            data: partes[0] || 'A definir',
            hora: partes[1] || 'A definir'
        };
    }

    function criarBlocoInfoProf17(label, valor) {
        const box = document.createElement('div');
        box.className = 'prof17-tournament-info-box';
        const lab = document.createElement('div');
        lab.className = 'prof17-tournament-info-label';
        lab.textContent = label;
        const val = document.createElement('div');
        val.className = 'prof17-tournament-info-value';
        val.textContent = valor || 'A definir';
        box.appendChild(lab);
        box.appendChild(val);
        return box;
    }

    function criarCardTorneioPublicoXadrez(torneio, id) {
        instalarEstiloProf17TorneiosXadrez();
        const card = document.createElement('div');
        card.className = 'chess-public-tournament-card-v17';
        card.style.setProperty('display', 'block', 'important');

        const nome = somenteTextoSeguro(torneio?.name || 'Torneio de Xadrez', 60);
        const sala = normalizarSalaXadrez(torneio?.room || '');
        const salaTxt = (sala || 'a definir').toUpperCase();
        const dh = separarDataHoraTorneioXadrez(torneio?.date);
        const mensagem = mensagemPublicaLimpaTorneioXadrez(torneio);

        const main = document.createElement('div');
        main.className = 'prof17-tournament-main';

        const top = document.createElement('div');
        top.className = 'prof17-tournament-top';
        const icon = document.createElement('div');
        icon.className = 'prof17-tournament-icon';
        icon.textContent = '🏆';
        const textBox = document.createElement('div');
        textBox.style.minWidth = '0';
        textBox.style.flex = '1';
        const row = document.createElement('div');
        row.className = 'prof17-tournament-name-row';
        const title = document.createElement('div');
        title.className = 'prof17-tournament-name';
        title.textContent = nome;
        const badge = document.createElement('div');
        badge.className = 'prof17-tournament-badge';
        badge.textContent = 'Aberto';
        row.appendChild(title);
        row.appendChild(badge);
        const sub = document.createElement('div');
        sub.className = 'prof17-tournament-sub';
        sub.textContent = 'Torneio oficial publicado pelo administrador';
        textBox.appendChild(row);
        textBox.appendChild(sub);
        top.appendChild(icon);
        top.appendChild(textBox);

        const info = document.createElement('div');
        info.className = 'prof17-tournament-info';
        info.appendChild(criarBlocoInfoProf17('📅 Data', dh.data));
        info.appendChild(criarBlocoInfoProf17('🕘 Horário', dh.hora));
        info.appendChild(criarBlocoInfoProf17('🏠 Sala', salaTxt));

        const msg = document.createElement('div');
        msg.className = 'prof17-tournament-message';
        msg.textContent = mensagem;

        const actions = document.createElement('div');
        actions.className = 'prof17-tournament-actions';
        const assistir = document.createElement('button');
        assistir.type = 'button';
        assistir.className = 'prof17-watch-btn';
        assistir.textContent = '👀 Assistir online';
        assistir.onclick = () => assistirTorneioPublicoXadrez(torneio);
        const copiar = document.createElement('button');
        copiar.type = 'button';
        copiar.className = 'prof17-copy-btn';
        copiar.textContent = '📋 Copiar convite';
        copiar.onclick = () => copiarLinkPublicoTorneioXadrez(torneio);
        actions.appendChild(assistir);
        actions.appendChild(copiar);

        main.appendChild(top);
        main.appendChild(info);
        main.appendChild(msg);
        main.appendChild(actions);
        card.appendChild(main);
        return card;
    }

    function manterTorneioPublicoSoNoMenuXadrezProf17() {
        const panel = document.getElementById('chess-public-tournaments-panel');
        if (!panel) return;
        if (document.body.classList.contains('chess-board-visible') || document.body.classList.contains('chess-admin-only')) {
            panel.style.setProperty('display', 'none', 'important');
            return;
        }
        if (panel.dataset.temTorneio === '1') panel.style.removeProperty('display');
    }

    function garantirFormularioInteresseTorneioXadrez(panel) {
        if (!panel || document.getElementById('chess-tournament-interest-panel')) return;
        const box = document.createElement('div');
        box.id = 'chess-tournament-interest-panel';
        box.className = 'chess-tournament-interest-panel';
        box.innerHTML = `
            <div class="chess-tournament-interest-title">➕ Quero participar de torneios</div>
            <div class="chess-tournament-interest-desc">Preencha seus dados para o administrador chamar você quando montar os próximos torneios de Xadrez.</div>
            <button id="chess-tournament-interest-toggle" class="chess-tournament-interest-toggle" type="button">Fazer inscrição</button>
            <div id="chess-tournament-interest-form" class="chess-tournament-interest-form">
                <input id="chess-interest-name" type="text" maxlength="40" placeholder="Seu nome">
                <input id="chess-interest-whatsapp" type="tel" maxlength="22" placeholder="WhatsApp">
                <select id="chess-interest-level" class="full">
                    <option value="facil">Nível fácil</option>
                    <option value="medio">Nível médio</option>
                    <option value="avancado">Nível avançado</option>
                </select>
                <button id="chess-interest-send" class="chess-tournament-interest-send" type="button">Enviar inscrição</button>
            </div>
        `;
        panel.appendChild(box);
        document.getElementById('chess-tournament-interest-toggle')?.addEventListener('click', () => {
            const form = document.getElementById('chess-tournament-interest-form');
            form?.classList.toggle('open');
        });
        document.getElementById('chess-interest-send')?.addEventListener('click', enviarInteresseTorneioXadrez);
    }

    async function enviarInteresseTorneioXadrez() {
        try {
            const nome = nomeSeguro(document.getElementById('chess-interest-name')?.value || '');
            const whatsapp = telefoneSeguro(document.getElementById('chess-interest-whatsapp')?.value || '');
            const nivel = somenteTextoSeguro(document.getElementById('chess-interest-level')?.value || 'medio', 20);
            if (!nome || nome.length < 2) {
                exibirAlertaDoSistema('Inscrição', 'Digite seu nome para participar dos torneios.');
                return;
            }
            if (!whatsapp || whatsapp.length < 8) {
                exibirAlertaDoSistema('Inscrição', 'Digite um WhatsApp válido para o administrador chamar você.');
                return;
            }
            const novo = push(ref(db, 'chessTournamentInterests'));
            await set(novo, {
                game: 'xadrez',
                name: nome,
                whatsapp,
                level: nivel,
                status: 'novo',
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            document.getElementById('chess-interest-name').value = '';
            document.getElementById('chess-interest-whatsapp').value = '';
            const form = document.getElementById('chess-tournament-interest-form');
            form?.classList.remove('open');
            exibirAlertaDoSistema('Inscrição enviada ✅', 'Seu interesse em participar de torneios foi enviado ao administrador.');
        } catch (e) {
            console.warn('Erro ao enviar interesse de torneio:', e);
            exibirAlertaDoSistema('Inscrição', 'Não foi possível enviar agora. Tente novamente.');
        }
    }

    function nivelInteresseTorneioLabel(nivel) {
        const n = String(nivel || 'medio').toLowerCase();
        if (n === 'facil') return 'Fácil';
        if (n === 'avancado') return 'Avançado';
        return 'Médio';
    }

    function garantirPainelInteressesAdminXadrez() {
        const tournamentBox = document.querySelector('.chess-admin-tournament-box');
        if (!tournamentBox || document.getElementById('chess-admin-interests-box')) return;
        const box = document.createElement('div');
        box.id = 'chess-admin-interests-box';
        box.className = 'chess-admin-interests-box';
        box.innerHTML = `
            <div class="chess-admin-tournament-title">📝 Interessados em torneios</div>
            <div class="chess-admin-desc">Pessoas que preencheram nome, WhatsApp e nível para participar dos próximos torneios de Xadrez.</div>
            <div id="chess-admin-interests-list" class="chess-admin-tournament-list"><div style="color:#94a3b8;font-style:italic;">Nenhum interessado carregado ainda.</div></div>
        `;
        tournamentBox.insertAdjacentElement('afterend', box);
    }

    let chessTournamentInterestsUnsubscribe = null;
    function carregarInteressesTorneioXadrezAdmin(forcar = false) {
        garantirPainelInteressesAdminXadrez();
        const list = document.getElementById('chess-admin-interests-list');
        if (!list) return;
        if (chessTournamentInterestsUnsubscribe) {
            if (!forcar) return;
            try { chessTournamentInterestsUnsubscribe(); } catch (_) {}
            chessTournamentInterestsUnsubscribe = null;
        }
        chessTournamentInterestsUnsubscribe = onValue(ref(db, 'chessTournamentInterests'), (snapshot) => {
            limparElemento(list);
            const data = snapshot.val() || {};
            const itens = Object.entries(data)
                .map(([id, item]) => [id, item || {}])
                .sort((a, b) => numeroSeguro(b[1].createdAt) - numeroSeguro(a[1].createdAt))
                .slice(0, 60);
            if (!itens.length) {
                list.appendChild(criarTexto('div', 'Nenhum interessado em torneio ainda.', 'tiny-muted'));
                return;
            }
            itens.forEach(([id, item]) => {
                const row = document.createElement('div');
                row.className = 'chess-admin-interest-row' + (item.status === 'chamado' ? ' called' : '');
                const nome = nomeSeguro(item.name || 'Jogador');
                const zap = telefoneSeguro(item.whatsapp || '');
                const nivel = nivelInteresseTorneioLabel(item.level);
                const dataTxt = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'sem data';
                row.innerHTML = `
                    <strong style="color:#bbf7d0;display:block;margin-bottom:3px;">${escapeHtmlXadrez(nome)}</strong>
                    <div style="font-size:.74rem;color:#dbeafe;line-height:1.35;">📲 ${escapeHtmlXadrez(zap)} • Nível: ${escapeHtmlXadrez(nivel)} • ${escapeHtmlXadrez(dataTxt)}</div>
                    <div style="font-size:.70rem;color:#94a3b8;margin-top:2px;">Status: ${item.status === 'chamado' ? 'chamado' : 'novo'}</div>
                `;
                const actions = document.createElement('div');
                actions.className = 'chess-admin-interest-actions';
                const copiar = document.createElement('button');
                copiar.type = 'button';
                copiar.style.background = '#22c55e';
                copiar.textContent = 'Copiar WhatsApp';
                copiar.onclick = async () => {
                    try { await navigator.clipboard.writeText(zap); mostrarToastXadrez('📋 WhatsApp copiado.'); }
                    catch (_) { exibirAlertaDoSistema('WhatsApp', zap); }
                };
                const chamar = document.createElement('button');
                chamar.type = 'button';
                chamar.style.background = '#2563eb';
                chamar.textContent = 'Marcar chamado';
                chamar.onclick = async () => {
                    if (!(await exigirAdminSeguro())) return;
                    await update(ref(db, `chessTournamentInterests/${id}`), { status: 'chamado', calledAt: Date.now(), updatedAt: Date.now() });
                };
                const excluir = document.createElement('button');
                excluir.type = 'button';
                excluir.style.background = '#991b1b';
                excluir.textContent = 'Excluir';
                excluir.onclick = async () => {
                    if (!(await exigirAdminSeguro())) return;
                    const ok = window.confirm(`Excluir o interessado "${nome}"?`);
                    if (!ok) return;
                    await remove(ref(db, `chessTournamentInterests/${id}`));
                    mostrarToastXadrez('🗑️ Interessado removido.');
                };
                actions.appendChild(copiar);
                actions.appendChild(chamar);
                actions.appendChild(excluir);
                row.appendChild(actions);
                list.appendChild(row);
            });
        });
    }

    const oldGarantirPainelPublicoTorneiosXadrezProf17 = typeof garantirPainelPublicoTorneiosXadrez === 'function' ? garantirPainelPublicoTorneiosXadrez : null;
    if (oldGarantirPainelPublicoTorneiosXadrezProf17) {
        garantirPainelPublicoTorneiosXadrez = function garantirPainelPublicoTorneiosXadrezProf17() {
            instalarEstiloProf17TorneiosXadrez();
            const panel = oldGarantirPainelPublicoTorneiosXadrezProf17.apply(this, arguments);
            if (panel) {
                panel.classList.add('prof17-tournament-panel');
                garantirFormularioInteresseTorneioXadrez(panel);
                manterTorneioPublicoSoNoMenuXadrezProf17();
            }
            return panel;
        };
    }

    const oldCarregarTorneiosPublicosXadrezProf17 = typeof carregarTorneiosPublicosXadrez === 'function' ? carregarTorneiosPublicosXadrez : null;
    if (oldCarregarTorneiosPublicosXadrezProf17) {
        carregarTorneiosPublicosXadrez = function carregarTorneiosPublicosXadrezProf17(forcar = false) {
            instalarEstiloProf17TorneiosXadrez();
            oldCarregarTorneiosPublicosXadrezProf17.call(this, forcar);
            const panel = document.getElementById('chess-public-tournaments-panel');
            if (panel) {
                panel.classList.add('prof17-tournament-panel');
                garantirFormularioInteresseTorneioXadrez(panel);
            }
            setTimeout(manterTorneioPublicoSoNoMenuXadrezProf17, 30);
        };
    }

    const oldMostrarTabuleiroXadrezAposEscolhaProf17 = typeof mostrarTabuleiroXadrezAposEscolha === 'function' ? mostrarTabuleiroXadrezAposEscolha : null;
    if (oldMostrarTabuleiroXadrezAposEscolhaProf17) {
        mostrarTabuleiroXadrezAposEscolha = function mostrarTabuleiroXadrezAposEscolhaProf17() {
            const ret = oldMostrarTabuleiroXadrezAposEscolhaProf17.apply(this, arguments);
            setTimeout(manterTorneioPublicoSoNoMenuXadrezProf17, 0);
            setTimeout(manterTorneioPublicoSoNoMenuXadrezProf17, 180);
            return ret;
        };
    }

    const oldOcultarTabuleiroXadrezParaMenuProf17 = typeof ocultarTabuleiroXadrezParaMenu === 'function' ? ocultarTabuleiroXadrezParaMenu : null;
    if (oldOcultarTabuleiroXadrezParaMenuProf17) {
        ocultarTabuleiroXadrezParaMenu = function ocultarTabuleiroXadrezParaMenuProf17() {
            const ret = oldOcultarTabuleiroXadrezParaMenuProf17.apply(this, arguments);
            setTimeout(() => {
                carregarTorneiosPublicosXadrez(true);
                manterTorneioPublicoSoNoMenuXadrezProf17();
            }, 80);
            return ret;
        };
    }

    const oldInstalarPainelAdminXadrezProf17 = typeof instalarPainelAdminXadrez === 'function' ? instalarPainelAdminXadrez : null;
    if (oldInstalarPainelAdminXadrezProf17) {
        instalarPainelAdminXadrez = function instalarPainelAdminXadrezProf17() {
            const ret = oldInstalarPainelAdminXadrezProf17.apply(this, arguments);
            instalarEstiloProf17TorneiosXadrez();
            garantirPainelInteressesAdminXadrez();
            carregarInteressesTorneioXadrezAdmin(true);
            return ret;
        };
    }

    const oldAbrirAdminXadrezCentralProf17 = typeof abrirAdminXadrezCentral === 'function' ? abrirAdminXadrezCentral : null;
    if (oldAbrirAdminXadrezCentralProf17) {
        abrirAdminXadrezCentral = async function abrirAdminXadrezCentralProf17() {
            const ret = await oldAbrirAdminXadrezCentralProf17.apply(this, arguments);
            setTimeout(() => {
                garantirPainelInteressesAdminXadrez();
                carregarInteressesTorneioXadrezAdmin(true);
            }, 80);
            return ret;
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            instalarEstiloProf17TorneiosXadrez();
            manterTorneioPublicoSoNoMenuXadrezProf17();
        }, 500);
    });

    // ✅ PROFISSIONAL 17.1 — substitui o carregamento público para não esconder a inscrição quando não houver torneio aberto.
    carregarTorneiosPublicosXadrez = function carregarTorneiosPublicosXadrezProf17Seguro(forcar = false) {
        instalarEstiloProf17TorneiosXadrez();
        const panel = garantirPainelPublicoTorneiosXadrez();
        const list = document.getElementById('chess-public-tournaments-list');
        if (!panel || !list) return;
        panel.classList.add('prof17-tournament-panel');
        garantirFormularioInteresseTorneioXadrez(panel);
        if (chessTournamentsPublicUnsubscribe) {
            if (!forcar) {
                manterTorneioPublicoSoNoMenuXadrezProf17();
                return;
            }
            try { chessTournamentsPublicUnsubscribe(); } catch (_) {}
            chessTournamentsPublicUnsubscribe = null;
        }
        chessTournamentsPublicUnsubscribe = onValue(ref(db, 'chessTournaments'), (snapshot) => {
            limparElemento(list);
            const data = snapshot.val() || {};
            const itens = Object.entries(data)
                .map(([id, t]) => [id, t || {}])
                .filter(([, t]) => String(t.status || 'aberto') !== 'encerrado')
                .sort((a, b) => numeroSeguro(a[1].date ? new Date(a[1].date).getTime() : a[1].createdAt) - numeroSeguro(b[1].date ? new Date(b[1].date).getTime() : b[1].createdAt))
                .slice(0, 5);
            if (!itens.length) {
                panel.dataset.temTorneio = '0';
                list.appendChild(criarTexto('div', 'Nenhum torneio de Xadrez publicado no momento. Você ainda pode deixar seu nome para participar dos próximos.', 'tiny-muted'));
            } else {
                panel.dataset.temTorneio = '1';
                itens.forEach(([id, t]) => list.appendChild(criarCardTorneioPublicoXadrez(t, id)));
            }
            // O painel pode aparecer no menu mesmo sem torneio para mostrar o botão de inscrição.
            if (document.body.classList.contains('chess-board-visible') || document.body.classList.contains('chess-admin-only')) {
                panel.style.setProperty('display', 'none', 'important');
            } else {
                panel.style.removeProperty('display');
            }
        });
    };


    /* =====================================================================
       ✅ PROFISSIONAL 21 — PROFESSOR INTELIGENTE NA DAMAS
       Baseado no modo Professor do Xadrez: ativa com # no nome (#Isiquel ou Isiquel#),
       aparece apenas no aparelho do professor e usa as regras/movimentos da Damas.
       Não mexe no Firebase da partida, não joga sozinho, não reinicia sala e não altera o aluno.
    ===================================================================== */
    function instalarProfessorInteligenteDamas21() {
        let damasProfessorAtivo21 = false;
        let damasProfessorTexto21 = '';
        let damasProfessorRecolhido21 = false;
        let damasProfessorUltimaDica21 = null;
        let damasProfessorPedidoCapturado21 = false;

        instalarCssProfessorDamas21();
        garantirPainelProfessorDamas21();

        function detectarProfessorDamas21(nome) {
            const n = String(nome || '').trim();
            return damasProfessorPedidoCapturado21 || /^#/.test(n) || /#$/.test(n);
        }

        function limparNomeProfessorDamas21(nome) {
            const limpo = String(nome || '')
                .replace(/^#+/, '')
                .replace(/#+$/, '')
                .replace(/\s+/g, ' ')
                .trim();
            return nomeSeguro(limpo || 'Professor');
        }

        function professorDamasPodeAparecer21() {
            const boardWrapper = document.getElementById('normal-board-wrapper');
            const telaJogoVisivel = !!(
                gameScreen &&
                gameScreen.style.display !== 'none' &&
                (!boardWrapper || boardWrapper.offsetParent !== null || boardWrapper.style.display !== 'none')
            );
            const papelValido = isPracticeMode || playerRole === 'p1' || playerRole === 'p2';
            return !!(
                damasProfessorAtivo21 &&
                currentGameState &&
                currentGameState.board &&
                telaJogoVisivel &&
                papelValido
            );
        }

        function ladoProfessorDamas21() {
            if (playerRole === 'p2') return 2;
            return 1;
        }

        function nomeLadoDamas21(lado) {
            return lado === 2 ? 'pretas' : 'vermelhas';
        }

        function nomePecaDamas21(peca) {
            if (peca === 2 || peca === 4) return 'Dama';
            return 'Peça comum';
        }

        function coordenadaDamas21(r, c) {
            const letras = 'ABCDEFGH';
            return `${letras[c] || '?'}${8 - r}`;
        }

        function movimentoCoordDamas21(move) {
            if (!move) return '—';
            return `${coordenadaDamas21(move.fromR, move.fromC)} → ${coordenadaDamas21(move.toR, move.toC)}`;
        }

        function valorPecaDamas21(peca) {
            if (peca === 2 || peca === 4) return 320;
            if (peca) return 115;
            return 0;
        }

        function cloneBoardDamas21(board) {
            return (board || []).map(row => Array.isArray(row) ? row.slice() : []);
        }

        function instalarCssProfessorDamas21() {
            if (document.getElementById('professor-damas-21-style')) return;
            const style = document.createElement('style');
            style.id = 'professor-damas-21-style';
            style.textContent = `
                #damas-teacher-private-panel {
                    display: none;
                    width: min(760px, calc(100% - 18px));
                    margin: 10px auto 12px auto;
                    border-radius: 18px;
                    border: 1px solid rgba(34, 197, 94, .55);
                    background: linear-gradient(180deg, rgba(4, 24, 30, .96), rgba(6, 18, 26, .98));
                    box-shadow: 0 16px 34px rgba(0, 0, 0, .38), 0 0 20px rgba(34, 197, 94, .13);
                    color: #e5f6ef;
                    overflow: hidden;
                    position: relative;
                    z-index: 5;
                }
                #damas-teacher-private-panel.teacher-visible { display: block; }
                #damas-teacher-private-panel .damas-teacher-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 12px 14px;
                    border-bottom: 1px solid rgba(148, 163, 184, .22);
                    background: rgba(15, 118, 110, .18);
                }
                #damas-teacher-private-panel .damas-teacher-title {
                    font-weight: 900;
                    font-size: .96rem;
                    letter-spacing: .02em;
                    color: #d1fae5;
                }
                #damas-teacher-private-panel .damas-teacher-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px 8px;
                    border-radius: 999px;
                    background: rgba(34, 197, 94, .16);
                    border: 1px solid rgba(34, 197, 94, .32);
                    color: #86efac;
                    font-size: .68rem;
                    margin-left: 5px;
                    text-transform: uppercase;
                }
                #damas-teacher-private-panel .damas-teacher-actions {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                #damas-teacher-private-panel .damas-teacher-btn {
                    width: auto;
                    min-width: 38px;
                    padding: 7px 10px;
                    margin: 0;
                    border: 0;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: .76rem;
                    font-weight: 900;
                    color: #052e2b;
                    background: linear-gradient(135deg, #86efac, #22c55e);
                    box-shadow: none;
                }
                #damas-teacher-private-panel .damas-teacher-btn.secondary {
                    color: #e5f6ef;
                    background: rgba(15, 23, 42, .82);
                    border: 1px solid rgba(148, 163, 184, .30);
                }
                #damas-teacher-private-panel .damas-teacher-body {
                    padding: 12px 14px 14px 14px;
                    font-size: .86rem;
                    line-height: 1.45;
                    color: #dbeafe;
                }
                #damas-teacher-private-panel .damas-teacher-body strong { color: #fef3c7; }
                #damas-teacher-private-panel .damas-teacher-muted { color: #9ca3af; font-size: .78rem; }
                #damas-teacher-private-panel .damas-teacher-section-title {
                    display: block;
                    color: #86efac;
                    text-transform: uppercase;
                    font-size: .70rem;
                    letter-spacing: .08em;
                    font-weight: 900;
                    margin: 8px 0 5px 0;
                }
                #damas-teacher-private-panel .damas-teacher-tip {
                    padding: 8px 9px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, .18);
                    background: rgba(2, 6, 23, .28);
                    margin-top: 6px;
                }
                #damas-teacher-private-panel .damas-teacher-tip.best {
                    border-color: rgba(34, 197, 94, .42);
                    background: rgba(20, 83, 45, .20);
                }
                #damas-teacher-private-panel.teacher-collapsed .damas-teacher-body { display: none; }
                body.damas-professor-ativo-21 #damas-teacher-private-panel.teacher-visible { display: block !important; }
                body.damas-professor-ativo-21 #damas-teacher-private-panel { visibility: visible !important; opacity: 1 !important; }
                .square.teacher-damas-from { outline: 3px solid rgba(34,197,94,.98); outline-offset: -4px; box-shadow: inset 0 0 20px rgba(34,197,94,.30); }
                .square.teacher-damas-to { outline: 3px solid rgba(250,204,21,.98); outline-offset: -4px; box-shadow: inset 0 0 24px rgba(250,204,21,.32); }
                .square.teacher-damas-danger { outline: 3px solid rgba(239,68,68,.96); outline-offset: -4px; box-shadow: inset 0 0 24px rgba(239,68,68,.32); }
                @media (max-width: 620px) {
                    #damas-teacher-private-panel { width: calc(100% - 8px); border-radius: 14px; margin-top: 8px; }
                    #damas-teacher-private-panel .damas-teacher-head { padding: 10px; align-items: flex-start; }
                    #damas-teacher-private-panel .damas-teacher-title { font-size: .87rem; }
                    #damas-teacher-private-panel .damas-teacher-actions { gap: 5px; }
                    #damas-teacher-private-panel .damas-teacher-btn { padding: 6px 8px; font-size: .70rem; }
                    #damas-teacher-private-panel .damas-teacher-body { padding: 10px; font-size: .80rem; }
                }
            `;
            document.head.appendChild(style);
        }

        function garantirPainelProfessorDamas21() {
            let panel = document.getElementById('damas-teacher-private-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'damas-teacher-private-panel';
                panel.innerHTML = `
                    <div class="damas-teacher-head">
                        <div class="damas-teacher-title">🎓 Professor inteligente de Damas <span class="damas-teacher-badge">privado</span></div>
                        <div class="damas-teacher-actions">
                            <button id="damas-teacher-analyze-btn" type="button" class="damas-teacher-btn">Analisar posição</button>
                            <button id="damas-teacher-collapse-btn" type="button" class="damas-teacher-btn secondary">−</button>
                        </div>
                    </div>
                    <div id="damas-teacher-private-content" class="damas-teacher-body"></div>
                `;
                const boardWrapper = document.getElementById('normal-board-wrapper');
                if (boardWrapper && boardWrapper.parentNode) {
                    boardWrapper.insertAdjacentElement('beforebegin', panel);
                } else if (gameScreen) {
                    gameScreen.appendChild(panel);
                }
                const collapse = panel.querySelector('#damas-teacher-collapse-btn');
                const analyze = panel.querySelector('#damas-teacher-analyze-btn');
                if (collapse) collapse.addEventListener('click', () => {
                    damasProfessorRecolhido21 = !damasProfessorRecolhido21;
                    panel.classList.toggle('teacher-collapsed', damasProfessorRecolhido21);
                    collapse.textContent = damasProfessorRecolhido21 ? '+' : '−';
                });
                if (analyze) analyze.addEventListener('click', () => {
                    atualizarProfessorDamas21(criarAnalisePosicaoDamas21());
                    aplicarMarcacoesProfessorDamas21();
                });
            }
            const podeVerAgora = professorDamasPodeAparecer21();
            panel.classList.toggle('teacher-visible', podeVerAgora);
            document.body.classList.toggle('damas-professor-ativo-21', podeVerAgora);
            panel.classList.toggle('teacher-collapsed', damasProfessorRecolhido21);
            const btn = panel.querySelector('#damas-teacher-collapse-btn');
            if (btn) btn.textContent = damasProfessorRecolhido21 ? '+' : '−';
            return panel;
        }

        function atualizarProfessorDamas21(texto = '') {
            const panel = garantirPainelProfessorDamas21();
            const body = document.getElementById('damas-teacher-private-content');
            if (!body) return;
            if (texto) damasProfessorTexto21 = texto;
            if (!damasProfessorTexto21) {
                damasProfessorTexto21 = currentGameState?.turn === ladoProfessorDamas21()
                    ? 'Professor inteligente de Damas ligado. Toque numa peça ou clique em Analisar posição para receber dicas de aula neste aparelho.'
                    : 'Professor inteligente de Damas ligado. Observe a jogada do aluno e use o painel para explicar ataque, defesa, captura obrigatória e coroação.';
            }
            body.innerHTML = damasProfessorTexto21;
            const podeVerAgora = professorDamasPodeAparecer21();
            panel.classList.toggle('teacher-visible', podeVerAgora);
            document.body.classList.toggle('damas-professor-ativo-21', podeVerAgora);
        }

        function adversarioTemCapturaDamas21(board, lado) {
            const adv = lado === 1 ? 2 : 1;
            return computeAllValidMovesEngine(adv, board, null).filter(m => m.capture).length > 0;
        }

        function movimentoGeraCapturaObrigatoriaDamas21(applied, lado, move) {
            if (!move.capture) return false;
            const novas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
            return novas.length > 0;
        }

        function pontuarMovimentoProfessorDamas21(board, move, lado) {
            const pecaAntes = board?.[move.fromR]?.[move.fromC] || 0;
            const applied = aplicarMovimentoEngine(board, move);
            let nextTurn = lado === 1 ? 2 : 1;
            let nextForced = null;
            if (move.capture) {
                const novas = computeValidMovesForPieceEngine(applied.toR, applied.toC, applied.board, true);
                if (novas.length > 0) {
                    nextTurn = lado;
                    nextForced = { r: applied.toR, c: applied.toC };
                }
            }

            let score = lado === 2
                ? minimaxRobo(applied.board, 3, nextTurn, -Infinity, Infinity, nextForced)
                : -minimaxRobo(applied.board, 3, nextTurn, -Infinity, Infinity, nextForced);

            const razoes = [];
            if (move.capture) {
                const capturada = board?.[move.capture.r]?.[move.capture.c] || 0;
                score += 120 + valorPecaDamas21(capturada) * 0.25;
                razoes.push(capturada === 2 || capturada === 4 ? 'captura uma dama adversária' : 'cumpre a captura obrigatória');
            }
            if ((pecaAntes === 1 && move.toR === 0) || (pecaAntes === 3 && move.toR === 7)) {
                score += 240;
                razoes.push('coroa e vira dama');
            }
            if (movimentoGeraCapturaObrigatoriaDamas21(applied, lado, move)) {
                score += 160;
                razoes.push('mantém sequência de captura');
            }
            if (move.toC >= 2 && move.toC <= 5 && move.toR >= 2 && move.toR <= 5) {
                score += 28;
                razoes.push('ganha controle central');
            }
            if (move.toC === 0 || move.toC === 7) {
                score += 12;
                razoes.push('usa a lateral para reduzir ataques por um lado');
            }
            if (!adversarioTemCapturaDamas21(applied.board, lado)) {
                score += 45;
                razoes.push('não entrega captura imediata fácil');
            } else {
                score -= 55;
                razoes.push('atenção: pode permitir resposta com captura');
            }

            if (!razoes.length) razoes.push('melhora a posição e mantém opções');
            return { move, score, razoes, applied };
        }

        function melhoresMovimentosProfessorDamas21(lado, board = currentGameState?.board, filtroPeca = null, limite = 3) {
            if (!board) return [];
            let forced = null;
            if (lockPieceForMultiCapture && currentGameState?.turn === lado) forced = lockPieceForMultiCapture;
            let movimentos = computeAllValidMovesEngine(lado, board, forced);
            if (filtroPeca) movimentos = movimentos.filter(m => m.fromR === filtroPeca.r && m.fromC === filtroPeca.c);
            if (!movimentos.length) return [];
            return movimentos
                .map(m => pontuarMovimentoProfessorDamas21(board, m, lado))
                .sort((a, b) => b.score - a.score)
                .slice(0, limite);
        }

        function renderSugestoesProfessorDamas21(lista, titulo = 'Dicas fortes da posição') {
            if (!lista || !lista.length) {
                return '<span class="damas-teacher-section-title">Dicas da posição</span><span class="damas-teacher-muted">Não encontrei uma jogada forte agora. Use a posição para ensinar proteção, avanço seguro e captura obrigatória.</span>';
            }
            return `
                <span class="damas-teacher-section-title">${titulo}</span>
                ${lista.map((item, idx) => `
                    <div class="damas-teacher-tip ${idx === 0 ? 'best' : ''}">
                        <strong>${idx === 0 ? 'Melhor dica' : 'Outra ideia'}:</strong> ${movimentoCoordDamas21(item.move)}<br>
                        <span class="damas-teacher-muted">Por quê: ${item.razoes.join('; ')}.</span>
                    </div>
                `).join('')}
            `;
        }

        function criarAnalisePosicaoDamas21() {
            if (!currentGameState?.board) return 'Sem tabuleiro carregado para analisar.';
            const lado = ladoProfessorDamas21();
            const vez = currentGameState.turn === lado ? 'sua vez de jogar' : 'vez do aluno/oponente';
            const lista = melhoresMovimentosProfessorDamas21(lado, currentGameState.board, null, 3);
            damasProfessorUltimaDica21 = lista[0]?.move ? { move: lista[0].move, danger: null } : null;
            return `
                <strong>🎯 Análise das ${nomeLadoDamas21(lado)}:</strong> ${vez}.<br>
                <span class="damas-teacher-muted">Use estas ideias para explicar por áudio: captura obrigatória, segurança, coroação e controle das diagonais.</span>
                ${renderSugestoesProfessorDamas21(lista, 'Melhores dicas da posição')}
            `;
        }

        function criarDicaPecaDamas21(r, c) {
            if (!currentGameState?.board) return '';
            const board = currentGameState.board;
            const peca = board?.[r]?.[c] || 0;
            if (!peca) return '';
            const dono = donoDaPecaEngine(peca);
            const lado = ladoProfessorDamas21();
            const movimentosDaPeca = computeValidMovesForPieceEngine(r, c, board, false);
            const capturas = movimentosDaPeca.filter(m => m.capture);
            const casas = movimentosDaPeca.slice(0, 8).map(movimentoCoordDamas21).join(', ') || 'sem movimento seguro agora';

            if (dono !== lado) {
                const ameacas = melhoresMovimentosProfessorDamas21(dono, board, { r, c }, 2);
                damasProfessorUltimaDica21 = ameacas[0]?.move ? { move: ameacas[0].move, danger: { r, c } } : { move: null, danger: { r, c } };
                return `
                    <strong>👀 Peça do aluno/oponente em ${coordenadaDamas21(r, c)}.</strong><br>
                    <span class="damas-teacher-muted">Ela tem ${movimentosDaPeca.length} movimento(s) e ${capturas.length} captura(s). Use isso para explicar ameaça e defesa.</span><br>
                    ${renderSugestoesProfessorDamas21(ameacas, 'O que essa peça pode ameaçar')}
                `;
            }

            let forced = null;
            if (lockPieceForMultiCapture && currentGameState?.turn === lado) forced = lockPieceForMultiCapture;
            let movimentos = forced ? computeValidMovesForPieceEngine(r, c, board, true) : movimentosDaPeca;
            const existeCapturaObrigatoria = computeAllValidMovesEngine(dono, board, forced).some(m => m.capture);
            if (existeCapturaObrigatoria) movimentos = movimentos.filter(m => m.capture);
            const sugestoes = melhoresMovimentosProfessorDamas21(lado, board, { r, c }, 3);
            damasProfessorUltimaDica21 = sugestoes[0]?.move ? { move: sugestoes[0].move, danger: null } : null;

            return `
                <strong>${nomePecaDamas21(peca)} das ${nomeLadoDamas21(lado)}</strong> em <strong>${coordenadaDamas21(r, c)}</strong>.<br>
                <strong>Casas possíveis:</strong> ${movimentos.length} movimento(s), ${movimentos.filter(m => m.capture).length} captura(s).<br>
                <span class="damas-teacher-muted">${casas}</span><br>
                ${existeCapturaObrigatoria ? '<div class="damas-teacher-tip best"><strong>Regra importante:</strong> existe captura obrigatória. Ensine o aluno que, na Damas, quando dá para capturar, a tomada deve ser feita.</div>' : ''}
                ${renderSugestoesProfessorDamas21(sugestoes, 'Melhores dicas dessa peça')}
            `;
        }

        function mensagemAposJogadaDamas21(pecaAntes, move) {
            if (!pecaAntes || !move) return criarAnalisePosicaoDamas21();
            const partes = [];
            partes.push(`<strong>✅ Jogada feita:</strong> ${movimentoCoordDamas21(move)}.`);
            if (move.capture) partes.push('Explique que a captura era o caminho principal porque ganha material e, em muitos casos, é obrigatória.');
            if ((pecaAntes === 1 && move.toR === 0) || (pecaAntes === 3 && move.toR === 7)) partes.push('Essa jogada coroou a peça. Agora ela virou dama e controla diagonais longas.');
            if (currentGameState?.turn !== ladoProfessorDamas21()) partes.push('Agora observe a resposta do aluno e procure mostrar se ele deixou captura, defesa ou caminho para coroação.');
            return `${partes.join('<br>')}<br>${renderSugestoesProfessorDamas21(melhoresMovimentosProfessorDamas21(ladoProfessorDamas21(), currentGameState?.board, null, 2), 'Próximas ideias para explicar')}`;
        }

        function aplicarMarcacoesProfessorDamas21() {
            if (!professorDamasPodeAparecer21()) return;
            const info = damasProfessorUltimaDica21;
            if (!info) return;
            const mark = (sel, cls) => {
                const el = boardEl?.querySelector(sel);
                if (el) el.classList.add(cls);
            };
            if (info.move) {
                mark(`[data-row="${info.move.fromR}"][data-col="${info.move.fromC}"]`, 'teacher-damas-from');
                mark(`[data-row="${info.move.toR}"][data-col="${info.move.toC}"]`, 'teacher-damas-to');
                if (info.move.capture) mark(`[data-row="${info.move.capture.r}"][data-col="${info.move.capture.c}"]`, 'teacher-damas-danger');
            }
            if (info.danger) mark(`[data-row="${info.danger.r}"][data-col="${info.danger.c}"]`, 'teacher-damas-danger');
        }


        function prepararAtivacaoProfessorDamas21() {
            const raw = String(nameInput?.value || '').trim();
            const pedido = /^#/.test(raw) || /#$/.test(raw);
            damasProfessorPedidoCapturado21 = pedido;
            try { sessionStorage.setItem('damas_professor_privado_ativo_21', pedido ? '1' : '0'); } catch (_) {}
            if (pedido && nameInput) {
                const limpo = limparNomeProfessorDamas21(raw);
                nameInput.value = limpo;
                try { localStorage.setItem('damas_nome_jogador', limpo); } catch (_) {}
            }
            return pedido;
        }

        if (joinBtn) {
            joinBtn.addEventListener('click', prepararAtivacaoProfessorDamas21, true);
        }
        [btnChooseEasy, btnChooseMedium, btnChooseHard, btnChooseLearn].filter(Boolean).forEach((btn) => {
            btn.addEventListener('click', () => {
                prepararAtivacaoProfessorDamas21();
                damasProfessorAtivo21 = damasProfessorPedidoCapturado21;
                setTimeout(() => {
                    garantirPainelProfessorDamas21();
                    atualizarProfessorDamas21(damasProfessorAtivo21 ? 'Professor inteligente de Damas ligado no treino. Toque numa peça ou clique em Analisar posição para receber dicas deste aparelho.' : '');
                }, 350);
            }, true);
        });

        const joinRoomOriginalDamas21 = joinRoom;
        joinRoom = async function joinRoomProfessorDamas21(roomName, playerName, forceSpectator) {
            const rawName = String(playerName || nameInput?.value || '').trim();
            const solicitado = detectarProfessorDamas21(rawName);
            damasProfessorAtivo21 = !!(solicitado && !forceSpectator);
            damasProfessorTexto21 = '';
            damasProfessorUltimaDica21 = null;
            const nomeLimpo = solicitado ? limparNomeProfessorDamas21(rawName || nameInput?.value) : playerName;
            if (solicitado && nameInput) nameInput.value = nomeLimpo;
            const resp = await joinRoomOriginalDamas21.call(this, roomName, nomeLimpo, forceSpectator);
            damasProfessorAtivo21 = !!(solicitado && !forceSpectator && (playerRole === 'p1' || playerRole === 'p2' || isPracticeMode));
            garantirPainelProfessorDamas21();
            atualizarProfessorDamas21(damasProfessorAtivo21
                ? 'Professor inteligente de Damas ligado. Toque numa peça ou clique em Analisar posição para receber dicas neste aparelho.'
                : '');
            aplicarMarcacoesProfessorDamas21();
            return resp;
        };

        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => {
                setTimeout(() => {
                    damasProfessorAtivo21 = false;
                    damasProfessorPedidoCapturado21 = false;
                    damasProfessorTexto21 = '';
                    damasProfessorUltimaDica21 = null;
                    try { sessionStorage.setItem('damas_professor_privado_ativo_21', '0'); } catch (_) {}
                    document.body.classList.remove('damas-professor-ativo-21');
                    garantirPainelProfessorDamas21();
                }, 120);
            });
        }

        const gerarOriginalDamas21 = generateBoardUI;
        generateBoardUI = function generateBoardUIProfessorDamas21(board) {
            const retorno = gerarOriginalDamas21.apply(this, arguments);
            garantirPainelProfessorDamas21();
            atualizarProfessorDamas21();
            aplicarMarcacoesProfessorDamas21();
            return retorno;
        };

        const clickOriginalDamas21 = handleSquareInteraction;
        handleSquareInteraction = function handleSquareInteractionProfessorDamas21(r, c) {
            if (damasProfessorAtivo21 && currentGameState?.board && professorDamasPodeAparecer21()) {
                const peca = currentGameState.board?.[r]?.[c] || 0;
                if (peca) {
                    const texto = criarDicaPecaDamas21(r, c);
                    if (texto) atualizarProfessorDamas21(texto);
                }
            }
            const retorno = clickOriginalDamas21.apply(this, arguments);
            setTimeout(() => {
                garantirPainelProfessorDamas21();
                aplicarMarcacoesProfessorDamas21();
            }, 30);
            return retorno;
        };

        const moverOriginalDamas21 = executeGameMove;
        executeGameMove = function executeGameMoveProfessorDamas21(move) {
            const boardAntes = cloneBoardDamas21(currentGameState?.board || []);
            const pecaAntes = boardAntes?.[move?.fromR]?.[move?.fromC] || 0;
            const retorno = moverOriginalDamas21.apply(this, arguments);
            if (damasProfessorAtivo21 && professorDamasPodeAparecer21()) {
                setTimeout(() => {
                    atualizarProfessorDamas21(mensagemAposJogadaDamas21(pecaAntes, move));
                    aplicarMarcacoesProfessorDamas21();
                }, 80);
            }
            return retorno;
        };

        setInterval(() => {
            if (!damasProfessorAtivo21 && !damasProfessorPedidoCapturado21) return;
            if (damasProfessorPedidoCapturado21 && currentGameState?.board && (playerRole === 'p1' || playerRole === 'p2' || isPracticeMode)) {
                damasProfessorAtivo21 = true;
            }
            garantirPainelProfessorDamas21();
            atualizarProfessorDamas21();
            if (professorDamasPodeAparecer21()) aplicarMarcacoesProfessorDamas21();
        }, 700);
    }

    // PROFISSIONAL 22 — reforço de ativação do Professor de Damas.
    // Corrige casos em que o # era limpo antes do painel reconhecer o professor.
    instalarProfessorInteligenteDamas21();

    /* =====================================================================
       ✅ PROFISSIONAL 23 — CORREÇÃO DEFINITIVA DO PROFESSOR NA DAMAS
       Reforço independente por cima da versão 21/22.
       Motivo: em alguns celulares o # era limpo ou a tela mudava antes do painel
       receber a classe de visível. Este reforço captura o pedido antes do clique,
       guarda na sessão do aparelho do professor e força o painel acima do tabuleiro.
       Não grava nada na sala, não aparece para o aluno e não altera a partida.
    ===================================================================== */
    function instalarReforcoDefinitivoProfessorDamas23() {
        if (window.__professorDamas23Instalado) return;
        window.__professorDamas23Instalado = true;

        let professorDamas23Ativo = false;
        let professorDamas23Texto = '';
        let professorDamas23Ultima = null;

        function temHashProfessor23(nome) {
            const n = String(nome || '').trim();
            return /^#/.test(n) || /#$/.test(n);
        }

        function limparNomeProfessor23(nome) {
            const limpo = String(nome || '')
                .replace(/^#+/, '')
                .replace(/#+$/, '')
                .replace(/\s+/g, ' ')
                .trim();
            return nomeSeguro(limpo || 'Professor');
        }

        function salvarAtivo23(valor) {
            professorDamas23Ativo = !!valor;
            try { sessionStorage.setItem('damas_professor_privado_ativo_23', professorDamas23Ativo ? '1' : '0'); } catch (_) {}
            try { sessionStorage.setItem('damas_professor_privado_ativo_21', professorDamas23Ativo ? '1' : '0'); } catch (_) {}
        }

        function lerAtivoSalvo23() {
            try {
                if (sessionStorage.getItem('damas_professor_privado_ativo_23') === '1') professorDamas23Ativo = true;
                if (sessionStorage.getItem('damas_professor_privado_ativo_21') === '1') professorDamas23Ativo = true;
            } catch (_) {}
            return professorDamas23Ativo;
        }

        function capturarPedidoProfessor23(limparCampoAgora = false) {
            const raw = String(nameInput?.value || '').trim();
            if (temHashProfessor23(raw)) {
                salvarAtivo23(true);
                if (limparCampoAgora && nameInput) {
                    const limpo = limparNomeProfessor23(raw);
                    nameInput.value = limpo;
                    try { localStorage.setItem('damas_nome_jogador', limpo); } catch (_) {}
                }
                return true;
            }
            return lerAtivoSalvo23();
        }

        function instalarCssProfessorDamas23() {
            if (document.getElementById('professor-damas-23-style')) return;
            const style = document.createElement('style');
            style.id = 'professor-damas-23-style';
            style.textContent = `
                #damas-teacher-private-panel.damas-teacher-force-23 {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    width: min(780px, calc(100% - 14px)) !important;
                    margin: 10px auto 12px auto !important;
                    position: relative !important;
                    z-index: 30 !important;
                }
                body.damas-professor-force-23 #damas-teacher-private-panel {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                #damas-teacher-private-panel .damas-teacher-alerta-23 {
                    display: block;
                    margin-top: 8px;
                    padding: 8px 10px;
                    border-radius: 12px;
                    border: 1px solid rgba(34,197,94,.35);
                    background: rgba(20,83,45,.24);
                    color: #bbf7d0;
                    font-size: .80rem;
                    font-weight: 800;
                }
                #damas-teacher-private-panel .damas-teacher-lista-23 {
                    margin: 8px 0 0 0;
                    padding-left: 18px;
                }
                #damas-teacher-private-panel .damas-teacher-lista-23 li {
                    margin: 4px 0;
                }
                .square.teacher-damas-from,
                .square.teacher-damas23-from { outline: 3px solid rgba(34,197,94,.98) !important; outline-offset: -4px; box-shadow: inset 0 0 20px rgba(34,197,94,.30) !important; }
                .square.teacher-damas-to,
                .square.teacher-damas23-to { outline: 3px solid rgba(250,204,21,.98) !important; outline-offset: -4px; box-shadow: inset 0 0 24px rgba(250,204,21,.32) !important; }
                .square.teacher-damas-danger,
                .square.teacher-damas23-danger { outline: 3px solid rgba(239,68,68,.96) !important; outline-offset: -4px; box-shadow: inset 0 0 24px rgba(239,68,68,.32) !important; }
            `;
            document.head.appendChild(style);
        }

        function ladoProfessor23() {
            if (playerRole === 'p2') return 2;
            if (playerRole === 'p1') return 1;
            return currentGameState?.turn === 2 ? 2 : 1;
        }

        function nomeLado23(lado) {
            return lado === 2 ? 'pretas' : 'vermelhas';
        }

        function coord23(r, c) {
            const letras = 'ABCDEFGH';
            return `${letras[c] || '?'}${8 - r}`;
        }

        function tipoPeca23(peca) {
            return (peca === 2 || peca === 4) ? 'dama' : 'peça comum';
        }

        function movimentoTexto23(m) {
            if (!m) return '—';
            return `${coord23(m.fromR, m.fromC)} → ${coord23(m.toR, m.toC)}`;
        }

        function podeMostrarProfessor23() {
            lerAtivoSalvo23();
            const boardWrapper = document.getElementById('normal-board-wrapper');
            const estaNaTelaDamas = !!(
                professorDamas23Ativo &&
                gameScreen &&
                gameScreen.style.display !== 'none' &&
                boardWrapper &&
                boardWrapper.style.display !== 'none' &&
                adminPanel?.style.display !== 'block' &&
                currentGameState &&
                currentGameState.board
            );
            return estaNaTelaDamas;
        }

        function garantirPainel23() {
            instalarCssProfessorDamas23();
            let panel = document.getElementById('damas-teacher-private-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'damas-teacher-private-panel';
                panel.innerHTML = `
                    <div class="damas-teacher-head">
                        <div class="damas-teacher-title">🎓 Professor inteligente de Damas <span class="damas-teacher-badge">privado</span></div>
                        <div class="damas-teacher-actions">
                            <button id="damas-teacher-analyze-btn" type="button" class="damas-teacher-btn">Analisar posição</button>
                            <button id="damas-teacher-collapse-btn" type="button" class="damas-teacher-btn secondary">−</button>
                        </div>
                    </div>
                    <div id="damas-teacher-private-content" class="damas-teacher-body"></div>
                `;
            }
            const boardWrapper = document.getElementById('normal-board-wrapper');
            if (boardWrapper && panel.parentNode !== boardWrapper.parentNode) {
                boardWrapper.insertAdjacentElement('beforebegin', panel);
            } else if (boardWrapper && panel.nextElementSibling !== boardWrapper) {
                boardWrapper.insertAdjacentElement('beforebegin', panel);
            } else if (!panel.parentNode && gameScreen) {
                gameScreen.appendChild(panel);
            }
            return panel;
        }

        function pontuarMovimento23(board, move, lado) {
            let pontos = 0;
            const razoes = [];
            const peca = board?.[move.fromR]?.[move.fromC] || 0;
            if (move.capture) { pontos += 90; razoes.push('captura peça adversária'); }
            if ((peca === 1 && move.toR === 0) || (peca === 3 && move.toR === 7)) { pontos += 80; razoes.push('coroa e vira dama'); }
            if (peca === 2 || peca === 4) { pontos += 16; razoes.push('usa a força da dama nas diagonais'); }
            if (move.toC >= 2 && move.toC <= 5 && move.toR >= 2 && move.toR <= 5) { pontos += 18; razoes.push('controla o centro'); }
            if (lado === 1 && move.toR < move.fromR) { pontos += 8; razoes.push('avança com segurança'); }
            if (lado === 2 && move.toR > move.fromR) { pontos += 8; razoes.push('avança com segurança'); }
            if (move.toC === 0 || move.toC === 7) { pontos -= 6; razoes.push('vai para a lateral, explique o cuidado'); }
            if (!razoes.length) razoes.push('melhora a posição e ajuda na explicação');
            return { move, pontos, razoes };
        }

        function melhoresMovimentos23(lado, board, filtroCasa = null, limite = 4) {
            let moves = [];
            try { moves = computeAllValidMovesEngine(lado, board, null) || []; } catch (_) { moves = []; }
            if (filtroCasa) moves = moves.filter(m => m.fromR === filtroCasa.r && m.fromC === filtroCasa.c);
            return moves
                .map(m => pontuarMovimento23(board, m, lado))
                .sort((a, b) => b.pontos - a.pontos)
                .slice(0, limite);
        }

        function renderSugestoes23(titulo, itens) {
            if (!itens || !itens.length) {
                return `<span class="damas-teacher-section-title">${titulo}</span><span class="damas-teacher-muted">Não encontrei movimento desta peça agora. Use a posição para ensinar proteção, captura obrigatória e avanço seguro.</span>`;
            }
            professorDamas23Ultima = itens[0];
            return `
                <span class="damas-teacher-section-title">${titulo}</span>
                <ol class="damas-teacher-lista-23">
                    ${itens.map((item, i) => `<li><strong>${i === 0 ? 'Melhor dica' : 'Opção'}:</strong> ${movimentoTexto23(item.move)}<br><span class="damas-teacher-muted">Por quê: ${item.razoes.join('; ')}.</span></li>`).join('')}
                </ol>
            `;
        }

        function criarAnalise23() {
            const board = currentGameState?.board;
            const lado = ladoProfessor23();
            if (!board) return 'Aguardando o tabuleiro carregar...';
            const todos = melhoresMovimentos23(lado, board, null, 4);
            const capturas = todos.filter(i => i.move?.capture).length;
            return `
                <strong>Professor de Damas ligado neste aparelho.</strong><br>
                <span class="damas-teacher-muted">Você está analisando as ${nomeLado23(lado)}. O aluno não vê este painel.</span>
                ${capturas ? '<span class="damas-teacher-alerta-23">⚠️ Existe captura boa/obrigatória para explicar.</span>' : '<span class="damas-teacher-alerta-23">✅ Não vi captura principal agora. Trabalhe avanço, defesa e centro.</span>'}
                ${renderSugestoes23('Melhores ideias da posição', todos)}
            `;
        }

        function criarDicaPeca23(r, c) {
            const board = currentGameState?.board;
            if (!board) return '';
            const peca = board?.[r]?.[c] || 0;
            if (!peca) return '';
            const lado = (peca === 1 || peca === 2) ? 1 : 2;
            const ladoProf = ladoProfessor23();
            if (lado !== ladoProf) {
                return `<strong>Peça do aluno em ${coord23(r, c)}.</strong><br><span class="damas-teacher-muted">Use esta peça para explicar ameaça, defesa e possíveis capturas que ele pode deixar.</span>${renderSugestoes23('Ideias para o seu lado', melhoresMovimentos23(ladoProf, board, null, 3))}`;
            }
            const sugestoes = melhoresMovimentos23(ladoProf, board, { r, c }, 4);
            let movimentos = [];
            try { movimentos = computeValidMovesForPieceEngine(r, c, board, true) || []; } catch (_) { movimentos = []; }
            return `
                <strong>${tipoPeca23(peca)} das ${nomeLado23(lado)}</strong> em <strong>${coord23(r, c)}</strong>.<br>
                <span class="damas-teacher-muted">Movimentos legais desta peça: ${movimentos.length}. Capturas: ${movimentos.filter(m => m.capture).length}.</span>
                ${renderSugestoes23('Melhores dicas dessa peça', sugestoes)}
            `;
        }

        function atualizarPainel23(texto = '') {
            const panel = garantirPainel23();
            const pode = podeMostrarProfessor23();
            if (texto) professorDamas23Texto = texto;
            if (pode && !professorDamas23Texto) professorDamas23Texto = criarAnalise23();
            const body = document.getElementById('damas-teacher-private-content');
            if (body && pode) body.innerHTML = professorDamas23Texto || criarAnalise23();
            panel.classList.toggle('teacher-visible', pode);
            panel.classList.toggle('damas-teacher-force-23', pode);
            document.body.classList.toggle('damas-professor-force-23', pode);
            if (pode) panel.style.setProperty('display', 'block', 'important');
            else panel.style.removeProperty('display');
            aplicarMarcacoes23();
        }

        function aplicarMarcacoes23() {
            const board = document.getElementById('board');
            if (!board) return;
            board.querySelectorAll('.teacher-damas23-from,.teacher-damas23-to,.teacher-damas23-danger').forEach(el => {
                el.classList.remove('teacher-damas23-from','teacher-damas23-to','teacher-damas23-danger');
            });
            if (!podeMostrarProfessor23() || !professorDamas23Ultima?.move) return;
            const m = professorDamas23Ultima.move;
            const marcar = (r, c, cls) => {
                const el = board.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (el) el.classList.add(cls);
            };
            marcar(m.fromR, m.fromC, 'teacher-damas23-from');
            marcar(m.toR, m.toC, 'teacher-damas23-to');
            if (m.capture) marcar(m.capture.r, m.capture.c, 'teacher-damas23-danger');
        }

        if (nameInput) {
            ['input','change','keyup','blur'].forEach(evt => {
                nameInput.addEventListener(evt, () => capturarPedidoProfessor23(false), true);
            });
        }
        [joinBtn, practiceBtn, btnChooseEasy, btnChooseMedium, btnChooseHard, btnChooseLearn].filter(Boolean).forEach(btn => {
            btn.addEventListener('click', () => capturarPedidoProfessor23(true), true);
        });

        const joinAnterior23 = joinRoom;
        joinRoom = async function joinRoomReforcoProfessorDamas23(roomName, playerName, forceSpectator) {
            const tinhaPedido = capturarPedidoProfessor23(true) || professorDamas23Ativo;
            const nomeFinal = tinhaPedido ? limparNomeProfessor23(playerName || nameInput?.value) : playerName;
            const resp = await joinAnterior23.call(this, roomName, nomeFinal, forceSpectator);
            if (tinhaPedido && !forceSpectator && playerRole !== 'admin') salvarAtivo23(true);
            setTimeout(() => atualizarPainel23(criarAnalise23()), 250);
            return resp;
        };

        const gerarAnterior23 = generateBoardUI;
        generateBoardUI = function generateBoardUIReforcoProfessorDamas23(board) {
            const retorno = gerarAnterior23.apply(this, arguments);
            setTimeout(() => atualizarPainel23(), 30);
            return retorno;
        };

        const clicarAnterior23 = handleSquareInteraction;
        handleSquareInteraction = function handleSquareInteractionReforcoProfessorDamas23(r, c) {
            if (podeMostrarProfessor23()) {
                const dica = criarDicaPeca23(r, c);
                if (dica) atualizarPainel23(dica);
            }
            const retorno = clicarAnterior23.apply(this, arguments);
            setTimeout(() => atualizarPainel23(), 80);
            return retorno;
        };

        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => {
                setTimeout(() => {
                    salvarAtivo23(false);
                    professorDamas23Texto = '';
                    professorDamas23Ultima = null;
                    atualizarPainel23('');
                }, 160);
            });
        }

        document.addEventListener('click', (ev) => {
            if (ev.target && ev.target.closest && ev.target.closest('#damas-teacher-analyze-btn')) {
                if (podeMostrarProfessor23()) atualizarPainel23(criarAnalise23());
            }
        }, true);

        setInterval(() => {
            capturarPedidoProfessor23(false);
            if (professorDamas23Ativo) atualizarPainel23();
        }, 500);
    }

    instalarReforcoDefinitivoProfessorDamas23();

    /* =====================================================================
       ✅ PROFISSIONAL 25 — POPUP DIDÁTICO DA PEÇA NO MODO PROFESSOR
       Popup privado para o professor explicar a peça selecionada no online.
       Serve para Xadrez e Damas. Não aparece para aluno, não grava na sala,
       não muda Firebase, não altera jogadas e não reinicia partida.
    ===================================================================== */
    function instalarPopupProfessorPeca25Global() {
        if (window.__popupProfessorPeca25GlobalInstalado) return;
        window.__popupProfessorPeca25GlobalInstalado = true;

        function instalarCssPopup25() {
            if (document.getElementById('popup-professor-peca-25-style')) return;
            const style = document.createElement('style');
            style.id = 'popup-professor-peca-25-style';
            style.textContent = `
                #teacher-piece-popup-25 {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                    background: rgba(2, 6, 23, .72);
                    backdrop-filter: blur(5px);
                }
                #teacher-piece-popup-25.open { display: flex; }
                #teacher-piece-popup-25 .teacher-piece-card {
                    width: min(520px, 96vw);
                    max-height: 88vh;
                    overflow: auto;
                    border-radius: 22px;
                    border: 1px solid rgba(34, 197, 94, .45);
                    background: linear-gradient(180deg, rgba(8, 25, 38, .98), rgba(4, 13, 24, .99));
                    box-shadow: 0 25px 70px rgba(0, 0, 0, .55), 0 0 28px rgba(34,197,94,.14);
                    color: #e5f6ef;
                }
                #teacher-piece-popup-25 .teacher-piece-head {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 15px;
                    border-bottom: 1px solid rgba(148, 163, 184, .20);
                    background: rgba(15, 118, 110, .18);
                }
                #teacher-piece-popup-25 .teacher-piece-titlebox {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }
                #teacher-piece-popup-25 .teacher-piece-symbol {
                    width: 44px;
                    height: 44px;
                    min-width: 44px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.75rem;
                    background: rgba(250, 204, 21, .13);
                    border: 1px solid rgba(250, 204, 21, .32);
                    color: #fef3c7;
                }
                #teacher-piece-popup-25 .teacher-piece-title {
                    font-weight: 950;
                    font-size: 1rem;
                    line-height: 1.15;
                    color: #f8fafc;
                }
                #teacher-piece-popup-25 .teacher-piece-subtitle {
                    margin-top: 3px;
                    font-size: .75rem;
                    color: #94a3b8;
                    font-weight: 700;
                }
                #teacher-piece-popup-25 .teacher-piece-close {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, .25);
                    background: rgba(15, 23, 42, .84);
                    color: #e5e7eb;
                    cursor: pointer;
                    font-weight: 950;
                    font-size: 1.05rem;
                }
                #teacher-piece-popup-25 .teacher-piece-body {
                    padding: 14px 15px 16px 15px;
                    font-size: .89rem;
                    line-height: 1.48;
                }
                #teacher-piece-popup-25 .teacher-piece-section {
                    margin: 0 0 10px 0;
                    padding: 10px 11px;
                    border-radius: 14px;
                    border: 1px solid rgba(148, 163, 184, .16);
                    background: rgba(2, 6, 23, .26);
                }
                #teacher-piece-popup-25 .teacher-piece-label {
                    display: block;
                    margin-bottom: 4px;
                    color: #86efac;
                    text-transform: uppercase;
                    font-size: .68rem;
                    letter-spacing: .08em;
                    font-weight: 950;
                }
                #teacher-piece-popup-25 .teacher-piece-moves {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 6px;
                }
                #teacher-piece-popup-25 .teacher-piece-move {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(14, 165, 233, .14);
                    border: 1px solid rgba(56, 189, 248, .24);
                    color: #bfdbfe;
                    font-weight: 850;
                    font-size: .76rem;
                }
                #teacher-piece-popup-25 .teacher-piece-audio {
                    border-color: rgba(250, 204, 21, .28);
                    background: rgba(113, 63, 18, .18);
                    color: #fef3c7;
                }
                #teacher-piece-popup-25 .teacher-piece-footer {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 0 15px 15px 15px;
                }
                #teacher-piece-popup-25 .teacher-piece-ok {
                    border: 0;
                    border-radius: 13px;
                    padding: 10px 14px;
                    cursor: pointer;
                    color: #052e2b;
                    font-weight: 950;
                    background: linear-gradient(135deg, #86efac, #22c55e);
                }
                @media (max-width: 620px) {
                    #teacher-piece-popup-25 { padding: 10px; align-items: flex-end; }
                    #teacher-piece-popup-25 .teacher-piece-card { width: 100%; max-height: 86vh; border-radius: 19px; }
                    #teacher-piece-popup-25 .teacher-piece-head { padding: 12px; }
                    #teacher-piece-popup-25 .teacher-piece-body { padding: 12px; font-size: .83rem; }
                    #teacher-piece-popup-25 .teacher-piece-symbol { width: 40px; height: 40px; min-width: 40px; font-size: 1.45rem; }
                }
            `;
            document.head.appendChild(style);
        }

        function escape25(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function garantirPopup25() {
            instalarCssPopup25();
            let overlay = document.getElementById('teacher-piece-popup-25');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'teacher-piece-popup-25';
                overlay.innerHTML = `
                    <div class="teacher-piece-card" role="dialog" aria-modal="true" aria-label="Manual do professor">
                        <div class="teacher-piece-head">
                            <div class="teacher-piece-titlebox">
                                <div id="teacher-piece-symbol-25" class="teacher-piece-symbol">♟</div>
                                <div>
                                    <div id="teacher-piece-title-25" class="teacher-piece-title">Manual do Professor</div>
                                    <div id="teacher-piece-subtitle-25" class="teacher-piece-subtitle">Explicação privada</div>
                                </div>
                            </div>
                            <button id="teacher-piece-close-25" class="teacher-piece-close" type="button">×</button>
                        </div>
                        <div id="teacher-piece-body-25" class="teacher-piece-body"></div>
                        <div class="teacher-piece-footer">
                            <button id="teacher-piece-ok-25" class="teacher-piece-ok" type="button">Entendi</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
                const fechar = () => overlay.classList.remove('open');
                overlay.addEventListener('click', (ev) => {
                    if (ev.target === overlay) fechar();
                });
                overlay.querySelector('#teacher-piece-close-25')?.addEventListener('click', fechar);
                overlay.querySelector('#teacher-piece-ok-25')?.addEventListener('click', fechar);
                document.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape') fechar();
                });
            }
            return overlay;
        }

        window.abrirPopupProfessorPeca25 = function abrirPopupProfessorPeca25(dados = {}) {
            const overlay = garantirPopup25();
            const simbolo = overlay.querySelector('#teacher-piece-symbol-25');
            const title = overlay.querySelector('#teacher-piece-title-25');
            const subtitle = overlay.querySelector('#teacher-piece-subtitle-25');
            const body = overlay.querySelector('#teacher-piece-body-25');
            const movimentos = Array.isArray(dados.ondePodeIr) && dados.ondePodeIr.length
                ? dados.ondePodeIr.map(m => `<span class="teacher-piece-move">${escape25(m)}</span>`).join('')
                : '<span class="teacher-piece-move">Sem casa legal agora</span>';

            if (simbolo) simbolo.textContent = dados.simbolo || '♟';
            if (title) title.textContent = dados.titulo || 'Peça selecionada';
            if (subtitle) subtitle.textContent = `${dados.jogo || 'Jogo'} • posição ${dados.posicao || '—'}`;
            if (body) {
                body.innerHTML = `
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">O que é esta peça</span>
                        ${escape25(dados.oQueE || 'Esta peça faz parte da estratégia da posição.')}
                    </div>
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">O que ela faz</span>
                        ${escape25(dados.comoAnda || 'Ela se movimenta conforme as regras do jogo.')}
                    </div>
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">Onde pode ir agora</span>
                        <div class="teacher-piece-moves">${movimentos}</div>
                    </div>
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">Por que isso importa no jogo</span>
                        ${escape25(dados.porque || 'Use esta posição para ensinar ataque, defesa e cuidado antes de jogar.')}
                    </div>
                    <div class="teacher-piece-section teacher-piece-audio">
                        <span class="teacher-piece-label">Frase para instruir por áudio</span>
                        “${escape25(dados.fraseAula || 'Observe a peça, veja para onde ela pode ir e pense no que ela protege ou ameaça antes de jogar.')}”
                    </div>
                `;
            }
            overlay.classList.add('open');
        };
    }

    function instalarPopupDidaticoPecaDamas25() {
        if (window.__popupPecaDamas25Instalado) return;
        window.__popupPecaDamas25Instalado = true;

        function professorDamasAtivo25() {
            let ativo = false;
            try {
                ativo = sessionStorage.getItem('damas_professor_privado_ativo_23') === '1' || sessionStorage.getItem('damas_professor_privado_ativo_21') === '1';
            } catch (_) {}
            const boardWrapper = document.getElementById('normal-board-wrapper');
            return !!(
                ativo &&
                !isPracticeMode &&
                (playerRole === 'p1' || playerRole === 'p2') &&
                gameScreen &&
                gameScreen.style.display !== 'none' &&
                boardWrapper &&
                boardWrapper.style.display !== 'none' &&
                currentGameState &&
                currentGameState.board
            );
        }

        function coord25(r, c) {
            const letras = 'ABCDEFGH';
            return `${letras[c] || '?'}${8 - r}`;
        }

        function dono25(peca) {
            if (peca === 1 || peca === 2) return 1;
            if (peca === 3 || peca === 4) return 2;
            return 0;
        }

        function ladoNome25(lado) {
            return lado === 2 ? 'pretas' : 'vermelhas';
        }

        function tipoNome25(peca) {
            return (peca === 2 || peca === 4) ? 'Dama' : 'Peça comum';
        }

        function movimentosTextoDamas25(movs) {
            if (!movs || !movs.length) return ['Sem casa legal agora'];
            return movs.slice(0, 14).map(m => {
                let txt = `${coord25(m.fromR, m.fromC)} → ${coord25(m.toR, m.toC)}`;
                if (m.capture) txt += ` captura em ${coord25(m.capture.r, m.capture.c)}`;
                return txt;
            });
        }

        function criarDadosPopupDamas25(r, c) {
            const board = currentGameState?.board;
            const peca = board?.[r]?.[c] || 0;
            if (!peca) return null;
            let movimentos = [];
            try { movimentos = computeValidMovesForPieceEngine(r, c, board, false) || []; } catch (_) { movimentos = []; }
            let capturasObrigatorias = [];
            try { capturasObrigatorias = computeAllValidMovesEngine(dono25(peca), board, null).filter(m => m.capture); } catch (_) { capturasObrigatorias = []; }
            const eDama = peca === 2 || peca === 4;
            const capturasDaPeca = movimentos.filter(m => m.capture).length;
            const lado = dono25(peca);
            const doProfessor = (playerRole === 'p1' && lado === 1) || (playerRole === 'p2' && lado === 2);

            let oQueE = eDama
                ? 'A Dama é a peça coroada. Ela é mais forte porque anda pelas diagonais longas enquanto houver caminho livre.'
                : 'A peça comum é a base da Damas. Ela avança pelas diagonais, protege caminhos e tenta chegar ao outro lado para virar Dama.';
            let comoAnda = eDama
                ? 'A Dama anda em qualquer diagonal, para frente ou para trás, quantas casas livres puder. Para capturar, ela pula a peça adversária e cai numa casa livre depois dela.'
                : 'A peça comum anda uma casa na diagonal para frente. Ela captura pulando a peça adversária na diagonal. Neste jogo, quando existe captura, a captura deve ser feita.';
            let porque = '';
            if (capturasDaPeca > 0) {
                porque = 'Esta peça tem captura disponível. Use isso para ensinar que na Damas ganhar material e respeitar a captura obrigatória muda a partida.';
            } else if (capturasObrigatorias.length > 0) {
                porque = 'Existe captura obrigatória para este lado, mas talvez não seja com esta peça. Ensine o aluno a procurar todas as capturas antes de andar.';
            } else if (eDama) {
                porque = 'A Dama controla muitas diagonais. Ela serve para atacar de longe, defender peças e cortar caminhos do adversário.';
            } else {
                porque = 'Esta peça ajuda no avanço, no controle do centro e na formação de defesa. O objetivo é avançar sem deixar captura fácil.';
            }
            if (!doProfessor) {
                porque = 'Esta é uma peça do aluno/adversário. Use para explicar o que ela ameaça, quais caminhos ela tem e como evitar deixar captura para ela.';
            }

            return {
                jogo: 'Damas online',
                simbolo: eDama ? '👑' : '●',
                titulo: `${tipoNome25(peca)} ${ladoNome25(lado)}`,
                posicao: coord25(r, c),
                oQueE,
                comoAnda,
                ondePodeIr: movimentosTextoDamas25(movimentos),
                porque,
                fraseAula: eDama
                    ? 'A Dama é forte porque domina diagonais longas; antes de mover, olhe tudo o que ela ataca e tudo o que ela precisa defender.'
                    : 'Antes de andar, procure captura obrigatória, veja se a peça ficará protegida e pense se ela está avançando com segurança.'
            };
        }

        const clicarAnterior25 = handleSquareInteraction;
        handleSquareInteraction = function handleSquareInteractionPopupDamas25(r, c) {
            const board = currentGameState?.board;
            const pecaAntes = board?.[r]?.[c] || 0;
            const clicouDestino = !!(selectedPiece && Array.isArray(validMoves) && validMoves.some(m => m.toR === r && m.toC === c));
            const deveAbrir = !!(professorDamasAtivo25() && pecaAntes && !clicouDestino);
            const dados = deveAbrir ? criarDadosPopupDamas25(r, c) : null;
            const retorno = clicarAnterior25.apply(this, arguments);
            if (dados && window.abrirPopupProfessorPeca25) {
                setTimeout(() => window.abrirPopupProfessorPeca25(dados), 60);
            }
            return retorno;
        };
    }

    instalarPopupProfessorPeca25Global();
    instalarPopupDidaticoPecaDamas25();

    /* =====================================================================
       ✅ PROFISSIONAL 26 — POPUP PEQUENO ACIMA DA PEÇA
       Troca o popup central por um quadrinho pequeno perto da peça tocada,
       com explicação, movimento e melhor dica didática para o professor.
    ===================================================================== */
    function instalarPopupProfessorPeca26Global() {
        if (window.__popupProfessorPeca26GlobalInstalado) return;
        window.__popupProfessorPeca26GlobalInstalado = true;
        const abrirOriginalPopupProfessor25 = window.abrirPopupProfessorPeca25;

        function escape26(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function instalarCss26() {
            if (document.getElementById('popup-professor-peca-26-style')) return;
            const style = document.createElement('style');
            style.id = 'popup-professor-peca-26-style';
            style.textContent = `
                #teacher-piece-popup-25 {
                    position: fixed !important;
                    inset: 0 !important;
                    z-index: 999999 !important;
                    display: none !important;
                    background: transparent !important;
                    backdrop-filter: none !important;
                    padding: 0 !important;
                    pointer-events: none !important;
                }
                #teacher-piece-popup-25.open { display: block !important; }
                #teacher-piece-popup-25 .teacher-piece-card {
                    position: fixed !important;
                    width: min(340px, calc(100vw - 18px)) !important;
                    max-height: min(430px, 72vh) !important;
                    overflow: auto !important;
                    border-radius: 16px !important;
                    border: 1px solid rgba(125, 211, 252, .55) !important;
                    background: linear-gradient(180deg, rgba(8, 20, 38, .98), rgba(2, 8, 23, .99)) !important;
                    box-shadow: 0 18px 45px rgba(0,0,0,.55), 0 0 24px rgba(14,165,233,.20) !important;
                    color: #e5f6ff !important;
                    pointer-events: auto !important;
                }
                #teacher-piece-popup-25 .teacher-piece-card::after {
                    content: '';
                    position: absolute;
                    left: var(--arrow-left, 28px);
                    top: 100%;
                    width: 14px;
                    height: 14px;
                    transform: rotate(45deg);
                    margin-top: -7px;
                    background: rgba(2, 8, 23, .99);
                    border-right: 1px solid rgba(125, 211, 252, .45);
                    border-bottom: 1px solid rgba(125, 211, 252, .45);
                }
                #teacher-piece-popup-25 .teacher-piece-head {
                    padding: 10px 11px !important;
                    gap: 9px !important;
                    background: rgba(14, 116, 144, .20) !important;
                }
                #teacher-piece-popup-25 .teacher-piece-symbol {
                    width: 36px !important;
                    height: 36px !important;
                    min-width: 36px !important;
                    border-radius: 11px !important;
                    font-size: 1.45rem !important;
                }
                #teacher-piece-popup-25 .teacher-piece-title {
                    font-size: .92rem !important;
                }
                #teacher-piece-popup-25 .teacher-piece-subtitle {
                    font-size: .68rem !important;
                }
                #teacher-piece-popup-25 .teacher-piece-close {
                    width: 32px !important;
                    height: 32px !important;
                    border-radius: 10px !important;
                }
                #teacher-piece-popup-25 .teacher-piece-body {
                    padding: 10px 11px 11px 11px !important;
                    font-size: .80rem !important;
                    line-height: 1.36 !important;
                }
                #teacher-piece-popup-25 .teacher-piece-section {
                    margin-bottom: 7px !important;
                    padding: 8px 9px !important;
                    border-radius: 11px !important;
                }
                #teacher-piece-popup-25 .teacher-piece-label {
                    font-size: .61rem !important;
                    margin-bottom: 3px !important;
                    color: #7dd3fc !important;
                }
                #teacher-piece-popup-25 .teacher-piece-moves { gap: 4px !important; }
                #teacher-piece-popup-25 .teacher-piece-move {
                    padding: 4px 7px !important;
                    font-size: .68rem !important;
                }
                #teacher-piece-popup-25 .teacher-piece-best {
                    border-color: rgba(34, 197, 94, .34) !important;
                    background: rgba(20, 83, 45, .22) !important;
                    color: #dcfce7 !important;
                }
                #teacher-piece-popup-25 .teacher-piece-audio {
                    border-color: rgba(250, 204, 21, .28) !important;
                    background: rgba(113, 63, 18, .16) !important;
                }
                #teacher-piece-popup-25 .teacher-piece-footer { display: none !important; }
                @media (max-width: 620px) {
                    #teacher-piece-popup-25 .teacher-piece-card {
                        width: min(330px, calc(100vw - 14px)) !important;
                        max-height: 62vh !important;
                        border-radius: 15px !important;
                    }
                    #teacher-piece-popup-25 .teacher-piece-body { font-size: .78rem !important; }
                }
            `;
            document.head.appendChild(style);
        }

        function garantirPopup26() {
            instalarCss26();
            if (typeof abrirOriginalPopupProfessor25 !== 'function') return null;
            let overlay = document.getElementById('teacher-piece-popup-25');
            if (!overlay) {
                abrirOriginalPopupProfessor25({ titulo: 'Professor', jogo: 'Carregando', posicao: '—' });
                overlay = document.getElementById('teacher-piece-popup-25');
                if (overlay) overlay.classList.remove('open');
            }
            return overlay;
        }

        function calcularPosicao26(dados, card) {
            const rect = dados.anchorRect || null;
            const vw = window.innerWidth || 360;
            const vh = window.innerHeight || 640;
            const cw = Math.min(340, vw - 18);
            let left = rect ? (rect.left + rect.width / 2 - cw / 2) : (vw / 2 - cw / 2);
            left = Math.max(9, Math.min(left, vw - cw - 9));
            const estimatedH = Math.min(430, Math.max(260, card?.offsetHeight || 320));
            let top = rect ? (rect.top - estimatedH - 10) : (vh * .18);
            if (top < 8 && rect) top = Math.min(rect.bottom + 10, vh - estimatedH - 8);
            top = Math.max(8, Math.min(top, vh - 80));
            const arrow = rect ? Math.max(18, Math.min(cw - 26, (rect.left + rect.width / 2) - left - 7)) : 28;
            return { left, top, cw, arrow };
        }

        window.abrirPopupProfessorPeca25 = window.abrirPopupProfessorPeca26 = function abrirPopupProfessorPeca26(dados = {}) {
            const overlay = garantirPopup26();
            if (!overlay) return;
            const simbolo = overlay.querySelector('#teacher-piece-symbol-25');
            const title = overlay.querySelector('#teacher-piece-title-25');
            const subtitle = overlay.querySelector('#teacher-piece-subtitle-25');
            const body = overlay.querySelector('#teacher-piece-body-25');
            const card = overlay.querySelector('.teacher-piece-card');
            const movimentos = Array.isArray(dados.ondePodeIr) && dados.ondePodeIr.length
                ? dados.ondePodeIr.map(m => `<span class="teacher-piece-move">${escape26(m)}</span>`).join('')
                : '<span class="teacher-piece-move">Sem casa legal agora</span>';

            if (simbolo) simbolo.textContent = dados.simbolo || '♟';
            if (title) title.textContent = dados.titulo || 'Peça selecionada';
            if (subtitle) subtitle.textContent = `${dados.jogo || 'Jogo'} • ${dados.posicao || '—'}`;
            if (body) {
                body.innerHTML = `
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">O que é / função</span>
                        ${escape26(dados.oQueE || 'Esta peça faz parte da estratégia da posição.')}
                    </div>
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">O que ela faz</span>
                        ${escape26(dados.comoAnda || 'Ela se movimenta conforme as regras do jogo.')}
                    </div>
                    <div class="teacher-piece-section">
                        <span class="teacher-piece-label">Onde pode ir agora</span>
                        <div class="teacher-piece-moves">${movimentos}</div>
                    </div>
                    <div class="teacher-piece-section teacher-piece-best">
                        <span class="teacher-piece-label">Melhor dica para instruir</span>
                        ${escape26(dados.melhorJogada || dados.porque || 'Observe se a jogada ganha material, protege o Rei e não deixa peça sem defesa.')}
                    </div>
                    <div class="teacher-piece-section teacher-piece-audio">
                        <span class="teacher-piece-label">Como explicar por áudio</span>
                        “${escape26(dados.fraseAula || 'Antes de jogar, veja o que a peça ataca, o que ela protege e se ela fica segura depois do movimento.')}”
                    </div>
                `;
            }
            overlay.classList.add('open');
            if (card) {
                card.style.left = '-9999px';
                card.style.top = '8px';
                card.style.width = '';
                requestAnimationFrame(() => {
                    const pos = calcularPosicao26(dados, card);
                    card.style.left = `${pos.left}px`;
                    card.style.top = `${pos.top}px`;
                    card.style.width = `${pos.cw}px`;
                    card.style.setProperty('--arrow-left', `${pos.arrow}px`);
                });
            }
        };
    }

    function instalarPopupProfessorDamas26() {
        if (window.__popupProfessorDamas26Instalado) return;
        window.__popupProfessorDamas26Instalado = true;

        function professorDamasAtivo26() {
            let ativo = false;
            try {
                ativo = sessionStorage.getItem('damas_professor_privado_ativo_23') === '1' || sessionStorage.getItem('damas_professor_privado_ativo_21') === '1';
            } catch (_) {}
            return !!(ativo && !isPracticeMode && (playerRole === 'p1' || playerRole === 'p2') && currentGameState?.board && gameScreen && gameScreen.style.display !== 'none');
        }
        function coord26(r, c) { const letras = 'ABCDEFGH'; return `${letras[c] || '?'}${8 - r}`; }
        function dono26(p) { if (p === 1 || p === 2) return 1; if (p === 3 || p === 4) return 2; return 0; }
        function nomeLado26(lado) { return lado === 2 ? 'pretas' : 'vermelhas'; }
        function rectDamas26(r, c) {
            try {
                const el = document.querySelector(`#game-board .square[data-row="${r}"][data-col="${c}"]`) || document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
                if (el) { const x = el.getBoundingClientRect(); return { left: x.left, top: x.top, right: x.right, bottom: x.bottom, width: x.width, height: x.height }; }
            } catch (_) {}
            return null;
        }
        function melhorDicaDamas26(peca, r, c, movimentos, board) {
            const lista = Array.isArray(movimentos) ? movimentos : [];
            const eDama = peca === 2 || peca === 4;
            if (!lista.length) return 'Melhor orientação: esta peça está travada agora. Use isso para explicar bloqueio, proteção e por que nem toda peça pode sair a qualquer momento.';
            const avaliadas = lista.map(m => {
                let score = 0;
                const razoes = [];
                if (m.capture) { score += eDama ? 260 : 220; razoes.push(`captura em ${coord26(m.capture.r, m.capture.c)}`); }
                const vaiCoroar = (peca === 1 && m.toR === 0) || (peca === 3 && m.toR === 7);
                if (vaiCoroar) { score += 420; razoes.push('chega para virar Dama'); }
                const centro = 7 - (Math.abs(3.5 - m.toR) + Math.abs(3.5 - m.toC));
                if (centro >= 5.5) { score += 65; razoes.push('controla melhor o centro'); }
                if (!m.capture && ((peca === 1 && m.toR < r) || (peca === 3 && m.toR > r))) { score += 38; razoes.push('avança com objetivo'); }
                if (eDama) { score += 45; razoes.push('mantém pressão de Dama nas diagonais'); }
                return { m, score, razoes };
            }).sort((a,b) => b.score - a.score);
            const best = avaliadas[0];
            const motivos = best.razoes.length ? best.razoes.slice(0,3).join(', ') : 'melhora a posição com segurança';
            return `Boa jogada didática: ${coord26(best.m.fromR, best.m.fromC)} → ${coord26(best.m.toR, best.m.toC)}. Motivo: ${motivos}. Ensine assim: “na Damas primeiro procure captura obrigatória, depois veja se a peça ficará protegida e se aproxima da coroação.”`;
        }
        function criarDadosDamas26(r, c, anchorRect) {
            const board = currentGameState?.board;
            const peca = board?.[r]?.[c] || 0;
            if (!peca) return null;
            let movimentos = [];
            try { movimentos = computeValidMovesForPieceEngine(r, c, board, false) || []; } catch (_) {
                try { movimentos = computeValidMovesForPiece(r, c, board) || []; } catch (__) { movimentos = []; }
            }
            const eDama = peca === 2 || peca === 4;
            const lado = dono26(peca);
            const capturas = movimentos.filter(m => m.capture).length;
            return {
                jogo: 'Damas online',
                simbolo: eDama ? '👑' : '●',
                titulo: `${eDama ? 'Dama' : 'Peça comum'} ${nomeLado26(lado)}`,
                posicao: coord26(r, c),
                oQueE: eDama ? 'A Dama é a peça coroada da Damas. Ela é mais forte porque controla diagonais longas.' : 'A peça comum é a base do jogo de Damas. Ela avança, protege caminhos e tenta chegar ao outro lado para virar Dama.',
                comoAnda: eDama ? 'A Dama anda pelas diagonais para frente ou para trás enquanto houver caminho livre. Para capturar, pula a peça adversária e cai depois dela.' : 'A peça comum anda uma casa na diagonal para frente. Captura pulando a peça adversária na diagonal. Quando há captura, a captura é obrigatória.',
                ondePodeIr: movimentos.length ? movimentos.slice(0,14).map(m => `${coord26(m.fromR,m.fromC)} → ${coord26(m.toR,m.toC)}${m.capture ? ' captura' : ''}`) : ['Sem casa legal agora'],
                porque: capturas ? 'Esta peça tem captura. Use para ensinar que a captura obrigatória muda todo o plano da jogada.' : 'Use esta peça para ensinar avanço seguro, controle do centro, defesa e caminho para coroação.',
                melhorJogada: melhorDicaDamas26(peca, r, c, movimentos, board),
                fraseAula: eDama ? 'A Dama domina diagonais longas; olhe tudo que ela ataca antes de mover.' : 'Na Damas, antes de andar, procure captura obrigatória e veja se a peça continuará protegida.',
                anchorRect,
                row: r,
                col: c
            };
        }

        const clickAnteriorDamas26 = handleSquareInteraction;
        handleSquareInteraction = function handleSquareInteractionPopupDamas26(r, c) {
            const board = currentGameState?.board;
            const pecaAntes = board?.[r]?.[c] || 0;
            const clicouDestino = !!(selectedPiece && Array.isArray(validMoves) && validMoves.some(m => m.toR === r && m.toC === c));
            const pode = !!(professorDamasAtivo26() && pecaAntes && !clicouDestino);
            const rect = pode ? rectDamas26(r, c) : null;
            const dados = pode ? criarDadosDamas26(r, c, rect) : null;
            const retorno = clickAnteriorDamas26.apply(this, arguments);
            if (dados && window.abrirPopupProfessorPeca25) setTimeout(() => window.abrirPopupProfessorPeca25(dados), 120);
            return retorno;
        };
    }

    instalarPopupProfessorPeca26Global();
    instalarPopupProfessorDamas26();



})();




/* ✅ FASE 36.12 - Reforço sem remendo: manter controles no tabuleiro se a sala online já estiver ativa. */
document.addEventListener('click', async (ev) => {
    const alvo = ev.target;
    if (!alvo || !alvo.closest) return;
    if (alvo.closest('#chess-board-leave-online-btn')) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        await sairXadrezOnline(false);
        ocultarTabuleiroXadrezParaMenu();
        mostrarToastXadrez('🚪 Você saiu da sala online. A vaga foi liberada.');
    }
    if (alvo.closest('#chess-call-toggle-btn') && chessMode === 'online') {
        const panel = document.getElementById('chess-call-panel');
        if (panel && !panel.classList.contains('call-active')) {
            panel.classList.toggle('call-compact');
            const toggle = document.getElementById('chess-call-toggle-btn');
            if (toggle) toggle.textContent = panel.classList.contains('call-compact') ? '+' : '−';
        }
        setTimeout(() => garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator), 20);
    }
}, true);

setInterval(() => {
    if (chessMode === 'online' && chessRoomId && document.body.classList.contains('chess-board-visible')) {
        garantirControlesOnlineNoTabuleiro3612(!chessIsSpectator);
    }
}, 1000);
