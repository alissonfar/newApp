# Documento de Planejamento: Ferramentas Everest

**Versão:** 1.2
**Data:** 30/07/2024 (Atualizado)

**Nota sobre Estado Atual (Julho 2024):** As Fases 1 a 5 deste plano foram concluídas. O frontend foi desenvolvido (UI e chamadas de API) e o backend (Models, Controllers, Rotas protegidas por role) foi implementado para todas as ferramentas. O frontend agora está conectado aos endpoints reais do backend. Os testes iniciais End-to-End (Passo 6.1) e de Controle de Acesso (Passo 6.2) foram realizados com sucesso. O projeto está atualmente iniciando o Passo 6.3.

**1. Visão Geral**

Este documento descreve a concepção e o planejamento para a implementação de uma nova seção na aplicação "Controle de Gastos", denominada "Ferramentas Everest". Esta seção será um conjunto de utilitários e funcionalidades projetadas especificamente para otimizar as tarefas diárias de usuários com a role de acesso "everest", tipicamente envolvidos em atividades de suporte técnico ou atendimento. O objetivo é centralizar informações, agilizar consultas e fornecer ferramentas práticas que atualmente podem exigir o uso de múltiplos aplicativos externos (planilhas, blocos de notas, etc.).

O acesso a esta seção e suas funcionalidades será restrito a usuários autenticados que possuam a role **"everest" ou "admin"**. A role "admin" tem acesso a todas as funcionalidades do sistema.

**2. Requisitos**

**2.1. Requisitos Funcionais**

*   **RF001: Controle de Acesso por Role:** A aplicação deve garantir que apenas usuários com a role **"everest" ou "admin"** possam acessar a rota `/everest` e suas sub-funcionalidades.
*   **RF002: Página Dedicada Everest:** Deve existir uma página principal (`/everest`) que sirva como painel para acessar as diferentes ferramentas.
*   **RF003: Gerenciador de Notas/Conhecimento:**
    *   Permitir criar, ler, atualizar e deletar notas pessoais.
    *   Permitir adicionar tags/categorias às notas.
    *   Permitir buscar notas por título, conteúdo ou tag.
*   **RF004: Repositório de Links Úteis:**
    *   Permitir salvar, ler, atualizar e deletar links (URL, título, descrição).
    *   Permitir categorizar/taggear links.
    *   Permitir buscar links por título, descrição, URL ou tag.
*   **RF005: Rastreador de Informações de Chamados:**
    *   Permitir registrar informações contextuais sobre chamados de suporte (ID Externo, Cliente, Resumo, Passos, Links/Notas associadas, Status). *Não é um sistema de helpdesk.*
    *   Permitir visualizar, atualizar e deletar registros de informações de chamados.
    *   Permitir buscar registros por ID Externo, Cliente ou Resumo.
*   **RF006: Consulta de Acesso por CNPJ:**
    *   Permitir o upload de arquivos (CSV/XLSX) contendo mapeamento de CNPJ para informações de acesso (usuário, etc.).
    *   Processar o arquivo e armazenar os dados de forma estruturada no backend.
    *   Permitir consultar as informações de acesso buscando por CNPJ.
*   **RF007: Processador/Sumarizador de XML:**
    *   Permitir o upload de arquivos XML.
    *   Processar o XML no backend para extrair informações chave pré-definidas.
    *   Armazenar um resumo das informações extraídas.
    *   Permitir visualizar o último resumo gerado ou buscar/visualizar resumos anteriores.

**2.2. Requisitos Não-Funcionais**

*   **RNF001: Segurança:**
    *   Implementar Role-Based Access Control (RBAC) de forma robusta no frontend e backend.
    *   Validar e sanitizar todas as entradas do usuário (formulários, uploads).
    *   Validar tipos e tamanhos de arquivos no upload.
    *   Armazenar dados sensíveis (se houver, ex: na planilha CNPJ) de forma segura (evitar senhas em texto plano).
    *   Manter as dependências atualizadas para mitigar vulnerabilidades conhecidas.
    *   Seguir as melhores práticas de segurança web (HTTPS implícito, etc.).
*   **RNF002: Usabilidade:**
    *   Manter a consistência visual e de interação com o restante da aplicação (uso de TailwindCSS, componentes existentes).
    *   Interface intuitiva e fácil de navegar dentro da seção Everest.
    *   Fornecer feedback claro ao usuário sobre ações (sucesso, erro, carregamento).
