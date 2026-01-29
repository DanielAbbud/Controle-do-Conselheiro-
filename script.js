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
    sendPasswordResetEmail,
    updateProfile
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

const nomesCategorias = ["Frequencia", "Devoção Matinal", "Uniforme", "Higiene", "Materiais", "Ano Bíblico", "Classe Biblica", "Disciplina."];
const coresGrafico = ['#FF5722', '#FFC107', '#4CAF50', '#03A9F4', '#9C27B0', '#E91E63', '#795548', '#607D8B'];


// --- FUNÇÃO DETECTAR DISPOSITIVO 📱 ---
function detectarDispositivo() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return "📱 Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "📱 iPhone/iPad";
    if (/Windows/i.test(ua)) return "💻 Windows";
    if (/Mac/i.test(ua)) return "💻 Mac";
    if (/Linux/i.test(ua)) return "💻 Linux";
    return "🌐 Outro";
}

// --- FUNÇÃO ESPIÃ (LOGS CRÍTICOS) 🕵️‍♂️ ---
async function registrarLog(acao, detalhes) {
    let identificacao = "Desconhecido";

    if (userAtual) {
        identificacao = userAtual.displayName
            ? `${userAtual.displayName} (${userAtual.email})`
            : userAtual.email;
    } else {
        const emailTentativa = document.getElementById('email-input')?.value;
        if (emailTentativa) identificacao = `Tentativa: ${emailTentativa}`;
    }

    try {
        await addDoc(collection(db, "logs"), {
            usuario: identificacao,
            uid: userAtual ? userAtual.uid : "anonimo",
            acao: acao,
            detalhes: detalhes,
            data: new Date().toISOString(),
            dispositivo: detectarDispositivo(),
            navegador: navigator.userAgent
        });
        console.log(`📝 Log Importante: ${acao}`);
    } catch (e) {
        console.error("Erro log:", e);
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
        document.getElementById('nome-input').classList.remove('hidden');
        document.getElementById('nome-input').focus();
    } else {
        document.getElementById('titulo-login').innerText = "Bem-vindo!";
        document.getElementById('btn-entrar-email').classList.remove('hidden');
        document.getElementById('btn-criar-conta').classList.add('hidden');
        document.getElementById('txt-toggle').innerText = "Não tem conta?";
        document.getElementById('link-toggle').innerText = "Crie uma aqui";
        document.getElementById('nome-input').classList.add('hidden');
    }
});

document.getElementById('btn-esqueci-senha').addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    if (!email) {
        alert("⚠️ Digite seu email primeiro.");
        return;
    }
    registrarLog("Segurança", `Solicitou reset de senha para: ${email}`);
    sendPasswordResetEmail(auth, email)
        .then(() => alert("📧 Email enviado!"))
        .catch((error) => alert("Erro: " + error.message));
});

document.getElementById('btn-entrar-email').addEventListener('click', () => {
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;
    signInWithEmailAndPassword(auth, email, senha)
        .catch((error) => tratarErroLogin(error));
});

document.getElementById('btn-criar-conta').addEventListener('click', async () => {
    const nome = document.getElementById('nome-input').value.trim();
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;

    if (!nome) return alert("⚠️ Digite seu nome.");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;
        await updateProfile(user, { displayName: nome });

        userAtual = user;
        registrarLog("Conta", `Novo usuário cadastrado: ${nome}`);

        alert(`🎉 Bem-vindo, ${nome}!`);
        document.getElementById('user-name').innerText = nome;
    } catch (error) {
        tratarErroLogin(error);
    }
});

document.getElementById('btn-login-google').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => alert("Erro: " + e.message));
});

function tratarErroLogin(error) {
    let msg = error.message;
    if (error.code === 'auth/invalid-email') msg = "Email inválido.";
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') msg = "Senha incorreta.";

    registrarLog("Erro Login", `Falha ao entrar: ${msg}`);

    alert("Atenção: " + msg);
}

