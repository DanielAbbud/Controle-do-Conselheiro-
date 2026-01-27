import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
        .then(() => console.log("Logado!"))
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
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        userAtual = user;
        document.getElementById('tela-login').classList.add('hidden');
        document.getElementById('app-principal').style.display = 'block';
        document.getElementById('btn-logout').classList.remove('hidden');

        let nomeExibicao = user.displayName || user.email;
        document.getElementById('user-name').innerText = nomeExibicao;
        carregarConfiguracao();
    } else {
        userAtual = null;
        document.getElementById('user-name').innerText = "";
        dadosUnidade = { unidade: "", membros: [] };
        avaliacoesCache = [];

        document.getElementById('cfgUnidade').value = "";
        document.getElementById('cfgMembros').value = "";
        document.getElementById('lista-dashboard').innerHTML = "";
        const grafico = document.getElementById('grafico-geral');
        if (grafico) grafico.style.background = "#ddd";

        document.getElementById('tela-login').classList.remove('hidden');
        document.getElementById('app-principal').style.display = 'none';
        document.getElementById('btn-logout').classList.add('hidden');
    }
});


// --- 2. CONFIGURAÇÃO ---
async function carregarConfiguracao() {
    if (!userAtual) return;
    document.getElementById('cfgUnidade').value = "";
    document.getElementById('cfgMembros').value = "";
    dadosUnidade = { unidade: "", membros: [] };

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

// BOTÃO PRÓXIMO (BLOQUEIA DUPLICADOS)
document.getElementById('btn-proximo').addEventListener('click', async () => {
    if (!dadosUnidade.membros[wizardIndex]) return;

    const nomeMembro = dadosUnidade.membros[wizardIndex];
    const mesSelecionado = document.getElementById('selMes').value;
    const semanaSelecionada = document.getElementById('selSemana').value;

    const notas = [];
    let total = 0;
    for (let i = 1; i <= 8; i++) {
        let val = Number(document.getElementById('n' + i).value) || 0;
        notas.push(val);
        total += val;
    }

    const idUnico = `${userAtual.uid}_${nomeMembro.replace(/\s+/g, '')}_${mesSelecionado}_${semanaSelecionada}`;
    const docRef = doc(db, "avaliacoes", idUnico);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const pular = confirm(`⛔ ${nomeMembro} já tem nota em ${mesSelecionado}/${semanaSelecionada}.\n\nDeseja PULAR para o próximo?`);
            if (pular) avancarProximoMembro();
            return;
        }

        const novaAvaliacao = {
            uid: userAtual.uid,
            nome: nomeMembro,
            mes: mesSelecionado,
            semana: semanaSelecionada,
            notas: notas,
            total: total,
            data: new Date().toISOString()
        };

        await setDoc(docRef, novaAvaliacao);
        console.log("Salvo!");

        // Limpa o cache para que, se formos ao painel, ele baixe tudo novo (com a nova nota)
        avaliacoesCache = [];
        avancarProximoMembro();

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro no sistema: " + error.message);
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


// --- 4. DASHBOARD E GRÁFICOS ---
window.atualizarDashboard = async function () {
    const divDash = document.getElementById('lista-dashboard');
    const cardDestaque = document.getElementById('card-destaque');

    divDash.innerHTML = "Carregando...";
    cardDestaque.style.display = 'none';

    const filtroMes = document.getElementById('dashMes').value;
    const filtroSemana = document.getElementById('dashSemana').value;

    if (avaliacoesCache.length === 0) {
        const q = query(collection(db, "avaliacoes"), where("uid", "==", userAtual.uid));
        const snap = await getDocs(q);
        // IMPORTANTE: Agora salvamos o ID do documento também
        snap.forEach(doc => {
            let dados = doc.data();
            dados.id = doc.id; // Guarda o ID para poder excluir depois
            avaliacoesCache.push(dados);
        });
    }

    const dadosFiltrados = avaliacoesCache.filter(dado =>
        dado.mes === filtroMes && dado.semana === filtroSemana
    );

    if (dadosFiltrados.length === 0) {
        divDash.innerHTML = "<p align='center'>Sem dados nesta semana.</p>";
        document.getElementById('grafico-geral').style.background = '#eee';
        document.getElementById('legenda-geral').innerHTML = "";
        return;
    }

    let html = "<ul style='padding:0; list-style:none;'>";
    const totaisPorMembro = {};
    const somaCategoriasGeral = [0, 0, 0, 0, 0, 0, 0, 0];

    dadosFiltrados.forEach(dado => {
        if (!totaisPorMembro[dado.nome]) totaisPorMembro[dado.nome] = 0;
        totaisPorMembro[dado.nome] += dado.total;
        dado.notas.forEach((nota, i) => somaCategoriasGeral[i] += nota);
    });

    const ranking = Object.entries(totaisPorMembro).sort((a, b) => b[1] - a[1]);

    if (ranking.length > 0) {
        const lider = ranking[0];
        document.getElementById('nome-destaque').innerText = lider[0];
        document.getElementById('pontos-destaque').innerText = lider[1];
        cardDestaque.style.display = 'block';
    }

    ranking.forEach(([nome, total]) => {
        html += `
            <li onclick="abrirDetalhes('${nome}')" style="background:#f9f9f9; border-bottom: 1px solid #eee; margin:0; padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <span>👤 ${nome}</span>
                <span style="color:#555; font-weight:bold;">${total} pts &rarr;</span>
            </li>`;
    });
    html += "</ul>";
    divDash.innerHTML = html;

    gerarGraficoPizza(somaCategoriasGeral, 'grafico-geral', 'legenda-geral');
}


// --- 5. DETALHES (MODAL COM EXCLUIR) ---
window.abrirDetalhes = function (nome) {
    const modal = document.getElementById('modal-detalhes');
    const listaHist = document.getElementById('lista-historico');

    document.getElementById('titulo-detalhe').innerText = "Desempenho: " + nome;
    listaHist.innerHTML = "";

    const dadosMembro = avaliacoesCache.filter(d => d.nome === nome);
    const somaCatMembro = [0, 0, 0, 0, 0, 0, 0, 0];

    dadosMembro.forEach(d => {
        // Gera o botão de excluir com o ID
        listaHist.innerHTML += `
            <li style="border-bottom:1px solid #ddd; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="display:block; font-size:0.9rem; color:#666;">${d.mes} (${d.semana})</span>
                    <strong style="font-size:1.1rem;">${d.total} pts</strong>
                </div>
                <button onclick="excluirAvaliacao('${d.id}', '${nome}')" class="btn-danger" style="width:auto; padding:5px 10px; font-size:0.8rem;">
                    🗑️ Excluir
                </button>
            </li>`;
        d.notas.forEach((n, i) => somaCatMembro[i] += n);
    });

    modal.classList.remove('hidden');

    setTimeout(() => {
        gerarGraficoPizza(somaCatMembro, 'grafico-individual');
    }, 100);
}

// --- NOVA FUNÇÃO: EXCLUIR ---
window.excluirAvaliacao = async function (id, nome) {
    if (confirm("⚠️ Tem certeza que deseja excluir essa avaliação?\n\nDepois de excluir, você poderá avaliar este membro novamente nesta semana.")) {
        try {
            await deleteDoc(doc(db, "avaliacoes", id));

            // Remove do cache local para atualizar a tela sem recarregar tudo
            avaliacoesCache = avaliacoesCache.filter(item => item.id !== id);

            alert("Avaliação excluída com sucesso!");

            // Atualiza o modal (recarrega a lista) e o painel de fundo
            abrirDetalhes(nome);
            atualizarDashboard();

        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
}

window.fecharDetalhes = function () {
    document.getElementById('modal-detalhes').classList.add('hidden');
}

function gerarGraficoPizza(dados, idGrafico, idLegenda = null) {
    const total = dados.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    let gradiente = [];
    let anguloAtual = 0;
    let legendaHTML = "";

    dados.forEach((valor, i) => {
        if (valor > 0) {
            const pct = valor / total;
            const angulo = pct * 360;
            gradiente.push(`${coresGrafico[i]} ${anguloAtual}deg ${anguloAtual + angulo}deg`);
            anguloAtual += angulo;
            if (idLegenda) {
                legendaHTML += `<div class="legenda-item"><span class="cor-bolinha" style="background:${coresGrafico[i]}"></span>${nomesCategorias[i]} (${Math.round(pct * 100)}%)</div>`;
            }
        }
    });
    document.getElementById(idGrafico).style.background = `conic-gradient(${gradiente.join(', ')})`;
    if (idLegenda) document.getElementById(idLegenda).innerHTML = legendaHTML;
}


// --- 6. NAVEGAÇÃO ---
window.navegar = function (aba) {
    ['config', 'avaliar', 'dashboard'].forEach(id => {
        document.getElementById('sec-' + id).classList.add('hidden');
        document.getElementById('nav-' + id).classList.remove('active');
    });
    document.getElementById('sec-' + aba).classList.remove('hidden');
    document.getElementById('nav-' + aba).classList.add('active');

    if (aba === 'dashboard') atualizarDashboard();
}

document.getElementById('nav-config').onclick = () => navegar('config');
document.getElementById('nav-avaliar').onclick = () => navegar('avaliar');
document.getElementById('nav-dashboard').onclick = () => navegar('dashboard');