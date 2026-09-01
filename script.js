import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc,
    query, where, getDocs, deleteDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged,
    signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

let userAtual = null;
let dadosUnidade = { unidade: "", membros: [] };
let avaliacoesCache = [];
let idEmEdicao = null;
let nomeAntigoEmEdicao = null;

const nomesCategorias = ["Frequencia", "Devoção Matinal", "Uniforme", "Higiene.", "Classe Biblica", "Ano Bíblico", "Materiais", "Disciplina."];
const coresGrafico = ['#FF5722', '#FFC107', '#4CAF50', '#03A9F4', '#9C27B0', '#E91E63', '#795548', '#607D8B'];

// LISTA DE ADMINS (UIDs do Firebase)
const ADMINS = [
    "R5dbzU8OsJc21IU7cx6gPAMomrA2", // Daniel Quintela
    "KqLW3du260V0g3x9XBNWvr5bNLf2"  // Sergio Lima
];

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 4000, timerProgressBar: true,
    didOpen: (toast) => { toast.addEventListener('mouseenter', Swal.stopTimer); toast.addEventListener('mouseleave', Swal.resumeTimer); }
});

// --- FUNÇÕES DE INTERFACE ---
window.toggleSenha = function () {
    const input = document.getElementById('senha-input'); const olho = document.getElementById('olho-senha');
    if (input.type === "password") { input.type = "text"; olho.classList.replace('fa-eye-slash', 'fa-eye'); olho.style.color = "#E65100"; }
    else { input.type = "password"; olho.classList.replace('fa-eye', 'fa-eye-slash'); olho.style.color = "#666"; }
}
function detectingDevice() { const ua = navigator.userAgent; if (/Android/i.test(ua)) return "📱 Android"; if (/iPhone/i.test(ua)) return "📱 iPhone"; if (/Windows/i.test(ua)) return "💻 Windows"; return "🌐 Outro"; }

document.getElementById('link-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    const login = document.getElementById('btn-entrar-email').classList.contains('hidden');
    if (login) {
        document.getElementById('titulo-login').innerText = "Bem-vindo!";
        document.getElementById('btn-entrar-email').classList.remove('hidden'); document.getElementById('btn-criar-conta').classList.add('hidden');
        document.getElementById('nome-input').classList.add('hidden'); document.getElementById('reg-unidade').classList.add('hidden');
        document.getElementById('box-termos').classList.add('hidden'); // ESCONDE OS TERMOS NO LOGIN
        document.getElementById('txt-toggle').innerText = "Não tem conta?"; document.getElementById('link-toggle').innerText = "Crie uma aqui";
    } else {
        document.getElementById('titulo-login').innerText = "Criar Conta";
        document.getElementById('btn-entrar-email').classList.add('hidden'); document.getElementById('btn-criar-conta').classList.remove('hidden');
        document.getElementById('nome-input').classList.remove('hidden'); document.getElementById('reg-unidade').classList.remove('hidden');
        document.getElementById('box-termos').classList.remove('hidden'); // MOSTRA OS TERMOS NO CADASTRO
        document.getElementById('txt-toggle').innerText = "Já tem conta?"; document.getElementById('link-toggle').innerText = "Faça login";
    }
});

document.getElementById('btn-entrar-email').addEventListener('click', () => {
    const email = document.getElementById('email-input').value; const senha = document.getElementById('senha-input').value;
    if (!email || !senha) return Swal.fire('Erro', 'Preencha email e senha', 'warning');
    signInWithEmailAndPassword(auth, email, senha).catch(e => Swal.fire('Erro', e.message, 'error'));
});

document.getElementById('btn-criar-conta').addEventListener('click', async () => {
    const nome = document.getElementById('nome-input').value; const email = document.getElementById('email-input').value;
    const senha = document.getElementById('senha-input').value; const unidadeSelecionada = document.getElementById('reg-unidade').value;
    const termosAceitos = document.getElementById('check-termos').checked;

    if (!nome) return Swal.fire('Erro', 'Digite seu nome', 'warning');
    if (!unidadeSelecionada) return Swal.fire('Erro', 'Selecione sua unidade!', 'warning');
    if (!termosAceitos) return Swal.fire('Atenção', 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta!', 'warning');

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(cred.user, { displayName: nome }); userAtual = cred.user;
        await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade: unidadeSelecionada, nome_conselheiro: nome, membros: [] });
        registrarLog("Conta", `Criou conta: ${nome} | Unidade: ${unidadeSelecionada}`);
        Swal.fire('Sucesso', `Bem-vindo à unidade ${unidadeSelecionada}!`, 'success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (e) { Swal.fire('Erro', e.message, 'error'); }
});

document.getElementById('btn-login-google').addEventListener('click', () => { signInWithPopup(auth, provider).catch(e => Swal.fire('Erro', e.message, 'error')); });
document.getElementById('btn-logout').addEventListener('click', () => { registrarLog("Logout", "Saiu"); signOut(auth).then(() => { userAtual = null; dadosUnidade = { unidade: "", membros: [] }; avaliacoesCache = []; window.location.reload(); }); });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userAtual = user; document.getElementById('tela-login').classList.add('hidden');
        const docSnap = await getDoc(doc(db, "configuracoes", user.uid));
        if (docSnap.exists() && docSnap.data().unidade) dadosUnidade.unidade = docSnap.data().unidade;
        registrarLog("Login", "Entrou");

        if (!docSnap.exists() || !docSnap.data().unidade) {
            document.getElementById('app-principal').classList.add('hidden'); document.getElementById('btn-logout').classList.remove('hidden'); document.getElementById('modal-setup-inicial').classList.remove('hidden');
        } else {
            document.getElementById('app-principal').classList.remove('hidden'); document.getElementById('app-principal').style.display = 'block';
            document.getElementById('btn-logout').classList.remove('hidden'); document.getElementById('modal-setup-inicial').classList.add('hidden');
            const nomeExibicao = user.displayName || user.email.split('@')[0];
            const elemNome = document.getElementById('user-name'); if (elemNome) elemNome.innerText = nomeExibicao;
            document.getElementById('nav-admin').style.display = ADMINS.includes(user.uid) ? "inline-block" : "none";
            carregarConfiguracao(); configurarPeriodoAtual();
        }
    } else {
        userAtual = null; document.getElementById('tela-login').classList.remove('hidden'); document.getElementById('app-principal').classList.add('hidden');
        document.getElementById('app-principal').style.display = 'none'; document.getElementById('btn-logout').classList.add('hidden'); document.getElementById('modal-setup-inicial').classList.add('hidden');
    }
});

window.salvarUnidadeGoogle = async () => {
    const unidadeSelecionada = document.getElementById('google-unidade-select').value;
    if (!unidadeSelecionada) return Swal.fire('Atenção', 'Selecione uma unidade para continuar.', 'warning');
    try {
        await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade: unidadeSelecionada, nome_conselheiro: userAtual.displayName || "Conselheiro Google", membros: [] }, { merge: true });
        registrarLog("Configuração", `Vínculo Google: ${unidadeSelecionada}`);
        Swal.fire({ icon: 'success', title: 'Configurado!', text: `Bem-vindo à unidade ${unidadeSelecionada}`, timer: 2000, showConfirmButton: false }).then(() => { window.location.reload(); });
    } catch (e) { Swal.fire('Erro', 'Falha ao salvar: ' + e.message, 'error'); }
}