document.getElementById('btn-logout').addEventListener('click', () => {
    registrarLog("Logout", "Saiu do sistema");
    signOut(auth);
});

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
    document.getElementById('cfgNomeConselheiro').value = userAtual.displayName || "";

    const docSnap = await getDoc(doc(db, "configuracoes", userAtual.uid));
    const selectCorrecao = document.getElementById('selMembroCorrecao');
    if (selectCorrecao) selectCorrecao.innerHTML = "<option value=''>Selecione para corrigir...</option>";

    if (docSnap.exists()) {
        dadosUnidade = docSnap.data();
        document.getElementById('cfgUnidade').value = dadosUnidade.unidade || "";
        document.getElementById('cfgMembros').value = (dadosUnidade.membros || []).join('\n');

        if (dadosUnidade.membros && selectCorrecao) {
            dadosUnidade.membros.forEach(nome => {
                let option = document.createElement("option");
                option.text = nome;
                option.value = nome;
                selectCorrecao.add(option);
            });
        }
    }
}

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const nomeConselheiro = document.getElementById('cfgNomeConselheiro').value.trim();
    const unidade = document.getElementById('cfgUnidade').value;
    const membros = document.getElementById('cfgMembros').value.split('\n').filter(n => n.trim());

    await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade, membros });

    if (nomeConselheiro) {
        await updateProfile(userAtual, { displayName: nomeConselheiro }).then(() => {
            document.getElementById('user-name').innerText = nomeConselheiro;
        });
    }

    registrarLog("Configuração", `Alterou dados da Unidade ou Membros`);
    dadosUnidade = { unidade, membros };
    carregarConfiguracao();
    alert("✅ Salvo com sucesso!");
    navegar('avaliar');
});


// --- 3. AVALIAÇÃO ---
let wizardIndex = 0;

document.getElementById('btn-iniciar').addEventListener('click', () => {
    if (!dadosUnidade.membros?.length) return alert("Cadastre membros na Config!");
    wizardIndex = 0;
    abrirWizard();
});

document.getElementById('btn-corrigir').addEventListener('click', () => {
    const nomeAlvo = document.getElementById('selMembroCorrecao').value;
    if (!nomeAlvo) return alert("Selecione um membro!");

    const indexEncontrado = dadosUnidade.membros.indexOf(nomeAlvo);
    if (indexEncontrado !== -1) {
        wizardIndex = indexEncontrado;
        abrirWizard();
    }
});

function abrirWizard() {
    document.getElementById('wizard-form').classList.remove('hidden');
    document.getElementById('wizard-form').scrollIntoView({ behavior: 'smooth' });
    carregarMembroWizard();
}

function carregarMembroWizard() {
    document.getElementById('wiz-nome').innerText = dadosUnidade.membros[wizardIndex];
    document.getElementById('contador-passo').innerText = `${wizardIndex + 1} de ${dadosUnidade.membros.length}`;
    for (let i = 1; i <= 8; i++) document.getElementById('n' + i).value = '';
    document.getElementById('n1').focus();
}

// SALVAR AVALIAÇÃO (AÇÃO IMPORTANTE - TEM LOG)
document.getElementById('btn-proximo').addEventListener('click', async () => {
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
        let acaoLog = "Avaliação";

        if (docSnap.exists()) {
            if (!confirm(`⚠️ ${nomeMembro} JÁ TEM NOTA. Sobrescrever?`)) return;
            acaoLog = "Alteração";
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

        registrarLog(acaoLog, `${nomeMembro} (${total} pts) | ${mes}/${semana}`);

        avaliacoesCache = [];
        avancarProximoMembro();
    } catch (error) {
        alert("Erro: " + error.message);
        registrarLog("Erro Sistema", `Falha ao salvar nota: ${error.message}`);
    }
});

function avancarProximoMembro() {
    wizardIndex++;
    if (wizardIndex < dadosUnidade.membros.length) {
        carregarMembroWizard();
    } else {
        alert("🎉 Finalizado!");
        fecharWizard();
        navegar('dashboard');
    }
}

