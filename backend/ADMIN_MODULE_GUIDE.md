# Guia do Módulo de Administração

Este documento descreve a arquitetura, o funcionamento e como estender o módulo de administração da aplicação Controle de Gastos.

## 1. Visão Geral da Arquitetura

O módulo de administração foi implementado para permitir que usuários específicos (com a role 'admin') gerenciem outros usuários e, potencialmente, outras configurações do sistema no futuro. A implementação seguiu o princípio de **minimizar o impacto** nas funcionalidades existentes e **centralizar ações por usuário** em um modal dedicado.

**Componentes Principais:**

*   **Backend:**
    *   **Modelo `Usuario`:** Contém campos cruciais como `role` (`admin`, `pro`, `comum`) e `status` (`ativo`, `inativo`, `bloqueado`).
    *   **Middleware `isAdmin`:** Verifica se o usuário autenticado possui a role 'admin' antes de permitir acesso a rotas administrativas.
    *   **Rotas `/api/admin`:** Um conjunto dedicado de endpoints para operações administrativas (listar usuários, obter detalhes, resetar senha, verificar email, atualizar role, atualizar status).
    *   **Controlador `adminController`:** Contém a lógica de negócio para as rotas administrativas, incluindo validações de segurança (ex: não alterar próprio role/status, não rebaixar último admin).
*   **Frontend:**
    *   **`AdminRoute.js`:** Componente de proteção de rota (Layout Route) que utiliza o `AuthContext` para permitir acesso apenas a usuários com `role === 'admin'`.
    *   **Página `AdminDashboard`:** Ponto de entrada visual para a seção de administração.
    *   **Componente `UserList`:** Exibe a lista paginada de usuários. **Modificação:** Em vez de botões individuais por ação, agora possui um botão "Gerenciar Ações" (`<FaCog />`) por usuário, que abre o `AdminUserActionsModal`.
    *   **Componente `UserDetailsModal`:** (Existente) Exibe os detalhes completos de um usuário selecionado (aberto pelo botão `<FaEye />` na `UserList`).
    *   **Componente `AdminUserActionsModal`:** (Novo) Modal que centraliza as ações administrativas para um usuário específico. Atualmente contém: Resetar Senha, Verificar Email, Alterar Role e Alterar Status. Projetado para ser extensível.
    *   **`MainLayout.js`:** Renderiza condicionalmente o link "Administração" na barra lateral apenas para usuários admin.

## 2. Detalhamento dos Arquivos Chave

### Backend (`./backend/src`)

*   **`models/usuarios.js`:**
    *   **Função:** Define o schema Mongoose para a coleção `usuarios`.
    *   **Campos Relevantes:** `role` (enum), `status` (enum), `emailVerificado` (boolean), `senha`, `nome`, etc.
*   **`middlewares/autenticacao.js`:**
    *   **Função:** Contém middlewares `autenticacao` (verifica JWT) e `isAdmin` (verifica `usuario.role === 'admin'`).
    *   **Uso:** `autenticacao` e `isAdmin` são aplicados globalmente às rotas em `adminRoutes.js`.
*   **`controllers/adminController.js`:**
    *   **Função:** Implementa a lógica para cada endpoint administrativo.
    *   **Funções Atuais:**
        *   `listarUsuarios`: Lista usuários com paginação.
        *   `obterDetalhesUsuario`: Busca detalhes de um usuário (para `UserDetailsModal`).
        *   `resetarSenhaUsuario`: Gera senha temporária, faz hash manual e atualiza via `findByIdAndUpdate` para evitar problemas de validação em outros campos. Retorna a senha temporária.
        *   `verifyUserEmail`: Marca `emailVerificado = true` e limpa tokens relacionados via `findByIdAndUpdate`.
        *   `updateUserRole`: Atualiza o campo `role` via `findByIdAndUpdate`, com validação do `newRole` e checagens de segurança (não alterar próprio role, não rebaixar último admin).
        *   `updateUserStatus`: Atualiza o campo `status` via `findByIdAndUpdate`, com validação do `newStatus` e checagem de segurança (não alterar próprio status).
    *   **Extensão:** Para novas ações, adicione funções aqui e registre a rota correspondente.
