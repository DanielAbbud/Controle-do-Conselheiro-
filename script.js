import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc,
    query, where, getDocs, deleteDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let idEmEdicao = null;
let nomeAntigoEmEdicao = null;

const nomesCategorias = ["Frequencia", "Devoção Matinal", "Uniforme", "Higiene.", "Classe Biblica", "Ano Bíblico", "Materiais", "Disciplina."];
const coresGrafico = ['#FF5722', '#FFC107', '#4CAF50', '#03A9F4', '#9C27B0', '#E91E63', '#795548', '#607D8B'];

// --- UTILITÁRIO: SWEETALERT ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// --- FUNÇÕES DE INTERFACE ---
window.toggleSenha = function () {
    const input = document.getElementById('senha-input');
    const olho = document.getElementById('olho-senha');
    if (input.type === "password") {
        input.type = "text";
        olho.classList.replace('fa-eye-slash', 'fa-eye');
        olho.style.color = "#E65100";
    } else {
        input.type = "password";
        olho.classList.replace('fa-eye', 'fa-eye-slash');
        olho.style.color = "#666";
    }
}

function detectingDevice() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return "📱 Android";
    if (/iPhone/i.test(ua)) return "📱 iPhone";
    if (/Windows/i.test(ua)) return "💻 Windows";
    return "🌐 Outro";
}

async function registrarLog(acao, detalhes) {
    let id = userAtual ? `${userAtual.displayName} (${userAtual.email})` : document.getElementById('email-input')?.value || "Anonimo";
    try {
        await addDoc(collection(db, "logs"), {
            usuario: id,
            uid: userAtual ? userAtual.uid : "anonimo",
            acao, detalhes,
            data: new Date().toISOString(),
            dispositivo: detectingDevice()
        });
    } catch (e) { console.error(e); }
}

// --- AUTENTICAÇÃO ---
document.getElementById('link-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    const login = document.getElementById('btn-entrar-email').classList.contains('hidden');
    if (login) {
        document.getElementById('titulo-login').innerText = "Bem-vindo!";
        document.getElementById('btn-entrar-email').classList.remove('hidden');
        document.getElementById('btn-criar-conta').classList.add('hidden');
        document.getElementById('nome-input').classList.add('hidden');
        document.getElementById('txt-toggle').innerText = "Não tem conta?";
        document.getElementById('link-toggle').innerText = "Crie uma aqui";
    } else {
        document.getElementById('titulo-login').innerText = "Criar Conta";
        document.getElementById('btn-entrar-email').classList.add('hidden');
        document.getElementById('btn-criar-conta').classList.remove('hidden');
        document.getElementById('nome-input').classList.remove('hidden');
        document.getElementById('txt-toggle').innerText = "Já tem conta?";
        document.getElementById('link-toggle').innerText = "Faça login";
    }
});

document.getElementById('btn-entrar-email').addEventListener('click', () => {
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;
    if (!email || !senha) return Swal.fire('Erro', 'Preencha email e senha', 'warning');
    signInWithEmailAndPassword(auth, email, senha).catch(e => Swal.fire('Erro', e.message, 'error'));
});

document.getElementById('btn-criar-conta').addEventListener('click', async () => {
    const nome = document.getElementById('nome-input').value;
    const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value;
    if (!nome) return Swal.fire('Erro', 'Digite seu nome', 'warning');
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(cred.user, { displayName: nome });
        userAtual = cred.user;
        registrarLog("Conta", `Criou conta: ${nome}`);
        Swal.fire('Sucesso', `Bem-vindo ${nome}!`, 'success');
    } catch (e) { Swal.fire('Erro', e.message, 'error'); }
});

document.getElementById('btn-login-google').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => Swal.fire('Erro', e.message, 'error'));
});

document.getElementById('btn-logout').addEventListener('click', () => {
    registrarLog("Logout", "Saiu");
    signOut(auth);
});

// --- LISTA DE ADMINS ---
const ADMINS = [
    "V7FUkGG035dQiBo5FoB3DVYF14N2", // Daniel
    "U6Oi4O5scdY70e43bLMGJZf82m1"   // Sérgio
];