*   **RNF003: Manutenibilidade e Mínima Disrupção:**
    *   **Extrema Importância:** Modificar o mínimo possível a estrutura e o código existente não relacionado à funcionalidade Everest. Garantir que todas as funcionalidades atuais (Transações, Relatórios, Tags, etc.) continuem funcionando perfeitamente.
    *   Código modular e bem organizado (componentes React, hooks, funções API separadas, controllers/services no backend).
    *   Adotar padrões de codificação consistentes.
*   **RNF004: Desempenho:**
    *   Consultas ao backend devem ser eficientes.
    *   O processamento de arquivos (Planilha, XML) não deve bloquear a interface do usuário por longos períodos (considerar feedback de progresso ou processamento assíncrono se necessário para arquivos grandes no futuro).

**3. Integração com o Sistema Existente**

*   **Frontend (`controle-gastos-frontend`):**
    *   **Roteamento:** Adicionar nova rota `/everest` em `src/App.js`.
    *   **Controle de Acesso:** Criar componente `src/EverestRoute.js` que verifica se `usuario.role` é **'everest' ou 'admin'** a partir do `AuthContext`.
    *   **Layout:** Adicionar um novo item de menu condicional em `src/components/Layout/MainLayout.js` visível apenas para as roles **'everest' ou 'admin'**.
    *   **Páginas e Componentes:** Criar novos arquivos em `src/pages/Everest/` e `src/components/Everest/` para as funcionalidades específicas.
    *   **API:** Adicionar novas funções de chamada ao backend em `src/api.js`.
*   **Backend (`backend`):**
    *   **Autenticação/Autorização:**
        *   Modificar `src/models/User.js` para incluir `role: { type: String, enum: ['user', 'admin', 'everest'], default: 'user' }`.
        *   Atualizar a lógica de geração de token JWT (provavelmente em `src/controllers/authController.js`) para incluir a `role` no payload.
        *   Criar um middleware (`src/middlewares/checkRole.js` ou similar) para verificar se `req.user.role === 'everest'` nas rotas protegidas.
    *   **Novos Recursos:**
        *   Criar novos Models Mongoose em `src/models/` (ex: `EverestNote.js`, `EverestLink.js`, `EverestTicketInfo.js`, `EverestCnpjAccess.js`, `EverestXmlSummary.js`). *Usar prefixo 'Everest' pode ajudar na organização.*
        *   Criar novos arquivos de rotas em `src/routes/` (ex: `everestNotes.js`).
        *   Criar novos controllers em `src/controllers/` (ex: `everestNoteController.js`).
        *   Registrar as novas rotas no `src/app.js`, protegendo-as com o middleware de role.
        *   Configurar `multer` para os endpoints de upload.

**4. Funcionalidades Detalhadas (Ferramentas Everest)**

*(Resumo - detalhes podem ser refinados durante a implementação)*

*   **4.1. Gerenciador de Notas:**
    *   **UI:** Componente (`NotesManager.js`) com `textarea`/editor simples, campos para título e tags (input de texto, talvez com sugestões). Lista/Tabela de notas com busca e botões de ação (Editar, Excluir). Modal para edição/criação.
    *   **API:** Endpoints implementados em `backend/src/routes/everestNotes.js` (prefixo `/api/everest/notes`).
        *   `POST /`: `createNote`
        *   `GET /`: `getNotes` (Busca por termo ainda não implementada no backend).
        *   `GET /:id`: `getNoteById`
        *   `PUT /:id`: `updateNote`
        *   `DELETE /:id`: `deleteNote`
*   **4.2. Repositório de Links:**
    *   **UI:** Componente (`LinksManager.js`) com formulário (URL, Título, Descrição, Tags). Tabela/Lista de links com busca/filtro e ações.
    *   **API:** Endpoints implementados em `backend/src/routes/everestLinks.js` (prefixo `/api/everest/links`).
        *   `POST /`: `createLink`
        *   `GET /`: `getLinks` (Busca por termo ainda não implementada no backend).
        *   `GET /:id`: `getLinkById`
        *   `PUT /:id`: `updateLink`
        *   `DELETE /:id`: `deleteLink`