async function carregarConfiguracao() {
    if (!userAtual) return;
    const campoConselheiro = document.getElementById('cfgNomeConselheiro');
    if (campoConselheiro && !campoConselheiro.value) campoConselheiro.value = userAtual.displayName || "";
    const docSnap = await getDoc(doc(db, "configuracoes", userAtual.uid));
    const listaMembros = document.getElementById('lista-membros-config'); const selectCorrecao = document.getElementById('selMembroCorrecao');
    if (selectCorrecao) selectCorrecao.innerHTML = "<option value=''>Selecione...</option>";
    if (listaMembros) listaMembros.innerHTML = "";

    if (docSnap.exists()) {
        const prefs = docSnap.data();
        if (prefs.unidade) {
            dadosUnidade.unidade = prefs.unidade; const campoUnidade = document.getElementById('cfgUnidade');
            campoUnidade.value = dadosUnidade.unidade; campoUnidade.disabled = true;
            if (prefs.nome_conselheiro) document.getElementById('cfgNomeConselheiro').value = prefs.nome_conselheiro;
            await importarMembros(true);
        }
    } else { dadosUnidade = { unidade: "", membros: [] }; }
}

function atualizarListaMembrosTela(membros) {
    const listaMembros = document.getElementById('lista-membros-config'); const selectCorrecao = document.getElementById('selMembroCorrecao');
    if (!listaMembros) return; listaMembros.innerHTML = "";
    if (selectCorrecao) selectCorrecao.innerHTML = "<option value=''>Selecione...</option>";
    if (membros.length === 0) { listaMembros.innerHTML = "<li style='padding:10px; color:#888; text-align:center;'>Nenhum membro encontrado.</li>"; return; }
    membros.forEach(nome => {
        listaMembros.innerHTML += `<li onclick="abrirFicha('${nome}')" style="padding: 12px 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer;"><span style="font-weight: 500;">👤 ${nome}</span><span style="font-size: 0.75rem; color: #1565C0;">Ver Ficha</span></li>`;
        if (selectCorrecao) { let opt = document.createElement("option"); opt.value = nome; opt.text = nome; selectCorrecao.add(opt); }
    });
}

window.importarMembros = async (modoSilencioso = false) => {
    const nomeUnidadeInput = document.getElementById('cfgUnidade').value.trim().toUpperCase();
    if (!nomeUnidadeInput) return;
    if (!modoSilencioso) Swal.fire({ title: 'Sincronizando...', didOpen: () => Swal.showLoading() });
    try {
        const q = query(collection(db, "configuracoes"), where("unidade", "==", nomeUnidadeInput));
        const querySnapshot = await getDocs(q);
        let maiorLista = []; let encontrou = false;
        querySnapshot.forEach((doc) => { const data = doc.data(); if (data.membros && data.membros.length > maiorLista.length) { maiorLista = data.membros; encontrou = true; } });
        if (encontrou) {
            dadosUnidade.unidade = nomeUnidadeInput; dadosUnidade.membros = maiorLista; atualizarListaMembrosTela(maiorLista);
            await setDoc(doc(db, "configuracoes", userAtual.uid), { membros: maiorLista }, { merge: true });
            if (!modoSilencioso) { await registrarLog("Sincronização", `Sincronizou unidade: ${nomeUnidadeInput}`); Swal.fire({ icon: 'success', title: 'Atualizado!', text: `${maiorLista.length} membros carregados.` }); }
        } else { if (!modoSilencioso) Swal.fire('Vazio', 'Unidade vinculada, mas sem membros cadastrados ainda.', 'info'); }
    } catch (error) { console.error(error); if (!modoSilencioso) Swal.fire('Erro', 'Falha ao sincronizar.', 'error'); }
}

window.abrirModalCadastro = () => { idEmEdicao = null; nomeAntigoEmEdicao = null; document.querySelectorAll('#modal-cadastro input').forEach(i => i.value = ''); document.getElementById('modal-cadastro').classList.remove('hidden'); };
window.fecharModalCadastro = () => { document.getElementById('modal-cadastro').classList.add('hidden'); };

window.salvarCadastroMembro = async () => {
    const nome = document.getElementById('cad-nome').value.trim();
    if (!nome) return Swal.fire('Atenção', 'O nome é obrigatório!', 'warning');
    const unidadeAtual = document.getElementById('cfgUnidade').value.trim().toUpperCase();
    if (!unidadeAtual) return Swal.fire('Erro', 'Erro de vínculo. Recarregue a página.', 'error');

    const ficha = {
        uid_conselheiro: userAtual.uid, unidade: unidadeAtual, nome: nome, nasc: document.getElementById('cad-nasc').value,
        idade: document.getElementById('cad-idade').value, mae: document.getElementById('cad-mae').value, tel_mae: document.getElementById('cad-tel-mae').value,
        pai: document.getElementById('cad-pai').value, tel_pai: document.getElementById('cad-tel-pai').value, endereco: document.getElementById('cad-endereco').value,
        numero: document.getElementById('cad-numero').value, bairro: document.getElementById('cad-bairro').value, cidade: document.getElementById('cad-cidade').value,
        uf: document.getElementById('cad-uf').value, data_cadastro: new Date().toISOString()
    };

    try {
        const docConfigRef = doc(db, "configuracoes", userAtual.uid); let listaMembros = dadosUnidade.membros || [];
        if (idEmEdicao) {
            await updateDoc(doc(db, "membros_detalhados", idEmEdicao), ficha);
            if (nomeAntigoEmEdicao && nomeAntigoEmEdicao !== nome) {
                listaMembros = listaMembros.map(m => m === nomeAntigoEmEdicao ? nome : m); dadosUnidade.membros = listaMembros;
                await setDoc(docConfigRef, { membros: listaMembros }, { merge: true }); atualizarListaMembrosTela(listaMembros);
            }
            registrarLog("Edição", `Editou: ${nome}`); Swal.fire('Atualizado!', 'Ficha alterada.', 'success');
        } else {
            await addDoc(collection(db, "membros_detalhados"), ficha);
            if (!listaMembros.includes(nome)) {
                listaMembros.push(nome); dadosUnidade.membros = listaMembros; dadosUnidade.unidade = unidadeAtual;
                await setDoc(docConfigRef, { unidade: unidadeAtual, membros: listaMembros }, { merge: true }); atualizarListaMembrosTela(listaMembros);
            }
            registrarLog("Cadastro", `Novo membro: ${nome}`); Swal.fire('Salvo!', 'Membro adicionado.', 'success');
        }
        fecharModalCadastro();
    } catch (e) { console.error(e); Swal.fire('Erro', 'Falha ao salvar: ' + e.message, 'error'); }
};

window.salvarConfiguracao = async () => {
    const nomeConselheiro = document.getElementById('cfgNomeConselheiro').value; const unidade = document.getElementById('cfgUnidade').value.trim().toUpperCase();
    if (!unidade) return Swal.fire('Erro', 'Unidade não vinculada!', 'error');
    await registrarLog("Configuração", `Atualizou perfil: ${nomeConselheiro}`);
    await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade: unidade, nome_conselheiro: nomeConselheiro, membros: dadosUnidade.membros }, { merge: true });
    if (nomeConselheiro) { await updateProfile(userAtual, { displayName: nomeConselheiro }); document.getElementById('user-name').innerText = nomeConselheiro; }
    Swal.fire('Salvo', 'Perfil atualizado!', 'success');
};