onAuthStateChanged(auth, (user) => {
    if (user) {
        userAtual = user;
        registrarLog("Login", "Entrou");
        document.getElementById('tela-login').classList.add('hidden');
        document.getElementById('app-principal').style.display = 'block';
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName;

        document.getElementById('nav-admin').style.display = ADMINS.includes(user.uid) ? "inline-block" : "none";

        carregarConfiguracao();
    } else {
        userAtual = null;
        document.getElementById('tela-login').classList.remove('hidden');
        document.getElementById('app-principal').style.display = 'none';
        document.getElementById('btn-logout').classList.add('hidden');
    }
});

// --- GESTÃO DE CADASTRO (CONFIG) ---
async function carregarConfiguracao() {
    if (!userAtual) return;
    document.getElementById('cfgNomeConselheiro').value = userAtual.displayName || "";

    const docSnap = await getDoc(doc(db, "configuracoes", userAtual.uid));
    const listaMembros = document.getElementById('lista-membros-config');
    const selectCorrecao = document.getElementById('selMembroCorrecao');

    if (selectCorrecao) selectCorrecao.innerHTML = "<option value=''>Selecione...</option>";
    if (listaMembros) listaMembros.innerHTML = "";

    if (docSnap.exists()) {
        dadosUnidade = docSnap.data();
        document.getElementById('cfgUnidade').value = dadosUnidade.unidade || "";

        if (dadosUnidade.membros && dadosUnidade.membros.length > 0) {
            dadosUnidade.membros.forEach(nome => {
                if (listaMembros) {
                    listaMembros.innerHTML += `
                        <li onclick="abrirFicha('${nome}')" style="padding: 12px 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;">
                            <span style="font-weight: 500; display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-user" style="color:#ccc;"></i> ${nome}
                            </span>
                            <span style="background: #e3f2fd; color: #1565C0; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; border:1px solid #bbdefb;">
                                Ver Ficha
                            </span>
                        </li>`;
                }
                if (selectCorrecao) {
                    let opt = document.createElement("option");
                    opt.value = nome;
                    opt.text = nome;
                    selectCorrecao.add(opt);
                }
            });
        } else if (listaMembros) {
            listaMembros.innerHTML = "<li style='text-align:center; color:#999; padding: 20px;'>Nenhum membro cadastrado.<br>Clique no botão acima para adicionar.</li>";
        }
    }
}

// --- FUNÇÃO: ABRIR FICHA (CONFIG) ---
window.abrirFicha = async function (nome) {
    const modal = document.getElementById('modal-ficha');
    const corpo = document.getElementById('corpo-ficha');
    const headerUnidade = document.getElementById('ficha-unidade');

    headerUnidade.innerText = document.getElementById('cfgUnidade').value || "S/ UNIDADE";
    corpo.innerHTML = "Carregando dados...";
    modal.classList.remove('hidden');

    try {
        const q = query(collection(db, "membros_detalhados"),
            where("uid_conselheiro", "==", userAtual.uid),
            where("nome", "==", nome));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const d = snap.docs[0].data();
            const docId = snap.docs[0].id;

            // NA CONFIG SÓ APARECE EDITAR
            corpo.innerHTML = `
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:10px; display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-user-circle" style="color:#777;"></i> ${d.nome} <span style="font-weight:normal; font-size:0.9rem; color:#666;">(Idade: ${d.idade || '?'})</span>
                </div>
                <div style="margin-bottom:8px;">
                    <i class="fa-solid fa-phone" style="color:#E65100; width:20px;"></i> <strong>Mãe:</strong> ${d.mae} (${d.tel_mae})
                </div>
                <div style="margin-bottom:8px;">
                    <i class="fa-solid fa-phone" style="color:#E65100; width:20px;"></i> <strong>Pai:</strong> ${d.pai} (${d.tel_pai})
                </div>
                <div>
                    <i class="fa-solid fa-map-pin" style="color:#D32F2F; width:20px;"></i> ${d.endereco}, ${d.numero}
                </div>
                
                <hr style="margin: 20px 0 10px 0; border:0; border-top:1px solid #eee;">
                
                <div style="display:flex; justify-content: flex-end;">
                    <button onclick="prepararEdicao('${docId}', '${nome.replace(/'/g, "\\'")}')" class="btn" style="border:1px solid #E65100; color:#E65100; font-size:0.9rem; padding: 8px 25px;">
                        <i class="fa-solid fa-pencil"></i> Editar
                    </button>
                </div>
            `;
        } else {
            corpo.innerHTML = "<div style='text-align:center; padding:20px; color:#999;'>Ficha incompleta (nome na lista, mas sem dados).</div>";
        }
    } catch (e) {
        console.error(e);
        corpo.innerHTML = "<div style='color:red'>Erro ao carregar.</div>";
    }
}