*   **4.3. Rastreador de Info Chamados:**
    *   **UI:** Componente (`TicketInfoTracker.js`) com formulário (ID Externo, Cliente, Resumo, Status Dropdown, Textarea para Passos, campo para Links/Notas). Tabela/Lista com busca e ações.
    *   **API:** Endpoints implementados em `backend/src/routes/everestTicketInfo.js` (prefixo `/api/everest/ticketinfo`).
        *   `POST /`: `createTicketInfo`
        *   `GET /`: `getTicketInfos` (Busca por termo ainda não implementada no backend).
        *   `GET /:id`: `getTicketInfoById`
        *   `PUT /:id`: `updateTicketInfo`
        *   `DELETE /:id`: `deleteTicketInfo`
*   **4.4. Consulta Acesso CNPJ:**
    *   **UI:** Componente (`CnpjAccessTool.js`) com botão de Upload (aceitando `.csv`, `.xlsx`), input para busca de CNPJ, área de resultados. Feedback sobre upload (sucesso/erro/processando).
    *   **API:** Endpoints implementados em `backend/src/routes/everestCnpj.js` (prefixo `/api/everest/cnpj`).
        *   `POST /upload`: `processUpload` (Recebe `multipart/form-data` com campo 'file'). Processa CSV/XLSX.
        *   `GET /query/:cnpj`: `queryByCnpj`.
*   **4.5. Processador XML:**
    *   **UI:** Componente (`XmlProcessorTool.js`) com botão de Upload (aceitando `.xml`). Área para exibir o último resumo ou uma lista selecionável de resumos anteriores.
    *   **API:** Endpoints implementados em `backend/src/routes/everestXml.js` (prefixo `/api/everest/xml`).
        *   `POST /process`: `processXmlUpload` (Recebe `multipart/form-data` com campo 'file'). Processa XML.
        *   `GET /summaries`: `getSummaries`.
        *   `GET /summaries/:id`: `getSummaryById`.

**5. Considerações de Segurança (Reforço)**

*   **Princípio Fundamental:** **Mínima Disrupção.** Isolar ao máximo o código da funcionalidade Everest. Testar exaustivamente as funcionalidades existentes após cada etapa significativa.
*   **Controle de Acesso:** A verificação das roles **'everest' ou 'admin'** deve ocorrer tanto no frontend (para exibição de UI e acesso à rota) quanto no backend (para autorização de acesso aos endpoints da API). O backend deve sempre validar a permissão, independentemente da checagem do frontend.
*   **Uploads:** Validar rigorosamente a extensão (`.csv`, `.xlsx`, `.xml`) e o MIME type dos arquivos no backend. Limitar o tamanho máximo do upload. Sanitizar nomes de arquivos. Armazenar uploads em local seguro e não diretamente acessível via web, se possível.
*   **Input:** Validar e sanitizar TODOS os dados recebidos do frontend no backend antes de processar ou salvar no banco de dados.
*   **Dados Sensíveis:** Evitar armazenar senhas ou chaves de API em texto claro. Se a planilha CNPJ contiver senhas, discutir a necessidade e a forma segura de armazenamento (idealmente, não armazenar ou usar hash forte se inevitável e não reutilizável).
*   **Dependências:** Manter `npm audit` em dia para ambos os projetos.

**Dependências Adicionadas (Backend):**
*   `xlsx`: Para parsing de arquivos `.xlsx`.
*   `csv-parser`: Para parsing de arquivos `.csv`.
*   `xml2js`: Para parsing de arquivos `.xml`.

**Limitações Atuais / TODOs:**
*   **Busca:** Os endpoints `GET` para Notas, Links e Info Chamados ainda não implementam a filtragem por `searchTerm` no backend; a busca atual é feita localmente no frontend sobre os dados carregados.
*   **Processamento XML:** A lógica de extração de dados no `everestXmlController.js` (`extractNFeData`) está atualmente configurada como exemplo para o formato NFe. Pode precisar de adaptação para outros formatos de XML.

**6. Plano de Implementação (Status Atualizado)**

**Fase 1: Estrutura e Acesso Base (Frontend)**