*   **`routes/adminRoutes.js`:**
    *   **Função:** Define os endpoints sob o prefixo `/api/admin`.
    *   **Rotas Atuais:**
        *   `GET /usuarios`: (`listarUsuarios`)
        *   `GET /usuarios/:id`: (`obterDetalhesUsuario`)
        *   `POST /usuarios/:id/resetar-senha`: (`resetarSenhaUsuario`)
        *   `PUT /usuarios/:id/verify-email`: (`verifyUserEmail`)
        *   `PUT /usuarios/:id/role`: (`updateUserRole`)
        *   `PUT /usuarios/:id/status`: (`updateUserStatus`)
    *   **Proteção:** `router.use(autenticacao); router.use(isAdmin);` aplicados a todas as rotas.
    *   **Extensão:** Adicione novas rotas aqui (ex: `DELETE /usuarios/:id` para exclusão).
*   **`app.js`:**
    *   Registra `adminRoutes` com `app.use('/api/admin', adminRoutes);`.

### Frontend (`./controle-gastos-frontend/src`)

*   **`AdminRoute.js`:** Sem alterações recentes. Protege o acesso à seção `/admin`.
*   **`App.js`:** Sem alterações recentes. Define a rota `/admin` usando `AdminRoute`.
*   **`pages/Admin/AdminDashboard.js`:** Sem alterações recentes. Renderiza o `UserList`.
*   **`pages/Admin/UserList.js`:**
    *   **Função:** Busca e exibe a lista de usuários.
    *   **Modificação:**
        *   A coluna "Ações" agora contém um botão "Ver Detalhes" (`<FaEye />`) e um botão "Gerenciar Ações" (`<FaCog />`).
        *   O botão `<FaEye />` abre o `UserDetailsModal` (como antes).
        *   O botão `<FaCog />` abre o novo `AdminUserActionsModal`, passando o objeto `usuario` selecionado.
        *   A função `handleResetSenha` foi removida daqui (movida para o modal).
        *   Adicionada função `handleActionSuccess` que é passada como prop para `AdminUserActionsModal`. Esta função exibe o toast de sucesso e recarrega a lista de usuários (`carregarUsuarios`) se a ação modificar dados visíveis na tabela (role, status, email verificado), garantindo que os badges sejam atualizados. Importante: ela *não* fecha o modal se a ação for 'reset', para permitir a cópia da senha.
    *   **Extensão:** Para adicionar informações à tabela, modifique a query no `carregarUsuarios` (parâmetro `select`) e adicione a célula `<td>` correspondente.
*   **`pages/Admin/UserDetailsModal.js`:** Sem alterações recentes. Usado para visualização detalhada.
*   **`pages/Admin/AdminUserActionsModal.js`:** (Novo)
    *   **Função:** Modal para executar ações em um usuário específico. Recebe `usuario`, `onClose`, `onActionSuccess` como props.
    *   **Ações Atuais:**
        *   **Resetar Senha:** Chama `POST /api/admin/usuarios/:id/resetar-senha`. Em sucesso, exibe a senha temporária dentro do modal com um botão para copiar (`navigator.clipboard.writeText`) e *não* fecha o modal automaticamente. Chama `onActionSuccess` com a mensagem (sem a senha).
        *   **Verificar Email:** Chama `PUT /api/admin/usuarios/:id/verify-email`. Desabilitado se o email já estiver verificado. Em sucesso, chama `onActionSuccess` e fecha o modal.
        *   **Alterar Role:** Apresenta um `<select>` com os roles permitidos (`ALLOWED_ROLES`). Ao clicar em "Salvar Role", chama `PUT /api/admin/usuarios/:id/role` com o `newRole` selecionado. Desabilitado se o role não foi alterado ou se o admin tenta editar a si mesmo (verificação de segurança no backend é a principal). Em sucesso, chama `onActionSuccess` (passando o usuário atualizado) e fecha o modal.
        *   **Alterar Status:** Apresenta um `<select>` com os status permitidos (`ALLOWED_STATUSES`). Ao clicar em "Salvar Status", chama `PUT /api/admin/usuarios/:id/status`. Desabilitado se o status não foi alterado ou se o admin tenta editar a si mesmo. Em sucesso, chama `onActionSuccess` (passando o usuário atualizado) e fecha o modal.
    *   **Estado:** Gerencia estados de loading independentes para cada ação (`loadingReset`, `loadingVerify`, etc.) e o estado para exibir/copiar a senha temporária (`tempPassword`, `showTempPassword`).
    *   **Extensibilidade:** Novas ações podem ser adicionadas como botões ou outros inputs dentro do `div.modal-actions-list`.