// --- EDITAR E EXCLUIR ---
window.prepararEdicao = async (id, nome) => {
    try {
        const docSnap = await getDoc(doc(db, "membros_detalhados", id));
        if (docSnap.exists()) {
            const d = docSnap.data();

            document.getElementById('cad-nome').value = d.nome || "";
            document.getElementById('cad-nasc').value = d.nasc || "";
            document.getElementById('cad-idade').value = d.idade || "";
            document.getElementById('cad-mae').value = d.mae || "";
            document.getElementById('cad-tel-mae').value = d.tel_mae || "";
            document.getElementById('cad-pai').value = d.pai || "";
            document.getElementById('cad-tel-pai').value = d.tel_pai || "";
            document.getElementById('cad-endereco').value = d.endereco || "";
            document.getElementById('cad-numero').value = d.numero || "";
            document.getElementById('cad-bairro').value = d.bairro || "";
            document.getElementById('cad-cidade').value = d.cidade || "";
            document.getElementById('cad-uf').value = d.uf || "";

            idEmEdicao = id;
            nomeAntigoEmEdicao = d.nome;

            document.getElementById('modal-ficha').classList.add('hidden');
            document.getElementById('modal-cadastro').classList.remove('hidden');
        }
    } catch (e) {
        Swal.fire('Erro', 'Não foi possível editar: ' + e.message, 'error');
    }
}

window.deletarFicha = async (id, nome) => {
    const result = await Swal.fire({
        title: 'Excluir Definitivamente?',
        text: "Isso apagará a ficha e removerá o membro da unidade. Não tem volta!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, remover'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "membros_detalhados", id));
            registrarLog("Exclusão Admin", `Admin removeu: ${nome}`);
            Swal.fire('Pronto', 'Membro removido com sucesso.', 'success');

            document.getElementById('modal-ficha').classList.add('hidden');

            if (!document.getElementById('sec-admin').classList.contains('hidden')) {
                carregarFichasGeral();
            }
            if (!document.getElementById('sec-config').classList.contains('hidden')) {
                carregarConfiguracao();
            }
        } catch (e) {
            if (!document.getElementById('sec-admin').classList.contains('hidden')) {
                carregarFichasGeral();
            }
            Swal.fire('Info', 'Registro processado.', 'success');
        }
    }
}

// --- SALVAR (NOVO OU EDIÇÃO) ---
window.abrirModalCadastro = () => {
    idEmEdicao = null;
    nomeAntigoEmEdicao = null;
    document.querySelectorAll('#modal-cadastro input').forEach(i => i.value = '');
    document.getElementById('modal-cadastro').classList.remove('hidden');
};

window.fecharModalCadastro = () => {
    document.getElementById('modal-cadastro').classList.add('hidden');
};