*   \[x] **Passo 1.1 (Mock):** No `AuthContext` (`controle-gastos-frontend/src/context/AuthContext.js`), adicionar temporariamente uma forma de simular um usuário com `role: 'everest'` para fins de desenvolvimento (pode ser um estado local ou um valor fixo inicial enquanto o backend não é atualizado).
*   \[x] **Passo 1.2 (Rota Protegida):** Criar o arquivo `controle-gastos-frontend/src/EverestRoute.js`. Implementar a lógica que verifica se `authContext.usuario?.role` é **'everest' ou 'admin'**. Se não for, redirecionar para a Home (`/`) ou exibir uma página de "Não Autorizado".
*   \[x] **Passo 1.3 (Definição da Rota):** Em `controle-gastos-frontend/src/App.js`, importar `EverestRoute` e a futura página `EverestPage`. Adicionar a definição da rota: `<Route path="/everest" element={<EverestRoute><EverestPage /></EverestRoute>} />`.
*   \[x] **Passo 1.4 (Página Placeholder):** Criar a pasta `src/pages/Everest/` e o arquivo `EverestPage.js`. Implementar um componente simples com um título "Ferramentas Everest" como placeholder.
*   \[x] **Passo 1.5 (Menu):** Em `src/components/Layout/MainLayout.js`, localizar a lista de itens de menu (`menuItems`). Adicionar um novo item (ex: { name: 'Ferramentas Everest', path: '/everest', icon: <FaTools /> }). Envolver a renderização deste item `<li>` com uma verificação condicional: `{ (usuario?.role === 'everest' || usuario?.role === 'admin') && ( /* ...código do item de menu... */ )}`.
*   \[x] **Passo 1.6 (Teste Inicial):** Executar o frontend. Verificar se:
    *   Com a role 'everest' mockada OU logado como 'admin' real (após implementação do backend), o item de menu aparece e a navegação para `/everest` funciona.
    *   Sem a role 'everest' mockada e sem ser 'admin', o item de menu NÃO aparece e o acesso direto a `/everest` é bloqueado/redirecionado.

**Fase 2: Implementação das Ferramentas (Frontend UI + Lógica Mockada)**

*(Implementar uma ferramenta de cada vez)*

*   \[x] **Passo 2.1 (Notas - UI):** Criar `src/components/Everest/NotesManager.js`. Desenvolver a UI para criar, listar e buscar notas usando Tailwind e componentes existentes. Usar dados mockados (`useState` inicial com um array de notas).
*   \[x] **Passo 2.2 (Notas - Lógica Local):** Implementar as funções de adicionar, editar (abrir modal com dados), deletar e buscar, manipulando apenas o estado local (o array de notas mockadas).
*   \[x] **Passo 2.3 (Notas - Integração):** Integrar o componente `NotesManager` dentro da `EverestPage.js`.
*   \[x] **Passo 2.4 (Notas - Teste):** Testar todas as interações da UI e a manipulação do estado local para o gerenciador de notas.
*   \[x] **Passo 2.5 (Repetir para Links):** Repetir passos 2.1 a 2.4 para o Repositório de Links (`LinksManager.js`).
*   \[x] **Passo 2.6 (Repetir para Info Chamados):** Repetir passos 2.1 a 2.4 para o Rastreador de Informações de Chamados (`TicketInfoTracker.js`).
*   \[x] **Passo 2.7 (Repetir para Acesso CNPJ - UI):** Criar `CnpjAccessTool.js`. Implementar a UI de upload e busca. A lógica de upload e busca será apenas visual nesta fase (sem processamento real).
*   \[x] **Passo 2.8 (Repetir para XML - UI):** Criar `XmlProcessorTool.js`. Implementar a UI de upload e exibição de resumos (com dados mockados).

**Fase 3: Integração API (Frontend - Contratos)**

*   \[x] **Passo 3.1 (Definir Funções API):** Em `src/api.js`, adicionar as assinaturas das funções necessárias para todas as ferramentas Everest (ex: `criarNotaEverest(notaData)`, `obterNotasEverest()`, `uploadPlanilhaCnpj(formData)`, etc.). Inicialmente, essas funções podem apenas logar a chamada ou retornar Promises resolvidas com dados mockados. *Importante: Definir os parâmetros e o formato esperado de resposta.*
*   \[x] **Passo 3.2 (Refatorar Notas):** No `NotesManager.js`, substituir a lógica de manipulação do estado local pelas chamadas às funções correspondentes em `api.js`. Usar `useEffect` para buscar as notas ao montar o componente. Adicionar estados de `loading` e `error` e exibir feedback apropriado na UI.
*   \[x] **Passo 3.3 (Teste Notas com API Mock):** Testar o `NotesManager` garantindo que ele chama as funções corretas da API (mock) e lida com os estados de carregamento/erro.
*   \[x] **Passo 3.4 (Repetir Refatoração):** Repetir os passos 3.2 e 3.3 para `LinksManager.js`, `TicketInfoTracker.js`, `CnpjAccessTool.js` (chamando `uploadPlanilhaCnpj` e `consultarCnpj`), `XmlProcessorTool.js` (chamando `processarXml` e `obterSumariosXml`).

