import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAuorMQnlj-SCwFsPOEBKnqj2im6VVLcHk",
    authDomain: "controle-de-unidade.firebaseapp.com",
    projectId: "controle-de-unidade",
    storageBucket: "controle-de-unidade.firebasestorage.app",
    messagingSenderId: "344553489715",
    appId: "1:344553489715:web:fa19c9387e4e32688b2a46"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- VARIÁVEIS GLOBAIS ---
let userAtual = null;
let dadosUnidade = { unidade: "", membros: [] };
let avaliacoesCache = [];

// Configuração dos Gráficos
const nomesCategorias = ["Freq.", "Devoção", "Unif.", "Hig.", "Boa Ação", "Ano Bíb.", "Taxa", "Disc."];
const coresGrafico = ['#FF5722', '#FFC107', '#4CAF50', '#03A9F4', '#9C27B0', '#E91E63', '#795548', '#607D8B'];


// --- FUNÇÃO ESPIÃ (LOGS) 🕵️‍♂️ ---
async function registrarLog(acao, detalhes) {
    if (!userAtual) return;
    try {
        await addDoc(collection(db, "logs"), {
            usuario: userAtual.email || "Desconhecido",
            uid: userAtual.uid,
            acao: acao,
            detalhes: detalhes,
            data: new Date().toISOString(),
            navegador: navigator.userAgent
        });
        console.log(`📝 Log registrado: ${acao}`);
    } catch (e) {
        console.error("Erro ao gravar log:", e);
    }
}


// --- 1. LÓGICA DE LOGIN ---

let modoCadastro = false;
document.getElementById('link-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    modoCadastro = !modoCadastro;

    if (modoCadastro) {
        document.getElementById('titulo-login').innerText = "Criar Nova Conta";
        document.getElementById('btn-entrar-email').classList.add('hidden');
        document.getElementById('btn-criar-conta').classList.remove('hidden');
        document.getElementById('txt-toggle').innerText = "Já tem conta?";
        document.getElementById('link-toggle').innerText = "Faça login";
    } else {
        document.getElementById('titulo-login').innerText = "Bem-vindo!";
        document.getElementById('btn-entrar-email').classList.remove('hidden');
        document.getElementById('btn-criar-conta').classList.add('hidden');
        document.getElementById('txt-toggle').innerText = "Não tem conta?";
        document.getElementById('link-toggle').innerText = "Crie uma aqui";
    }
});

// Recuperar Senha
document.getElementById('btn-esqueci-senha').addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    if (!email) {
        alert("⚠️ Por favor, digite seu email no campo acima primeiro.");
        document.getElementById('email-input').focus();
        return;
    }
    sendPasswordResetEmail(auth, email)
        .then(() => alert("📧 Email de recuperação enviado! Verifique sua caixa de entrada."))
        .catch((error) => alert("Erro: " + error.message));
});

// Entrar com Email
document.getElementById('btn-entrar-email').addEventListener('click', () => {
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;
    signInWithEmailAndPassword(auth, email, senha)
        .catch((error) => tratarErroLogin(error));
});

// Criar Conta
document.getElementById('btn-criar-conta').addEventListener('click', () => {
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;
    createUserWithEmailAndPassword(auth, email, senha)
        .then(() => alert("Conta criada com sucesso!"))
        .catch((error) => tratarErroLogin(error));
});

// Entrar com Google
document.getElementById('btn-login-google').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => alert("Erro: " + e.message));
});

function tratarErroLogin(error) {
    let msg = error.message;
    if (error.code === 'auth/invalid-email') msg = "Email inválido.";
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') msg = "Email ou senha incorretos.";
    if (error.code === 'auth/email-already-in-use') msg = "Este email já está cadastrado.";
    if (error.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
    alert("Atenção: " + msg);
}

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
    registrarLog("Logout", "Usuário saiu do sistema");
    signOut(auth);
});

// 👇 SEU UID DE ADMINISTRADOR
const ADMIN_UID = "V7FUkGG035dQiBo5FoB3DVYF14N2";

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (userAtual === null) {
            userAtual = user;
            registrarLog("Login", "Entrou no sistema");
        }
        userAtual = user;
        document.getElementById('tela-login').classList.add('hidden');
        document.getElementById('app-principal').style.display = 'block';
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName || user.email;

        // --- TRAVA DE SEGURANÇA 🔐 ---
        const btnAdmin = document.getElementById('nav-admin');
        if (user.uid === ADMIN_UID) {
            btnAdmin.style.display = "inline-block";
        } else {
            btnAdmin.style.display = "none";
        }

        carregarConfiguracao();
    } else {
        userAtual = null;
        document.getElementById('user-name').innerText = "";
        dadosUnidade = { unidade: "", membros: [] };
        avaliacoesCache = [];
        document.getElementById('tela-login').classList.remove('hidden');
        document.getElementById('app-principal').style.display = 'none';
        document.getElementById('btn-logout').classList.add('hidden');
    }
});