window.salvarCadastroMembro = async () => {
    const nome = document.getElementById('cad-nome').value.trim();
    if (!nome) return Swal.fire('Atenção', 'O nome é obrigatório!', 'warning');

    const ficha = {
        uid_conselheiro: userAtual.uid,
        unidade: document.getElementById('cfgUnidade').value || "Sem Unidade",
        nome: nome,
        nasc: document.getElementById('cad-nasc').value,
        idade: document.getElementById('cad-idade').value,
        mae: document.getElementById('cad-mae').value,
        tel_mae: document.getElementById('cad-tel-mae').value,
        pai: document.getElementById('cad-pai').value,
        tel_pai: document.getElementById('cad-tel-pai').value,
        endereco: document.getElementById('cad-endereco').value,
        numero: document.getElementById('cad-numero').value,
        bairro: document.getElementById('cad-bairro').value,
        cidade: document.getElementById('cad-cidade').value,
        uf: document.getElementById('cad-uf').value,
        data_cadastro: new Date().toISOString()
    };

    try {
        const docConfigRef = doc(db, "configuracoes", userAtual.uid);
        const docConfigSnap = await getDoc(docConfigRef);
        let listaMembros = docConfigSnap.exists() ? (docConfigSnap.data().membros || []) : [];

        if (idEmEdicao) {
            await updateDoc(doc(db, "membros_detalhados", idEmEdicao), ficha);
            if (nomeAntigoEmEdicao && nomeAntigoEmEdicao !== nome) {
                listaMembros = listaMembros.map(m => m === nomeAntigoEmEdicao ? nome : m);
                await updateDoc(docConfigRef, { membros: listaMembros });
            }
            registrarLog("Edição", `Editou: ${nome}`);
            Swal.fire('Atualizado!', 'Ficha alterada.', 'success');
        } else {
            // 👇 A CORREÇÃO ESTÁ AQUI (Adicionei o parênteses que faltava no 'collection')
            await addDoc(collection(db, "membros_detalhados"), ficha);

            if (!listaMembros.includes(nome)) {
                listaMembros.push(nome);
                await setDoc(docConfigRef, {
                    unidade: ficha.unidade,
                    membros: listaMembros
                }, { merge: true });
            }
            registrarLog("Cadastro", `Novo membro: ${nome}`);
            Swal.fire('Salvo!', 'Membro adicionado.', 'success');
        }

        fecharModalCadastro();

        if (!document.getElementById('sec-admin').classList.contains('hidden')) {
            carregarFichasGeral();
        } else {
            carregarConfiguracao();
        }

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao salvar: ' + e.message, 'error');
    }
};

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const nomeConselheiro = document.getElementById('cfgNomeConselheiro').value;
    const unidade = document.getElementById('cfgUnidade').value;

    await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade }, { merge: true });
    if (nomeConselheiro) await updateProfile(userAtual, { displayName: nomeConselheiro });

    Swal.fire('Salvo', 'Dados atualizados', 'success');
});


// --- ADMINISTRAÇÃO ---
window.alternarVisaoAdmin = (visao) => {
    document.getElementById('admin-view-logs').classList.add('hidden');
    document.getElementById('admin-view-fichas').classList.add('hidden');

    if (visao === 'logs') document.getElementById('admin-view-logs').classList.remove('hidden');
    if (visao === 'fichas') {
        document.getElementById('admin-view-fichas').classList.remove('hidden');
        carregarFichasGeral();
    }
}

window.carregarLogs = async () => {
    const lista = document.getElementById('lista-logs');
    const dataFiltro = document.getElementById('filtroDataAdmin').value;
    lista.innerHTML = "Carregando...";
    let q;
    if (dataFiltro) {
        const start = new Date(dataFiltro); start.setUTCHours(0, 0, 0, 0);
        const end = new Date(dataFiltro); end.setUTCHours(23, 59, 59, 999);
        q = query(collection(db, "logs"), where("data", ">=", start.toISOString()), where("data", "<=", end.toISOString()), orderBy("data", "desc"));
    } else {
        q = query(collection(db, "logs"), orderBy("data", "desc"), limit(50));
    }
    const snap = await getDocs(q);
    lista.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        let cor = d.acao.includes("Erro") ? "#f44336" : "#2196F3";
        lista.innerHTML += `<li style="border-left:4px solid ${cor}; padding:10px; margin-bottom:5px; background:#fff;">
            <small>${new Date(d.data).toLocaleString()}</small><br>
            <strong>${d.usuario}:</strong> ${d.acao} - ${d.detalhes}
        </li>`;
    });
}

window.carregarFichasGeral = async () => {
    const div = document.getElementById('lista-fichas-global');
    div.innerHTML = "<p>Buscando fichas...</p>";
    try {
        const q = query(collection(db, "membros_detalhados"), orderBy("unidade"));
        const snap = await getDocs(q);
        if (snap.empty) { div.innerHTML = "<p>Nenhuma ficha encontrada.</p>"; return; }
        let html = ""; let unidadeAtual = "";

        snap.forEach(doc => {
            const d = doc.data();
            const docId = doc.id;

            if (d.unidade !== unidadeAtual) {
                unidadeAtual = d.unidade;
                html += `<h4 style="background:#E65100; color:white; padding:5px; margin-top:15px;">🛡️ Unidade: ${unidadeAtual}</h4>`;
            }

            html += `
            <div style="background:white; border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:5px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p><strong>👤 ${d.nome}</strong> (Idade: ${d.idade || '?'})</p>
                        <p style="font-size:0.9rem; margin:5px 0;">
                           📞 <strong>Mãe:</strong> ${d.mae} (${d.tel_mae})<br>
                           📞 <strong>Pai:</strong> ${d.pai} (${d.tel_pai})<br>
                           📍 ${d.endereco}, ${d.numero} - ${d.bairro}
                        </p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button onclick="prepararEdicao('${docId}', '${d.nome.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="font-size:0.8rem; padding: 5px 10px;">
                            ✏️ Editar
                        </button>
                        <button onclick="deletarFicha('${docId}', '${d.nome.replace(/'/g, "\\'")}')" class="btn btn-danger" style="font-size:0.8rem; padding: 5px 10px;">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>
            </div>`;
        });
        div.innerHTML = html;
    } catch (e) { console.error(e); div.innerHTML = "<p style='color:red'>Erro ao carregar fichas.</p>"; }
}