*(Neste ponto, o Frontend estará estruturalmente pronto, com UI funcional e chamadas de API definidas, aguardando a implementação do Backend)*

**Fase 4: Backend - Estrutura e Acesso**

*   \[x] **Passo 4.1 (Model User):** Atualizar `backend/src/models/User.js` adicionando a `role` 'everest' ao enum (ou criando o campo `role` se não existir).
*   \[x] **Passo 4.2 (JWT):** Atualizar a função de login/geração de token para incluir a `role` no payload do JWT.
*   \[x] **Passo 4.3 (Middleware Role):** Criar `backend/src/middlewares/checkRole.js` (ou similar) que exporta uma função `checkRole(allowedRoles)` que retorna um middleware. Este middleware verifica se `req.user.role` está incluído no array `allowedRoles`. As rotas Everest usarão `checkRole(['everest', 'admin'])`.
*   \[x] **Passo 4.4 (Teste Backend Auth):** Testar o login, verificar se o token contém a role. Testar o acesso a uma rota de teste protegida pelo `checkRole(['everest', 'admin'])` usando Postman/Insomnia (deve funcionar para ambas as roles, falhar para outras).

**Fase 5: Backend - Endpoints das Ferramentas**

*(Implementar uma ferramenta de cada vez)*

*   \[x] **Passo 5.1 (Notas - Backend):**
    *   Criar `backend/src/models/EverestNote.js` (Schema Mongoose).
    *   Criar `backend/src/routes/everestNotes.js` definindo as rotas CRUD.
    *   Proteger as rotas usando `checkRole(['everest', 'admin'])`.
    *   Criar `backend/src/controllers/everestNoteController.js` com a lógica para interagir com o model `EverestNote`.
    *   Registrar a rota em `app.js`.
*   \[x] **Passo 5.2 (Notas - Teste Backend):** Testar os endpoints CRUD de notas via Postman/Insomnia ou diretamente pelo frontend (que já está pronto para chamar a API real).
*   \[x] **Passo 5.3 (Repetir para Links):** Implementar e testar o backend para Links.
*   \[x] **Passo 5.4 (Repetir para Info Chamados):** Implementar e testar o backend para Info Chamados.
*   \[x] **Passo 5.5 (Repetir para Acesso CNPJ):** Implementar e testar o backend para Acesso CNPJ (incluir `multer`, parsing de CSV/XLSX, armazenamento no Model `EverestCnpjAccess`).
*   \[x] **Passo 5.6 (Repetir para XML):** Implementar e testar o backend para XML (incluir `multer`, parsing de XML, armazenamento no Model `EverestXmlSummary`).

**Fase 6: Teste Integrado e Refinamento**

*   \[x] **Passo 6.1 (Testes E2E):** Realizar testes completos End-to-End para cada ferramenta Everest, simulando o fluxo real do usuário.
*   \[x] **Passo 6.2 (Testes de Acesso):** Testar rigorosamente que usuários sem as roles 'everest' ou 'admin' não conseguem acessar a seção nem interagir com os endpoints da API Everest. Verificar que tanto 'everest' quanto 'admin' conseguem.
*   \[ ] **Passo 6.3 (Testes Funcionalidades Existentes):** **Crucial:** Testar novamente as funcionalidades principais da aplicação (Transações, Relatórios, Tags, Autenticação geral, **Módulo Admin**, etc.) para garantir que nada foi quebrado.
*   \[ ] **Passo 6.4 (Testes de Borda):** Testar casos como uploads vazios, dados inválidos em formulários, busca sem resultados, etc.
*   \[ ] **Passo 6.5 (Revisão e Refatoração):** Revisar o código implementado (Frontend e Backend). Refatorar se necessário para melhorar clareza, performance ou segurança.
*   \[ ] **Passo 6.6 (Polimento UI/UX):** Ajustes finais na interface com base nos testes e feedback.

**7. Checklist de Implementação (Status Atualizado)**