// --- 2. CONFIGURAÇÃO ---
async function carregarConfiguracao() {
    if (!userAtual) return;
    const docSnap = await getDoc(doc(db, "configuracoes", userAtual.uid));
    if (docSnap.exists()) {
        dadosUnidade = docSnap.data();
        document.getElementById('cfgUnidade').value = dadosUnidade.unidade || "";
        document.getElementById('cfgMembros').value = (dadosUnidade.membros || []).join('\n');
    }
}

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const unidade = document.getElementById('cfgUnidade').value;
    const membros = document.getElementById('cfgMembros').value.split('\n').filter(n => n.trim());
    await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade, membros });
    registrarLog("Configuração", `Alterou unidade/membros`);
    dadosUnidade = { unidade, membros };
    alert("✅ Salvo!");
    navegar('avaliar');
});


// --- 3. AVALIAÇÃO ---
let wizardIndex = 0;

document.getElementById('btn-iniciar').addEventListener('click', () => {
    if (!dadosUnidade.membros?.length) return alert("Cadastre membros na Config!");
    wizardIndex = 0;
    document.getElementById('wizard-form').classList.remove('hidden');
    carregarMembroWizard();
});

function carregarMembroWizard() {
    document.getElementById('wiz-nome').innerText = dadosUnidade.membros[wizardIndex];
    for (let i = 1; i <= 8; i++) document.getElementById('n' + i).value = '';
    document.getElementById('n1').focus();
}

document.getElementById('btn-proximo').addEventListener('click', async () => {
    if (!dadosUnidade.membros[wizardIndex]) return;

    const nomeMembro = dadosUnidade.membros[wizardIndex];
    const mes = document.getElementById('selMes').value;
    const semana = document.getElementById('selSemana').value;

    const notas = [];
    let total = 0;
    for (let i = 1; i <= 8; i++) {
        let val = Number(document.getElementById('n' + i).value) || 0;
        notas.push(val);
        total += val;
    }

    const idUnico = `${userAtual.uid}_${nomeMembro.replace(/\s+/g, '')}_${mes}_${semana}`;
    const docRef = doc(db, "avaliacoes", idUnico);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const pular = confirm(`⛔ ${nomeMembro} já tem nota em ${mes}/${semana}.\nDeseja PULAR?`);
            if (pular) avancarProximoMembro();
            return;
        }

        await setDoc(docRef, {
            uid: userAtual.uid,
            nome: nomeMembro,
            mes: mes,
            semana: semana,
            notas: notas,
            total: total,
            data: new Date().toISOString()
        });

        registrarLog("Avaliação", `Avaliou ${nomeMembro} (${total} pts)`);
        avaliacoesCache = [];
        avancarProximoMembro();

    } catch (error) {
        alert("Erro: " + error.message);
    }
});

function avancarProximoMembro() {
    wizardIndex++;
    if (wizardIndex < dadosUnidade.membros.length) {
        carregarMembroWizard();
    } else {
        alert("🎉 Lista finalizada!");
        document.getElementById('wizard-form').classList.add('hidden');
        navegar('dashboard');
    }
}


// --- 4. DASHBOARD ---
window.atualizarDashboard = async function () {
    const divDash = document.getElementById('lista-dashboard');
    const cardDestaque = document.getElementById('card-destaque');
    divDash.innerHTML = "Carregando...";
    cardDestaque.style.display = 'none';

    const mes = document.getElementById('dashMes').value;
    const semana = document.getElementById('dashSemana').value;

    if (avaliacoesCache.length === 0) {
        const q = query(collection(db, "avaliacoes"), where("uid", "==", userAtual.uid));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            let d = doc.data(); d.id = doc.id;
            avaliacoesCache.push(d);
        });
    }

    const filtrados = avaliacoesCache.filter(d => d.mes === mes && d.semana === semana);

    if (filtrados.length === 0) {
        divDash.innerHTML = "<p align='center'>Sem dados.</p>";
        document.getElementById('grafico-geral').style.background = '#eee';
        return;
    }

    let html = "<ul style='padding:0; list-style:none;'>";
    const totais = {};
    const somaGeral = [0, 0, 0, 0, 0, 0, 0, 0];

    filtrados.forEach(d => {
        if (!totais[d.nome]) totais[d.nome] = 0;
        totais[d.nome] += d.total;
        d.notas.forEach((n, i) => somaGeral[i] += n);
    });

    const ranking = Object.entries(totais).sort((a, b) => b[1] - a[1]);

    if (ranking.length > 0) {
        document.getElementById('nome-destaque').innerText = ranking[0][0];
        document.getElementById('pontos-destaque').innerText = ranking[0][1];
        cardDestaque.style.display = 'block';
    }

    ranking.forEach(([nome, total]) => {
        html += `<li onclick="abrirDetalhes('${nome}')" style="background:#f9f9f9; border-bottom:1px solid #eee; padding:15px; display:flex; justify-content:space-between; cursor:pointer;">
            <span>👤 ${nome}</span><strong>${total} pts</strong>
        </li>`;
    });
    divDash.innerHTML = html + "</ul>";
    gerarGraficoPizza(somaGeral, 'grafico-geral', 'legenda-geral');
}