window.fecharWizard = function () {
    document.getElementById('wizard-form').classList.add('hidden');
    document.getElementById('selMembroCorrecao').value = "";
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// EXCLUIR (AÇÃO IMPORTANTE - TEM LOG)
window.excluirAvaliacao = async function (id, nome) {
    if (confirm("Deseja excluir?")) {
        await deleteDoc(doc(db, "avaliacoes", id));
        registrarLog("Exclusão", `Excluiu nota de: ${nome}`);
        avaliacoesCache = avaliacoesCache.filter(i => i.id !== id);
        alert("Excluído!");
        abrirDetalhes(nome);
        atualizarDashboard();
    }
}
window.fecharDetalhes = () => {
    document.getElementById('modal-detalhes').classList.add('hidden');
}

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

// --- 6. ADMIN COM FILTRO DE DATA 📅 ---
window.carregarLogs = async function () {
    const lista = document.getElementById('lista-logs');
    const dataFiltro = document.getElementById('filtroDataAdmin').value;
    lista.innerHTML = "Carregando...";

    let q;

    if (dataFiltro) {
        // Lógica de filtro: Dia completo (00:00 até 23:59)
        // Criando datas em ISO String para o Firebase entender
        const start = new Date(dataFiltro);
        start.setUTCHours(0, 0, 0, 0); // Ajuste UTC para garantir o dia correto

        const end = new Date(dataFiltro);
        end.setUTCHours(23, 59, 59, 999);

        // AQUI: Firestore exige o ISO String para comparar
        // Como o input date vem YYYY-MM-DD, a conversão é simples
        // Porem, para evitar problemas de fuso, comparamos Strings

        q = query(collection(db, "logs"),
            where("data", ">=", start.toISOString()),
            where("data", "<=", end.toISOString()),
            orderBy("data", "desc")
        );
    } else {
        // Padrão: Últimos 50
        q = query(collection(db, "logs"), orderBy("data", "desc"), limit(50));
    }

    try {
        const snap = await getDocs(q);
        lista.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const dataFormatada = new Date(d.data).toLocaleString('pt-BR');
            const dispositivo = d.dispositivo || "❓ Desc.";

            let cor = "#ccc";
            if (d.acao.includes("Erro")) cor = "#f44336";
            if (d.acao.includes("Avaliação") || d.acao.includes("Alteração")) cor = "#2196F3";
            if (d.acao.includes("Exclusão")) cor = "#D32F2F";
            if (d.acao.includes("Login") || d.acao.includes("Conta")) cor = "#4CAF50";

            lista.innerHTML += `
                <li class="log-item" style="border-left: 4px solid ${cor}">
                    <div class="log-header">
                        <span>${dataFormatada}</span>
                        <span class="log-email" title="${dispositivo}">${dispositivo} | ${d.usuario}</span>
                    </div>
                    <div class="log-texto">
                        <strong>${d.acao}:</strong> ${d.detalhes}
                    </div>
                </li>
            `;
        });
        if (snap.empty) lista.innerHTML = "<p align='center'>Nenhum registro encontrado para esta data.</p>";

    } catch (error) {
        console.error(error);
        // Fallback caso falte índice composto no Firebase (raro com essa estrutura)
        lista.innerHTML = "<p align='center' style='color:red'>Erro ao filtrar. Tente sem data.</p>";
    }
}

// --- 7. NAVEGAÇÃO ---
window.navegar = function (aba) {
    ['config', 'avaliar', 'dashboard', 'admin'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');
        const btn = document.getElementById('nav-' + id);
        if (btn) btn.classList.remove('active');
    });
    const telaDestino = document.getElementById('sec-' + aba);
    if (telaDestino) telaDestino.classList.remove('hidden');
    const btnDestino = document.getElementById('nav-' + aba);
    if (btnDestino) btnDestino.classList.add('active');
    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'admin') carregarLogs();
}

document.getElementById('nav-config').onclick = () => navegar('config');
document.getElementById('nav-avaliar').onclick = () => navegar('avaliar');
document.getElementById('nav-dashboard').onclick = () => navegar('dashboard');
document.getElementById('nav-admin').onclick = () => navegar('admin');