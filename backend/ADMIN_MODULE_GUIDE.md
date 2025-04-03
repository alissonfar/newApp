# Guia do Módulo de Administração

Este documento descreve a arquitetura, o funcionamento e como estender o módulo de administração da aplicação Controle de Gastos.

## 1. Visão Geral da Arquitetura

O módulo de administração foi implementado para permitir que usuários específicos (com a role 'admin') gerenciem outros usuários e, potencialmente, outras configurações do sistema no futuro. A implementação seguiu o princípio de **minimizar o impacto** nas funcionalidades existentes.

**Componentes Principais:**

*   **Backend:**
    *   **Modelo `Usuario`:** Adicionado um campo `role` para definir o tipo de usuário (`admin`, `pro`, `comum`).
    *   **Middleware `isAdmin`:** Verifica se o usuário autenticado possui a role 'admin' antes de permitir acesso a rotas específicas.
    *   **Rotas `/api/admin`:** Um conjunto dedicado de endpoints para operações administrativas (listar usuários, obter detalhes, resetar senha).
    *   **Controlador `adminController`:** Contém a lógica de negócio para as rotas administrativas.
*   **Frontend:**
    *   **`AdminRoute.js`:** Componente de proteção de rota que utiliza o `AuthContext` para permitir acesso apenas a usuários com `role === 'admin'`. Usa o padrão "Layout Route" do React Router v6.
    *   **Página `AdminDashboard`:** Ponto de entrada visual para a seção de administração.
    *   **Componente `UserList`:** Exibe a lista paginada de usuários com ações básicas (Ver Detalhes, Resetar Senha).
    *   **Componente `UserDetailsModal`:** Exibe os detalhes completos de um usuário selecionado em um modal.
    *   **`MainLayout.js`:** Renderiza condicionalmente o link "Administração" na barra lateral apenas para usuários admin.

## 2. Detalhamento dos Arquivos Chave

### Backend (`./backend/src`)

*   **`models/usuarios.js`:**
    *   **Função:** Define o schema Mongoose para a coleção `usuarios` no MongoDB.
    *   **Modificação:** Contém o novo campo `role`: `{ type: String, enum: ['admin', 'pro', 'comum'], default: 'comum', index: true }`.
        *   `enum`: Define os únicos valores permitidos para o campo `role`.
        *   `default`: Garante que novos usuários (e usuários atualizados via script de migração) recebam 'comum' se nenhum `role` for especificado.
*   **`middlewares/autenticacao.js`:**
    *   **Função:** Contém middlewares relacionados à autenticação e autorização.
    *   **`autenticacao` (Função Existente Modificada):** Verifica o token JWT. A exportação foi alterada para `module.exports = { autenticacao, isAdmin }`, exigindo desestruturação `{ autenticacao }` onde era importada.
    *   **`isAdmin` (Nova Função):** Middleware que deve ser usado *após* o `autenticacao`. Ele busca o usuário no banco usando `req.userId` (fornecido por `autenticacao`), verifica se `usuario.role === 'admin'`, e retorna erro 403 (Forbidden) ou chama `next()`.
*   **`controllers/adminController.js`:**
    *   **Função:** Implementa a lógica para cada endpoint administrativo.
    *   **Funções Atuais:** `listarUsuarios` (com paginação e seleção de campos), `obterDetalhesUsuario`, `resetarSenhaUsuario` (gera e retorna senha temporária).
    *   **Extensão:** Para novas ações, adicione novas funções exportadas aqui.
*   **`routes/adminRoutes.js`:**
    *   **Função:** Define os endpoints sob o prefixo `/api/admin`.
    *   **Proteção:** Usa `router.use(autenticacao); router.use(isAdmin);` no início para garantir que *todas* as rotas definidas neste arquivo exijam login e permissão de admin.
    *   **Extensão:** Para novas ações, defina novas rotas (ex: `router.put('/usuarios/:id/block', adminController.blockUser);`).
*   **`app.js`:**
    *   **Função:** Ponto de entrada principal da aplicação Express.
    *   **Modificação:** Importa `adminRoutes` e o registra com `app.use('/api/admin', adminRoutes);`.

### Frontend (`./controle-gastos-frontend/src`)

