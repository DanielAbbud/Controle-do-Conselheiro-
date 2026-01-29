# 🛡️ Sistema de Controle de Unidade - Clube Heróis da Fé

Sistema web desenvolvido para gestão e avaliação semanal das unidades de Desbravadores. O foco é eliminar o papel, automatizar a somatória de pontos e garantir segurança e auditoria para a liderança.

## 🚀 Funcionalidades Principais

### 1. 🔐 Autenticação e Segurança
* **Login Seguro:** Acesso via E-mail/Senha ou Conta Google.
* **Recuperação de Senha:** Sistema automático de "Esqueci minha senha" via e-mail.
* **Persistência:** O usuário permanece logado mesmo fechando o navegador.
* **Proteção de Rotas:** Ninguém acessa o painel sem estar logado.

### 2. 📝 Sistema de Avaliação (Híbrido)
* **Critérios DBV:** Pontuação automática baseada em 8 requisitos:
    1.  Frequência (30 pts)
    2.  Devoção Matinal (40 pts)
    3.  Uniforme (50 pts)
    4.  Higiene (30 pts)
    5.  Classe Bíblica (50 pts)
    6.  Ano Bíblico (40 pts)
    7.  Materiais (40 pts)
    8.  Disciplina (40 pts)
* **Modo Sequência:** Avalie todos os membros da unidade um por um (ideal para reuniões).
* **Modo Correção:** Selecione um membro específico para ajustar uma nota ou avaliar tardiamente.
* **Validação:** O sistema avisa se você tentar sobrescrever uma nota já existente.

### 3. 📊 Dashboard e Resultados
* **Destaque da Semana:** Mostra automaticamente quem fez mais pontos no período.
* **Gráficos Visuais:** Gráfico de pizza colorido mostrando a distribuição de pontos da unidade.
* **Filtros Inteligentes:** Visualize o histórico por Mês e Semana.
* **Histórico Individual:** Detalhes completos de cada membro com opção de exclusão.

### 4. ⚙️ Configuração Personalizada
* **Identidade do Conselheiro:** O sistema salva e exibe o "Nome Fantasia" (Apelido) do conselheiro.
* **Gestão da Unidade:** Cadastro fácil do nome da Unidade e lista de membros.
* **Atualização em Tempo Real:** Alterações na configuração refletem na hora na avaliação.

### 5. 👮 Painel Administrativo 
* **Log de Auditoria Total:** Registra ações críticas do sistema:
    * Entradas e Saídas (Login/Logout).
    * Criação de novas contas.
    * Avaliações realizadas ou alteradas.
    * Exclusão de notas.
    * Erros de senha (tentativas de invasão).
* **Espião de Dispositivo:** Identifica se a ação foi feita via Android, iPhone ou Computador.
* **Máquina do Tempo:** Filtro de data para verificar o histórico de dias passados.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5 & CSS3:** Design responsivo (funciona em Celular e PC) e moderno.
* **JavaScript (ES6+):** Lógica avançada de avaliação e manipulação do DOM.
* **Firebase Authentication:** Gestão de usuários e segurança.
* **Firebase Firestore:** Banco de dados NoSQL em tempo real na nuvem.

---

## 📱 Como Usar

1.  **Crie sua Conta:** Use o botão "Crie uma aqui" e defina seu Nome de Conselheiro.
2.  **Configure:** Vá na aba `Config`, digite o nome da Unidade (ex: Jaguar) e os membros.
3.  **Avalie:** Na aba `Avaliar`, escolha o Mês/Semana e clique em "Iniciar Sequência".
4.  **Acompanhe:** Veja o `Painel` para descobrir o destaque da semana.
5.  **Audite:** (Apenas Admin) Acesse a aba `Admin` para ver os logs de atividade.

---

## 📸 Status do Projeto

✅ **Concluído e Pronto para Uso.**