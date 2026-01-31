# API de Controle de Gastos - Backend

## Configuração do Ambiente

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
   - Crie/edite o arquivo `.env.development` para ambiente de desenvolvimento
   - Crie/edite o arquivo `.env.production` para ambiente de produção

Exemplo de variáveis necessárias:
```env
PORT=3001
DB_URI=mongodb://localhost:27017/controle-gastos
JWT_SECRET=sua_chave_secreta
JWT_EXPIRES=7d

# Configurações de Email
EMAIL_USER=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_de_app
EMAIL_FROM=seu_email@gmail.com
SITE_URL=http://localhost:3004
```

3. Inicie o servidor:
```bash
# Ambiente de desenvolvimento
npm run dev

# Ambiente de produção
npm start
```

## Endpoints da API

Base URL: `http://localhost:3001/api` (desenvolvimento) ou seu domínio de produção

### Autenticação e Gerenciamento de Usuário

#### Registro de Usuário
```http
POST /usuarios/registrar
Content-Type: application/json

{
    "nome": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "senha": "senha123"
}
```
Resposta:
```json
{
    "mensagem": "Usuário registrado com sucesso! Por favor, verifique seu email para ativar sua conta."
}
```

#### Verificação de Email
```http
GET /usuarios/verificar-email/{token}
```
Resposta:
```json
{
    "mensagem": "Email verificado com sucesso! Sua conta está ativa."
}
```

#### Reenvio de Verificação de Email
```http
POST /usuarios/reenviar-verificacao
Content-Type: application/json

{
    "email": "usuario@exemplo.com"
}
```
Resposta:
```json
{
    "mensagem": "Email de verificação reenviado com sucesso."
}
```

#### Login
```http
POST /usuarios/login
Content-Type: application/json

{
    "email": "usuario@exemplo.com",
    "senha": "senha123"
}
```
Resposta:
```json
{
    "mensagem": "Login bem-sucedido!",
    "token": "seu_token_jwt",
    "usuario": {
        "_id": "id_do_usuario",
        "nome": "Nome do Usuário",
        "email": "usuario@exemplo.com",
        "emailVerificado": true
    }
}
```

### Recuperação de Senha

#### Solicitar Redefinição de Senha
```http
POST /usuarios/esqueci-senha
Content-Type: application/json

{
    "email": "usuario@exemplo.com"
}
```
Resposta:
```json
{
    "mensagem": "Se um usuário com este email existir, você receberá as instruções para redefinir sua senha."
}
```

#### Verificar Token de Redefinição
```http
GET /usuarios/redefinir-senha/{token}
```
Resposta:
```json
{
    "mensagem": "Token válido",
    "email": "usuario@exemplo.com"
}
```

#### Redefinir Senha
```http
POST /usuarios/redefinir-senha/{token}
Content-Type: application/json

{
    "novaSenha": "nova-senha-123"
}
```
Resposta:
```json
{
    "mensagem": "Senha redefinida com sucesso!",
    "token": "novo_token_jwt",
    "usuario": {
        "_id": "id_do_usuario",
        "nome": "Nome do Usuário",
        "email": "usuario@exemplo.com",
        "emailVerificado": true
    }
}
```

### Rotas Protegidas

Para acessar as rotas protegidas, inclua o token JWT no header:
```http
Authorization: Bearer seu_token_jwt
```

#### Obter Perfil
```http
GET /usuarios/perfil
```

#### Atualizar Perfil
```http
PUT /usuarios/perfil
Content-Type: application/json

{
    "nome": "Novo Nome",
    "telefone": "123456789",
    // outros campos...
}
```

#### Atualizar Senha
```http
PUT /usuarios/perfil/senha
Content-Type: application/json

{
    "senhaAtual": "senha-atual",
    "novaSenha": "nova-senha"
}
```

#### Atualizar Email
```http
PUT /usuarios/perfil/email
Content-Type: application/json

{
    "novoEmail": "novo@exemplo.com",
    "senha": "senha-atual"
}
```

#### Atualizar Preferências
```http
PUT /usuarios/perfil/preferencias
Content-Type: application/json

{
    "preferencias": {
        "tema": "escuro",
        "notificacoes": {
            "email": true,
            "push": false
        },
        "moedaPadrao": "BRL"
    }
}
```

#### Upload de Foto de Perfil
```http
POST /usuarios/perfil/foto
Content-Type: multipart/form-data

foto: [arquivo]
```

## Considerações de Segurança

1. Tokens JWT expiram em 7 dias
2. Tokens de verificação de email expiram em 24 horas
3. Tokens de redefinição de senha expiram em 1 hora
4. Senhas são armazenadas com hash usando bcrypt
5. Emails são verificados antes de permitir login
6. Tokens são de uso único e invalidados após uso

## Emails Enviados pelo Sistema

1. Email de verificação após registro
2. Email de boas-vindas após verificação
3. Email de redefinição de senha
4. Email de confirmação após redefinição de senha
5. Email de alteração de senha

## Tratamento de Erros

A API retorna erros no formato:
```json
{
    "erro": "Mensagem descritiva do erro"
}
```

Códigos de status HTTP utilizados:
- 200: Sucesso
- 201: Criado com sucesso
- 400: Erro de validação/dados
- 401: Não autorizado
- 403: Proibido (email não verificado)
- 404: Não encontrado
- 500: Erro interno do servidor 