window.abrirFicha = async function (nome) {
    const modal = document.getElementById('modal-ficha'); const corpo = document.getElementById('corpo-ficha'); const headerUnidade = document.getElementById('ficha-unidade');
    headerUnidade.innerText = dadosUnidade.unidade || "S/ UNIDADE"; corpo.innerHTML = "Carregando dados..."; modal.classList.remove('hidden');
    try {
        let q = query(collection(db, "membros_detalhados"), where("nome", "==", nome), where("unidade", "==", dadosUnidade.unidade));
        let snap = await getDocs(q);
        if (snap.empty) { q = query(collection(db, "membros_detalhados"), where("nome", "==", nome)); snap = await getDocs(q); }
        if (!snap.empty) {
            const d = snap.docs[0].data(); const docId = snap.docs[0].id;
            corpo.innerHTML = `<div style="font-weight:bold; font-size:1.1rem; margin-bottom:10px; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-user-circle" style="color:#777;"></i> ${d.nome} <span style="font-weight:normal; font-size:0.9rem; color:#666;">(Idade: ${d.idade || '?'})</span></div><div style="margin-bottom:8px;"><i class="fa-solid fa-phone" style="color:#E65100; width:20px;"></i> <strong>Mãe:</strong> ${d.mae || '-'} (${d.tel_mae || '-'})</div><div style="margin-bottom:8px;"><i class="fa-solid fa-phone" style="color:#E65100; width:20px;"></i> <strong>Pai:</strong> ${d.pai || '-'} (${d.tel_pai || '-'})</div><div><i class="fa-solid fa-map-pin" style="color:#D32F2F; width:20px;"></i> ${d.endereco || '-'}, ${d.numero || ''}</div><hr style="margin: 20px 0 10px 0; border:0; border-top:1px solid #eee;"><div style="display:flex; justify-content: flex-end;"><button onclick="prepararEdicao('${docId}', '${nome.replace(/'/g, "\\'")}')" class="btn" style="border:1px solid #E65100; color:#E65100; font-size:0.9rem; padding: 8px 25px;"><i class="fa-solid fa-pencil"></i> Editar</button></div>`;
        } else { corpo.innerHTML = "<div style='text-align:center; padding:20px; color:#999;'>Ficha não encontrada no banco detalhado.</div>"; }
    } catch (e) { console.error(e); corpo.innerHTML = "<div style='color:red'>Erro ao carregar.</div>"; }
}

window.prepararEdicao = async (id, nome) => {
    try {
        const docSnap = await getDoc(doc(db, "membros_detalhados", id));
        if (docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('cad-nome').value = d.nome || ""; document.getElementById('cad-nasc').value = d.nasc || "";
            document.getElementById('cad-idade').value = d.idade || ""; document.getElementById('cad-mae').value = d.mae || "";
            document.getElementById('cad-tel-mae').value = d.tel_mae || ""; document.getElementById('cad-pai').value = d.pai || "";
            document.getElementById('cad-tel-pai').value = d.tel_pai || ""; document.getElementById('cad-endereco').value = d.endereco || "";
            document.getElementById('cad-numero').value = d.numero || ""; document.getElementById('cad-bairro').value = d.bairro || "";
            document.getElementById('cad-cidade').value = d.cidade || ""; document.getElementById('cad-uf').value = d.uf || "";
            idEmEdicao = id; nomeAntigoEmEdicao = d.nome;
            document.getElementById('modal-ficha').classList.add('hidden'); document.getElementById('modal-cadastro').classList.remove('hidden');
        }
    } catch (e) { Swal.fire('Erro', 'Não foi possível editar: ' + e.message, 'error'); }
}

window.deletarFicha = async (id, nome) => {
    const result = await Swal.fire({ title: 'Excluir Definitivamente?', text: "Isso apagará a ficha e removerá o membro da unidade.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Sim, remover' });
    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "membros_detalhados", id));
            if (dadosUnidade.membros.includes(nome)) {
                dadosUnidade.membros = dadosUnidade.membros.filter(m => m !== nome);
                await setDoc(doc(db, "configuracoes", userAtual.uid), { unidade: dadosUnidade.unidade, membros: dadosUnidade.membros }, { merge: true });
                atualizarListaMembrosTela(dadosUnidade.membros);
            }
            registrarLog("Exclusão Admin", `Admin removeu: ${nome}`); Swal.fire('Pronto', 'Membro removido com sucesso.', 'success'); document.getElementById('modal-ficha').classList.add('hidden');
        } catch (e) { Swal.fire('Erro', 'Falha ao remover: ' + e.message, 'error'); }
    }
}

let wizardIndex = 0;
document.getElementById('btn-iniciar').addEventListener('click', () => { if (!dadosUnidade.membros?.length) return Swal.fire('Ops', 'Cadastre membros na Config!', 'info'); wizardIndex = 0; abrirWizard(); });
document.getElementById('btn-corrigir').addEventListener('click', () => { const nome = document.getElementById('selMembroCorrecao').value; if (!nome) return Swal.fire('Ops', 'Selecione!', 'info'); wizardIndex = dadosUnidade.membros.indexOf(nome); abrirWizard(); });

const btnProximo = document.getElementById('btn-proximo');
if (btnProximo) {
    btnProximo.addEventListener('click', async () => {
        if (!dadosUnidade.unidade) return Swal.fire('Erro', 'Configure o nome da Unidade na aba Config antes de avaliar!', 'error');
        if (document.getElementById('n1').disabled) {
            wizardIndex++;
            if (wizardIndex < dadosUnidade.membros.length) { abrirWizard(); } else { Swal.fire('Fim', 'Avaliações concluídas!', 'success'); fecharWizard(); navegar('dashboard'); }
            return;
        }
        const nome = dadosUnidade.membros[wizardIndex]; const mes = document.getElementById('selMes').value; const semana = document.getElementById('selSemana').value;
        let notas = [], total = 0; for (let i = 1; i <= 8; i++) { let v = Number(document.getElementById('n' + i).value) || 0; notas.push(v); total += v; }
        const unidadeSafe = dadosUnidade.unidade.trim().toUpperCase().replace(/\s+/g, '_'); const id = `${unidadeSafe}_${nome.replace(/\s+/g, '')}_${mes}_${semana}`;
        const agora = new Date(); const dataFormatada = agora.toLocaleString('pt-BR');
        try {
            await setDoc(doc(db, "avaliacoes", id), { unidade: dadosUnidade.unidade, autor_uid: userAtual.uid, autor_nome: userAtual.displayName, nome, mes, semana, notas, total, data: agora.toISOString(), data_legivel: dataFormatada });
            await registrarLog("Avaliação", `Avaliou: ${nome} | ${dataFormatada} | ${total} pts`); Toast.fire({ icon: 'success', title: 'Nota Salva!' }); avaliacoesCache = []; wizardIndex++;
            if (wizardIndex < dadosUnidade.membros.length) { abrirWizard(); } else { Swal.fire('Fim', 'Avaliações concluídas!', 'success'); fecharWizard(); navegar('dashboard'); }
        } catch (e) { console.error(e); Swal.fire('Erro', e.message, 'error'); }
    });
}

async function abrirWizard() {
    const wizardForm = document.getElementById('wizard-form'); wizardForm.classList.remove('hidden'); wizardForm.scrollIntoView({ behavior: 'smooth' });
    const nome = dadosUnidade.membros[wizardIndex]; document.getElementById('wiz-nome').innerText = nome; document.getElementById('contador-passo').innerText = `${wizardIndex + 1} / ${dadosUnidade.membros.length}`;
    const mes = document.getElementById('selMes').value; const semana = document.getElementById('selSemana').value;
    for (let i = 1; i <= 8; i++) { let input = document.getElementById('n' + i); input.value = ''; input.style.borderColor = '#ddd'; input.disabled = true; }
    const unidadeSafe = dadosUnidade.unidade.trim().toUpperCase().replace(/\s+/g, '_'); const idCheck = `${unidadeSafe}_${nome.replace(/\s+/g, '')}_${mes}_${semana}`;
    try {
        const docSnap = await getDoc(doc(db, "avaliacoes", idCheck));
        if (docSnap.exists()) {
            const dados = docSnap.data(); const dataAvaliacao = dados.data ? new Date(dados.data).toLocaleString('pt-BR') : 'Data desc.';
            Toast.fire({ icon: 'info', title: 'Já Avaliado!', text: `Por: ${dados.autor_nome || 'Alguém'}\nEm: ${dataAvaliacao}` });
            dados.notas.forEach((nota, index) => { let input = document.getElementById('n' + (index + 1)); input.value = nota; input.style.borderColor = '#4CAF50'; input.disabled = true; });
            document.getElementById('btn-proximo').innerText = "Próximo (Já Avaliado) ➡️";
        } else {
            for (let i = 1; i <= 8; i++) document.getElementById('n' + i).disabled = false; document.getElementById('btn-proximo').innerText = "Salvar e Próximo ➡️";
        }
    } catch (error) { console.log("Erro ao verificar duplicidade:", error); for (let i = 1; i <= 8; i++) document.getElementById('n' + i).disabled = false; }
}

