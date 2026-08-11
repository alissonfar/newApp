# Descontinuação de Conta Conjunta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover completamente o módulo de "conta conjunta" (vínculo entre pessoas, saldo devedor e acertos FIFO) do backend e do frontend, mantendo `Transacao.pagamentos[]` (divisão normal de pagamento) intacto e sem alterar o comportamento de nenhuma outra feature (Conta Fixa, Empréstimos, Importação, Relatórios).

**Architecture:** Remoção em 3 camadas, sempre backend antes de frontend: (1) modelos e serviços que definem/calculam `contaConjunta`/`VinculoConjunto`/`AcertoConjunto`, (2) controllers e rotas que expõem esse módulo via HTTP — incluindo o caminho paralelo em `TransacaoImportada`/`importacaoController.js` que a investigação original não tinha coberto —, (3) UI: hook, abas do form de transação, páginas de gestão de vínculo, e os pontos de leitura em Relatórios/Importação. Dado histórico gravado (`transacao.valor` já reduzido pra parte do usuário em transações antigas com `pagoPor: 'outro'`) não é reprocessado — fica como está, por decisão do usuário.

**Tech Stack:** Node.js/Express, Mongoose, React 19, Jest.

## Global Constraints

- `Transacao.pagamentos[]` não é tocado em nenhuma task — nem estrutura, nem validação de soma (fora do ramo condicional que está sendo removido), nem uso em relatórios/parcelamento/Conta Fixa.
- Nenhuma migration roda automaticamente. O script de `$unset`/`drop` é entregue pronto na Task 13, com o comando exato (PowerShell), para o usuário rodar manualmente e confirmar o resultado.
- Nunca rodar `npm install`, `npm run build`, ou commit/push automaticamente — sempre parar e pedir para o usuário rodar quando aplicável.
- Dado histórico (`transacao.valor`/`pagamentos[]` já gravados como parte do usuário em TXs antigas com `contaConjunta.pagoPor === 'outro'`) permanece como está — nenhuma task reprocessa esses valores.
- Depois de cada task de remoção de arquivo inteiro, rodar um `require`/import smoke check (Node para backend, `eslint` para frontend) antes de commitar — arquivo removido com referência esquecida quebra o boot do servidor ou o build do CRA silenciosamente até alguém abrir a tela.

---

### Task 1: Backend — remover subdocumento `contaConjunta` do model `Transacao`

**Files:**
- Modify: `backend/src/models/transacao.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `Transacao` sem os campos `contaConjunta` e sem o índice `contaConjunta.ativo/vinculoId/acertadoEm`. Nenhuma outra interface de `Transacao` muda.

- [ ] **Step 1: Remover o subdocumento `contaConjunta` do schema**

Em `backend/src/models/transacao.js`, remova o bloco (linhas 50-59 no arquivo atual):

```js
  // Módulo Conta Conjunta - metadados de divisão (ignorado quando ativo=false)
  contaConjunta: {
    ativo: { type: Boolean, default: false },
    vinculoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VinculoConjunto' },
    pagoPor: { type: String, enum: ['usuario', 'outro'] },
    valorTotal: { type: Number, min: 0 },
    parteUsuario: { type: Number, min: 0 },
    parteOutro: { type: Number, min: 0 },
    acertadoEm: { type: mongoose.Schema.Types.ObjectId, ref: 'AcertoConjunto', default: null }
  },
```

Deixando o campo `subconta` seguido diretamente pelo bloco de Empréstimos:

```js
  // Módulo Patrimônio - vinculação opcional a subconta
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: false, default: null },
  // Módulo Empréstimos - quando setado, esta transação é parte de um empréstimo
  emprestimoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Emprestimo', default: null },
```

- [ ] **Step 2: Remover o índice de `contaConjunta`**

Remova a linha (por volta da linha 82 do arquivo atual):

```js
TransacaoSchema.index({ usuario: 1, 'contaConjunta.ativo': 1, 'contaConjunta.vinculoId': 1, 'contaConjunta.acertadoEm': 1 }, { sparse: true });
```

- [ ] **Step 3: Verificar que o model carrega sem erro**

Run: `cd backend && node -e "require('./src/models/transacao'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/transacao.js
git commit -m "refactor(conta-conjunta): remove subdocumento contaConjunta do model Transacao"
```

---

### Task 2: Backend — remover subdocumento `contaConjunta` do model `TransacaoImportada`

**Files:**
- Modify: `backend/src/models/transacaoImportada.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `TransacaoImportada.paraTransacao()` sem incluir `contaConjunta` no objeto retornado.

- [ ] **Step 1: Remover o campo `contaConjunta` do schema**

Em `backend/src/models/transacaoImportada.js`, remova o bloco (por volta das linhas 175-182):

```js
  contaConjunta: {
    ativo: { type: Boolean, default: false },
    vinculoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VinculoConjunto' },
    pagoPor: { type: String, enum: ['usuario', 'outro'] },
    valorTotal: { type: Number, min: 0 },
    parteUsuario: { type: Number, min: 0 },
    parteOutro: { type: Number, min: 0 }
  }
```

Atenção: esse é o último campo antes de `}, {` (fechamento do objeto de definição do schema, seguido pelas opções `timestamps`/`toJSON`) — ao remover, o campo anterior (`emprestimoIdOrigemCriado`) passa a ser o último, então remova também a vírgula sobrando após o `}` dele, se houver.

- [ ] **Step 2: Remover o bloco que propaga `contaConjunta` em `paraTransacao()`**

Remova, dentro do método `TransacaoImportadaSchema.methods.paraTransacao` (por volta das linhas 220-230):

```js
  if (this.contaConjunta?.ativo) {
    result.contaConjunta = {
      ativo: true,
      vinculoId: this.contaConjunta.vinculoId,
      pagoPor: this.contaConjunta.pagoPor,
      valorTotal: this.contaConjunta.valorTotal,
      parteUsuario: this.contaConjunta.parteUsuario,
      parteOutro: this.contaConjunta.parteOutro,
      acertadoEm: null
    };
  }
```

`paraTransacao()` volta a terminar direto no `return result;`.

- [ ] **Step 3: Verificar que o model carrega sem erro**

Run: `cd backend && node -e "require('./src/models/transacaoImportada'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/transacaoImportada.js
git commit -m "refactor(conta-conjunta): remove subdocumento contaConjunta do model TransacaoImportada"
```