// --- 5. DETALHES ---
window.abrirDetalhes = function (nome) {
    const modal = document.getElementById('modal-detalhes');
    const lista = document.getElementById('lista-historico');
    document.getElementById('titulo-detalhe').innerText = nome;
    lista.innerHTML = "";

    const dados = avaliacoesCache.filter(d => d.nome === nome);
    const soma = [0, 0, 0, 0, 0, 0, 0, 0];

    dados.forEach(d => {
        lista.innerHTML += `
            <li style="border-bottom:1px solid #ddd; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                <span>${d.mes} (${d.semana}) <br> <b>${d.total} pts</b></span>
                <button class="btn-danger" onclick="excluirAvaliacao('${d.id}', '${nome}')">🗑️ Excluir</button>
            </li>`;
        d.notas.forEach((n, i) => soma[i] += n);
    });
    modal.classList.remove('hidden');
    setTimeout(() => gerarGraficoPizza(soma, 'grafico-individual'), 100);
}

window.excluirAvaliacao = async function (id, nome) {
    if (confirm("Deseja excluir?")) {
        await deleteDoc(doc(db, "avaliacoes", id));
        registrarLog("Exclusão", `Excluiu nota de ${nome}`);
        avaliacoesCache = avaliacoesCache.filter(i => i.id !== id);
        alert("Excluído!");
        abrirDetalhes(nome);
        atualizarDashboard();
    }
}
window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.add('hidden');

function gerarGraficoPizza(dados, idGrafico, idLegenda = null) {
    const total = dados.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    let grad = [], atual = 0, leg = "";
    dados.forEach((v, i) => {
        if (v > 0) {
            const ang = (v / total) * 360;
            grad.push(`${coresGrafico[i]} ${atual}deg ${atual + ang}deg`);
            atual += ang;
            if (idLegenda) leg += `<div class="legenda-item"><span class="cor-bolinha" style="background:${coresGrafico[i]}"></span>${nomesCategorias[i]}</div>`;
        }
    });
    document.getElementById(idGrafico).style.background = `conic-gradient(${grad.join(', ')})`;
    if (idLegenda) document.getElementById(idLegenda).innerHTML = leg;
}

// --- 6. ADMIN (CARREGAR LOGS) ---
window.carregarLogs = async function () {
    const lista = document.getElementById('lista-logs');
    lista.innerHTML = "Carregando...";

    // Busca os últimos 20 logs ordenados por data
    const q = query(collection(db, "logs"), orderBy("data", "desc"), limit(20));
    const snap = await getDocs(q);

    lista.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        const dataFormatada = new Date(d.data).toLocaleString('pt-BR');

        lista.innerHTML += `
            <li class="log-item log-tipo-${d.acao.split(' ')[0]}">
                <div class="log-header">
                    <span>${dataFormatada}</span>
                    <span class="log-email">${d.usuario}</span>
                </div>
                <div class="log-texto">
                    ${d.acao}: ${d.detalhes}
                </div>
            </li>
        `;
    });

    if (snap.empty) lista.innerHTML = "<p align='center'>Nenhum registro encontrado.</p>";
}

// --- 7. NAVEGAÇÃO CORRIGIDA ✅ ---
window.navegar = function (aba) {
    // Esconde todas as telas e desativa botões
    ['config', 'avaliar', 'dashboard', 'admin'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');

        const btn = document.getElementById('nav-' + id);
        if (btn) btn.classList.remove('active');
    });

    // Mostra a tela certa
    const telaDestino = document.getElementById('sec-' + aba);
    if (telaDestino) telaDestino.classList.remove('hidden');

    const btnDestino = document.getElementById('nav-' + aba);
    if (btnDestino) btnDestino.classList.add('active');

    // Executa ações específicas
    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'admin') carregarLogs();
}

// Eventos de clique
document.getElementById('nav-config').onclick = () => navegar('config');
document.getElementById('nav-avaliar').onclick = () => navegar('avaliar');
document.getElementById('nav-dashboard').onclick = () => navegar('dashboard');
document.getElementById('nav-admin').onclick = () => navegar('admin');