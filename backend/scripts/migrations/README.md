# Como Executar Scripts de Migração do Banco de Dados

Este documento detalha como executar os scripts de migração localizados nesta pasta (`backend/scripts/migrations`). As migrações são usadas para atualizar o schema ou os dados do banco de dados de forma controlada, especialmente ao introduzir novas funcionalidades ou alterações no modelo de dados.

## Pré-requisitos

*   **Node.js e npm/yarn:** Instalados no ambiente onde o script será executado.
*   **Acesso ao Terminal:** Uma interface de linha de comando (Prompt de Comando, PowerShell, Git Bash, etc.).
*   **Código-fonte:** O projeto completo na sua máquina.
*   **Arquivos `.env`:** Os arquivos `backend/.env.development` e `backend/.env.production` devem estar configurados corretamente, especialmente a variável `DB_URI` para cada ambiente.
*   **Dependências Instaladas:** As dependências do backend devem estar instaladas. Se não tiver certeza, execute `npm install` (ou `yarn install`) dentro da pasta `backend`.

## Passos para Execução

1.  **Abra o Terminal:** Inicie seu terminal de preferência.

2.  **Navegue até a Raiz do Projeto:** Use o comando `cd` para ir até a pasta principal do seu projeto (a pasta que contém as pastas `backend` e `controle-gastos-frontend`).
    ```bash
    # Exemplo (ajuste o caminho conforme necessário)
    cd "/c/Users/Alisson/Documents/1 TESTE CURSOR AI/newApp"
    ```

3.  **Escolha o Ambiente e Execute o Script:**
    *   Você executará os scripts usando o comando `node` seguido pelo caminho do script específico que deseja rodar (ex: `backend/scripts/migrations/001-add-default-user-role.js`).
    *   **IMPORTANTE:** Execute cada script de migração **apenas uma vez** por ambiente.

    **Opção A: Executar em Desenvolvimento**
    *   Este comando usará a configuração do banco de dados definida em `backend/.env.development`.
    ```bash
    node backend/scripts/migrations/SEU_SCRIPT_DE_MIGRACAO.js
    # Exemplo para a primeira migração:
    # node backend/scripts/migrations/001-add-default-user-role.js
    ```

    **Opção B: Executar em Produção**
    *   Este comando usará a configuração do banco de dados definida em `backend/.env.production`.
    *   **CUIDADO:** Tenha certeza absoluta antes de executar migrações em produção. Considere fazer um backup do banco de dados antes.
    *   Você precisa definir a variável de ambiente `NODE_ENV` como `production` **antes** de executar o comando `node`.

        *   **No Windows (Prompt de Comando):**
            ```cmd
            set NODE_ENV=production && node backend/scripts/migrations/SEU_SCRIPT_DE_MIGRACAO.js
            REM Exemplo:
            REM set NODE_ENV=production && node backend/scripts/migrations/001-add-default-user-role.js
            ```

        *   **No Windows (PowerShell):**
            ```powershell
            $env:NODE_ENV="production"; node backend/scripts/migrations/SEU_SCRIPT_DE_MIGRACAO.js
            # Exemplo:
            # $env:NODE_ENV="production"; node backend/scripts/migrations/001-add-default-user-role.js
            ```

        *   **No Git Bash / Linux / macOS:**
            ```bash
            NODE_ENV=production node backend/scripts/migrations/SEU_SCRIPT_DE_MIGRACAO.js
            # Exemplo:
            # NODE_ENV=production node backend/scripts/migrations/001-add-default-user-role.js
            ```

4.  **Observe a Saída:** O terminal exibirá o progresso da migração, incluindo mensagens de conexão, status da operação (quantos documentos foram afetados) e eventuais erros. Leia atentamente a saída para confirmar se a migração foi bem-sucedida.

## Quando Executar

*   Execute as migrações **após** o deploy do código da aplicação que depende das alterações feitas pela migração.
*   Execute **na ordem correta** se houver múltiplas migrações dependentes (geralmente indicado pela numeração no nome do arquivo, ex: `001-`, `002-`, etc.).
*   Execute **apenas uma vez** por ambiente. 