// --- AVALIAÇÃO ---
let wizardIndex = 0;
document.getElementById('btn-iniciar').addEventListener('click', () => {
    if (!dadosUnidade.membros?.length) return Swal.fire('Ops', 'Cadastre membros na Config!', 'info');
    wizardIndex = 0; abrirWizard();
});
document.getElementById('btn-corrigir').addEventListener('click', () => {
    const nome = document.getElementById('selMembroCorrecao').value;
    if (!nome) return Swal.fire('Ops', 'Selecione!', 'info');
    wizardIndex = dadosUnidade.membros.indexOf(nome);
    abrirWizard();
});
function abrirWizard() {
    document.getElementById('wizard-form').classList.remove('hidden');
    document.getElementById('wizard-form').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('wiz-nome').innerText = dadosUnidade.membros[wizardIndex];
    document.getElementById('contador-passo').innerText = `${wizardIndex + 1}/${dadosUnidade.membros.length}`;
    for (let i = 1; i <= 8; i++) document.getElementById('n' + i).value = '';
}
document.getElementById('btn-proximo').addEventListener('click', async () => {
    const nome = dadosUnidade.membros[wizardIndex];
    const mes = document.getElementById('selMes').value;
    const semana = document.getElementById('selSemana').value;
    let notas = [], total = 0;
    for (let i = 1; i <= 8; i++) {
        let v = Number(document.getElementById('n' + i).value) || 0;
        notas.push(v); total += v;
    }
    const id = `${userAtual.uid}_${nome.replace(/\s+/g, '')}_${mes}_${semana}`;
    try {
        await setDoc(doc(db, "avaliacoes", id), { uid: userAtual.uid, nome, mes, semana, notas, total, data: new Date().toISOString() });
        Toast.fire({ icon: 'success', title: 'Nota Salva!' });
        avaliacoesCache = [];
        wizardIndex++;
        if (wizardIndex < dadosUnidade.membros.length) abrirWizard();
        else { Swal.fire('Fim', 'Avaliações concluídas', 'success'); fecharWizard(); navegar('dashboard'); }
    } catch (e) { Swal.fire('Erro', e.message, 'error'); }
});
window.fecharWizard = () => document.getElementById('wizard-form').classList.add('hidden');

// --- DASHBOARD E DETALHES ---
window.atualizarDashboard = async () => {
    const div = document.getElementById('lista-dashboard');
    div.innerHTML = "Carregando...";
    const mes = document.getElementById('dashMes').value;
    const semana = document.getElementById('dashSemana').value;
    if (avaliacoesCache.length === 0) {
        const snap = await getDocs(query(collection(db, "avaliacoes"), where("uid", "==", userAtual.uid)));
        snap.forEach(d => { let x = d.data(); x.id = d.id; avaliacoesCache.push(x); });
    }
    const filt = avaliacoesCache.filter(d => d.mes === mes && d.semana === semana);
    if (filt.length === 0) { div.innerHTML = "Sem dados"; return; }
    let html = "<ul style='list-style:none;padding:0'>";
    let totalG = [0, 0, 0, 0, 0, 0, 0, 0];
    filt.sort((a, b) => b.total - a.total).forEach(d => {
        html += `<li onclick="abrirDetalhes('${d.nome}')" style="background:#f9f9f9;padding:10px;margin-bottom:5px;display:flex;justify-content:space-between;cursor:pointer;"><span>👤 ${d.nome}</span><strong>${d.total}</strong></li>`;
        d.notas.forEach((n, i) => totalG[i] += n);
    });
    div.innerHTML = html + "</ul>";

    if (filt.length > 0) {
        document.getElementById('card-destaque').style.display = 'block';
        document.getElementById('nome-destaque').innerText = filt[0].nome;
        document.getElementById('pontos-destaque').innerText = filt[0].total + " pts";
    }
    graficoPizza(totalG, 'grafico-geral', 'legenda-geral');
}

