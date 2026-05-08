# 🛡️ Sistema de Controle de Unidade - Clube Heróis da Fé (V2.0)

Sistema web e **PWA (Progressive Web App)** desenvolvido para gestão e avaliação semanal das unidades de Desbravadores. O foco é eliminar o papel, automatizar a somatória de pontos e garantir segurança total e auditoria para a liderança.

> **Versão Atual:** 2.0 (Blindada & Otimizada)

## 🚀 Funcionalidades Principais

### 1. 📱 Experiência de Aplicativo
* **Instalável:** Funciona como um aplicativo nativo no Android e iOS (iPhone).
* **Sem Download:** Não ocupa espaço da loja de aplicativos.
* **Imersivo:** Roda em tela cheia, sem barra de navegação.
* **Ícone na Tela Inicial:** Acesso rápido direto pelo brasão do clube.

### 2. 🔐 Autenticação e Segurança (Blindada)
* **Vínculo Obrigatório:** O sistema obriga a seleção da Unidade no momento do cadastro.
* **Modal Google Inteligente:** Se o usuário entrar com Google pela primeira vez, uma janela bloqueia o acesso até que ele selecione sua unidade.
* **Trava de Segurança:** Após definida, a Unidade não pode ser alterada manualmente pelo Conselheiro, evitando erros ou trocas acidentais.
* **Login Seguro:** Acesso via E-mail/Senha ou Conta Google com persistência de sessão.

### 3. 📝 Sistema de Avaliação
* **Critérios Oficiais:** Pontuação automática baseada nos 8 requisitos do cartão (Frequência, Uniforme, Ano Bíblico, etc.).
* **Fluxo Rápido (Wizard):** Avalie todos os membros em sequência ("Próximo", "Próximo") sem sair da tela.
* **Proteção contra Duplicidade:** O sistema avisa se você tentar avaliar o mesmo membro, na mesma semana, duas vezes.
* **Modo Correção:** Permite editar uma nota específica caso tenha havido erro.

### 4. 📊 Dashboard e Relatórios de Excelência
* **Destaque da Semana:** Exibe o campeão da semana atual no topo do painel.
* **Botão "Fechar Mês":** Calcula automaticamente a somatória das 4 semanas e gera o ranking mensal (Ouro, Prata, Bronze).
* **🏆 Ranking Anual Inteligente:** Botão especial que **só aparece em Dezembro**. Ele varre todo o histórico do ano para revelar o Desbravador Excelência.
* **Gráficos:** Visualização em pizza da distribuição de pontos da unidade.

### 5. 🗂️ Gestão de Membros e Fichas
* **Ficha Cadastral Completa:** Cadastro detalhado com: Nome, Data de Nascimento, Idade, Nome dos Pais, Telefones e Endereço completo.
* **Sincronia de Equipe:** Botão "Forçar Sincronia" permite que Conselheiro e Associado vejam a mesma lista de membros em tempo real.
* **Edição Fácil:** Altere dados da ficha ou exclua membros (com confirmação de segurança).

### 6. 👮 Painel Administrativo (Diretoria)
* **Logs de Auditoria Turbinados:**
    * Registra: *Quem fez* + *Email de contato* + *Qual Unidade pertence*.
    * Exemplo: `Daniel (email@gmail.com) | Und: THIAGO WHITE`.
* **Correção de "Delay":** Sistema aguarda o carregamento dos dados para garantir que nenhum log fique "Sem Unidade".
* **Espião de Dispositivo:** Identifica se o acesso foi via Celular (Android/iPhone) ou PC.
* **Gestão Global:** O Admin pode visualizar e gerenciar as fichas de todas as unidades.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5 & CSS3:** Design responsivo e adaptado para mobile (Mobile-First).
* **JavaScript (ES6+):** Lógica de "Wizard", validações assíncronas e manipulação de DOM.
* **Firebase Authentication:** Gestão de usuários.
* **Firebase Firestore:** Banco de dados NoSQL em tempo real.
* **SweetAlert2:** Alertas e modais bonitos e interativos.

---

## 📲 Como Instalar no Celular

O sistema utiliza tecnologia PWA. Siga os passos abaixo:

### 🤖 No Android (Chrome)
1. Acesse o link do sistema.
2. Toque no menu (3 pontinhos) > **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.

### 🍎 No iPhone (iOS - Safari)
1. Acesse o link pelo Safari.
2. Toque no botão **Compartilhar** (quadrado com seta).
3. Role e toque em **"Adicionar à Tela de Início"**.

---

## 📸 Status do Projeto

✅ **Versão 2.0 Finalizada.**
* Sistema de Logs corrigido.
* Botão de Ranking Anual com gatilho de data (Dezembro).
* Cadastro e Login blindados contra erros de unidade.