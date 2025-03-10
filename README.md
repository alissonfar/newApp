# Sistema de Controle de Gastos

## 📝 Sobre o Projeto
Sistema web para controle de gastos pessoais e compartilhados, permitindo o gerenciamento de transações financeiras com múltiplos participantes e um proprietário definido.

## 🏗️ Estrutura do Projeto
O projeto está dividido em duas partes principais:
- `backend/`: API REST em Node.js com Express e MongoDB
- `controle-gastos-frontend/`: Interface web em React.js

## 🚀 Funcionalidades Principais

### 1. Gestão de Usuários
- Registro de novos usuários
- Login/Autenticação
- Configuração de perfil e preferências
- Definição de proprietário do sistema

### 2. Gestão de Transações
- Criação, edição e exclusão de transações
- Categorização por tipo (gasto/recebível)
- Múltiplos participantes por transação
- Filtros por proprietário (case insensitive)

### 3. Dashboard
- Resumo financeiro mensal
- Gráfico de evolução financeira
- Calendário com marcação de transações
- Notas rápidas
- Últimas transações

## 🔧 Configuração Técnica

### Backend (Node.js + Express + MongoDB)

#### Endpoints da API

1. **Autenticação**
```
POST /api/auth/registro
Headers:
{
    "Content-Type": "application/json"
}
Payload:
{
    "nome": "string",
    "email": "string",
    "senha": "string"
}
Response (200):
{
    "token": "string",
    "usuario": {
        "id": "string",
        "nome": "string",
        "email": "string"
    }
}

POST /api/auth/login
Headers:
{
    "Content-Type": "application/json"
}
Payload:
{
    "email": "string",
    "senha": "string"
}
Response (200):
{
    "token": "string",
    "usuario": {
        "id": "string",
        "nome": "string",
        "email": "string"
    }
}
```

2. **Usuários**
```
GET /api/usuarios/perfil
Headers:
{
    "Authorization": "Bearer {token}"
}
Response (200):
{
    "id": "string",
    "nome": "string",
    "email": "string",
    "preferencias": {
        "tema": "string",
        "proprietario": "string",
        "notificacoes": {
            "email": boolean,
            "push": boolean
        },
        "moedaPadrao": "string"
    }
}

PUT /api/usuarios/perfil
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload:
{
    "nome": "string",
    "email": "string",
    "preferencias": {
        "tema": "string",
        "proprietario": "string",
        "notificacoes": {
            "email": boolean,
            "push": boolean
        },
        "moedaPadrao": "string"
    }
}
Response (200):
{
    "mensagem": "Perfil atualizado com sucesso",
    "usuario": {
        // Dados do usuário atualizados
    }
}

PUT /api/usuarios/perfil/senha
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload:
{
    "senhaAtual": "string",
    "novaSenha": "string"
}
Response (200):
{
    "mensagem": "Senha atualizada com sucesso"
}
```

3. **Transações**
```
GET /api/transacoes
Headers:
{
    "Authorization": "Bearer {token}"
}
Query Params:
- proprietario: string (opcional, case insensitive)
Response (200):
{
    "transacoes": [
        {
            "id": "string",
            "tipo": "gasto" | "recebivel",
            "descricao": "string",
            "valor": number,
            "data": "Date",
            "pagamentos": [
                {
                    "pessoa": "string",
                    "valor": number
                }
            ],
            "observacao": "string",
            "status": "string"
        }
    ]
}

POST /api/transacoes
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload:
{
    "tipo": "gasto" | "recebivel",
    "descricao": "string",
    "valor": number,
    "data": "Date",
    "pagamentos": [
        {
            "pessoa": "string",
            "valor": number
        }
    ],
    "observacao": "string" (opcional)
}
Response (201):
{
    "id": "string",
    "tipo": "string",
    "descricao": "string",
    "valor": number,
    "data": "Date",
    "pagamentos": [
        {
            "pessoa": "string",
            "valor": number
        }
    ],
    "observacao": "string",
    "status": "string"
}

PUT /api/transacoes/:id
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload: // Mesma estrutura do POST
Response (200):
{
    // Dados da transação atualizada
}

DELETE /api/transacoes/:id
Headers:
{
    "Authorization": "Bearer {token}"
}
Response (200):
{
    "mensagem": "Transação estornada com sucesso",
    "transacao": {
        // Dados da transação estornada
    }
}
```