**Fase 1: Estrutura e Acesso Base (Frontend)**
*   \[x] **Passo 1.1 (Mock):** No `AuthContext` (`controle-gastos-frontend/src/context/AuthContext.js`), adicionar temporariamente uma forma de simular um usuário com `role: 'everest'` para fins de desenvolvimento (pode ser um estado local ou um valor fixo inicial enquanto o backend não é atualizado).
*   \[x] **Passo 1.2 (Rota Protegida):** Criar o arquivo `controle-gastos-frontend/src/EverestRoute.js`. Implementar a lógica que verifica se `authContext.usuario?.role` é **'everest' ou 'admin'**. Se não for, redirecionar para a Home (`/`) ou exibir uma página de "Não Autorizado".
*   \[x] **Passo 1.3 (Definição da Rota):** Em `controle-gastos-frontend/src/App.js`, importar `EverestRoute` e a futura página `EverestPage`. Adicionar a definição da rota: `<Route path="/everest" element={<EverestRoute><EverestPage /></EverestRoute>} />`.
*   \[x] **Passo 1.4 (Página Placeholder):** Criar a pasta `src/pages/Everest/` e o arquivo `EverestPage.js`. Implementar um componente simples com um título "Ferramentas Everest" como placeholder.
*   \[x] **Passo 1.5 (Menu):** Em `src/components/Layout/MainLayout.js`, localizar a lista de itens de menu (`menuItems`). Adicionar um novo item (ex: { name: 'Ferramentas Everest', path: '/everest', icon: <FaTools /> }). Envolver a renderização deste item `<li>` com uma verificação condicional: `{ (usuario?.role === 'everest' || usuario?.role === 'admin') && ( /* ...código do item de menu... */ )}`.
*   \[x] **Passo 1.6 (Teste Inicial):** Executar o frontend. Verificar se:
    *   Com a role 'everest' mockada OU logado como 'admin' real (após implementação do backend), o item de menu aparece e a navegação para `/everest` funciona.
    *   Sem a role 'everest' mockada e sem ser 'admin', o item de menu NÃO aparece e o acesso direto a `/everest` é bloqueado/redirecionado.

**Fase 2: Implementação das Ferramentas (Frontend UI + Lógica Mockada)**
*   \[x] **Passo 2.1 (Notas - UI):** Criar `src/components/Everest/NotesManager.js`. Desenvolver a UI para criar, listar e buscar notas usando Tailwind e componentes existentes. Usar dados mockados (`useState` inicial com um array de notas).
*   \[x] **Passo 2.2 (Notas - Lógica Local):** Implementar as funções de adicionar, editar (abrir modal com dados), deletar e buscar, manipulando apenas o estado local (o array de notas mockadas).
*   \[x] **Passo 2.3 (Notas - Integração):** Integrar o componente `NotesManager` dentro da `EverestPage.js`.
*   \[x] **Passo 2.4 (Notas - Teste):** Testar todas as interações da UI e a manipulação do estado local para o gerenciador de notas.
*   \[x] **Passo 2.5 (Repetir para Links):** Repetir passos 2.1 a 2.4 para o Repositório de Links (`LinksManager.js`).
*   \[x] **Passo 2.6 (Repetir para Info Chamados):** Repetir passos 2.1 a 2.4 para o Rastreador de Informações de Chamados (`TicketInfoTracker.js`).
*   \[x] **Passo 2.7 (Repetir para Acesso CNPJ - UI):** Criar `CnpjAccessTool.js`. Implementar a UI de upload e busca. A lógica de upload e busca será apenas visual nesta fase (sem processamento real).
*   \[x] **Passo 2.8 (Repetir para XML - UI):** Criar `XmlProcessorTool.js`. Implementar a UI de upload e exibição de resumos (com dados mockados).

**Fase 3: Integração API (Frontend - Contratos)**
*   \[x] **Passo 3.1 (Definir Funções API):** Em `src/api.js`, adicionar as assinaturas das funções necessárias para todas as ferramentas Everest (ex: `criarNotaEverest(notaData)`, `obterNotasEverest()`, `uploadPlanilhaCnpj(formData)`, etc.). Inicialmente, essas funções podem apenas logar a chamada ou retornar Promises resolvidas com dados mockados. *Importante: Definir os parâmetros e o formato esperado de resposta.*
*   \[x] **Passo 3.2 (Refatorar Notas):** No `NotesManager.js`, substituir a lógica de manipulação do estado local pelas chamadas às funções correspondentes em `api.js`. Usar `useEffect` para buscar as notas ao montar o componente. Adicionar estados de `loading` e `error` e exibir feedback apropriado na UI.
*   \[x] **Passo 3.3 (Teste Notas com API Mock):** Testar o `NotesManager` garantindo que ele chama as funções corretas da API (mock) e lida com os estados de carregamento/erro.
*   \[x] **Passo 3.4 (Repetir Refatoração):** Repetir os passos 3.2 e 3.3 para `LinksManager.js`, `TicketInfoTracker.js`, `CnpjAccessTool.js` (chamando `uploadPlanilhaCnpj` e `consultarCnpj`), `XmlProcessorTool.js` (chamando `processarXml` e `obterSumariosXml`).

