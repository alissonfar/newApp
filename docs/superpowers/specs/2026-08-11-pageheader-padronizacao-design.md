# Padronização de cabeçalhos de página — Design

**Contexto:** Depois do fix de largura fluida das páginas (sessão anterior, ver `docs/superpowers/plans/2026-08-11-largura-fluida-paginas.md`), o usuário notou que os cabeçalhos de cada rota também estão inconsistentes entre si — cores diferentes (`#333` hardcoded, azul `#1976d2`, tokens de tema), tags diferentes (`h1` em algumas, `h2` em outras), alinhamento diferente (a maioria à esquerda, mas Modelos de Relatório e Nova Importação centralizados), ícone presente em só 2 das 26 páginas, e nenhuma delas segue um padrão único. O usuário escolheu o cabeçalho de `/pluggy` (título grande + ícone + subtítulo, próximo da sidebar) como referência a ser replicada em toda a aplicação.

## Goal

Criar um componente `PageHeader` reutilizável e migrar as 26 páginas/rotas do app pra usá-lo, eliminando a inconsistência visual de título/ícone/subtítulo, e reduzir levemente o padding do `.main-content` pra aproximar o conteúdo da sidebar.

## Fora de escopo

- `src/pages/GerenciarImportacoes/GerenciarImportacoes.js` — não está roteado em `App.js` (código morto, a rota `/importacao` real usa `GerenciamentoImportacoesPage`). Não faz parte desta migração. Pode ser sinalizado como candidato a remoção separadamente.
- O componente `SectionHeader` existente (`src/components/shared/SectionHeader.js`) não é alterado — continua servindo aos usos de cabeçalho de card/seção interna que já tem hoje (ex: dentro do card de filtros do Relatório). As únicas duas exceções são Contas Fixas e Relatório, que hoje usam `SectionHeader` indevidamente como cabeçalho PRINCIPAL da página — essas duas trocam para `PageHeader` (ver tabela de migração).

## Arquitetura

### Componente `PageHeader`

Novo arquivo `src/components/shared/PageHeader.js` + `PageHeader.css`, no mesmo padrão de organização do `SectionHeader`.

```jsx
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
```

**API:**
- `icon` (opcional, nó React): o mesmo componente de ícone `@mui/icons-material` já usado para a rota em `menuStructure.js`. Renderizado antes do título.
- `title` (obrigatório, string ou nó): texto do título.
- `subtitle` (opcional, string ou nó): texto abaixo do título.
- `action` (opcional, nó React): elemento (normalmente um `Button`) alinhado à direita do título, na mesma linha.

**CSS (`PageHeader.css`), usando tokens de tema (compatível com dark mode — nunca cor hardcoded):**

```css
.cg-page-header { margin-bottom: 1.5rem; }
.cg-page-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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
}
.cg-page-header__icon svg { width: 1em; height: 1em; }
.cg-page-header__subtitle {
  color: var(--cg-color-text-secondary);
  margin: 0.5rem 0 0;
  font-size: var(--cg-font-size-base);
}
.cg-page-header__action { flex-shrink: 0; }
```

O ícone herda `color: currentColor` (mesma cor do título, `--cg-color-text-primary`) — não usa a cor azul de destaque (`--cg-color-primary`) que o `SectionHeader` usa hoje pro ícone, porque o padrão de referência (`/pluggy`) não usa azul no ícone nem no título.

### Regra de mapeamento de ícone

Cada `PageHeader` usa o mesmo componente de ícone `@mui/icons-material` já mapeado pra rota em `src/components/Layout/menuStructure.js`. Sub-páginas de detalhe que não têm entrada própria na sidebar (ex: detalhe de um empréstimo específico) herdam o ícone da seção/página-mãe mais próxima na sidebar.

Isso troca a biblioteca de ícone em várias páginas que hoje usam `react-icons/fa` (ex: `FaPlug`, `FaPiggyBank`, `FaCalculator`) — essas importações são substituídas pelo ícone `@mui/icons-material` equivalente da sidebar. Páginas que já não tinham ícone algum (a maioria) ganham um pela primeira vez.

### Tabela de migração (26 páginas)