---

### Task 3: Backend — simplificar `transacaoService.js`

**Files:**
- Modify: `backend/src/services/transacaoService.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `validarSomaPagamentos(transacao, pagamentos)` — assinatura mantida, mas `transacao` não precisa mais ter `contaConjunta`; sempre valida soma = `transacao.valor`. `validarContaConjunta` e `prepararValorEContaConjunta` deixam de existir — Task 4/5/6 removem todos os chamadores antes desta task ser considerada "fechada" (ver ordem abaixo).

**⚠️ Ordem:** faça esta task depois de já ter localizado (não necessariamente removido) todos os chamadores — Tasks 4, 5 e 6 removem os usos em `controladorTransacao.js`, `transacaoImportadaController.js` e `importacaoController.js`. Para não deixar o backend quebrado entre commits, esta task remove as funções e simplifica `validarSomaPagamentos` **e** já ajusta os 3 arquivos chamadores no mesmo commit lógico — por isso as Tasks 3 a 6 devem ser executadas em sequência antes de rodar o backend.

- [ ] **Step 1: Reescrever `transacaoService.js` sem o ramo de conta conjunta**

Substitua o conteúdo completo do arquivo por:

```js
// src/services/transacaoService.js
const TOLERANCIA = 0.01;

/**
 * Valida que a soma dos pagamentos é igual ao valor da transação.
 * @param {Object} transacao - { valor }
 * @param {Array} pagamentos - [{ valor }]
 * @throws {Error} Se a validação falhar
 */
function validarSomaPagamentos(transacao, pagamentos) {
  if (!pagamentos || !Array.isArray(pagamentos)) {
    throw new Error('Pagamentos inválidos');
  }
  const somaPagamentos = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const valorEsperado = parseFloat(transacao.valor) || 0;
  if (Math.abs(somaPagamentos - valorEsperado) > TOLERANCIA) {
    throw new Error('Soma dos pagamentos deve ser igual ao valor da transação');
  }
}

module.exports = {
  validarSomaPagamentos
};
```

- [ ] **Step 2: Verificar que o módulo carrega sem erro**

Run: `cd backend && node -e "require('./src/services/transacaoService'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção (o `require` não valida os chamadores — isso é feito nas Tasks 4-6).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/transacaoService.js
git commit -m "refactor(conta-conjunta): remove validarContaConjunta e prepararValorEContaConjunta de transacaoService"
```

---

### Task 4: Backend — remover uso de `contaConjunta` em `controladorTransacao.js`

**Files:**
- Modify: `backend/src/controllers/controladorTransacao.js`

**Interfaces:**
- Consumes: `transacaoService.validarSomaPagamentos(transacao, pagamentos)` (Task 3 — nova assinatura simplificada).
- Produces: `criarTransacao`/`atualizarTransacao` ignoram `req.body.contaConjunta` completamente (campo passa a ser silenciosamente descartado se enviado, sem erro).

- [ ] **Step 1: Fluxo de transação única (sem parcelamento) — remover preparação de conta conjunta**

Substitua (por volta das linhas 517-532):

```js
      // Fluxo transação única (sem parcelamento)
      let valorFinal = parseFloat(valor) || 0;
      let contaConjuntaParaSalvar = undefined;
      if (req.body.contaConjunta?.ativo) {
        await transacaoService.validarContaConjunta({
          contaConjunta: req.body.contaConjunta,
          usuarioId: req.userId
        });
        const preparado = transacaoService.prepararValorEContaConjunta(req.body);
        valorFinal = preparado.valor;
        contaConjuntaParaSalvar = preparado.contaConjunta;
      }
      transacaoService.validarSomaPagamentos(
        { valor: valorFinal, contaConjunta: req.body.contaConjunta },
        pagamentos
      );
```

por:

```js
      // Fluxo transação única (sem parcelamento)
      const valorFinal = parseFloat(valor) || 0;
      transacaoService.validarSomaPagamentos({ valor: valorFinal }, pagamentos);
```

E remova o campo `contaConjunta: contaConjuntaParaSalvar` do `new Transacao({...})` logo abaixo (por volta da linha 542):

```js
        usuario: req.userId,
        subconta: subcontaId,
        contaConjunta: contaConjuntaParaSalvar
      });
```

vira:

```js
        usuario: req.userId,
        subconta: subcontaId
      });
```

- [ ] **Step 2: Fluxo parcelado — remover preparação de conta conjunta**

Substitua (por volta das linhas 567-578):

```js
    // Fluxo parcelado: suporta NOVO modelo (por pagamento) e LEGADO (top-level)
    let valorFinal = parseFloat(valor) || 0;
    let contaConjuntaParaSalvar = undefined;
    if (req.body.contaConjunta?.ativo) {
      await transacaoService.validarContaConjunta({
        contaConjunta: req.body.contaConjunta,
        usuarioId: req.userId
      });
      const preparado = transacaoService.prepararValorEContaConjunta(req.body);
      valorFinal = preparado.valor;
      contaConjuntaParaSalvar = preparado.contaConjunta;
    }
```

por:

```js
    // Fluxo parcelado: suporta NOVO modelo (por pagamento) e LEGADO (top-level)
    const valorFinal = parseFloat(valor) || 0;
