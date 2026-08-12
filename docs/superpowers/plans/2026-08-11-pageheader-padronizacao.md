# Padronização de Cabeçalhos de Página — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Criar o componente `PageHeader` (título grande + ícone + subtítulo + ação opcional, no padrão visual de `/pluggy`) e migrar as 30 páginas do app pra usá-lo, eliminando cabeçalhos inconsistentes (cores hardcoded, `h1`/`h2` misturados, alguns centralizados). Reduzir o padding do `.main-content` de 2rem para 1.5rem.

**Nota de revisão:** a versão original deste plano cobria 26 páginas (derivadas da sidebar, `menuStructure.js`). Uma conferência cruzada contra as rotas reais de `App.js` encontrou 4 rotas privadas fora da sidebar (acessadas via menu do usuário) que tinham ficado de fora: `/tags/inativos`, `/profile`, `/como-utilizar`, `/admin` — agora cobertas na Task 11.

**Architecture:** `PageHeader` é um componente de apresentação puro em `src/components/shared/PageHeader.js` (+ `.css`), com API `{ icon, title, subtitle, action }`. Cada página troca seu bloco de título manual (ou o uso indevido de `SectionHeader` como header de página, nos 2 casos de Contas Fixas/Relatório) pela chamada de `PageHeader`, importando o ícone `@mui/icons-material` já usado pra essa rota em `menuStructure.js`. O `SectionHeader` existente não é tocado — continua servindo cabeçalhos de card/seção interna.

**Tech Stack:** React 19, `@mui/icons-material` (ícones), CSS puro com tokens de tema (`src/theme/tokens.css`). Sem testes automatizados de frontend — verificação via smoke test manual.

## Global Constraints

- Ver spec completo em `docs/superpowers/specs/2026-08-11-pageheader-padronizacao-design.md` — este plano implementa exatamente o que está lá.
- `src/pages/GerenciarImportacoes/GerenciarImportacoes.js` está **fora de escopo** (código morto, não roteado).
- `SectionHeader.js`/`.css` **não é alterado**.
- Ao remover um import de ícone `react-icons/fa` que fica órfão (ex: `FaPiggyBank`, `FaCalculator`, `FaCreditCard`, `FaPlug`), remover só o nome específico da lista de import — nunca remover a linha de import inteira se outros ícones da mesma linha continuam em uso no arquivo.
- Não rodar `npm run build`.

---

## File Structure

| Tarefa | Arquivos | Conteúdo |
|---|---|---|
| 1 | `components/shared/PageHeader.js`, `PageHeader.css` | Componente novo (fundação) |
| 2 | `Home.js`, `Insights.js` | Páginas simples, sem action |
| 3 | `Relatorio.js`, `ContasFixas.js`, `PendenciasContasFixas.js` | Migração de `SectionHeader` → `PageHeader` |
| 4 | `ModelosRelatorio.js`, `TagManagement.js` | `h2` manual → `PageHeader`, com action |
| 5 | `GerenciamentoImportacoesPage.js`, `NovaImportacaoPage.js`, `DetalhesImportacaoPage.js` | Importação em massa |
| 6 | `NovaConciliacaoPage.js`, `HistoricoRecebimentosPage.js` | Recebimentos |
| 7 | `PatrimonioPage.js`, `ContasPage.js`, `DetalheSubcontaPage.js` | Patrimônio (resumo/contas) |
| 8 | `SimuladorRendimentosPage.js`, `EvolucaoPage.js`, `PatrimonioHistoricoPage.js` | Patrimônio (análise) |
| 9 | `ImportacaoOFXPage.js`, `ImportacaoOFXDetalhePage.js`, `TransferenciasPage.js`, `FaturasPage.js` | Patrimônio (OFX/faturas) |
| 10 | `PluggyPage.js`, `EmprestimosPage.js`, `EmprestimoDetalhePage.js`, `PessoasPage.js` | Open Finance/Empréstimos/Pessoas |
| 11 | `TagsInativos.js`, `Profile.js`, `HowToUse.js`, `AdminDashboard.js` | Rotas fora da sidebar |
| 12 | `MainLayout.css` | Padding 2rem → 1.5rem |
| 13 | — | Smoke test final de todas as rotas |

---

### Task 1: Componente `PageHeader`

**Files:**
- Create: `controle-gastos-frontend/src/components/shared/PageHeader.js`
- Create: `controle-gastos-frontend/src/components/shared/PageHeader.css`

- [ ] **Step 1: Criar `PageHeader.js`**

```jsx
// src/components/shared/PageHeader.js
import React from 'react';
import './PageHeader.css';

const PageHeader = ({ icon, title, subtitle, action }) => (
  <div className="cg-page-header">
    <div className="cg-page-header__row">
      <h1 className="cg-page-header__title">
        {icon && <span className="cg-page-header__icon">{icon}</span>}
        {title}
      </h1>
      {action && <div className="cg-page-header__action">{action}</div>}
    </div>
    {subtitle && <p className="cg-page-header__subtitle">{subtitle}</p>}
  </div>
);

export default PageHeader;
```

- [ ] **Step 2: Criar `PageHeader.css`**

```css
/* src/components/shared/PageHeader.css */
.cg-page-header { margin-bottom: 1.5rem; }

.cg-page-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.cg-page-header__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--fonte-titulos);
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--cg-color-text-primary);
  margin: 0;
}

.cg-page-header__icon {
  display: inline-flex;
  align-items: center;
  font-size: 1em;
  color: currentColor;
}

.cg-page-header__icon svg {
  width: 0.9em;
  height: 0.9em;
}

.cg-page-header__subtitle {
  color: var(--cg-color-text-secondary);
  margin: 0.5rem 0 0;
  font-size: var(--cg-font-size-base);
}

.cg-page-header__action {
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verificar visualmente**

Ainda não há consumidor do componente — nada pra ver no navegador neste passo. Seguir direto pra Task 2.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/components/shared/PageHeader.js controle-gastos-frontend/src/components/shared/PageHeader.css
git commit -m "feat(shared): adiciona componente PageHeader"
```