window.fecharWizard = () => document.getElementById('wizard-form').classList.add('hidden');

window.atualizarDashboard = async () => {
    const div = document.getElementById('lista-dashboard'); div.innerHTML = "Carregando...";
    const mes = document.getElementById('dashMes').value; const semana = document.getElementById('dashSemana').value;
    const btnRanking = document.getElementById('btnRankingAnual'); if (btnRanking) { if (mes === "Dezembro") { btnRanking.style.display = "block"; } else { btnRanking.style.display = "none"; } }
    if (!dadosUnidade.unidade) { div.innerHTML = "<p style='padding:20px; text-align:center'>Configure o nome da unidade na aba Config.</p>"; return; }
    if (avaliacoesCache.length === 0) {
        try { const q = query(collection(db, "avaliacoes"), where("unidade", "==", dadosUnidade.unidade)); const snap = await getDocs(q); avaliacoesCache = []; snap.forEach(d => { let x = d.data(); x.id = d.id; avaliacoesCache.push(x); }); }
        catch (e) { console.error("Erro dashboard:", e); }
    }
    const filt = avaliacoesCache.filter(d => d.mes === mes && d.semana === semana);
    if (filt.length === 0) { div.innerHTML = "<div style='padding:20px; text-align:center; color:#888'>Sem dados para este período.</div>"; return; }
    let html = "<ul style='list-style:none;padding:0'>"; let totalG = [0, 0, 0, 0, 0, 0, 0, 0];
    filt.sort((a, b) => b.total - a.total).forEach(d => {
        html += `<li onclick="abrirDetalhes('${d.nome}')" style="background:#f9f9f9;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;cursor:pointer;border-radius:6px;border-left:4px solid #E65100;"><span><div style="font-weight:bold">👤 ${d.nome}</div><div style="font-size:0.75rem; color:#888;">Avaliado por: ${d.autor_nome || 'Conselheiro'}</div></span><strong style="font-size:1.1rem; color:#E65100">${d.total}</strong></li>`;
        d.notas.forEach((n, i) => totalG[i] += n);
    });
    div.innerHTML = html + "</ul>";
    if (filt.length > 0) { document.getElementById('card-destaque').style.display = 'block'; document.getElementById('nome-destaque').innerText = filt[0].nome; document.getElementById('pontos-destaque').innerText = filt[0].total + " pts"; }
    else { document.getElementById('card-destaque').style.display = 'none'; }
    graficoPizza(totalG, 'grafico-geral', 'legenda-geral');
}

window.abrirDetalhes = function (nome) {
    const modal = document.getElementById('modal-detalhes'); const lista = document.getElementById('lista-historico');
    document.getElementById('titulo-detalhe').innerText = nome; lista.innerHTML = "";
    const dados = avaliacoesCache.filter(d => d.nome === nome); const soma = [0, 0, 0, 0, 0, 0, 0, 0];
    dados.forEach(d => {
        lista.innerHTML += `<li style="border-bottom:1px solid #eee; padding: 12px 5px; display: flex; justify-content: space-between; align-items: center;"><div style="font-size: 0.95rem;"><span style="font-weight:600; color:#333;">${d.mes}</span> <span style="color:#666;">(${d.semana})</span> <strong style="color:#E65100; margin-left: 5px;">— ${d.total} pts</strong></div><button onclick="excluirAvaliacao('${d.id}', '${nome}')" style="background:none; border:none; cursor:pointer; color:#999; padding:5px; margin-left:10px;"><i class="fa-solid fa-trash-can"></i></button></li>`;
        d.notas.forEach((n, i) => soma[i] += n);
    });
    modal.classList.remove('hidden'); setTimeout(() => graficoPizza(soma, 'grafico-individual'), 100);
}