```

Remova `contaConjunta: contaConjuntaParaSalvar` dos dois pontos onde aparece dentro deste fluxo: no `baseTransacao` do modelo novo (por volta da linha 598) e no objeto de cada parcela do modelo legado (por volta da linha 662). Em ambos os casos, apenas apague a linha inteira (a vírgula da linha anterior continua válida porque ainda há campos depois, como `parentTransactionId`/`isInstallment` no modelo legado, e `subconta` fecha o objeto no modelo novo — confira que não sobra vírgula solta antes do `}`).

- [ ] **Step 3: `atualizarTransacao` — remover leitura/gravação de `req.body.contaConjunta`**

Substitua (por volta das linhas 723-747):

```js
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    const pagamentosAtual = req.body.pagamentos || transacao.pagamentos;
    let valorAtual = req.body.valor !== undefined ? parseFloat(req.body.valor) : transacao.valor;
    let contaConjuntaAtual = transacao.contaConjunta && transacao.contaConjunta.toObject ? transacao.contaConjunta.toObject() : transacao.contaConjunta;
    if (req.body.contaConjunta !== undefined) {
      if (req.body.contaConjunta?.ativo) {
        await transacaoService.validarContaConjunta({
          contaConjunta: req.body.contaConjunta,
          usuarioId: req.userId
        });
        const preparado = transacaoService.prepararValorEContaConjunta({
          valor: req.body.valor,
          contaConjunta: req.body.contaConjunta
        });
        valorAtual = preparado.valor;
        contaConjuntaAtual = preparado.contaConjunta;
      } else {
        contaConjuntaAtual = { ativo: false };
      }
    }
    transacaoService.validarSomaPagamentos(
      { valor: valorAtual, contaConjunta: req.body.contaConjunta ?? contaConjuntaAtual },
      pagamentosAtual
    );
    transacao.tipo = req.body.tipo || transacao.tipo;
    transacao.descricao = req.body.descricao || transacao.descricao;
    transacao.valor = valorAtual;
    transacao.data = req.body.data || transacao.data;
    transacao.pagamentos = pagamentosAtual;
    transacao.observacao = req.body.observacao !== undefined ? req.body.observacao : transacao.observacao;
    if (req.body.contaConjunta !== undefined) {
      transacao.contaConjunta = contaConjuntaAtual;
    }
```

por:

```js
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    const pagamentosAtual = req.body.pagamentos || transacao.pagamentos;
    const valorAtual = req.body.valor !== undefined ? parseFloat(req.body.valor) : transacao.valor;
    transacaoService.validarSomaPagamentos({ valor: valorAtual }, pagamentosAtual);
    transacao.tipo = req.body.tipo || transacao.tipo;
    transacao.descricao = req.body.descricao || transacao.descricao;
    transacao.valor = valorAtual;
    transacao.data = req.body.data || transacao.data;
    transacao.pagamentos = pagamentosAtual;
    transacao.observacao = req.body.observacao !== undefined ? req.body.observacao : transacao.observacao;
```

- [ ] **Step 4: Verificar que o controller carrega sem erro**

Run: `cd backend && node -e "require('./src/controllers/controladorTransacao'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/controladorTransacao.js
git commit -m "refactor(conta-conjunta): remove leitura/gravacao de contaConjunta em controladorTransacao"
```

---

### Task 5: Backend — remover uso de `contaConjunta` em `transacaoImportadaController.js`

**Files:**
- Modify: `backend/src/controllers/transacaoImportadaController.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: edição de uma `TransacaoImportada` (linha em revisão de importação) ignora `contaConjunta` se enviado.

- [ ] **Step 1: Remover `contaConjunta` de `camposPermitidos`**

Substitua (por volta da linha 74):

```js
      const camposPermitidos = ['descricao', 'valor', 'data', 'tipo', 'observacao', 'pagamentos', 'subconta', 'contaConjunta', 'emprestimoId', 'emprestimoConfig'];
```

por:

```js
      const camposPermitidos = ['descricao', 'valor', 'data', 'tipo', 'observacao', 'pagamentos', 'subconta', 'emprestimoId', 'emprestimoConfig'];
```

- [ ] **Step 2: Remover o bloco `else if (campo === 'contaConjunta')`**

Remova (por volta das linhas 114-126):

```js
          } else if (campo === 'contaConjunta') {
            if (req.body.contaConjunta?.ativo) {
              transacao.contaConjunta = {
                ativo: true,
                vinculoId: req.body.contaConjunta.vinculoId,
                pagoPor: req.body.contaConjunta.pagoPor,
                valorTotal: req.body.contaConjunta.valorTotal,
                parteUsuario: req.body.contaConjunta.parteUsuario,
                parteOutro: req.body.contaConjunta.parteOutro
              };
            } else {
              transacao.contaConjunta = { ativo: false };
            }
          } else {
```

Deixando o `if/else if` encadeado voltar a ser:

```js
          if (campo === 'pagamentos') {
            // ... (inalterado)
          } else {
            transacao[campo] = req.body[campo];
          }
```

(ou seja, junte a condição `pagamentos` direto com o `else` final, removendo apenas o `else if` do meio).

- [ ] **Step 3: Verificar que o controller carrega sem erro**

Run: `cd backend && node -e "require('./src/controllers/transacaoImportadaController'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/transacaoImportadaController.js
git commit -m "refactor(conta-conjunta): remove leitura/gravacao de contaConjunta na revisao de importacao"
```

---

### Task 6: Backend — remover propagação de `contaConjunta` em `importacaoController.js`

**Files:**
- Modify: `backend/src/controllers/importacaoController.js`

**Interfaces:**
- Consumes: `transacaoService.validarSomaPagamentos` (Task 3).
- Produces: a finalização de importação (`PUT /:id/finalizar`) não copia mais `contaConjunta` de `TransacaoImportada` para a `Transacao` real.

- [ ] **Step 1: Remover o bloco que copia `contaConjunta` ao montar cada transação**

Remova, dentro da função `montarTransacao` (por volta das linhas 645-652):

```js
                if (ti.contaConjunta?.ativo) {
                    const preparado = transacaoService.prepararValorEContaConjunta({
                        valor,
                        contaConjunta: { ...ti.contaConjunta, ativo: true }
                    });
                    obj.valor = preparado.valor;
                    obj.contaConjunta = preparado.contaConjunta;
                }
                return obj;
```

vira apenas:

```js
                return obj;
```

- [ ] **Step 2: Remover o bloco de validação de conta conjunta antes de inserir**

Remova (por volta das linhas 714-722):

```js
            for (const tr of transacoesReais) {
                if (tr.contaConjunta?.ativo) {
                    transacaoService.validarSomaPagamentos(tr, tr.pagamentos);
                    await transacaoService.validarContaConjunta({
                        contaConjunta: tr.contaConjunta,
                        usuarioId: tr.usuario
                    });
                }
            }
```

Esse bloco só existia para o caminho de conta conjunta — a validação de soma de pagamentos "normal" (fora de conta conjunta) já não acontecia aqui antes (a importação confia na soma vinda de `TransacaoImportada`), então a remoção não introduz uma validação faltante nova.

- [ ] **Step 3: Verificar que o controller carrega sem erro**

Run: `cd backend && node -e "require('./src/controllers/importacaoController'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/importacaoController.js
git commit -m "refactor(conta-conjunta): remove propagacao de contaConjunta na finalizacao de importacao"
```

---

### Task 7: Backend — remover módulo de vínculo/acerto por completo (models, service, controllers, rotas)