---

### Task 2: Home e Insights

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Home/Home.js:227-229`
- Modify: `controle-gastos-frontend/src/pages/Insights/Insights.js`

- [ ] **Step 1: Home — importar `PageHeader` e `HomeIcon`, trocar o `h1`**

Adicionar aos imports do topo do arquivo (perto dos outros imports de `react`/`react-router-dom`):

```js
import PageHeader from '../../components/shared/PageHeader';
import HomeIcon from '@mui/icons-material/Home';
```

Trocar (linhas 227-229):
```jsx
        <h1 className="cg-home__title">
          Dashboard {proprietarioExibicao ? `- ${proprietarioExibicao}` : ''}
        </h1>
```
por:
```jsx
        <PageHeader
          icon={<HomeIcon />}
          title={`Dashboard${proprietarioExibicao ? ` - ${proprietarioExibicao}` : ''}`}
        />
```

- [ ] **Step 2: Remover CSS órfão do título antigo**

Em `Home.css`, localizar a regra `.cg-home__title` (definia `font-size`, `font-weight`, `color` do `h1` antigo) e removê-la — o novo título é estilizado pelo `PageHeader.css`. Manter `.cg-home__header` se tiver outras regras além de posicionar o título (ex: `margin-bottom`).

- [ ] **Step 3: Insights — importar `PageHeader` e `LightbulbIcon`, trocar o `h2`/`p`**

```js
import PageHeader from '../../components/shared/PageHeader';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
```

Trocar:
```jsx
    <div className="insights-page">
      <h2>Insights</h2>
      <p>Esta funcionalidade está em desenvolvimento.</p>
    </div>
```
por:
```jsx
    <div className="insights-page">
      <PageHeader icon={<LightbulbIcon />} title="Insights" subtitle="Esta funcionalidade está em desenvolvimento." />
    </div>
```

- [ ] **Step 4: Verificar visualmente**

Suba o dev server do frontend (`npm start` em `controle-gastos-frontend/`), abra `/` (Home) e `/insights`. Confirme: título grande com ícone à esquerda, no mesmo estilo do `/pluggy`, sem quebrar o resto do dashboard/insights.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/Home/Home.js controle-gastos-frontend/src/pages/Home/Home.css controle-gastos-frontend/src/pages/Insights/Insights.js
git commit -m "feat(layout): migra Home e Insights para PageHeader"
```

---

### Task 3: Relatórios, Contas Fixas, Pendências do Mês

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js:34,626-644`
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js:9,147-156`
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js:6,57`

- [ ] **Step 1: Relatório — trocar `SectionHeader` por `PageHeader`**

Trocar o import (linha 34):
```js
import SectionHeader from '../../components/shared/SectionHeader';
```
por:
```js
import PageHeader from '../../components/shared/PageHeader';
import ShowChartIcon from '@mui/icons-material/ShowChart';
```

Trocar (linhas 626-644):
```jsx
    <div className="cg-relatorio">
      <SectionHeader
        title="Relatórios"
        subtitle="Filtre, visualize e exporte suas transações"
        className="cg-relatorio__header"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={filters.toggleCollapsed}
            icon={filters.collapsed ? <FaChevronDown /> : <FaChevronUp />}
            title={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
            aria-label={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
          >
            {filters.collapsed ? 'Expandir' : 'Recolher'}
          </Button>
        }
      />
```
por:
```jsx
    <div className="cg-relatorio">
      <PageHeader
        icon={<ShowChartIcon />}
        title="Relatórios"
        subtitle="Filtre, visualize e exporte suas transações"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={filters.toggleCollapsed}
            icon={filters.collapsed ? <FaChevronDown /> : <FaChevronUp />}
            title={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
            aria-label={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
          >
            {filters.collapsed ? 'Expandir' : 'Recolher'}
          </Button>
        }
      />
```

Em `Relatorio.css`, remover a regra `.cg-relatorio__header { margin-bottom: var(--cg-spacing-base); }` (linhas 8-10) — o `PageHeader` já tem seu próprio `margin-bottom`.

- [ ] **Step 2: Contas Fixas — trocar `SectionHeader` por `PageHeader`**

Trocar o import (linha 9):
```js
import SectionHeader from '../../components/shared/SectionHeader';
```
por:
```js
import PageHeader from '../../components/shared/PageHeader';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
```

Trocar (linhas 147-156):
```jsx
          <SectionHeader
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>Ver pendências</Button>
                <Button variant="primary" startIcon={<FaPlus />} onClick={abrirNova}>Nova Conta Fixa</Button>
              </div>
            }
          />
```
por:
```jsx
          <PageHeader
            icon={<EventRepeatIcon />}
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>Ver pendências</Button>
                <Button variant="primary" startIcon={<FaPlus />} onClick={abrirNova}>Nova Conta Fixa</Button>
              </div>
            }
          />
```

- [ ] **Step 3: Pendências do Mês — trocar `SectionHeader` por `PageHeader`**

Trocar o import (linha 6):
```js
import SectionHeader from '../../components/shared/SectionHeader';
```
por:
```js
import PageHeader from '../../components/shared/PageHeader';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
```

Trocar (linha 57):
```jsx
          <SectionHeader title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
```
por:
```jsx
          <PageHeader icon={<EventRepeatIcon />} title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
```

- [ ] **Step 4: Verificar visualmente**

Abra `/relatorio`, `/contas-fixas` e `/contas-fixas/pendencias`. Confirme título grande com ícone, subtítulo abaixo, e que os botões de ação (Recolher/Expandir, Ver pendências, Nova Conta Fixa) continuam funcionando no mesmo lugar de antes.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/Relatorio/Relatorio.js controle-gastos-frontend/src/pages/Relatorio/Relatorio.css controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js
git commit -m "feat(layout): migra Relatorios, Contas Fixas e Pendencias para PageHeader"
```