window.excluirAvaliacao = async function (id, nome) {
    const result = await Swal.fire({ title: 'Excluir nota?', text: "Essa ação não pode ser desfeita.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Sim, excluir' });
    if (result.isConfirmed) {
        try { await deleteDoc(doc(db, "avaliacoes", id)); registrarLog("Exclusão", `Excluiu nota de: ${nome}`); avaliacoesCache = avaliacoesCache.filter(i => i.id !== id); Swal.fire('Pronto', 'Nota apagada.', 'success'); abrirDetalhes(nome); atualizarDashboard(); }
        catch (e) { Swal.fire('Erro', e.message, 'error'); }
    }
}

window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.add('hidden');

function graficoPizza(dados, idGraf, idLeg = null) {
    const total = dados.reduce((a, b) => a + b, 0); if (total === 0) return; let ang = 0, grad = []; let legendaHTML = "";
    dados.forEach((v, i) => { if (v > 0) { let fatia = (v / total) * 360; grad.push(`${coresGrafico[i]} ${ang}deg ${ang + fatia}deg`); ang += fatia; if (idLeg) legendaHTML += `<div class="legenda-item"><span class="cor-bolinha" style="background:${coresGrafico[i]}"></span>${nomesCategorias[i]}</div>`; } });
    document.getElementById(idGraf).style.background = `conic-gradient(${grad.join(', ')})`; if (idLeg) document.getElementById(idLeg).innerHTML = legendaHTML;
}

// =========================================
// SISTEMA DE NAVEGAÇÃO BLINDADO
// =========================================
window.navegar = (aba) => {
    ['config', 'avaliar', 'dashboard', 'admin'].forEach(id => { const el = document.getElementById('sec-' + id); if (el) el.classList.add('hidden'); });
    const telaAtiva = document.getElementById('sec-' + aba); if (telaAtiva) telaAtiva.classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btnAtivo = document.getElementById('nav-' + aba); if (btnAtivo) btnAtivo.classList.add('active');

    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'admin') {
        alternarVisaoAdmin('fichas');
    }
}
const btnConfig = document.getElementById('nav-config'); if (btnConfig) btnConfig.onclick = () => navegar('config');
const btnAvaliar = document.getElementById('nav-avaliar'); if (btnAvaliar) btnAvaliar.onclick = () => navegar('avaliar');
const btnDash = document.getElementById('nav-dashboard'); if (btnDash) btnDash.onclick = () => navegar('dashboard');
const btnAdmin = document.getElementById('nav-admin'); if (btnAdmin) btnAdmin.onclick = () => navegar('admin');

const btnEsqueci = document.getElementById('btn-esqueci-senha');
if (btnEsqueci) {
    btnEsqueci.addEventListener('click', (e) => {
        e.preventDefault(); const email = document.getElementById('email-input').value;
        if (!email) { Swal.fire({ icon: 'warning', title: 'Digite seu e-mail!', text: 'Preencha o campo de e-mail acima.' }); return; }
        sendPasswordResetEmail(auth, email).then(() => { Swal.fire({ icon: 'success', title: 'E-mail Enviado!' }); }).catch((error) => { Swal.fire({ icon: 'error', title: 'Erro', text: error.message }); });
    });
}

// =========================================
// ADMINISTRAÇÃO E LOGS
// =========================================
window.alternarVisaoAdmin = (visao) => {
    document.getElementById('admin-view-logs').classList.add('hidden');
    document.getElementById('admin-view-fichas').classList.add('hidden');

    ['logs', 'fichas'].forEach(id => {
        const btn = document.getElementById('btn-adm-' + id);
        if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-secondary'); }
    });

    const btnAtivo = document.getElementById('btn-adm-' + visao);
    if (btnAtivo) { btnAtivo.classList.remove('btn-secondary'); btnAtivo.classList.add('btn-primary'); }

    if (visao === 'logs') { document.getElementById('admin-view-logs').classList.remove('hidden'); carregarLogs(); }
    if (visao === 'fichas') { document.getElementById('admin-view-fichas').classList.remove('hidden'); carregarFichasGeral(); }
}

window.carregarLogs = async () => {
    const lista = document.getElementById('lista-logs'); const dataFiltroInput = document.getElementById('filtroDataAdmin').value;
    lista.innerHTML = "<li style='text-align:center; padding:10px; color:#666;'>🔄 Buscando registros...</li>";
    try {
        const q = query(collection(db, "logs"), orderBy("data", "desc"), limit(100)); const snap = await getDocs(q); lista.innerHTML = "";
        if (snap.empty) { lista.innerHTML = "<li style='text-align:center; padding:10px;'>Nenhum registro encontrado.</li>"; return; }
        let encontrouAlgum = false;
        snap.forEach(doc => {
            const d = doc.data(); let mostrar = true;
            if (dataFiltroInput) { const dataLog = d.data ? d.data.split('T')[0] : ""; if (dataLog !== dataFiltroInput) mostrar = false; }
            if (mostrar) {
                encontrouAlgum = true; const dataFormatada = d.data ? new Date(d.data).toLocaleString('pt-BR') : 'Data desc.';
                let borderCor = "#2196F3"; let icone = "ℹ️";
                if (d.acao.includes("Exclusão") || d.acao.includes("Erro")) { borderCor = "#D32F2F"; icone = "🚨"; }
                else if (d.acao.includes("Avaliação")) { borderCor = "#4CAF50"; icone = "✅"; }
                else if (d.acao.includes("Configuração")) { borderCor = "#FF9800"; icone = "⚙️"; }
                lista.innerHTML += `<li style="border-left: 5px solid ${borderCor}; padding: 12px; margin-bottom: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="color:#333;">${icone} ${d.acao}</strong><small style="color:#666; font-size:0.8rem;">${dataFormatada}</small></div><div style="font-size:0.9rem; color:#444; margin-bottom:5px;">${d.detalhes}</div><div style="border-top:1px solid #eee; padding-top:5px; font-size:0.75rem; color:#888; display:flex; flex-direction:column; gap:2px;"><span style="word-break: break-word; font-size: 0.7rem;">👤 ${d.usuario || 'Desconhecido'}</span><span style="align-self: flex-end;">📱 ${d.dispositivo || 'Web'}</span></div></li>`;
            }
        });
        if (!encontrouAlgum) { lista.innerHTML = "<li style='text-align:center; padding:20px; color:#888'>Nenhum log encontrado para esta data.</li>"; }
    } catch (e) { console.error(e); lista.innerHTML = `<li style="color:red; padding:10px;">Erro ao carregar logs: ${e.message}</li>`; }
}

window.carregarFichasGeral = async () => {
    const div = document.getElementById('lista-fichas-global'); div.innerHTML = "<p>Buscando fichas...</p>";
    try {
        const q = query(collection(db, "membros_detalhados"), orderBy("unidade")); const snap = await getDocs(q);
        if (snap.empty) { div.innerHTML = "<p>Nenhuma ficha encontrada.</p>"; return; }
        let html = ""; let unidadeAtual = "";
        snap.forEach(doc => {
            const d = doc.data(); const docId = doc.id;
            if (d.unidade !== unidadeAtual) { unidadeAtual = d.unidade; html += `<h4 style="background:#E65100; color:white; padding:5px; margin-top:15px;">🛡️ Unidade: ${unidadeAtual}</h4>`; }
            html += `<div style="background:white; border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:5px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><p><strong>👤 ${d.nome}</strong> (Idade: ${d.idade || '?'})</p><p style="font-size:0.9rem; margin:5px 0;">📞 <strong>Mãe:</strong> ${d.mae} (${d.tel_mae})<br>📞 <strong>Pai:</strong> ${d.pai} (${d.tel_pai})<br>📍 ${d.endereco}, ${d.numero} - ${d.bairro}</p></div><div style="display:flex; flex-direction:column; gap:5px;"><button onclick="prepararEdicao('${docId}', '${d.nome.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="font-size:0.8rem; padding: 5px 10px;">✏️ Editar</button><button onclick="deletarFicha('${docId}', '${d.nome.replace(/'/g, "\\'")}')" class="btn btn-danger" style="font-size:0.8rem; padding: 5px 10px;">🗑️ Excluir</button></div></div></div>`;
        });
        div.innerHTML = html;
    } catch (e) { console.error(e); div.innerHTML = "<p style='color:red'>Erro ao carregar fichas.</p>"; }
}

async function registrarLog(acao, detalhes) {
    let idUser = "Anonimo";
    if (userAtual) { let unidadeUser = dadosUnidade.unidade || "S/ Unidade"; idUser = `${userAtual.displayName || 'Sem Nome'} (${userAtual.email}) | Und: ${unidadeUser}`; }
    else { const emailInput = document.getElementById('email-input'); if (emailInput && emailInput.value) { idUser = `Tentativa: ${emailInput.value}`; } }
    try { await addDoc(collection(db, "logs"), { data: new Date().toISOString(), uid: userAtual ? userAtual.uid : "ANONIMO", usuario: idUser, acao: acao, detalhes: detalhes, dispositivo: detectingDevice() }); }
    catch (error) { console.error("Falha ao gravar log:", error); }
}

window.verRelatorioMensal = async () => {
    if (!dadosUnidade.unidade) return Swal.fire('Erro', 'Configure a unidade primeiro.', 'error');
    const mesSelecionado = document.getElementById('dashMes').value;
    Swal.fire({ title: `Calculando ${mesSelecionado}...`, didOpen: () => Swal.showLoading() });
    try {
        const q = query(collection(db, "avaliacoes"), where("unidade", "==", dadosUnidade.unidade), where("mes", "==", mesSelecionado));
        const snap = await getDocs(q);
        if (snap.empty) return Swal.fire('Sem dados', `Nenhuma avaliação encontrada em ${mesSelecionado}.`, 'info');
        let placar = {};
        snap.forEach(doc => { const d = doc.data(); if (!placar[d.nome]) placar[d.nome] = 0; placar[d.nome] += d.total; });
        let ranking = Object.entries(placar).sort((a, b) => b[1] - a[1]).map((item, index) => {
            let medalha = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}º`;
            return `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${medalha} <strong>${item[0]}</strong></span><span style="color:#E65100; font-weight:bold;">${item[1]} pts</span></li>`;
        }).join('');
        Swal.fire({ title: `🏆 Destaques de ${mesSelecionado}`, html: `<ul style="list-style:none; padding:0; text-align:left;">${ranking}</ul>`, confirmButtonText: 'Fechar' });
    } catch (e) { console.error(e); Swal.fire('Erro', 'Falha ao calcular mês.', 'error'); }
}

window.verRankingAnual = async () => {
    if (!dadosUnidade.unidade) return Swal.fire('Erro', 'Configure a unidade primeiro.', 'error');
    Swal.fire({ title: 'Calculando Ranking Anual...', didOpen: () => Swal.showLoading() });
    try {
        const q = query(collection(db, "avaliacoes"), where("unidade", "==", dadosUnidade.unidade)); const snap = await getDocs(q);
        if (snap.empty) return Swal.fire('Sem dados', 'Nenhuma avaliação encontrada neste ano.', 'info');
        let placar = {}; let totalAvaliacoes = {};
        snap.forEach(doc => { const d = doc.data(); if (!placar[d.nome]) { placar[d.nome] = 0; totalAvaliacoes[d.nome] = 0; } placar[d.nome] += d.total; totalAvaliacoes[d.nome]++; });
        let ranking = Object.entries(placar).sort((a, b) => b[1] - a[1]).map((item, index) => {
            let nome = item[0]; let pontos = item[1]; let icone = index === 0 ? "🏆👑" : "⭐";
            let estilo = index === 0 ? "background:#fff3e0; border:2px solid gold;" : "border-bottom:1px solid #eee;";
            return `<li style="padding:10px; ${estilo} display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:1.1rem;">${icone} ${nome}</div><small style="color:#666;">${totalAvaliacoes[nome]} avaliações registradas</small></div><div style="text-align:right;"><div style="color:#E65100; font-weight:900; font-size:1.2rem;">${pontos}</div><small>pontos</small></div></li>`;
        }).join('');
        Swal.fire({ title: '🏆 RANKING GERAL DO ANO', html: `<ul style="list-style:none; padding:0; text-align:left;">${ranking}</ul>`, width: 600, confirmButtonText: 'Incrível!' });
    } catch (e) { console.error(e); Swal.fire('Erro', 'Falha ao calcular ano.', 'error'); }
}

// =========================================
// PERÍODO ATUAL DAS AVALIAÇÕES
// =========================================

function configurarPeriodoAtual() {
    const agora = new Date(); const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesAtual = meses[agora.getMonth()]; const dia = agora.getDate(); let semana = "Semana 1";
    if (dia > 7 && dia <= 14) semana = "Semana 2"; else if (dia > 14 && dia <= 21) semana = "Semana 3"; else if (dia > 21) semana = "Semana 4";
    const idsMes = ['selMes', 'dashMes', 'admFiltroMes']; const idsSem = ['selSemana', 'dashSemana', 'admFiltroSemana'];
    idsMes.forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = mesAtual; });
    idsSem.forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = semana; });
}


const LOGO_HEROIS_PDF = './logo.png';
const MAPA_LOGOS_UNIDADES_PDF = {
    'THIAGO WHITE': './logo-thiago-white.png',
    'ELLEN WHITE': './logo-ellen-white.png',
    'JOSEPH BATES': './logo-joseph-bates.png',
    'RAINHA ESTER': './logo-rainha-ester.png'
};
const cacheLogosPDF = {};

function normalizarNomeUnidadeParaLogo(nome) {
    return String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

async function carregarImagemComoDataURL(caminho) {
    if (!caminho) return null;
    if (cacheLogosPDF[caminho]) return cacheLogosPDF[caminho];
    const resposta = await fetch(caminho);
    if (!resposta.ok) throw new Error(`Não foi possível carregar a imagem ${caminho}`);
    const blob = await resposta.blob();
    const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    cacheLogosPDF[caminho] = dataURL;
    return dataURL;
}

async function prepararLogosPDF(unidades = []) {
    const logos = {
        herois: await carregarImagemComoDataURL(LOGO_HEROIS_PDF),
        unidades: {}
    };

    const unicas = [...new Set(unidades.map(normalizarNomeUnidadeParaLogo).filter(Boolean))];
    for (const unidade of unicas) {
        const caminho = MAPA_LOGOS_UNIDADES_PDF[unidade];
        if (caminho) {
            try {
                logos.unidades[unidade] = await carregarImagemComoDataURL(caminho);
            } catch (erro) {
                console.warn('Não foi possível carregar a logo da unidade para o PDF:', unidade, erro);
            }
        }
    }

    return logos;
}

function desenharLogoNoPDF(pdf, dataURL, x, y, maxW = 22, maxH = 16) {
    if (!dataURL) return;
    try {
        const props = pdf.getImageProperties(dataURL);
        const proporcao = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * proporcao;
        const h = props.height * proporcao;
        const tipo = dataURL.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        pdf.addImage(dataURL, tipo, x + ((maxW - w) / 2), y + ((maxH - h) / 2), w, h);
    } catch (erro) {
        console.warn('Não foi possível desenhar uma logo no PDF.', erro);
    }
}

// =========================================
// EXPORTAÇÃO GERAL DO HISTÓRICO DE AVALIAÇÕES EM PDF
// =========================================
window.exportarHistoricoGeralPDF = async function () {
    if (!dadosUnidade.unidade) return Swal.fire('Erro', 'Configure o nome da unidade antes de exportar.', 'error');
    if (!window.jspdf?.jsPDF) return Swal.fire('Erro', 'A biblioteca de PDF não foi carregada. Verifique a internet e tente novamente.', 'error');

    Swal.fire({
        title: 'Gerando histórico completo...',
        text: 'Carregando todas as avaliações da unidade.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Sempre consulta o Firestore para garantir que o arquivo contenha TODO o histórico,
        // independentemente do mês/semana selecionado no painel ou do conteúdo atual do cache.
        const q = query(collection(db, "avaliacoes"), where("unidade", "==", dadosUnidade.unidade));
        const snap = await getDocs(q);

        if (snap.empty) {
            return Swal.fire('Sem dados', 'Ainda não existem avaliações registradas para esta unidade.', 'info');
        }

        avaliacoesCache = [];
        snap.forEach(item => {
            const x = item.data();
            x.id = item.id;
            avaliacoesCache.push(x);
        });

        const criterios = [
            ['01', 'Frequência', 30],
            ['02', 'Devoção Matinal', 40],
            ['03', 'Uniforme', 50],
            ['04', 'Higiene', 30],
            ['05', 'Classe Bíblica', 50],
            ['06', 'Ano Bíblico', 40],
            ['07', 'Materiais', 40],
            ['08', 'Disciplina', 40]
        ];
        const ordemMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const ordemSemana = ['Semana 1','Semana 2','Semana 3','Semana 4'];
        const ordenarAvaliacoes = (a, b) => {
            const ma = ordemMes.indexOf(a.mes), mb = ordemMes.indexOf(b.mes);
            if (ma !== mb) return ma - mb;
            const sa = ordemSemana.indexOf(a.semana), sb = ordemSemana.indexOf(b.semana);
            if (sa !== sb) return sa - sb;
            return String(a.data || '').localeCompare(String(b.data || ''));
        };

        // Agrupa todas as avaliações pelo nome do desbravador.
        const porDesbravador = {};
        avaliacoesCache.forEach(d => {
            const nome = (d.nome || 'Sem nome').trim();
            if (!porDesbravador[nome]) porDesbravador[nome] = [];
            porDesbravador[nome].push(d);
        });

        const nomes = Object.keys(porDesbravador).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        nomes.forEach(nome => porDesbravador[nome].sort(ordenarAvaliacoes));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const logosPDF = await prepararLogosPDF([dadosUnidade.unidade]);
        const logoUnidadeAtual = logosPDF.unidades[normalizarNomeUnidadeParaLogo(dadosUnidade.unidade)] || null;
        const dataEmissao = new Date().toLocaleString('pt-BR');
        const totalAvaliacoesGeral = avaliacoesCache.length;
        const totalPontosGeral = avaliacoesCache.reduce((s, d) => s + (Number(d.total) || 0), 0);

        const cabecalhoPagina = (titulo, subtitulo = '', logoDireita = logoUnidadeAtual) => {
            desenharLogoNoPDF(pdf, logosPDF.herois, 14, 8, 22, 16);
            desenharLogoNoPDF(pdf, logoDireita, 160, 8, 36, 16);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(16);
            pdf.setTextColor(0);
            pdf.text(titulo, 105, 17, { align: 'center' });
            if (subtitulo) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9.5);
                pdf.setTextColor(90);
                pdf.text(subtitulo, 105, 23, { align: 'center' });
            }
            pdf.setDrawColor(230, 81, 0);
            pdf.setLineWidth(0.7);
            pdf.line(14, 29, 196, 29);
        };

        // CAPA / RESUMO
        cabecalhoPagina('Histórico Geral de Avaliações', 'Clube de Desbravadores Heróis da Fé');
        pdf.setFontSize(11);
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Unidade:', 14, 39);
        pdf.setFont('helvetica', 'normal');
        pdf.text(dadosUnidade.unidade, 34, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Emitido em:', 14, 46);
        pdf.setFont('helvetica', 'normal');
        pdf.text(dataEmissao, 38, 46);

        pdf.autoTable({
            startY: 55,
            head: [['Desbravadores', 'Avaliações registradas', 'Pontos somados']],
            body: [[String(nomes.length), String(totalAvaliacoesGeral), `${totalPontosGeral} pts`]],
            theme: 'grid',
            headStyles: { fillColor: [230, 81, 0] },
            styles: { fontSize: 9, halign: 'center' }
        });

        const resumo = nomes.map(nome => {
            const dados = porDesbravador[nome];
            const total = dados.reduce((s, d) => s + (Number(d.total) || 0), 0);
            const media = dados.length ? total / dados.length : 0;
            const aproveitamento = dados.length ? (total / (dados.length * 320)) * 100 : 0;
            return [nome, String(dados.length), `${total} pts`, `${media.toFixed(1)} pts`, `${aproveitamento.toFixed(1)}%`];
        });

        pdf.autoTable({
            startY: pdf.lastAutoTable.finalY + 10,
            head: [['Desbravador', 'Avaliações', 'Total', 'Média', 'Aproveitamento']],
            body: resumo,
            theme: 'striped',
            margin: { left: 14, right: 14 },
            headStyles: { fillColor: [69, 90, 100] },
            styles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } }
        });

        // HISTÓRICO COMPLETO: um único arquivo, organizado por desbravador.
        nomes.forEach((nome) => {
            const dados = porDesbravador[nome];
            const totalPontos = dados.reduce((s, d) => s + (Number(d.total) || 0), 0);
            const media = dados.length ? totalPontos / dados.length : 0;
            const percentual = dados.length ? (totalPontos / (dados.length * 320)) * 100 : 0;

            // Cada desbravador começa em uma nova página para facilitar impressão e consulta,
            // mas todos permanecem dentro do MESMO PDF.
            pdf.addPage();
            cabecalhoPagina(nome, `Unidade ${dadosUnidade.unidade} • Histórico completo de avaliações`);

            pdf.autoTable({
                startY: 36,
                head: [['Avaliações', 'Pontos somados', 'Média semanal', 'Aproveitamento']],
                body: [[String(dados.length), `${totalPontos} pts`, `${media.toFixed(1)} pts`, `${percentual.toFixed(1)}%`]],
                theme: 'grid',
                headStyles: { fillColor: [230, 81, 0] },
                styles: { fontSize: 8.5, halign: 'center' }
            });

            let y = pdf.lastAutoTable.finalY + 8;
            dados.forEach(d => {
                // Reserva espaço suficiente para título + tabela. Se não couber, continua em nova página.
                if (y + 72 > 284) {
                    pdf.addPage();
                    cabecalhoPagina(nome, `Continuação • Unidade ${dadosUnidade.unidade}`);
                    y = 36;
                }

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10.5);
                pdf.setTextColor(230, 81, 0);
                pdf.text(`${d.mes || '-'} • ${d.semana || '-'} — ${Number(d.total) || 0} pontos`, 14, y);
                y += 5;

                const autor = d.autor_nome || 'Conselheiro não identificado';
                let dataAvaliacao = d.data_legivel || 'Data não informada';
                if (!d.data_legivel && d.data) {
                    const dt = new Date(d.data);
                    if (!Number.isNaN(dt.getTime())) dataAvaliacao = dt.toLocaleString('pt-BR');
                }
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8.3);
                pdf.setTextColor(80);
                pdf.text(`Avaliado por: ${autor} | Data: ${dataAvaliacao}`, 14, y);
                y += 3;

                const notas = Array.isArray(d.notas) ? d.notas : [];
                pdf.autoTable({
                    startY: y,
                    head: [['#', 'Critério', 'Nota', 'Máximo']],
                    body: criterios.map((c, i) => [c[0], c[1], String(Number(notas[i]) || 0), String(c[2])]),
                    theme: 'grid',
                    margin: { left: 14, right: 14 },
                    headStyles: { fillColor: [69, 90, 100] },
                    styles: { fontSize: 7.8, cellPadding: 1.35 },
                    columnStyles: {
                        0: { cellWidth: 12, halign: 'center' },
                        2: { cellWidth: 22, halign: 'center' },
                        3: { cellWidth: 22, halign: 'center' }
                    }
                });
                y = pdf.lastAutoTable.finalY + 7;
            });
        });

        // Rodapé em todas as páginas.
        const paginas = pdf.getNumberOfPages();
        for (let i = 1; i <= paginas; i++) {
            pdf.setPage(i);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.5);
            pdf.setTextColor(125);
            pdf.text(`Histórico Geral de Avaliações • ${dadosUnidade.unidade}`, 14, 291);
            pdf.text(`Página ${i} de ${paginas}`, 196, 291, { align: 'right' });
        }

        const unidadeArquivo = dadosUnidade.unidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
        pdf.save(`Historico_Completo_Avaliacoes_${unidadeArquivo}.pdf`);
        registrarLog('Exportação PDF Geral', `Exportou histórico completo de ${nomes.length} desbravadores e ${totalAvaliacoesGeral} avaliações da unidade ${dadosUnidade.unidade}`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível gerar o histórico completo em PDF: ' + e.message, 'error');
    }
};


// EXPORTAÇÃO DO DIRETOR: HISTÓRICO DE TODAS AS UNIDADES EM UM ÚNICO PDF
window.exportarTodasUnidadesPDF = async function () {
    if (!userAtual || !ADMINS.includes(userAtual.uid)) {
        return Swal.fire('Acesso negado', 'Somente o diretor pode exportar o relatório de todas as unidades.', 'error');
    }
    if (!window.jspdf?.jsPDF) {
        return Swal.fire('Erro', 'A biblioteca de PDF não foi carregada. Verifique a internet e tente novamente.', 'error');
    }

    try {
        Swal.fire({
            title: 'Gerando relatório geral...',
            text: 'Carregando avaliações de todas as unidades.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Sem filtro por unidade: esta consulta é exclusiva do diretor.
        const snap = await getDocs(collection(db, 'avaliacoes'));
        if (snap.empty) {
            return Swal.fire('Sem dados', 'Ainda não existem avaliações registradas.', 'info');
        }

        const avaliacoes = [];
        snap.forEach(item => {
            const d = item.data();
            d.id = item.id;
            avaliacoes.push(d);
        });

        const criterios = [
            ['01', 'Frequência', 30],
            ['02', 'Devoção Matinal', 40],
            ['03', 'Uniforme', 50],
            ['04', 'Higiene', 30],
            ['05', 'Classe Bíblica', 50],
            ['06', 'Ano Bíblico', 40],
            ['07', 'Materiais', 40],
            ['08', 'Disciplina', 40]
        ];
        const ordemMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const ordemSemana = ['Semana 1','Semana 2','Semana 3','Semana 4'];
        const ordenarAvaliacoes = (a, b) => {
            const ma = ordemMes.indexOf(a.mes), mb = ordemMes.indexOf(b.mes);
            if (ma !== mb) return ma - mb;
            const sa = ordemSemana.indexOf(a.semana), sb = ordemSemana.indexOf(b.semana);
            if (sa !== sb) return sa - sb;
            return String(a.data || '').localeCompare(String(b.data || ''));
        };

        // unidade -> desbravador -> avaliações
        const porUnidade = {};
        avaliacoes.forEach(d => {
            const unidade = (d.unidade || 'SEM UNIDADE').trim().toUpperCase();
            const nome = (d.nome || 'Sem nome').trim();
            if (!porUnidade[unidade]) porUnidade[unidade] = {};
            if (!porUnidade[unidade][nome]) porUnidade[unidade][nome] = [];
            porUnidade[unidade][nome].push(d);
        });

        const unidades = Object.keys(porUnidade).sort((a,b) => a.localeCompare(b, 'pt-BR'));
        unidades.forEach(unidade => {
            Object.values(porUnidade[unidade]).forEach(lista => lista.sort(ordenarAvaliacoes));
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const logosPDF = await prepararLogosPDF(unidades);
        const obterLogoUnidade = (unidade) => logosPDF.unidades[normalizarNomeUnidadeParaLogo(unidade)] || null;
        const dataEmissao = new Date().toLocaleString('pt-BR');

        const cabecalhoPagina = (titulo, subtitulo = '', logoDireita = null) => {
            desenharLogoNoPDF(pdf, logosPDF.herois, 14, 8, 22, 16);
            desenharLogoNoPDF(pdf, logoDireita, 160, 8, 36, 16);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(16);
            pdf.setTextColor(0);
            pdf.text(titulo, 105, 17, { align: 'center' });
            if (subtitulo) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9.5);
                pdf.setTextColor(90);
                pdf.text(subtitulo, 105, 23, { align: 'center' });
            }
            pdf.setDrawColor(230, 81, 0);
            pdf.setLineWidth(0.7);
            pdf.line(14, 29, 196, 29);
        };

        const totalDesbravadores = new Set(avaliacoes.map(d => `${(d.unidade||'').trim().toUpperCase()}|${(d.nome||'').trim()}`)).size;
        const totalPontos = avaliacoes.reduce((s,d) => s + (Number(d.total)||0), 0);

        // Capa geral
        cabecalhoPagina('Relatório Geral de Avaliações', 'Todas as Unidades • Clube de Desbravadores Heróis da Fé');
        pdf.setFontSize(10.5);
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Emitido em:', 14, 40);
        pdf.setFont('helvetica', 'normal');
        pdf.text(dataEmissao, 38, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Emitido por:', 14, 47);
        pdf.setFont('helvetica', 'normal');
        pdf.text(userAtual.displayName || userAtual.email || 'Diretor', 39, 47);

        pdf.autoTable({
            startY: 55,
            head: [['Unidades', 'Desbravadores', 'Avaliações', 'Pontos somados']],
            body: [[String(unidades.length), String(totalDesbravadores), String(avaliacoes.length), `${totalPontos} pts`]],
            theme: 'grid',
            headStyles: { fillColor: [230,81,0] },
            styles: { fontSize: 9, halign: 'center' }
        });

        const resumoUnidades = unidades.map(unidade => {
            const membros = porUnidade[unidade];
            const lista = Object.values(membros).flat();
            const pontos = lista.reduce((s,d) => s + (Number(d.total)||0), 0);
            return [unidade, String(Object.keys(membros).length), String(lista.length), `${pontos} pts`];
        });
        pdf.autoTable({
            startY: pdf.lastAutoTable.finalY + 10,
            head: [['Unidade', 'Desbravadores', 'Avaliações', 'Pontos']],
            body: resumoUnidades,
            theme: 'striped',
            headStyles: { fillColor: [69,90,100] },
            styles: { fontSize: 8.3 },
            columnStyles: { 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'} }
        });

        // Uma seção completa para cada unidade, e dentro dela cada desbravador.
        for (const unidade of unidades) {
            const membros = porUnidade[unidade];
            const nomes = Object.keys(membros).sort((a,b) => a.localeCompare(b, 'pt-BR'));
            const listaUnidade = Object.values(membros).flat();
            const pontosUnidade = listaUnidade.reduce((s,d) => s + (Number(d.total)||0), 0);

            pdf.addPage();
            cabecalhoPagina(`Unidade ${unidade}`, 'Resumo e histórico completo de avaliações', obterLogoUnidade(unidade));
            pdf.autoTable({
                startY: 36,
                head: [['Desbravadores', 'Avaliações', 'Pontos somados']],
                body: [[String(nomes.length), String(listaUnidade.length), `${pontosUnidade} pts`]],
                theme: 'grid',
                headStyles: { fillColor: [230,81,0] },
                styles: { fontSize: 8.5, halign: 'center' }
            });

            const resumoMembros = nomes.map(nome => {
                const dados = membros[nome];
                const total = dados.reduce((s,d) => s + (Number(d.total)||0), 0);
                const media = dados.length ? total / dados.length : 0;
                const aproveitamento = dados.length ? (total / (dados.length * 320)) * 100 : 0;
                return [nome, String(dados.length), `${total} pts`, `${media.toFixed(1)} pts`, `${aproveitamento.toFixed(1)}%`];
            });
            pdf.autoTable({
                startY: pdf.lastAutoTable.finalY + 8,
                head: [['Desbravador','Avaliações','Total','Média','Aproveitamento']],
                body: resumoMembros,
                theme: 'striped',
                headStyles: { fillColor: [69,90,100] },
                styles: { fontSize: 7.8 },
                columnStyles: { 1:{halign:'center'},2:{halign:'center'},3:{halign:'center'},4:{halign:'center'} }
            });

            for (const nome of nomes) {
                const dados = membros[nome];
                const total = dados.reduce((s,d) => s + (Number(d.total)||0), 0);
                const media = dados.length ? total / dados.length : 0;
                const percentual = dados.length ? (total / (dados.length * 320)) * 100 : 0;

                pdf.addPage();
                cabecalhoPagina(nome, `Unidade ${unidade} • Histórico completo de avaliações`, obterLogoUnidade(unidade));
                pdf.autoTable({
                    startY: 36,
                    head: [['Avaliações','Pontos somados','Média semanal','Aproveitamento']],
                    body: [[String(dados.length), `${total} pts`, `${media.toFixed(1)} pts`, `${percentual.toFixed(1)}%`]],
                    theme: 'grid',
                    headStyles: { fillColor: [230,81,0] },
                    styles: { fontSize: 8.5, halign: 'center' }
                });

                let y = pdf.lastAutoTable.finalY + 8;
                for (const d of dados) {
                    if (y + 72 > 284) {
                        pdf.addPage();
                        cabecalhoPagina(nome, `Continuação • Unidade ${unidade}`, obterLogoUnidade(unidade));
                        y = 36;
                    }

                    pdf.setFont('helvetica','bold');
                    pdf.setFontSize(10.5);
                    pdf.setTextColor(230,81,0);
                    pdf.text(`${d.mes || '-'} • ${d.semana || '-'} — ${Number(d.total)||0} pontos`, 14, y);
                    y += 5;

                    const autor = d.autor_nome || 'Conselheiro não identificado';
                    let dataAvaliacao = d.data_legivel || 'Data não informada';
                    if (!d.data_legivel && d.data) {
                        const dt = new Date(d.data);
                        if (!Number.isNaN(dt.getTime())) dataAvaliacao = dt.toLocaleString('pt-BR');
                    }
                    pdf.setFont('helvetica','normal');
                    pdf.setFontSize(8.3);
                    pdf.setTextColor(80);
                    pdf.text(`Avaliado por: ${autor} | Data: ${dataAvaliacao}`, 14, y);
                    y += 3;

                    const notas = Array.isArray(d.notas) ? d.notas : [];
                    pdf.autoTable({
                        startY: y,
                        head: [['#','Critério','Nota','Máximo']],
                        body: criterios.map((c,i) => [c[0],c[1],String(Number(notas[i])||0),String(c[2])]),
                        theme: 'grid',
                        margin: { left:14, right:14 },
                        headStyles: { fillColor: [69,90,100] },
                        styles: { fontSize:7.8, cellPadding:1.35 },
                        columnStyles: { 0:{cellWidth:12,halign:'center'},2:{cellWidth:22,halign:'center'},3:{cellWidth:22,halign:'center'} }
                    });
                    y = pdf.lastAutoTable.finalY + 7;
                }
            }
        }

        const paginas = pdf.getNumberOfPages();
        for (let i=1; i<=paginas; i++) {
            pdf.setPage(i);
            pdf.setFont('helvetica','normal');
            pdf.setFontSize(7.5);
            pdf.setTextColor(125);
            pdf.text('Relatório Geral de Avaliações • Todas as Unidades', 14, 291);
            pdf.text(`Página ${i} de ${paginas}`, 196, 291, { align:'right' });
        }

        pdf.save('Historico_Completo_Avaliacoes_Todas_as_Unidades.pdf');
        registrarLog('Exportação PDF Diretor', `Exportou histórico de todas as unidades: ${unidades.length} unidades, ${totalDesbravadores} desbravadores e ${avaliacoes.length} avaliações`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível gerar o relatório de todas as unidades: ' + e.message, 'error');
    }
};