*   **`AdminRoute.js`:**
    *   **Função:** Componente wrapper para proteger rotas. Usa `useContext(AuthContext)` para acessar `token`, `usuario`, `carregando`.
    *   **Lógica:** Se `carregando`, exibe "Carregando...". Se `!token` ou `usuario.role !== 'admin'`, redireciona para `/` usando `<Navigate />`. Se for admin, renderiza `<Outlet />`, que por sua vez renderiza o componente da rota filha definida em `App.js`.
*   **`App.js`:**
    *   **Função:** Define a estrutura de roteamento principal da aplicação.
    *   **Modificação:** Implementa a rota administrativa usando o padrão "Layout Route":
        ```jsx
        <Route element={<AdminRoute />}> {/* Pai: Aplica a proteção */}
          <Route 
            path="/admin" 
            element={ /* Filho: Conteúdo renderizado pelo Outlet */
              <MainLayout>
                <AdminDashboard />
              </MainLayout>
            }
          />
        </Route>
        ```
*   **`pages/Admin/AdminDashboard.js`:**
    *   **Função:** Componente de página simples que serve como container para os elementos da seção de administração. Atualmente, renderiza principalmente o `UserList`.
    *   **Extensão:** Pode ser usado para adicionar links/seções para outras funcionalidades administrativas no futuro.
*   **`pages/Admin/UserList.js`:**
    *   **Função:** Busca a lista paginada de usuários da API (`/api/admin/usuarios`), exibe em uma tabela e fornece botões de ação.
    *   **Ações Atuais:** "Ver Detalhes" (busca dados completos e abre `UserDetailsModal`), "Resetar Senha" (chama API `/api/admin/usuarios/:id/resetar-senha`).
    *   **Extensão:** Para novas ações na linha, adicione botões e funções `handle...` que chamem a API correspondente.
*   **`pages/Admin/UserDetailsModal.js`:**
    *   **Função:** Componente modal reutilizável que recebe um objeto `usuario` e uma função `onClose`. Exibe todos os campos do usuário de forma organizada.
    *   **Extensão:** Para exibir novos campos, adicione os `div.detail-item` apropriados. Para adicionar ações específicas do usuário no modal, descomente/adicione botões na seção `modal-actions`.
*   **`components/Layout/MainLayout.js`:**
    *   **Função:** Fornece a estrutura visual principal (barra lateral, header).
    *   **Modificação:** Renderiza condicionalmente o link `<li><Link to="/admin">...</Link></li>` na barra lateral, verificando `usuario?.role === 'admin'`. Usa `useContext(AuthContext)`.
    *   **Extensão:** Se novos roles precisarem ver o link, ajuste a condição (ex: `['admin', 'supervisor'].includes(usuario?.role)`).

## 3. Como Estender o Módulo de Administração

### A. Adicionar uma Nova Ação de Admin (Ex: Bloquear/Desbloquear Usuário)

1.  **Backend:**
    *   No `models/usuarios.js`, verifique se o campo `status` (`ativo`, `inativo`, `bloqueado`) já atende à necessidade. Se sim, ótimo.
    *   No `adminController.js`, crie uma nova função assíncrona (ex: `blockUser`, `unblockUser` ou `updateUserStatus`). Ela receberá `req`, `res`. Use `req.params.id` para encontrar o usuário (`Usuario.findByIdAndUpdate(id, { status: 'bloqueado' }, { new: true })`). Retorne o usuário atualizado ou uma mensagem de sucesso.
    *   No `adminRoutes.js`, adicione uma nova rota, por exemplo: `router.put('/usuarios/:id/status', adminController.updateUserStatus);`.
2.  **Frontend:**
    *   Decida onde o botão/ação fará sentido: na linha da tabela (`UserList.js`) ou dentro do modal (`UserDetailsModal.js`).
    *   Adicione um botão (ex: `<button onClick={() => handleUpdateStatus(usuario._id, 'bloqueado')}><FaBan /></button>`).
    *   Crie a função `handleUpdateStatus(userId, newStatus)` no componente correspondente.
    *   Dentro dela, use `api.put(`/admin/usuarios/${userId}/status`, { status: newStatus })`.
    *   Atualize o estado local para refletir a mudança (ex: recarregue a lista de usuários ou atualize o `selectedUser` no modal) e exiba um `toast` de sucesso/erro.