---

### Task 4: Modelos de Relatório e Tags

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ModelosRelatorio/ModelosRelatorio.js:214-222`
- Modify: `controle-gastos-frontend/src/components/Tag/TagManagement.js:383-388`

- [ ] **Step 1: Modelos de Relatório — trocar `h2` centralizado por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import DescriptionIcon from '@mui/icons-material/Description';
```

Trocar (linhas 213-222):
```jsx
    <div className="modelos-relatorio-container">
      <div className="modelos-relatorio-header">
        <h2>Modelos de Relatório</h2>
        <p className="modelos-relatorio-desc">
          Defina como cada tag afeta os totais. Tags não configuradas entram como soma. Depois selecione o modelo na página de Relatórios.
        </p>
        <button className="modelos-relatorio-btn-novo" onClick={() => openModal()}>
          + Novo Modelo
        </button>
      </div>
```
por:
```jsx
    <div className="modelos-relatorio-container">
      <PageHeader
        icon={<DescriptionIcon />}
        title="Modelos de Relatório"
        subtitle="Defina como cada tag afeta os totais. Tags não configuradas entram como soma. Depois selecione o modelo na página de Relatórios."
        action={
          <button className="modelos-relatorio-btn-novo" onClick={() => openModal()}>
            + Novo Modelo
          </button>
        }
      />
```

Em `ModelosRelatorio.css`, remover:
- A regra que centraliza `.modelos-relatorio-container` (`max-width` + `margin: 0 auto`, se existir — conferir se já não foi removida na leva anterior de largura fluida; se ainda existir, remover agora).
- As regras específicas de `.modelos-relatorio-header h2` (cor `#333`, `font-size`, `text-align: center`).

- [ ] **Step 2: Tags (`TagManagement.js`) — trocar `h2` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../shared/PageHeader';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
```

Trocar (linhas 382-388):
```jsx
    <div className="tag-management-page-container">
      <div className="tag-management-header-actions">
        <h2>Gerenciar Categorias e Tags</h2>
        <button className="btn-ver-inativos" onClick={() => navigate('/tags/inativos')}>
          Ver inativos
        </button>
      </div>
```
por:
```jsx
    <div className="tag-management-page-container">
      <PageHeader
        icon={<LocalOfferIcon />}
        title="Gerenciar Categorias e Tags"
        action={
          <button className="btn-ver-inativos" onClick={() => navigate('/tags/inativos')}>
            Ver inativos
          </button>
        }
      />
```

Em `TagManagement.css`, remover a regra `.tag-management-header-actions` se ela só existia pra layout do header antigo (conferir se não é usada em outro lugar do arquivo antes de remover).

- [ ] **Step 3: Verificar visualmente**

Abra `/modelos-relatorio` e `/tags`. Confirme título grande à esquerda (não mais centralizado em Modelos de Relatório), ícone, subtítulo e botão de ação no lugar certo.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/pages/ModelosRelatorio/ModelosRelatorio.js controle-gastos-frontend/src/pages/ModelosRelatorio/ModelosRelatorio.css controle-gastos-frontend/src/components/Tag/TagManagement.js controle-gastos-frontend/src/components/Tag/TagManagement.css
git commit -m "feat(layout): migra Modelos de Relatorio e Tags para PageHeader"
```

---

### Task 5: Importação em massa

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ImportacaoMassa/GerenciamentoImportacoesPage.js:141-186`
- Modify: `controle-gastos-frontend/src/pages/ImportacaoMassa/NovaImportacaoPage.js:26-32`
- Modify: `controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js:617-626`

- [ ] **Step 1: Gerenciamento de Importações — trocar os 3 `h1` (loading/erro/normal) por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import FileUploadIcon from '@mui/icons-material/FileUpload';
```

Este arquivo tem 3 retornos JSX diferentes (loading, erro, normal) cada um com seu próprio `<h1>Gerenciamento de Importações</h1>`. Trocar os três:

Loading (linhas 141-145):
```jsx
      <div className="gerenciamento-importacoes">
        <div className="page-header">
          <div className="header-content">
            <h1>Gerenciamento de Importações</h1>
          </div>
        </div>
```
por:
```jsx
      <div className="gerenciamento-importacoes">
        <PageHeader icon={<FileUploadIcon />} title="Gerenciamento de Importações" />
```

Erro (linhas 157-165, mesmo padrão do loading mas com botão "Nova Importação" dentro do `page-header`) — trocar o `<h1>` mantendo o botão como `action`:
```jsx
      <div className="gerenciamento-importacoes">
        <div className="page-header">
          <div className="header-content">
            <h1>Gerenciamento de Importações</h1>
            <button 
              className="btn-nova-importacao"
```
por:
```jsx
      <div className="gerenciamento-importacoes">
        <PageHeader
          icon={<FileUploadIcon />}
          title="Gerenciamento de Importações"
          action={
            <button
              className="btn-nova-importacao"
```
(fechar o `action={...}` e a tag `PageHeader` no ponto onde antes fechava `</div></div>` do header antigo — ler o restante do bloco no arquivo real antes de editar pra ajustar as chaves/parênteses corretamente, já que o JSX do botão continua nas linhas seguintes.)

Normal (linhas 180-186, mesmo padrão, classe `page-title` em vez de `page-header`):
```jsx
    <div className="gerenciamento-importacoes">
      <div className="page-title">
        <h1>Gerenciamento de Importações</h1>
        <button 
          className="btn-nova-importacao"
```
por:
```jsx
    <div className="gerenciamento-importacoes">
      <PageHeader
        icon={<FileUploadIcon />}
        title="Gerenciamento de Importações"
        action={
          <button
            className="btn-nova-importacao"
```
(mesmo cuidado de fechamento de chaves do caso anterior — ler o bloco completo do botão antes de editar.)