**Files:**
- Delete: `backend/src/models/vinculoConjunto.js`
- Delete: `backend/src/models/acertoConjunto.js`
- Delete: `backend/src/services/vinculoService.js`
- Delete: `backend/src/controllers/vinculoConjuntoController.js`
- Delete: `backend/src/controllers/acertoController.js`
- Delete: `backend/src/routes/rotasVinculoConjunto.js`
- Delete: `backend/src/routes/rotasAcertos.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: nenhuma (Tasks 1-6 já removeram todo consumidor de `VinculoConjunto`/`AcertoConjunto`/`vinculoService` fora deste conjunto de arquivos).
- Produces: as rotas `/api/vinculos-conjuntos` e `/api/acertos` deixam de existir — qualquer request pra elas retorna 404 padrão do Express.

- [ ] **Step 1: Apagar os 7 arquivos do módulo**

```bash
rm backend/src/models/vinculoConjunto.js
rm backend/src/models/acertoConjunto.js
rm backend/src/services/vinculoService.js
rm backend/src/controllers/vinculoConjuntoController.js
rm backend/src/controllers/acertoController.js
rm backend/src/routes/rotasVinculoConjunto.js
rm backend/src/routes/rotasAcertos.js
```

- [ ] **Step 2: Remover o registro das rotas em `app.js`**

Em `backend/src/app.js`, remova a linha de `require` (por volta da linha 81):

```js
const rotasVinculoConjunto = require('./routes/rotasVinculoConjunto');
```

E, junto a ela, procure e remova também o `require` de `rotasAcertos` (mesmo bloco de imports de rotas, verifique a linha exata no arquivo atual — é o `require('./routes/rotasAcertos')`).

Remova as duas linhas de registro (por volta das linhas 109-110):

```js
app.use('/api/vinculos-conjuntos', rotasVinculoConjunto);
app.use('/api/acertos', rotasAcertos);
```

- [ ] **Step 3: Verificar que o servidor sobe sem erros**

Run: `cd backend && npm start`
Expected: log de "Servidor rodando na porta 3001" (ou porta configurada) sem exceção de `Cannot find module`. Encerre o processo (Ctrl+C) depois de confirmar.

- [ ] **Step 4: Commit**

```bash
git add -u backend/src/models/vinculoConjunto.js backend/src/models/acertoConjunto.js backend/src/services/vinculoService.js backend/src/controllers/vinculoConjuntoController.js backend/src/controllers/acertoController.js backend/src/routes/rotasVinculoConjunto.js backend/src/routes/rotasAcertos.js backend/src/app.js
git commit -m "refactor(conta-conjunta): remove models, service, controllers e rotas de vinculo/acerto conjunto"
```

---

### Task 8: Backend — checkpoint de regressão

**Files:** nenhum (task só de verificação).

**Interfaces:** nenhuma.

- [ ] **Step 1: Rodar a suíte de testes do backend**

Run: `cd backend && npm test`
Expected: mesmo resultado de antes da remoção (121/122 — a única falha pré-existente é em `ledgerService.test.js`, não relacionada, documentada em `.brain/sessions/2026-08-07-conta-fixa-implementacao-e-fix-visual.md`). Se aparecer qualquer falha nova em `transacaoService`/`controladorTransacao`/`contaFixaService`, pare e investigue antes de prosseguir — é sinal de que alguma Task 1-7 quebrou algo.

- [ ] **Step 2: Teste manual — criar transação com múltiplos pagamentos, sem conta conjunta**

Run: `cd backend && npm run dev` (deixe rodando)

Com o backend no ar, use a UI (ainda não alterada nas próximas tasks) ou `curl` para criar uma transação com 2 pagamentos que somem o valor total, e confirme resposta `201`. Isso garante que `validarSomaPagamentos` simplificado (Task 3) continua funcionando no caminho comum.

Expected: transação criada normalmente, sem qualquer menção a `contaConjunta` no payload de resposta.

- [ ] **Step 3: Não commitar nada nesta task** — é só checkpoint. Se algo falhar, volte à task correspondente, corrija, e re-commit lá.

---

### Task 9: Frontend — remover conta conjunta do form de transação (hook + abas)

**Files:**
- Delete: `controle-gastos-frontend/src/hooks/useContaConjunta.js`
- Modify: `controle-gastos-frontend/src/hooks/usePagamentos.js`
- Modify: `controle-gastos-frontend/src/components/Transaction/TabAvancado.js`
- Modify: `controle-gastos-frontend/src/components/Transaction/TabResumo.js`
- Modify: `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js`

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: `usePagamentos({ transacao, proprietarioPadrao, valorTotal, parcelamentos })` — assinatura sem `isContaConjunta`/`pagoPor`/`parteUsuario`. `TabAvancado`/`TabResumo` sem a prop `contaConjunta`.

- [ ] **Step 1: Apagar o hook `useContaConjunta`**

```bash
rm controle-gastos-frontend/src/hooks/useContaConjunta.js
```

- [ ] **Step 2: Simplificar `usePagamentos.js`**

Em `controle-gastos-frontend/src/hooks/usePagamentos.js`, altere a assinatura da função (linha 14):

```js
export default function usePagamentos({ transacao, proprietarioPadrao, valorTotal, isContaConjunta, pagoPor, parteUsuario, parcelamentos }) {
```

por:

```js
export default function usePagamentos({ transacao, proprietarioPadrao, valorTotal, parcelamentos }) {
```

E substitua (linhas 41-43):

```js
  const valorEsperadoParaSoma = (isContaConjunta && pagoPor === 'outro')
    ? parseFloat(parteUsuario || 0)
    : parseFloat(valorTotal || 0);
```

por:

```js
  const valorEsperadoParaSoma = parseFloat(valorTotal || 0);
```

- [ ] **Step 3: Remover a seção de conta conjunta de `TabAvancado.js`**

Em `controle-gastos-frontend/src/components/Transaction/TabAvancado.js`, remova a prop `contaConjunta` da assinatura do componente e a linha que a desestrutura (linhas 6-17):

```js
const TabAvancado = ({
  parcelamento,
  contaConjunta,
  valorTotal,
  parteUsuario,
  setParteUsuario,
  transacao,
  emprestimoForm,
  tipoTransacao,
  qtdPagamentos = 1
}) => {
  const { state: cState, setters: cSetters, toggle: ccToggle, parteOutro } = contaConjunta;

  const temParcelamento = Object.values(parcelamento.state.parcelamentos || {}).some(c => c?.ativo);
```

por:

```js
const TabAvancado = ({
  parcelamento,
  transacao,
  emprestimoForm,
  tipoTransacao,
  qtdPagamentos = 1
}) => {
  const temParcelamento = Object.values(parcelamento.state.parcelamentos || {}).some(c => c?.ativo);
```

(as props `valorTotal`/`parteUsuario`/`setParteUsuario` só eram usadas dentro do bloco de conta conjunta removido no próximo passo — confirme isso antes de apagá-las; se sobrar algum uso fora desse bloco, mantenha a prop correspondente).

Remova o bloco inteiro `<div className="form-section conta-conjunta-section">...</div>` (linhas 32-136 do arquivo original, entre o fechamento do bloco de parcelamento e a linha do `EmprestimoSecao`), deixando:

```js
      {temParcelamento && (
        <div className="form-section parcelamento-resumo">
          <p className="parcelamento-resumo-texto">
            <strong>Parcelamento configurado nos pagamentos.</strong> {' '}
            Cada participante pode ter seu proprio plano de parcelamento.
          </p>
        </div>
      )}

      {emprestimoForm && <EmprestimoSecao form={emprestimoForm} valorTotal={valorTotal} tipoTransacao={tipoTransacao} qtdPagamentos={qtdPagamentos} />}
```

Isso reintroduz a necessidade da prop `valorTotal` (usada por `EmprestimoSecao`) — mantenha-a na assinatura:

```js
const TabAvancado = ({
  parcelamento,
  valorTotal,
  transacao,
  emprestimoForm,
  tipoTransacao,
  qtdPagamentos = 1
}) => {
```

- [ ] **Step 4: Remover referências a `contaConjunta` de `TabResumo.js`**

Em `controle-gastos-frontend/src/components/Transaction/TabResumo.js`, remova `contaConjunta` da assinatura (linha 16):

```js
const TabResumo = ({ formState, pagamentos, parcelamento, contaConjunta, allTags, categorias, duplicate }) => {
```

por:

```js
const TabResumo = ({ formState, pagamentos, parcelamento, allTags, categorias, duplicate }) => {
```

Remova a linha de validação de vínculo (linha 48):

```js
  if (contaConjunta.state.isContaConjunta && !contaConjunta.state.vinculoId) issues.push({ type: 'error', msg: 'Conta conjunta sem vinculo selecionado' });
```

Simplifique a linha seguinte (linha 50), removendo a condição de conta conjunta:

```js
  if (anyTagMissing && !contaConjunta.state.isContaConjunta) issues.push({ type: 'warn', msg: 'Nenhuma tag aplicada nos pagamentos' });
```

vira:

```js
  if (anyTagMissing) issues.push({ type: 'warn', msg: 'Nenhuma tag aplicada nos pagamentos' });
```

Remova o bloco de exibição de conta conjunta (linhas 89-97):

```js
          {contaConjunta.state.isContaConjunta && contaConjunta.state.vinculoId && (
            <div className="resumo-row">
              <Badge label={contaConjunta.state.pagoPor === 'usuario' ? 'Eu paguei' : 'Outro pagou'} />
              <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto)', opacity: 0.7 }}>
                Minha parte: R$ {parseFloat(contaConjunta.state.parteUsuario || 0).toFixed(2).replace('.', ',')}
                {' | '}Outro: R$ {contaConjunta.parteOutro.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
```

- [ ] **Step 5: Remover integração de conta conjunta em `NovaTransacaoForm.js`**

Em `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js`, remova o import (linha 9):

```js
import useContaConjunta from '../../hooks/useContaConjunta';
```

Remova a chamada do hook (linha 29):

```js
  const contaConjunta = useContaConjunta({ transacao });
```

Simplifique a chamada de `usePagamentos` (linhas 36-44), removendo as 3 props de conta conjunta:

```js
  const pagamentos = usePagamentos({
    transacao,
    proprietarioPadrao,
    valorTotal: form.formState.valorTotal,
    isContaConjunta: contaConjunta.state.isContaConjunta,
    pagoPor: contaConjunta.state.pagoPor,
    parteUsuario: contaConjunta.state.parteUsuario,
    parcelamentos: parcelamento.state.parcelamentos
  });
```

vira:

```js
  const pagamentos = usePagamentos({
    transacao,
    proprietarioPadrao,
    valorTotal: form.formState.valorTotal,
    parcelamentos: parcelamento.state.parcelamentos
  });
```

Simplifique `onValorTotalChange` (linhas 115-124):

```js
  const onValorTotalChange = useCallback((e) => {
    const raw = e.target.value;
    fsSetters.setValorTotal(raw);
    if (contaConjunta.state.isContaConjunta && contaConjunta.state.pagoPor === 'outro') {
      contaConjunta.setters.setParteUsuario(raw);
      if (pagamentos.pagamentos.length === 1) pagamentos.handlePagamentoChange(0, 'valor', raw);
    } else if (pagamentos.pagamentos.length === 1) {
      pagamentos.handlePagamentoChange(0, 'valor', raw);
    }
  }, [fsSetters, contaConjunta.state.isContaConjunta, contaConjunta.state.pagoPor, contaConjunta.setters, pagamentos]);
```

vira:

```js
  const onValorTotalChange = useCallback((e) => {
    const raw = e.target.value;
    fsSetters.setValorTotal(raw);
    if (pagamentos.pagamentos.length === 1) pagamentos.handlePagamentoChange(0, 'valor', raw);
  }, [fsSetters, pagamentos]);
```

Remova a função `onParteUsuarioChange` inteira (linhas 126-134):

```js
  const onParteUsuarioChange = useCallback((raw) => {
    contaConjunta.setters.setParteUsuario(raw);
    if (contaConjunta.state.pagoPor === 'outro') {
      fsSetters.setValorTotal(raw);
      if (pagamentos.pagamentos.length === 1) {
        pagamentos.handlePagamentoChange(0, 'valor', raw);
      }
    }
  }, [contaConjunta.state.pagoPor, contaConjunta.setters, fsSetters, pagamentos]);
```

Dentro de `handleSubmit`, remova a validação de conta conjunta (linhas 144-148):

```js
    const ccError = contaConjunta.validateContaConjunta(formState.valorTotal);
    if (ccError) {
      toast.error(ccError);
      return;
    }

```

Substitua (linhas 165-169):

```js
      let valorFinal = parseFloat(formState.valorTotal);
      let contaConjuntaPayload = contaConjunta.buildPayload(formState.valorTotal);
      if (contaConjuntaPayload) {
        valorFinal = contaConjunta.getValorFinal(formState.valorTotal);
      }
```

por:

```js
      const valorFinal = parseFloat(formState.valorTotal);
```

Remova a linha (por volta da linha 274):

```js
      if (contaConjuntaPayload) transacaoData.contaConjunta = contaConjuntaPayload;
```

Remova a linha (por volta da linha 319, dentro do bloco "salvar e continuar"):

```js
        contaConjunta.reset();
```

Atualize o array de dependências do `useCallback` de `handleSubmit` (por volta da linha 331):

```js
  }, [formState, form, pagamentos, contaConjunta, parcelamento, emprestimoForm, onSuccess, onClose, proprietarioPadrao, refs]);
```

vira:

```js
  }, [formState, form, pagamentos, parcelamento, emprestimoForm, onSuccess, onClose, proprietarioPadrao, refs]);
```

Por fim, remova as props de conta conjunta passadas para `TabAvancado`/`TabResumo` (por volta das linhas 453-474):

```js
        <TabAvancado
          data-tab="avancado"
          parcelamento={parcelamento}
          contaConjunta={contaConjunta}
          valorTotal={formState.valorTotal}
          parteUsuario={contaConjunta.state.parteUsuario}
          setParteUsuario={onParteUsuarioChange}
          transacao={transacao}
          emprestimoForm={emprestimoForm}
          tipoTransacao={formState.tipo}
          qtdPagamentos={pagamentos.pagamentos.length}
        />
        <TabResumo
          data-tab="resumo"
          formState={formState}
          pagamentos={pagamentos}
          parcelamento={parcelamento}
          contaConjunta={contaConjunta}
          allTags={allTags}
          categorias={categorias}
          duplicate={duplicate}
        />
```

por:

```js
        <TabAvancado
          data-tab="avancado"
          parcelamento={parcelamento}
          valorTotal={formState.valorTotal}
          transacao={transacao}
          emprestimoForm={emprestimoForm}
          tipoTransacao={formState.tipo}
          qtdPagamentos={pagamentos.pagamentos.length}
        />
        <TabResumo
          data-tab="resumo"
          formState={formState}
          pagamentos={pagamentos}
          parcelamento={parcelamento}
          allTags={allTags}
          categorias={categorias}
          duplicate={duplicate}
        />
```

- [ ] **Step 6: Rodar o lint nos 4 arquivos alterados**

Run: `cd controle-gastos-frontend && npx eslint src/hooks/usePagamentos.js src/components/Transaction/TabAvancado.js src/components/Transaction/TabResumo.js src/components/Transaction/NovaTransacaoForm.js`
Expected: sem erros (avisos de variável não utilizada, se houver, devem ser corrigidos antes de seguir — indicam alguma referência a `contaConjunta` que passou despercebida).

- [ ] **Step 7: Testar manualmente no navegador**

Run: `cd controle-gastos-frontend && npm start`

1. Acesse a tela de transações e abra "Nova transação" (detecte a porta real no terminal).
2. Confirme que a aba "Avançado" não mostra mais o checkbox "Esta é uma conta conjunta".
3. Preencha uma transação com 2 pagamentos (divisão normal) e salve.
4. Edite uma transação existente que **não** era conta conjunta e confirme que salva normalmente.

Expected: form de transação funciona ponta a ponta sem nenhum resquício visual de conta conjunta, e a divisão via `pagamentos[]` continua idêntica a antes.

- [ ] **Step 8: Commit**

```bash
git add controle-gastos-frontend/src/hooks/usePagamentos.js controle-gastos-frontend/src/components/Transaction/TabAvancado.js controle-gastos-frontend/src/components/Transaction/TabResumo.js controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js
git rm controle-gastos-frontend/src/hooks/useContaConjunta.js
git commit -m "refactor(conta-conjunta): remove hook e campos de conta conjunta do form de transacao"
```

---

### Task 10: Frontend — remover páginas de gestão de vínculo, rota e item de menu

**Files:**
- Delete: `controle-gastos-frontend/src/pages/Conjunto/ConjuntoPage.js`
- Delete: `controle-gastos-frontend/src/pages/Conjunto/ConjuntoPage.css`
- Delete: `controle-gastos-frontend/src/pages/Conjunto/DetalheVinculoPage.js`
- Delete: `controle-gastos-frontend/src/pages/Conjunto/DetalheVinculoPage.css`
- Modify: `controle-gastos-frontend/src/App.js`
- Modify: `controle-gastos-frontend/src/components/Layout/menuStructure.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: rotas `/conjunto` e `/conjunto/:id` deixam de existir; item de menu "Contas Conjuntas" desaparece da sidebar.

- [ ] **Step 1: Apagar a pasta `Conjunto` inteira**

```bash
rm controle-gastos-frontend/src/pages/Conjunto/ConjuntoPage.js
rm controle-gastos-frontend/src/pages/Conjunto/ConjuntoPage.css
rm controle-gastos-frontend/src/pages/Conjunto/DetalheVinculoPage.js
rm controle-gastos-frontend/src/pages/Conjunto/DetalheVinculoPage.css
```

- [ ] **Step 2: Remover imports e rotas de `App.js`**

Remova os imports (linhas 42-43):

```js
import ConjuntoPage from './pages/Conjunto/ConjuntoPage';
import DetalheVinculoPage from './pages/Conjunto/DetalheVinculoPage';
```

Remova as duas rotas (linhas 274-292):

```js
              <Route
                path="/conjunto"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <ConjuntoPage />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/conjunto/:id"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <DetalheVinculoPage />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
```

- [ ] **Step 3: Remover o item de menu de `menuStructure.js`**

Remova (por volta da linha 126):

```js
    { type: 'item', name: 'Contas Conjuntas', path: '/conjunto', icon: GroupIcon, key: 'conjunto' },
```

Se `GroupIcon` não for usado em mais nenhum lugar do arquivo (confira com uma busca no próprio arquivo antes de remover o import), remova também a linha de import correspondente. Se ainda for usado por outro item de menu, mantenha o import.

- [ ] **Step 4: Rodar o lint nos arquivos alterados**

Run: `cd controle-gastos-frontend && npx eslint src/App.js src/components/Layout/menuStructure.js`
Expected: sem erros (import não utilizado deve ser resolvido conforme o Step 3).

- [ ] **Step 5: Testar manualmente no navegador**

Run: `cd controle-gastos-frontend && npm start`

1. Confirme que "Contas Conjuntas" não aparece mais na sidebar.
2. Navegue manualmente para `/conjunto` na URL — deve cair na rota padrão de "não encontrado"/redirecionar, não renderizar a página antiga.

Expected: nenhum vestígio de navegação pra telas de conta conjunta.

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/App.js controle-gastos-frontend/src/components/Layout/menuStructure.js
git rm -r controle-gastos-frontend/src/pages/Conjunto
git commit -m "refactor(conta-conjunta): remove paginas, rota e item de menu de contas conjuntas"
```

---

### Task 11: Frontend — remover exibição de `contaConjunta` em Importação e Relatório

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js`
- Modify: `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: linhas de transação na revisão de importação e no relatório não exibem/exportam mais campos derivados de `contaConjunta`.

- [ ] **Step 1: Remover exibição de `contaConjunta` em `DetalhesImportacaoPage.js`**

Localize e remova a linha que inclui `contaConjunta: transacao.contaConjunta` no objeto montado por volta da linha 325 (mantenha os demais campos do objeto intactos — apenas apague essa linha e, se ela não for a última do objeto, garanta que a vírgula da linha anterior continua correta).

Localize o bloco de exibição por volta das linhas 1201-1205:

```js
                                                        {transacao.contaConjunta?.ativo ? (
                                                                Sim · {transacao.contaConjunta.pagoPor === 'outro' ? 'Outro pagou' : 'Eu paguei'} · 
                                                                Total: {formatarValor(transacao.contaConjunta.valorTotal)} · 
                                                                Minha parte: {formatarValor(transacao.contaConjunta.parteUsuario)}
```

Remova o bloco condicional inteiro (do `{transacao.contaConjunta?.ativo ? (` até o fechamento correspondente `) : (...)}`), deixando o restante da linha/célula da tabela como estava fora dessa condição — leia o entorno exato dessas linhas no arquivo antes de editar, já que é um JSX ternário e o fechamento pode estar várias linhas abaixo.

- [ ] **Step 2: Remover o campo `vinculo` derivado de `contaConjunta` em `Relatorio.js`**

Em `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js`, dentro de `flattenTransactions` (função no topo do arquivo), remova (linhas 51-56):

```js
    const baseContaConjunta = tr.contaConjunta?.ativo ? {
      valorTotal: tr.contaConjunta.valorTotal,
      parteUsuario: tr.contaConjunta.parteUsuario,
      pagoPor: tr.contaConjunta.pagoPor,
      vinculo: tr.contaConjunta.vinculoId?.nome || tr.vinculoNome || (tr.contaConjunta.vinculoId?._id || tr.contaConjunta.vinculoId) || ''
    } : {};
```

E remova as duas linhas que espalham `...baseContaConjunta` no objeto de cada linha achatada (uma no ramo "sem pagamentos" e outra dentro do `tr.pagamentos.forEach`, ambas próximas às ocorrências de `...baseParcelamento`/`...baseEmprestimo`).

Remova as 4 colunas derivadas de `contaConjunta` do export CSV (linhas 432-435 e o `customHeaders` na linha 442):

```js
            'Valor Total': r.valorTotal ?? '',
            'Parte Usuário': r.parteUsuario ?? '',
            'Pago Por': r.pagoPor ?? '',
            'Vínculo': r.vinculo ?? ''
```

e, em `customHeaders`:

```js
            customHeaders: ['Data', 'Descrição', 'Tipo', 'Status', 'Pessoa', 'Valor', 'Tags', 'Valor Total', 'Parte Usuário', 'Pago Por', 'Vínculo'],
```

vira:

```js
            customHeaders: ['Data', 'Descrição', 'Tipo', 'Status', 'Pessoa', 'Valor', 'Tags'],
```

(ajuste a vírgula final do objeto CSV — `Tags: tagsStr` passa a ser o último campo antes do fechamento `};`).

- [ ] **Step 3: Rodar o lint nos dois arquivos**

Run: `cd controle-gastos-frontend && npx eslint src/pages/ImportacaoMassa/DetalhesImportacaoPage.js src/pages/Relatorio/Relatorio.js`
Expected: sem erros.

- [ ] **Step 4: Testar manualmente no navegador**

Run: `cd controle-gastos-frontend && npm start`

1. Acesse `/relatorio`, gere um relatório qualquer e exporte em CSV — confirme que as colunas "Valor Total"/"Parte Usuário"/"Pago Por"/"Vínculo" não aparecem mais.
2. Acesse `/importacao-massa` (ou o caminho correspondente), abra os detalhes de uma importação existente e confirme que a tela renderiza normalmente, sem erro no console.

Expected: nenhuma referência visual ou funcional a conta conjunta nessas duas telas.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js controle-gastos-frontend/src/pages/Relatorio/Relatorio.js
git commit -m "refactor(conta-conjunta): remove exibicao e exportacao de dados de conta conjunta em importacao e relatorio"
```

---

### Task 12: Frontend — remover client de API de vínculo/acerto

**Files:**
- Modify: `controle-gastos-frontend/src/api.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `api.js` sem os 11 exports relacionados a vínculo/acerto conjunto.

- [ ] **Step 1: Remover o bloco inteiro de funções de vínculo/acerto**

Remova, de `controle-gastos-frontend/src/api.js`, o comentário e as 11 funções entre as linhas 577 e 708:

```js
/* ----- Vínculos Conjuntos (Conta Conjunta) ----- */
export async function listarVinculosConjuntos() { ... }
export async function criarVinculoConjunto(dados) { ... }
export async function obterVinculoConjunto(id) { ... }
export async function atualizarVinculoConjunto(id, dados) { ... }
export async function excluirVinculoConjunto(id) { ... }
export async function obterSaldoVinculo(id) { ... }
export async function obterResumoVinculo(id, params = {}) { ... }
export async function listarTransacoesVinculo(id, params = {}) { ... }
export async function obterExtratoVinculo(id, params = {}) { ... }
export async function listarAcertosVinculo(id) { ... }
export async function registrarAcertoVinculo(vinculoId, dados) { ... }
export async function estornarAcerto(acertoId) { ... }
```

(o conteúdo completo de cada função está nas linhas 577-708 do arquivo atual — apague o bloco todo, do comentário `/* ----- Vínculos Conjuntos (Conta Conjunta) ----- */` até o fechamento da última função `estornarAcerto`, imediatamente antes do comentário `/* ----- Pessoas (Empréstimos) ----- */`).

- [ ] **Step 2: Confirmar que não sobrou nenhum import quebrado**

Run: `cd controle-gastos-frontend && grep -rn "listarVinculosConjuntos\|criarVinculoConjunto\|obterVinculoConjunto\|atualizarVinculoConjunto\|excluirVinculoConjunto\|obterSaldoVinculo\|obterResumoVinculo\|listarTransacoesVinculo\|obterExtratoVinculo\|listarAcertosVinculo\|registrarAcertoVinculo\|estornarAcerto" src/`

Expected: nenhum resultado (todas as Tasks 9-11 já removeram os únicos consumidores: `useContaConjunta.js`, `ConjuntoPage.js`, `DetalheVinculoPage.js`). Se algo aparecer, é um consumidor que passou despercebido — investigue antes de prosseguir.

- [ ] **Step 3: Rodar o lint**

Run: `cd controle-gastos-frontend && npx eslint src/api.js`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/api.js
git commit -m "refactor(conta-conjunta): remove client de API de vinculos e acertos conjuntos"
```

---

### Task 13: Migration de dados (entregar script, usuário roda manualmente) + verificação final

**Files:**
- Create: `backend/scripts/migrations/007-remover-conta-conjunta.js`

**Interfaces:**
- Consumes: conexão MongoDB via variável de ambiente já usada pelos outros scripts de migration em `backend/scripts/migrations/`.
- Produces: script standalone, não importado por nenhum outro módulo do backend.

- [ ] **Step 1: Verificar o padrão dos scripts de migration existentes**

Run: `cd backend && node -e "console.log(require('fs').readdirSync('scripts/migrations'))"`

Abra o script mais recente (`006-emprestimo-transacao-importada.js`, citado no `CLAUDE.md`) e confirme o padrão de conexão/desconexão usado (`mongoose.connect`, leitura de `process.env`, log de resultado) antes de escrever o novo — para manter o mesmo estilo.

- [ ] **Step 2: Escrever o script de migration**

```js
// backend/scripts/migrations/007-remover-conta-conjunta.js
// Remove os dados do módulo de Conta Conjunta, descontinuado.
// Uso: node scripts/migrations/007-remover-conta-conjunta.js
// Para produção: NODE_ENV=production node scripts/migrations/007-remover-conta-conjunta.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/controle-gastos';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(`[Migration 007] Conectado a ${MONGO_URI}`);

  const db = mongoose.connection.db;

  const resultTransacoes = await db.collection('transacaos').updateMany(
    { contaConjunta: { $exists: true } },
    { $unset: { contaConjunta: '' } }
  );
  console.log(`[Migration 007] Transacoes atualizadas (contaConjunta removido): ${resultTransacoes.modifiedCount}`);

  const resultTransacoesImportadas = await db.collection('transacaoimportadas').updateMany(
    { contaConjunta: { $exists: true } },
    { $unset: { contaConjunta: '' } }
  );
  console.log(`[Migration 007] TransacaoImportadas atualizadas (contaConjunta removido): ${resultTransacoesImportadas.modifiedCount}`);

  const dropVinculos = await db.collection('vinculoconjuntos').drop().catch((err) => {
    if (err.codeName === 'NamespaceNotFound') return null;
    throw err;
  });
  console.log(`[Migration 007] Colecao 'vinculoconjuntos' removida: ${dropVinculos !== null}`);

  const dropAcertos = await db.collection('acertoconjuntos').drop().catch((err) => {
    if (err.codeName === 'NamespaceNotFound') return null;
    throw err;
  });
  console.log(`[Migration 007] Colecao 'acertoconjuntos' removida: ${dropAcertos !== null}`);

  await mongoose.disconnect();
  console.log('[Migration 007] Concluido.');
}

main().catch((err) => {
  console.error('[Migration 007] Erro:', err);
  process.exit(1);
});
```

**Atenção:** confirme o nome real da collection de `Transacao` (`db.collection('transacaos')` é o plural automático do Mongoose para o model `Transacao` — verifique com `db.getCollectionNames()` no `mongosh` antes de rodar, caso o projeto tenha customizado o nome da collection em algum lugar) e o de `TransacaoImportada` (`transacaoimportadas`) antes de entregar o comando final ao usuário.

- [ ] **Step 3: NÃO rodar o script.** Entregue ao usuário o comando exato para ele rodar e confirmar o resultado:

```bash
cd backend
node scripts/migrations/007-remover-conta-conjunta.js
```

Peça para o usuário colar a saída do console (as 4 linhas de log) antes de considerar a migration concluída.

- [ ] **Step 4: Commit do script (não da execução)**

```bash
git add backend/scripts/migrations/007-remover-conta-conjunta.js
git commit -m "chore(conta-conjunta): adiciona script de migration para remover dados de conta conjunta"
```

---

## Rodada final de verificação (após todas as tasks, incluindo a migration rodada pelo usuário)

- [ ] Rodar `cd backend && npm test` — mesmo resultado da Task 8 (121/122, falha pré-existente em `ledgerService`).
- [ ] Rodar `cd controle-gastos-frontend && npx eslint src/` — sem erros novos.
- [ ] Roteiro manual completo, com o backend e frontend rodando:
  1. Criar uma transação nova com 3 pagamentos (divisão normal) e confirmar que salva e aparece no relatório com a divisão correta.
  2. Confirmar que a sidebar não tem mais "Contas Conjuntas" e que `/conjunto` não carrega a tela antiga.
  3. Abrir uma Conta Fixa existente (ou criar uma nova) e confirmar que continua funcionando normalmente — módulo ortogonal, não deve ter sido afetado.
  4. Rodar uma importação de CSV pequena, revisar as transações importadas e finalizar — confirmar que finaliza sem erro e sem nenhuma referência a `contaConjunta` na resposta.
- [ ] Confirmar com o usuário que ele rodou a migration (Task 13) e colou a saída do console antes de marcar esta feature como encerrada.