*   **`pages/Admin/AdminUserActionsModal.css`:** (Novo) Estilos específicos para o modal de ações, incluindo a seção de exibição/cópia de senha e os selects de role/status.
*   **`components/Layout/MainLayout.js`:** Sem alterações recentes.

## 3. Como Estender o Módulo de Administração (Atualizado)

### A. Adicionar uma Nova Ação Simples no Modal (Ex: Reenviar Verificação)

1.  **Backend:**
    *   No `adminController.js`, crie a função (ex: `resendVerificationEmail`). Ela deve buscar o usuário, verificar se o email não está verificado, gerar novo token, salvar e chamar o serviço de email.
    *   No `adminRoutes.js`, adicione a rota (ex: `POST /usuarios/:id/resend-verification`).
2.  **Frontend (`AdminUserActionsModal.js`):**
    *   Adicione um novo estado de loading (ex: `loadingResend`).
    *   Adicione um novo botão no `div.action-buttons-group`. Desabilite-o se `isLoading` ou se `usuario.emailVerificado`.
    *   Crie o handler (`handleResendVerification`) que define o loading, chama a API (ex: `api.post(...)`), trata sucesso/erro com toasts, e chama `onActionSuccess` e `onClose` em caso de sucesso.

### B. Adicionar uma Nova Ação com Input no Modal (Ex: Adicionar Nota Interna)

1.  **Backend:**
    *   No `models/usuarios.js`, adicione o novo campo (ex: `notaAdmin: { type: String }`).
    *   No `adminController.js`, crie a função (ex: `updateAdminNote`). Ela receberá a nota do `req.body` e usará `findByIdAndUpdate` para salvar.
    *   No `adminRoutes.js`, adicione a rota (ex: `PUT /usuarios/:id/admin-note`).
2.  **Frontend (`AdminUserActionsModal.js`):**
    *   Adicione um novo estado de loading (ex: `loadingNote`).
    *   Adicione um novo estado para o valor do input (ex: `adminNoteValue`, inicializado com `usuario.notaAdmin || ''`).
    *   Adicione um novo `div` (similar ao `.select-action-item`) contendo um `<label>`, um `<textarea>` (ou `<input>`) ligado ao `adminNoteValue`, e um botão "Salvar Nota" ligado a um novo handler.
    *   Crie o handler (`handleUpdateNote`) que define o loading, chama a API (ex: `api.put(..., { nota: adminNoteValue })`), trata sucesso/erro, chama `onActionSuccess` e `onClose`.

### C. Exibir um Novo Campo do Usuário no Admin

1.  **Backend:**
    *   Certifique-se de que o campo existe no schema `models/usuarios.js`.
    *   Na função `listarUsuarios` em `adminController.js`, adicione o campo ao parâmetro `select` da query da API no `UserList.js` se quiser exibi-lo na tabela.
    *   A função `obterDetalhesUsuario` geralmente já retorna todos os campos (exceto senha).
2.  **Frontend:**
    *   **Tabela (`UserList.js`):** Adicione `<th>` e `<td>{usuario.novoCampo || 'N/A'}</td>`.
    *   **Modal de Detalhes (`UserDetailsModal.js`):** Adicione um `div.detail-item` com label e valor.
    *   **Modal de Ações (`AdminUserActionsModal.js`):** Se relevante para as ações, exiba o campo no cabeçalho do modal ou próximo às ações relacionadas.

### D. Adicionar Novos Tipos de Usuário (Roles) ou Status

1.  **Backend:**
    *   Atualize o `enum` correspondente (`role` ou `status`) em `models/usuarios.js`.
    *   Revise as checagens de segurança em `adminController.js` (ex: `updateUserRole`) se necessário.
    *   Revise o middleware `isAdmin` se o novo role precisar de acesso admin.
2.  **Frontend:**
    *   Atualize as constantes `ALLOWED_ROLES` ou `ALLOWED_STATUSES` em `AdminUserActionsModal.js` para que apareçam nos selects.
    *   Adicione as classes CSS correspondentes para os novos badges em `UserList.css` (ex: `.role-novo { ... }`, `.status-novo { ... }`).

## 4. Migrações de Banco de Dados

Alterações no schema (como adicionar novos campos ou modificar enums) podem exigir scripts de migração (`backend/scripts/migrations/`) para atualizar dados existentes. Consulte o `README.md` na pasta de migrações.

---

Este guia deve fornecer uma base sólida para entender e trabalhar com o módulo de administração. Mantenha a estrutura organizada e siga os padrões estabelecidos para facilitar a manutenção futura. 