Em `GerenciamentoImportacoesPage.css`, remover as regras de `.page-header`/`.page-title`/`.header-content` que só posicionavam o `h1` antigo (manter qualquer regra que outro elemento da página ainda use).

- [ ] **Step 2: Nova Importação — trocar `h1`+`p` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import FileUploadIcon from '@mui/icons-material/FileUpload';
```

Trocar (linhas 27-32):
```jsx
    <div className="nova-importacao-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1>Nova Importação</h1>
          <p>Importe suas transações a partir de arquivos JSON, CSV ou XLSX.</p>
        </div>
        <button
          type="button"
          onClick={handleAbrirModal}
```
por:
```jsx
    <div className="nova-importacao-page">
      <PageHeader
        icon={<FileUploadIcon />}
        title="Nova Importação"
        subtitle="Importe suas transações a partir de arquivos JSON, CSV ou XLSX."
        action={
          <button
            type="button"
            onClick={handleAbrirModal}
```
(mesmo cuidado: o `<button>` continua com mais props/filhos nas linhas seguintes — fechar `action={...}` e `/>` do `PageHeader` no ponto certo, ajustando a indentação do bloco do botão que sobra.)

- [ ] **Step 3: Detalhe de Importação — trocar `h1` (com botão Voltar) por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import FileUploadIcon from '@mui/icons-material/FileUpload';
```

Trocar (linhas 617-626):
```jsx
        <div className="detalhes-importacao-container">
            <div className="page-header">
                <button onClick={() => navigate(-1)} className="btn-voltar">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```
Manter o SVG do botão Voltar como está (não faz parte do título) — só envolver o `<h1>Detalhes da Importação</h1>` (linha 625) com `PageHeader`:
```jsx
                <h1>Detalhes da Importação</h1>
            </div>
```
por:
```jsx
                <PageHeader icon={<FileUploadIcon />} title="Detalhes da Importação" />
            </div>
```
(o botão Voltar continua acima, fora do `PageHeader` — ele não é um "action" do cabeçalho, é navegação.)

- [ ] **Step 4: Verificar visualmente**

Abra `/importacao`, `/importacao/nova` e o detalhe de uma importação existente (`/importacao/:id`). Confirme título grande com ícone, botão "+ Nova Importação" no lugar certo, e que o botão Voltar do detalhe continua funcionando.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/ImportacaoMassa/GerenciamentoImportacoesPage.js controle-gastos-frontend/src/pages/ImportacaoMassa/GerenciamentoImportacoesPage.css controle-gastos-frontend/src/pages/ImportacaoMassa/NovaImportacaoPage.js controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js
git commit -m "feat(layout): migra paginas de Importacao em Massa para PageHeader"
```

---

### Task 6: Recebimentos

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Recebimentos/NovaConciliacaoPage.js:38-43`
- Modify: `controle-gastos-frontend/src/pages/Recebimentos/HistoricoRecebimentosPage.js:110-113`

- [ ] **Step 1: Nova Conciliação — trocar `h1` (com chip de config condicional) por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import PaidIcon from '@mui/icons-material/Paid';
```

Trocar (linhas 39-43):
```jsx
    <div className="recebimentos-novo-page">
      <header className="recebimentos-novo-header">
        <div className="header-top">
          <h1>Nova Conciliação</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {mostrarBotaoConfig && (
```
por:
```jsx
    <div className="recebimentos-novo-page">
      <header className="recebimentos-novo-header">
        <PageHeader
          icon={<PaidIcon />}
          title="Nova Conciliação"
          action={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {mostrarBotaoConfig && (
```
Como o `div.header-top` original tinha o chip de config e provavelmente outros elementos fechando mais abaixo, ler o restante do bloco (a partir da linha 43 em diante, até o fechamento de `</div></header>` correspondente) antes de editar, pra fechar `action={...}` e a tag `PageHeader` no lugar certo, preservando toda a lógica condicional do chip de configuração exatamente como está.

Em `Recebimentos.css`, remover a regra `.recebimentos-novo-header h1` que definia a cor azul customizada (`color: var(--cor-texto-destaque, #1976d2)`).

- [ ] **Step 2: Histórico de Recebimentos — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import HistoryIcon from '@mui/icons-material/History';
```

Trocar (linhas 110-112):
```jsx
      <header className="recebimentos-historico-header">
        <h1>Histórico de Conciliações</h1>
        <Link to="\recebimentos\novo" className="ds-button ds-button--primary ds-button--md" style={{ textDecoration: 'none' }}>
```
por:
```jsx
      <header className="recebimentos-historico-header">
        <PageHeader
          icon={<HistoryIcon />}
          title="Histórico de Conciliações"
          action={
            <Link to="\recebimentos\novo" className="ds-button ds-button--primary ds-button--md" style={{ textDecoration: 'none' }}>
```
(o `<Link>` continua com mais conteúdo nas linhas seguintes — fechar `action={...}` e `PageHeader` no ponto certo, lendo o restante do bloco antes de editar.)

- [ ] **Step 3: Verificar visualmente**

Abra `/recebimentos/novo` (título não deve mais estar azul) e `/recebimentos/historico`. Confirme que o chip de configuração e o botão "Novo" continuam funcionando.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/pages/Recebimentos/NovaConciliacaoPage.js controle-gastos-frontend/src/pages/Recebimentos/HistoricoRecebimentosPage.js controle-gastos-frontend/src/pages/Recebimentos/Recebimentos.css
git commit -m "feat(layout): migra paginas de Recebimentos para PageHeader"
```

---

### Task 7: Patrimônio (Resumo, Contas, Detalhe de Subconta)

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/PatrimonioPage.js:3,61-66`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/ContasPage.js:130-133`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/DetalheSubcontaPage.js:327`

- [ ] **Step 1: Patrimônio (Resumo) — trocar `FaPiggyBank` por `DashboardIcon`, `h1` por `PageHeader`**

Em `PatrimonioPage.js`, na linha 3, remover `FaPiggyBank` da lista de import (mantendo `FaBuilding, FaChartPie, FaExclamationTriangle, FaSpinner`):
```js
import { FaPiggyBank, FaBuilding, FaChartPie, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
```
vira:
```js
import { FaBuilding, FaChartPie, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
```
Adicionar:
```js
import PageHeader from '../../components/shared/PageHeader';
import DashboardIcon from '@mui/icons-material/Dashboard';
```

Trocar (linhas 61-66):
```jsx
      <div className="patrimonio-header">
        <h1><FaPiggyBank /> Patrimônio</h1>
        <Button variant="primary" onClick={() => navigate('/patrimonio/contas')}>
          Gerenciar Contas
        </Button>
      </div>
```
por:
```jsx
      <PageHeader
        icon={<DashboardIcon />}
        title="Patrimônio"
        action={
          <Button variant="primary" onClick={() => navigate('/patrimonio/contas')}>
            Gerenciar Contas
          </Button>
        }
      />
```

Em `PatrimonioPage.css`, remover a regra `.patrimonio-header h1` (font-size fixo, display flex, gap — tudo isso já vem do `PageHeader.css`).

- [ ] **Step 2: Contas Bancárias — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
```

Trocar (linhas 131-133):
```jsx
      <div className="contas-header">
        <h1>Contas Bancárias</h1>
        <div className="contas-actions">
```
por:
```jsx
      <PageHeader
        icon={<AccountBalanceIcon />}
        title="Contas Bancárias"
        action={<div className="contas-actions">
```
O `<div className="contas-actions">` tem mais botões dentro (Nova Instituição etc.) — ler o restante do bloco até o fechamento correspondente de `</div>` antes de editar, pra fechar `action={...}` e `PageHeader` corretamente, preservando os botões existentes.

- [ ] **Step 3: Detalhe de Subconta — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
```

Trocar (linhas 322-328):
```jsx
    <div className="detalhe-subconta-page">
      <div className="detalhe-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio/contas')}>
          Voltar
        </Button>
        <h1>{subconta.instituicao?.nome} - {subconta.nome}</h1>
      </div>
```
por:
```jsx
    <div className="detalhe-subconta-page">
      <div className="detalhe-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio/contas')}>
          Voltar
        </Button>
        <PageHeader icon={<AccountBalanceIcon />} title={`${subconta.instituicao?.nome} - ${subconta.nome}`} />
      </div>
```

- [ ] **Step 4: Verificar visualmente**

Abra `/patrimonio`, `/patrimonio/contas` e o detalhe de uma subconta específica. Confirme ícone/título/ação no padrão novo, e que "Gerenciar Contas"/"Nova Instituição"/"Voltar" continuam funcionando.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/Patrimonio/PatrimonioPage.js controle-gastos-frontend/src/pages/Patrimonio/PatrimonioPage.css controle-gastos-frontend/src/pages/Patrimonio/ContasPage.js controle-gastos-frontend/src/pages/Patrimonio/DetalheSubcontaPage.js
git commit -m "feat(layout): migra Patrimonio, Contas e Detalhe de Subconta para PageHeader"
```

---

### Task 8: Patrimônio — Simulador, Evolução, Histórico

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/SimuladorRendimentosPage.js:3,20-23`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/EvolucaoPage.js:65-71`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/PatrimonioHistoricoPage.js:163-172`

- [ ] **Step 1: Simulador de Rendimentos — trocar `FaCalculator` por `CalculateIcon`, `h1` por `PageHeader`**

Na linha 3, remover `FaCalculator` do import (manter `FaArrowLeft`):
```js
import { FaArrowLeft, FaCalculator } from 'react-icons/fa';
```
vira:
```js
import { FaArrowLeft } from 'react-icons/fa';
```
Adicionar:
```js
import PageHeader from '../../components/shared/PageHeader';
import CalculateIcon from '@mui/icons-material/Calculate';
```

Ler as linhas 15-25 do arquivo (o bloco do header, que tem um botão "Voltar" antes do `h1 className="simulador-rendimentos-title"`) e trocar o `<h1 className="simulador-rendimentos-title"><FaCalculator /> Simulador de Rendimentos</h1>` por:
```jsx
        <PageHeader icon={<CalculateIcon />} title="Simulador de Rendimentos" />
```
mantendo o botão "Voltar" (se existir acima) intacto.

- [ ] **Step 2: Evolução — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import StackedBarChartIcon from '@mui/icons-material/StackedBarChart';
```

Trocar (linhas 65-71):
```jsx
    <div className="evolucao-page">
      <div className="evolucao-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <h1>Evolução do Patrimônio</h1>
      </div>
```
por:
```jsx
    <div className="evolucao-page">
      <div className="evolucao-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <PageHeader icon={<StackedBarChartIcon />} title="Evolução do Patrimônio" />
      </div>
```

- [ ] **Step 3: Patrimônio Histórico — trocar `h1`+`p` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
```

Trocar (linhas 163-172):
```jsx
    <div className="patrimonio-historico-page">
      <div className="patrimonio-historico-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <h1>Patrimônio Histórico</h1>
        <p className="patrimonio-historico-subtitle">
          Baseado no Ledger — consulte quanto você possuía em qualquer data
        </p>
      </div>
```
por:
```jsx
    <div className="patrimonio-historico-page">
      <div className="patrimonio-historico-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <PageHeader
          icon={<CalendarMonthIcon />}
          title="Patrimônio Histórico"
          subtitle="Baseado no Ledger — consulte quanto você possuía em qualquer data"
        />
      </div>
```

- [ ] **Step 4: Verificar visualmente**

Abra `/patrimonio/simulador`, `/patrimonio/evolucao` e `/patrimonio/historico`. Confirme ícone/título/subtítulo no padrão novo e que os botões "Voltar" continuam funcionando.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/Patrimonio/SimuladorRendimentosPage.js controle-gastos-frontend/src/pages/Patrimonio/EvolucaoPage.js controle-gastos-frontend/src/pages/Patrimonio/PatrimonioHistoricoPage.js
git commit -m "feat(layout): migra Simulador, Evolucao e Historico de Patrimonio para PageHeader"
```

---

### Task 9: Patrimônio — Importar OFX, Detalhe OFX, Transferências, Faturas

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/ImportacaoOFXPage.js:69-71`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/ImportacaoOFXDetalhePage.js:117-119`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/TransferenciasPage.js:101-104`
- Modify: `controle-gastos-frontend/src/pages/Patrimonio/FaturasPage.js:91-94`

- [ ] **Step 1: Importar OFX — trocar `h1`+`p` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
```

Trocar (linhas 69-71):
```jsx
    <div className="importacao-ofx-page">
      <h1>Importação OFX</h1>
      <p className="subtitulo">Importe extratos bancários no formato OFX para atualizar o saldo da subconta.</p>
```
por:
```jsx
    <div className="importacao-ofx-page">
      <PageHeader
        icon={<FileDownloadIcon />}
        title="Importação OFX"
        subtitle="Importe extratos bancários no formato OFX para atualizar o saldo da subconta."
      />
```

- [ ] **Step 2: Detalhe de Importação OFX — trocar `h1`+`p` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
```

Trocar (linhas 117-119):
```jsx
      <header className="detalhe-header">
        <h1>{importacao.nomeArquivo}</h1>
        <p>{importacao.subconta?.nome} • {formatarData(importacao.dtStart)} a {formatarData(importacao.dtEnd)}</p>
```
por:
```jsx
      <header className="detalhe-header">
        <PageHeader
          icon={<FileDownloadIcon />}
          title={importacao.nomeArquivo}
          subtitle={`${importacao.subconta?.nome} • ${formatarData(importacao.dtStart)} a ${formatarData(importacao.dtEnd)}`}
        />
```

- [ ] **Step 3: Transferências — trocar `h1` por `PageHeader` (manter `FaExchangeAlt` importado, é usado em outro lugar do arquivo)**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
```

Ler as linhas 95-105 do arquivo (contexto completo do subtítulo, que ocupa mais de uma linha) e trocar:
```jsx
      <h1><FaExchangeAlt /> Transferências entre Contas</h1>
      <p className="subtitulo">
```
por:
```jsx
      <PageHeader
        icon={<SwapHorizIcon />}
        title="Transferências entre Contas"
        subtitle={
```
fechando a prop `subtitle` no ponto onde antes fechava `</p>`, preservando o conteúdo dinâmico do parágrafo original. **Não remover** o import de `FaExchangeAlt` — ele continua em uso na linha 153 (`<FaExchangeAlt /> Registrar transferência` do botão de submit).

- [ ] **Step 4: Faturas — trocar `h1` por `PageHeader`, manter `.faturas-header-actions`**

Na linha 3, remover `FaCreditCard` do import (manter `FaSpinner, FaExclamationTriangle, FaArrowRight`):
```js
import { FaSpinner, FaExclamationTriangle, FaArrowRight, FaCreditCard } from 'react-icons/fa';
```
vira:
```js
import { FaSpinner, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';
```
Adicionar:
```js
import PageHeader from '../../components/shared/PageHeader';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
```

Trocar (linhas 91-94):
```jsx
      <div className="faturas-header">
        <h1><FaCreditCard /> Minhas Faturas</h1>
        <div className="faturas-header-actions">
```
por:
```jsx
      <PageHeader
        icon={<CalendarMonthIcon />}
        title="Minhas Faturas"
        action={<div className="faturas-header-actions">
```
O `<div className="faturas-header-actions">` contém o seletor de mês e o botão de atualizar — ler o restante do bloco até o fechamento correspondente antes de editar, pra fechar `action={...}` e `PageHeader` sem quebrar esses elementos.

- [ ] **Step 5: Verificar visualmente**

Abra `/patrimonio/importacoes-ofx`, o detalhe de uma importação OFX existente, `/patrimonio/transferencias` e `/patrimonio/faturas`. Confirme ícone/título/subtítulo/ação no padrão novo.

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/pages/Patrimonio/ImportacaoOFXPage.js controle-gastos-frontend/src/pages/Patrimonio/ImportacaoOFXDetalhePage.js controle-gastos-frontend/src/pages/Patrimonio/TransferenciasPage.js controle-gastos-frontend/src/pages/Patrimonio/FaturasPage.js
git commit -m "feat(layout): migra Importar OFX, Detalhe OFX, Transferencias e Faturas para PageHeader"
```

---

### Task 10: Open Finance, Empréstimos, Detalhe de Empréstimo, Pessoas

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Pluggy/PluggyPage.js:2,385-387`
- Modify: `controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js:46-52`
- Modify: `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js:149-156`
- Modify: `controle-gastos-frontend/src/pages/Pessoas/PessoasPage.js:96-104`

- [ ] **Step 1: Open Finance — trocar `FaPlug` por `HubIcon`**

Na linha 2, remover `FaPlug` da lista de import (manter os demais: `FaSync, FaCog, FaSpinner, FaCheck, FaPlus, FaTrash, FaLink, FaTimes, FaChevronRight`):
```js
import { FaSync, FaCog, FaSpinner, FaCheck, FaPlus, FaTrash, FaPlug, FaLink, FaTimes, FaChevronRight } from 'react-icons/fa';
```
vira:
```js
import { FaSync, FaCog, FaSpinner, FaCheck, FaPlus, FaTrash, FaLink, FaTimes, FaChevronRight } from 'react-icons/fa';
```
Adicionar:
```js
import PageHeader from '../../components/shared/PageHeader';
import HubIcon from '@mui/icons-material/Hub';
```

Trocar (linhas 385-387):
```jsx
    <div className="pluggy-page">
      <h1><FaPlug /> Pluggy - Open Finance</h1>
      <p className="subtitulo">Sincronize automaticamente transacoes das suas contas bancarias via Pluggy.</p>
```
por:
```jsx
    <div className="pluggy-page">
      <PageHeader
        icon={<HubIcon />}
        title="Open Finance"
        subtitle="Sincronize automaticamente transações das suas contas bancárias via Pluggy."
      />
```

Em `PluggyPage.css`, remover as regras `.pluggy-page h1` e `.pluggy-page .subtitulo` (linhas 1-15, já mapeadas no spec) — o `PageHeader.css` cobre isso agora.

- [ ] **Step 2: Empréstimos — trocar `h2` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import HandshakeIcon from '@mui/icons-material/Handshake';
```

Trocar (linhas 46-52):
```jsx
      <div className="emprestimos-header">
        <h2>Empréstimos</h2>
        <p className="emprestimos-desc">
          Acompanhe quem te deve, prazos e retornos esperados. Empréstimos concedidos
          não contam como gasto nos relatórios — o que volta é devolução de principal,
          juros são income real.
        </p>
```
por:
```jsx
      <PageHeader
        icon={<HandshakeIcon />}
        title="Empréstimos"
        subtitle="Acompanhe quem te deve, prazos e retornos esperados. Empréstimos concedidos não contam como gasto nos relatórios — o que volta é devolução de principal, juros são income real."
      />
```
(mantendo o `<p className="emprestimos-hint">` seguinte fora do `PageHeader`, como um parágrafo normal da página — ele não é o subtítulo do cabeçalho, é uma dica separada.)

- [ ] **Step 3: Detalhe de Empréstimo — trocar `h2` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import HandshakeIcon from '@mui/icons-material/Handshake';
```

Trocar (linhas 149-156):
```jsx
      <div className="emp-detalhe-header">
        <div>
          <h2>{emprestimo.pessoaNomeSnapshot}</h2>
          <p className="emp-detalhe-subtitulo">
            <span className={`emp-status-badge ${status.cls}`}>{status.text}</span>
            {emprestimo.observacao && <span className="emp-detalhe-obs">· {emprestimo.observacao}</span>}
          </p>
        </div>
```
por:
```jsx
      <div className="emp-detalhe-header">
        <PageHeader
          icon={<HandshakeIcon />}
          title={emprestimo.pessoaNomeSnapshot}
          subtitle={
            <>
              <span className={`emp-status-badge ${status.cls}`}>{status.text}</span>
              {emprestimo.observacao && <span className="emp-detalhe-obs">· {emprestimo.observacao}</span>}
            </>
          }
        />
```

- [ ] **Step 4: Pessoas — trocar `h2` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import ContactsIcon from '@mui/icons-material/Contacts';
```

Trocar (linhas 97-104):
```jsx
      <div className="pessoas-header">
        <h2>Pessoas</h2>
        <p className="pessoas-desc">
          Cadastre as pessoas para quem você empresta dinheiro. Use nos empréstimos para
          vincular transações e controlar quem te deve.
        </p>
        <button className="pessoas-btn-novo" onClick={() => openModal()}>+ Nova Pessoa</button>
      </div>
```
por:
```jsx
      <PageHeader
        icon={<ContactsIcon />}
        title="Pessoas"
        subtitle="Cadastre as pessoas para quem você empresta dinheiro. Use nos empréstimos para vincular transações e controlar quem te deve."
        action={<button className="pessoas-btn-novo" onClick={() => openModal()}>+ Nova Pessoa</button>}
      />
```

- [ ] **Step 5: Verificar visualmente**

Abra `/pluggy`, `/emprestimos`, o detalhe de um empréstimo específico e `/pessoas`. Confirme ícone/título/subtítulo/ação no padrão novo, e que "+ Nova Pessoa" continua abrindo o modal.

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/pages/Pluggy/PluggyPage.js controle-gastos-frontend/src/pages/Pluggy/PluggyPage.css controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js controle-gastos-frontend/src/pages/Pessoas/PessoasPage.js
git commit -m "feat(layout): migra Pluggy, Emprestimos, Detalhe de Emprestimo e Pessoas para PageHeader"
```

---

### Task 11: Rotas fora da sidebar (Tags Inativos, Perfil, Como Utilizar, Admin)

Essas 4 rotas não têm entrada no `menuStructure.js` — os ícones foram escolhidos e confirmados diretamente com o usuário (`LocalOfferIcon` herdado de Tags, `PersonIcon`, `HelpOutlineIcon`, `AdminPanelSettingsIcon`).

**Files:**
- Modify: `controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.js:85-90`
- Modify: `controle-gastos-frontend/src/pages/Profile/Profile.js:333-335`
- Modify: `controle-gastos-frontend/src/pages/HowToUse/HowToUse.js:2,7-12`
- Modify: `controle-gastos-frontend/src/pages/Admin/AdminDashboard.js:9`

- [ ] **Step 1: Tags Inativados — trocar `h2` por `PageHeader`, manter botão Voltar fora**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
```

Trocar (linhas 85-90):
```jsx
      <div className="tags-inativos-header">
        <button className="btn-voltar" onClick={() => navigate('/tags')}>
          <FaArrowLeft size={14} /> Voltar
        </button>
        <h2>Itens Inativados</h2>
      </div>
```
por:
```jsx
      <div className="tags-inativos-header">
        <button className="btn-voltar" onClick={() => navigate('/tags')}>
          <FaArrowLeft size={14} /> Voltar
        </button>
        <PageHeader icon={<LocalOfferIcon />} title="Itens Inativados" />
      </div>
```

- [ ] **Step 2: Meu Perfil — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import PersonIcon from '@mui/icons-material/Person';
```

Trocar (linhas 333-335):
```jsx
      <div className="profile-header">
        <h1>Meu Perfil</h1>
        <div className="profile-tabs">
```
por:
```jsx
      <div className="profile-header">
        <PageHeader icon={<PersonIcon />} title="Meu Perfil" />
        <div className="profile-tabs">
```

- [ ] **Step 3: Como Utilizar — trocar `FaInfoCircle`+`h1`+`p` por `PageHeader`**

Na linha 2, remover `FaInfoCircle` da lista de import (mantendo `FaUserCog, FaMoneyBillWave, FaChartLine, FaClipboardList, FaUserTie`, todos usados mais abaixo no arquivo):
```js
import { FaUserCog, FaMoneyBillWave, FaChartLine, FaClipboardList, FaUserTie, FaInfoCircle } from 'react-icons/fa';
```
vira:
```js
import { FaUserCog, FaMoneyBillWave, FaChartLine, FaClipboardList, FaUserTie } from 'react-icons/fa';
```
Adicionar:
```js
import PageHeader from '../../components/shared/PageHeader';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
```

Trocar (linhas 7-12):
```jsx
      <header className="how-to-use-header">
        <FaInfoCircle className="header-icon" />
        <h1>Como Utilizar o Sistema</h1>
        <p>Siga este guia passo a passo para aproveitar ao máximo nosso sistema de controle de gastos</p>
      </header>
```
por:
```jsx
      <header className="how-to-use-header">
        <PageHeader
          icon={<HelpOutlineIcon />}
          title="Como Utilizar o Sistema"
          subtitle="Siga este guia passo a passo para aproveitar ao máximo nosso sistema de controle de gastos"
        />
      </header>
```

Em `HowToUse.css`, remover a regra `.header-icon` (estilizava o `FaInfoCircle` antigo, órfã agora).

- [ ] **Step 4: Painel de Administração — trocar `h1` por `PageHeader`**

Adicionar imports:
```js
import PageHeader from '../../components/shared/PageHeader';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
```

Trocar (linha 9):
```jsx
    <div className="admin-dashboard-container">
      <h1>Painel de Administração</h1>
      <div className="admin-content">
```
por:
```jsx
    <div className="admin-dashboard-container">
      <PageHeader icon={<AdminPanelSettingsIcon />} title="Painel de Administração" />
      <div className="admin-content">
```

- [ ] **Step 5: Verificar visualmente**

Abra `/tags/inativos`, `/profile` e `/como-utilizar`. Para `/admin`, só é possível verificar se a conta logada tiver papel `admin` — se não tiver, pule e reporte como não verificado (não assumir que está OK sem checar).

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.js controle-gastos-frontend/src/pages/Profile/Profile.js controle-gastos-frontend/src/pages/HowToUse/HowToUse.js controle-gastos-frontend/src/pages/HowToUse/HowToUse.css controle-gastos-frontend/src/pages/Admin/AdminDashboard.js
git commit -m "feat(layout): migra Tags Inativados, Perfil, Como Utilizar e Admin para PageHeader"
```

---

### Task 12: Espaçamento do `.main-content`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Layout/MainLayout.css:103`

- [ ] **Step 1: Reduzir o padding**

Trocar:
```css
.main-content {
  flex: 1;
  min-width: 0;
  padding: 2rem;
```
por:
```css
.main-content {
  flex: 1;
  min-width: 0;
  padding: 1.5rem;
```

- [ ] **Step 2: Verificar visualmente**

Percorra 3-4 rotas com sidebar aberta e fechada, confirmando que o respiro entre a sidebar e o conteúdo ficou um pouco mais compacto (24px em vez de 32px), de forma consistente nos 4 lados.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Layout/MainLayout.css
git commit -m "fix(layout): reduz padding do main-content de 2rem para 1.5rem"
```

---

## Final Verification (Task 13)

- [ ] Percorrer as 30 rotas da tabela de migração (spec, seção "Tabela de migração") com sidebar expandida, conferindo: título grande, ícone à esquerda do título (mesmo ícone da sidebar, ou o ícone confirmado com o usuário nas 4 rotas fora do menu), subtítulo quando existente, botão de ação no lugar de antes.
- [ ] Repetir com a sidebar colapsada.
- [ ] Conferir especificamente as páginas que tinham botão de ação condicional ou lógica JSX mais complexa (Recebimentos/Nova Conciliação, Gerenciamento de Importações, Contas Bancárias, Faturas, Transferências) — são as que exigiram mais cuidado ao fechar chaves/parênteses nos steps acima.
- [ ] Conferir `/admin` separadamente, só se a conta de teste tiver papel `admin`.
- [ ] Rodar `npm run build`? **Não** — só quando o usuário disser "tarefa concluída" (regra do projeto).
- [ ] Reportar ao usuário o roteiro de smoke test manual (formato do `CLAUDE.md`), com a porta real do dev server detectada no momento.

---

## Self-Review

**Cobertura do spec:** as 30 páginas da tabela de migração do spec estão todas mapeadas em uma das Tasks 2-11 (Tasks 2-10 cobrem as 26 páginas da sidebar, Task 11 cobre as 4 rotas fora do menu). A criação do componente é a Task 1. O ajuste de padding é a Task 12.

**Placeholders:** os únicos pontos que pedem "ler o restante do bloco antes de editar" (Gerenciamento de Importações, Nova Importação, Contas Bancárias, Faturas, Nova Conciliação, Histórico de Recebimentos, Transferências) são casos onde o JSX original continua por muitas linhas com lógica não relacionada ao cabeçalho (botões com múltiplas props, listas de opções) — copiar tudo integralmente teria inflado o plano sem agregar clareza; a instrução deixa explícito exatamente qual trecho vira `action`/`subtitle` e qual continua igual, então não é ambiguidade sobre o quê fazer, só sobre onde fechar a tag no arquivo real.

**Consistência:** a API do `PageHeader` (`icon`, `title`, `subtitle`, `action`) definida na Task 1 é usada de forma idêntica em todas as tasks seguintes — nenhuma variação de nome de prop.