### B. Exibir um Novo Campo do Usuário no Admin

1.  **Backend:**
    *   Certifique-se de que o campo existe no schema `models/usuarios.js`.
    *   Verifique as funções `listarUsuarios` e `obterDetalhesUsuario` em `adminController.js`.
        *   Para `listarUsuarios`, se você quiser o campo na tabela, adicione-o ao parâmetro `select` da query da API no frontend (`UserList.js`) se ele não for selecionado por padrão. Garanta que ele não esteja sendo removido pelo `toJSON` no modelo se for necessário.
        *   Para `obterDetalhesUsuario`, geralmente todos os campos (exceto senha) já são retornados, mas verifique se não há um `.select()` excluindo-o.
2.  **Frontend:**
    *   **Tabela (`UserList.js`):** Se aplicável, adicione um cabeçalho `<th>Novo Campo</th>` e a célula de dados `<td>{usuario.novoCampo || 'N/A'}</td>` no loop `map`.
    *   **Modal (`UserDetailsModal.js`):** Adicione um novo bloco `<div class="detail-item">...</div>` com o label (`<span class="detail-label">...</span>`) e o valor (`<span class="detail-value">{usuario.novoCampo || 'N/A'}</span>`). Use ícones apropriados.

### C. Adicionar uma Nova Página Administrativa (Ex: Gerenciar Configurações Globais)

1.  **Backend (Se necessário):**
    *   Crie um novo modelo Mongoose (ex: `models/Configuracao.js`).
    *   Crie um novo controlador (ex: `controllers/configController.js`) com a lógica para ler/atualizar as configurações.
    *   Crie um novo arquivo de rotas (ex: `routes/configRoutes.js`), proteja-o com `autenticacao` e `isAdmin`, e defina os endpoints.
    *   Registre as novas rotas em `app.js` (ex: `app.use('/api/config', configRoutes);`).
2.  **Frontend:**
    *   Crie a nova página React (ex: `pages/Admin/ConfigPage.js`).
    *   Em `App.js`, adicione uma nova rota *aninhada* dentro da rota pai `<Route element={<AdminRoute />}>`:
        ```jsx
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<MainLayout><AdminDashboard /></MainLayout>} />
          <Route path="/admin/config" element={<MainLayout><ConfigPage /></MainLayout>} /> {/* Nova Rota */}
        </Route>
        ```
    *   Adicione um link para a nova página. Pode ser dentro do `AdminDashboard.js` ou, se for muito importante, diretamente na barra lateral (`MainLayout.js`), lembrando de usar a condição `usuario?.role === 'admin'`.

### D. Adicionar Novos Tipos de Usuário (Roles)

1.  **Backend:**
    *   Atualize o `enum` no campo `role` em `models/usuarios.js` para incluir os novos roles (ex: `['admin', 'pro', 'comum', 'supervisor']`).
    *   Analise o middleware `isAdmin` em `middlewares/autenticacao.js`. Se o novo role (ex: 'supervisor') também precisar de acesso às rotas de admin, ajuste a condição: `if (!['admin', 'supervisor'].includes(usuario.role)) { ... }`.
    *   Se o novo role tiver permissões *diferentes*, talvez seja necessário criar um novo middleware (ex: `isSupervisor`) ou uma lógica mais granular de permissões.
2.  **Frontend:**
    *   Analise o `AdminRoute.js`. Se necessário, ajuste a condição ou crie componentes de rota específicos para os novos roles.
    *   Atualize qualquer renderização condicional baseada em `role` (como o link em `MainLayout.js`).
    *   Adicione classes CSS para os novos badges de role em `UserList.css` e `UserDetailsModal.css` (ex: `.role-supervisor { background-color: some-color; }`).

## 4. Migrações de Banco de Dados

Lembre-se que alterações no schema (como adicionar o campo `role`) podem exigir a execução de scripts de migração para atualizar os documentos existentes no banco de dados.

*   Os scripts de migração ficam em `backend/scripts/migrations/`.
*   As instruções de como executá-los estão em `backend/scripts/migrations/README.md`.

---

Este guia deve fornecer uma base sólida para entender e trabalhar com o módulo de administração. Mantenha a estrutura organizada e siga os padrões estabelecidos para facilitar a manutenção futura. 