**Fase 4: Backend - Estrutura e Acesso**
*   \[x] **Passo 4.1 (Model User):** Atualizar `backend/src/models/User.js` adicionando a `role` 'everest' ao enum (ou criando o campo `role` se não existir).
*   \[x] **Passo 4.2 (JWT):** Atualizar a função de login/geração de token para incluir a `role` no payload do JWT.
*   \[x] **Passo 4.3 (Middleware Role):** Criar `backend/src/middlewares/checkRole.js` (ou similar) que exporta uma função `checkRole(allowedRoles)` que retorna um middleware. Este middleware verifica se `req.user.role` está incluído no array `allowedRoles`. As rotas Everest usarão `checkRole(['everest', 'admin'])`.
*   \[x] **Passo 4.4 (Teste Backend Auth):** Testar o login, verificar se o token contém a role. Testar o acesso a uma rota de teste protegida pelo `checkRole(['everest', 'admin'])` usando Postman/Insomnia (deve funcionar para ambas as roles, falhar para outras).

**Fase 5: Backend - Endpoints das Ferramentas**
*   \[x] **Passo 5.1 (Notas - Backend):**
    *   Criar `backend/src/models/EverestNote.js` (Schema Mongoose).
    *   Criar `backend/src/routes/everestNotes.js` definindo as rotas CRUD.
    *   Proteger as rotas usando `checkRole(['everest', 'admin'])`.
    *   Criar `backend/src/controllers/everestNoteController.js` com a lógica para interagir com o model `EverestNote`.
    *   Registrar a rota em `app.js`.
*   \[x] **Passo 5.2 (Notas - Teste Backend):** Testar os endpoints CRUD de notas via Postman/Insomnia ou diretamente pelo frontend (que já está pronto para chamar a API real).
*   \[x] **Passo 5.3 (Repetir para Links):** Implementar e testar o backend para Links.
*   \[x] **Passo 5.4 (Repetir para Info Chamados):** Implementar e testar o backend para Info Chamados.
*   \[x] **Passo 5.5 (Repetir para Acesso CNPJ):** Implementar e testar o backend para Acesso CNPJ (incluir `multer`, parsing de CSV/XLSX, armazenamento no Model `EverestCnpjAccess`).
*   \[x] **Passo 5.6 (Repetir para XML):** Implementar e testar o backend para XML (incluir `multer`, parsing de XML, armazenamento no Model `EverestXmlSummary`).

**Fase 6: Teste Integrado e Refinamento**
*   \[x] **Passo 6.1 (Testes E2E):** Realizar testes completos End-to-End para cada ferramenta Everest, simulando o fluxo real do usuário.
*   \[x] **Passo 6.2 (Testes de Acesso):** Testar rigorosamente que usuários sem as roles 'everest' ou 'admin' não conseguem acessar a seção nem interagir com os endpoints da API Everest. Verificar que tanto 'everest' quanto 'admin' conseguem.
*   \[ ] **Passo 6.3 (Testes Funcionalidades Existentes):** **Crucial:** Testar novamente as funcionalidades principais da aplicação (Transações, Relatórios, Tags, Autenticação geral, **Módulo Admin**, etc.) para garantir que nada foi quebrado.
*   \[ ] **Passo 6.4 (Testes de Borda):** Testar casos como uploads vazios, dados inválidos em formulários, busca sem resultados, etc.
*   \[ ] **Passo 6.5 (Revisão e Refatoração):** Revisar o código implementado (Frontend e Backend). Refatorar se necessário para melhorar clareza, performance ou segurança.
*   \[ ] **Passo 6.6 (Polimento UI/UX):** Ajustes finais na interface com base nos testes e feedback.

---

Este documento servirá como guia. Podemos detalhar ainda mais cada passo conforme avançamos na implementação. O foco principal é seguir a sequência Frontend-first e garantir a segurança e a integridade do sistema existente em todas as etapas. 