4. **Relatórios**
```
GET /api/relatorio
Headers:
{
    "Authorization": "Bearer {token}"
}
Response (200):
{
    "resumo": {
        "totalGastos": number,
        "totalRecebiveis": number,
        "saldo": number
    },
    "transacoesPorMes": [
        {
            "mes": string,
            "gastos": number,
            "recebiveis": number
        }
    ]
}
```

5. **Tags**
```
GET /api/tags
Headers:
{
    "Authorization": "Bearer {token}"
}
Response (200):
{
    "tags": [
        {
            "id": "string",
            "nome": "string",
            "cor": "string"
        }
    ]
}

POST /api/tags
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload:
{
    "nome": "string",
    "cor": "string"
}
```

6. **Categorias**
```
GET /api/categorias
Headers:
{
    "Authorization": "Bearer {token}"
}
Response (200):
{
    "categorias": [
        {
            "id": "string",
            "nome": "string",
            "tipo": "gasto" | "recebivel"
        }
    ]
}

POST /api/categorias
Headers:
{
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
}
Payload:
{
    "nome": "string",
    "tipo": "gasto" | "recebivel"
}
```

### Códigos de Erro Comuns

```
400 Bad Request
{
    "erro": "Mensagem detalhando o erro de validação"
}

401 Unauthorized
{
    "erro": "Token não fornecido ou inválido"
}

403 Forbidden
{
    "erro": "Usuário não tem permissão para acessar este recurso"
}

404 Not Found
{
    "erro": "Recurso não encontrado"
}

500 Internal Server Error
{
    "erro": "Erro interno do servidor"
}
```

### Observações Importantes

1. **Autenticação**
- Todas as rotas (exceto login e registro) requerem o header `Authorization` com um token JWT válido
- O token tem validade de 24 horas
- Tokens inválidos ou expirados retornam erro 401

2. **Validação de Dados**
- Campos obrigatórios não preenchidos retornam erro 400
- Valores inválidos (ex: data mal formatada) retornam erro 400
- Emails devem ser únicos no sistema

3. **Proprietário**
- O filtro por proprietário é case insensitive
- O proprietário deve ser definido nas preferências do usuário
- Transações sem proprietário definido não são exibidas no dashboard

4. **Transações**
- O status pode ser 'ativo' ou 'estornado'
- Transações estornadas não são consideradas nos cálculos
- A soma dos valores dos pagamentos deve ser igual ao valor total da transação

### Frontend (React.js)

#### Principais Componentes

1. **AuthContext**
- Gerenciamento de estado de autenticação
- Armazenamento de token JWT
- Informações do usuário logado

2. **Home**
- Dashboard principal
- Exibição de resumos financeiros
- Gráficos e calendário
- Gestão de notas rápidas

3. **NovaTransacaoForm**
- Formulário de criação/edição de transações
- Validação de campos
- Gestão de múltiplos pagamentos

4. **Profile**
- Configurações do usuário
- Definição de proprietário do sistema

## 🔄 Fluxos Principais

### 1. Fluxo de Autenticação
1. Usuário acessa o sistema
2. Realiza login/registro
3. Token JWT é armazenado
4. Informações do usuário são carregadas

### 2. Fluxo de Transações
1. Usuário acessa dashboard
2. Sistema carrega transações do proprietário
3. Usuário pode:
   - Visualizar resumos e gráficos
   - Criar nova transação
   - Editar/excluir transações existentes

### 3. Fluxo de Proprietário
1. Usuário acessa perfil
2. Define nome do proprietário
3. Sistema filtra transações pelo proprietário
4. Dashboard atualiza com dados filtrados

## 🔒 Segurança
- Autenticação via JWT
- Senhas criptografadas
- Validação de proprietário nas transações
- Proteção de rotas no frontend e backend

## 📊 Modelos de Dados

### Usuário
```javascript
{
    nome: String,
    email: String,
    senha: String,
    preferencias: {
        proprietario: String
    }
}
```

### Transação
```javascript
{
    tipo: String,
    descricao: String,
    valor: Number,
    data: Date,
    pagamentos: [{
        pessoa: String,
        valor: Number
    }],
    observacao: String,
    status: String,
    usuario: ObjectId
}
```

## 🛠️ Tecnologias Utilizadas

### Backend
- Node.js
- Express
- MongoDB
- JWT para autenticação
- Bcrypt para criptografia

### Frontend
- React.js
- React Router
- Context API
- Chart.js para gráficos
- React Calendar
- React Icons
- Axios para requisições HTTP

## 📱 Responsividade
O sistema é totalmente responsivo, adaptando-se a diferentes tamanhos de tela e dispositivos. 