| # | Página | Arquivo JSX | Rota | Ícone MUI | Subtítulo hoje | Action | Mecanismo atual → novo |
|---|---|---|---|---|---|---|---|
| 1 | Home | `pages/Home/Home.js` | `/` | `HomeIcon` | não | não | `h1` manual → `PageHeader` |
| 2 | Relatórios | `pages/Relatorio/Relatorio.js` | `/relatorio` | `ShowChartIcon` | sim | sim | `SectionHeader` → `PageHeader` |
| 3 | Insights | `pages/Insights/Insights.js` | `/insights` | `LightbulbIcon` | não | não | `h2` manual → `PageHeader` |
| 4 | Modelos de Relatório | `pages/ModelosRelatorio/ModelosRelatorio.js` | `/modelos-relatorio` | `DescriptionIcon` | sim | não | `h2` centralizado → `PageHeader` (esquerda) |
| 5 | Importação em Massa | `pages/ImportacaoMassa/GerenciamentoImportacoesPage.js` | `/importacao` | `FileUploadIcon` | não | sim | `h1` manual → `PageHeader` |
| 6 | Nova Importação | `pages/ImportacaoMassa/NovaImportacaoPage.js` | `/importacao/nova` | `FileUploadIcon` | sim | não | `h1` centralizado → `PageHeader` (esquerda) |
| 7 | Detalhe de Importação | `pages/ImportacaoMassa/DetalhesImportacaoPage.js` | `/importacao/:id` | `FileUploadIcon` (herdado) | não | não | `h1`/`page-header` manual → `PageHeader` |
| 8 | Recebimentos (Nova Conciliação) | `pages/Recebimentos/NovaConciliacaoPage.js` | `/recebimentos/novo` | `PaidIcon` | não | sim | `h1` azul → `PageHeader` |
| 9 | Histórico de Recebimentos | `pages/Recebimentos/HistoricoRecebimentosPage.js` | `/recebimentos/historico` | `HistoryIcon` | não | sim | `h1` manual → `PageHeader` |
| 10 | Tags | `components/Tag/TagManagement.js` | `/tags` | `LocalOfferIcon` | não | sim | `h2` manual → `PageHeader` |
| 11 | Contas Fixas | `pages/ContasFixas/ContasFixas.js` | `/contas-fixas` | `EventRepeatIcon` | sim | sim | `SectionHeader` → `PageHeader` |
| 12 | Pendências do Mês | `pages/ContasFixas/PendenciasContasFixas.js` | `/contas-fixas/pendencias` | `EventRepeatIcon` | sim | sim | `SectionHeader` → `PageHeader` |
| 13 | Patrimônio (Resumo) | `pages/Patrimonio/PatrimonioPage.js` | `/patrimonio` | `DashboardIcon` | não | sim | `h1` + `FaPiggyBank` → `PageHeader` |
| 14 | Contas Bancárias | `pages/Patrimonio/ContasPage.js` | `/patrimonio/contas` | `AccountBalanceIcon` | não | sim | `h1` manual → `PageHeader` |
| 15 | Detalhe de Subconta | `pages/Patrimonio/DetalheSubcontaPage.js` | `/patrimonio/contas/:id` | `AccountBalanceIcon` (herdado) | não | não | `h1` manual → `PageHeader` |
| 16 | Simulador de Rendimentos | `pages/Patrimonio/SimuladorRendimentosPage.js` | `/patrimonio/simulador` | `CalculateIcon` | não | não | `h1` + `FaCalculator` → `PageHeader` |
| 17 | Evolução | `pages/Patrimonio/EvolucaoPage.js` | `/patrimonio/evolucao` | `StackedBarChartIcon` | não | não | `h1` manual → `PageHeader` |
| 18 | Patrimônio Histórico | `pages/Patrimonio/PatrimonioHistoricoPage.js` | `/patrimonio/historico` | `CalendarMonthIcon` | sim | não | `h1` manual → `PageHeader` |
| 19 | Importar OFX | `pages/Patrimonio/ImportacaoOFXPage.js` | `/patrimonio/importacoes-ofx` | `FileDownloadIcon` | sim | não | `h1` manual → `PageHeader` |
| 20 | Detalhe de Importação OFX | `pages/Patrimonio/ImportacaoOFXDetalhePage.js` | `/patrimonio/importacoes-ofx/:id` | `FileDownloadIcon` (herdado) | sim | não | `h1` manual → `PageHeader` |
| 21 | Transferências | `pages/Patrimonio/TransferenciasPage.js` | `/patrimonio/transferencias` | `SwapHorizIcon` | sim | não | `h1` + `FaExchangeAlt` → `PageHeader` |
| 22 | Faturas | `pages/Patrimonio/FaturasPage.js` | `/patrimonio/faturas` | `CalendarMonthIcon` | não | sim | `h1` + `FaCreditCard` → `PageHeader` |
| 23 | Open Finance | `pages/Pluggy/PluggyPage.js` | `/pluggy` | `HubIcon` | sim | não | já é `PageHeader`-like (`FaPlug` → `HubIcon`) |
| 24 | Empréstimos | `pages/Emprestimos/EmprestimosPage.js` | `/emprestimos` | `HandshakeIcon` | sim | não | `h2` manual → `PageHeader` |
| 25 | Detalhe de Empréstimo | `pages/Emprestimos/EmprestimoDetalhePage.js` | `/emprestimos/:id` | `HandshakeIcon` (herdado) | sim | não | `h2` manual → `PageHeader` |
| 26 | Pessoas | `pages/Pessoas/PessoasPage.js` | `/pessoas` | `ContactsIcon` | sim | não | `h2` manual → `PageHeader` |

Cada linha, no plano de implementação, vira uma edição pontual: importar `PageHeader` e o ícone MUI correto, substituir o bloco de título/subtítulo/ação atual pela chamada do componente, remover CSS de título que ficou órfão (ex: `.cg-relatorio__header` continua existindo só pra `margin-bottom`, mas as regras de `h1`/`color` específicas somem).

### Espaçamento — `.main-content`

Em `src/components/Layout/MainLayout.css:103`, reduzir `padding: 2rem` para `padding: 1.5rem` (afeta os 4 lados — topo, direita, baixo, esquerda — de forma consistente, sem criar assimetria).

## Testes

Sem testes automatizados de frontend (convenção do projeto). Verificação via smoke test manual: percorrer as 26 rotas com sidebar aberta/fechada, conferir que todas têm título grande + ícone + (quando existente) subtítulo no mesmo estilo visual do Pluggy, e que os botões de ação que existiam antes continuam funcionando no mesmo lugar.

## Riscos identificados

- Trocar `react-icons/fa` por `@mui/icons-material` em ~6 páginas (Pluggy, Patrimônio, Simulador, Transferências, Faturas) exige atenção pra não deixar import não utilizado (`FaPiggyBank` etc.) órfão no arquivo — remover o import antigo junto.
- `TagManagement.js` foi conferido: é usado só por `pages/Tags/Tags.js` — sem outros consumidores, migração segura.
- Duas páginas (`Relatorio.js`, `ContasFixas.js`, `PendenciasContasFixas.js`) trocam de `SectionHeader` para `PageHeader` — conferir que o `action` (botão) continua no lugar certo depois da troca.