window.abrirDetalhes = function (nome) {
    const modal = document.getElementById('modal-detalhes');
    const lista = document.getElementById('lista-historico');
    document.getElementById('titulo-detalhe').innerText = nome;
    lista.innerHTML = "";

    const dados = avaliacoesCache.filter(d => d.nome === nome);
    const soma = [0, 0, 0, 0, 0, 0, 0, 0];

    dados.forEach(d => {
        lista.innerHTML += `
            <li style="border-bottom:1px solid #eee; padding: 12px 5px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.95rem;">
                    <span style="font-weight:600; color:#333;">${d.mes}</span> 
                    <span style="color:#666;">(${d.semana})</span> 
                    <strong style="color:#E65100; margin-left: 5px;">— ${d.total} pts</strong>
                </div>
                <button onclick="excluirAvaliacao('${d.id}', '${nome}')" style="background:none; border:none; cursor:pointer; color:#999; padding:5px; margin-left:10px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </li>`;
        d.notas.forEach((n, i) => soma[i] += n);
    });

    modal.classList.remove('hidden');
    setTimeout(() => graficoPizza(soma, 'grafico-individual'), 100);
}

window.excluirAvaliacao = async function (id, nome) {
    const result = await Swal.fire({
        title: 'Excluir nota?',
        text: "Essa ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "avaliacoes", id));
            registrarLog("Exclusão", `Excluiu nota de: ${nome}`);
            avaliacoesCache = avaliacoesCache.filter(i => i.id !== id);
            Swal.fire('Pronto', 'Nota apagada.', 'success');
            abrirDetalhes(nome);
            atualizarDashboard();
        } catch (e) {
            Swal.fire('Erro', e.message, 'error');
        }
    }
}

window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.add('hidden');

function graficoPizza(dados, idGraf, idLeg = null) {
    const total = dados.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    let ang = 0, grad = [];
    let legendaHTML = "";
    dados.forEach((v, i) => {
        if (v > 0) {
            let fatia = (v / total) * 360;
            grad.push(`${coresGrafico[i]} ${ang}deg ${ang + fatia}deg`);
            ang += fatia;
            if (idLeg) legendaHTML += `<div class="legenda-item"><span class="cor-bolinha" style="background:${coresGrafico[i]}"></span>${nomesCategorias[i]}</div>`;
        }
    });
    document.getElementById(idGraf).style.background = `conic-gradient(${grad.join(', ')})`;
    if (idLeg) document.getElementById(idLeg).innerHTML = legendaHTML;
}

window.navegar = (aba) => {
    ['config', 'avaliar', 'dashboard', 'admin'].forEach(id => document.getElementById('sec-' + id).classList.add('hidden'));
    document.getElementById('sec-' + aba).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + aba).classList.add('active');
    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'admin') carregarLogs();
}
document.getElementById('nav-config').onclick = () => navegar('config');
document.getElementById('nav-avaliar').onclick = () => navegar('avaliar');
document.getElementById('nav-dashboard').onclick = () => navegar('dashboard');
document.getElementById('nav-admin').onclick = () => navegar('admin');


// =========================================
// RECUPERAÇÃO DE SENHA (ESQUECI MINHA SENHA)
// =========================================
const btnEsqueci = document.getElementById('btn-esqueci-senha');

if (btnEsqueci) {
    btnEsqueci.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que a tela pule pro topo

        const email = document.getElementById('email-input').value;

        if (!email) {
            Swal.fire({
                icon: 'warning',
                title: 'Digite seu e-mail!',
                text: 'Preencha o campo de e-mail acima antes de clicar em "Esqueci minha senha".'
            });
            return;
        }

        sendPasswordResetEmail(auth, email)
            .then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'E-mail Enviado!',
                    text: 'Verifique sua caixa de entrada (e o Spam) para criar uma nova senha.'
                });
            })
            .catch((error) => {
                console.error("Erro ao recuperar senha:", error);
                let msg = "Erro ao enviar e-mail.";
                if (error.code === 'auth/user-not-found') msg = "E-mail não cadastrado.";
                if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";

                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: msg
                });
            });
    });
}