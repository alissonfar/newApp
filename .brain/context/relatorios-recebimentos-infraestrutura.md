---
type: context
status: active
created: 2026-08-31
tags: [relatorios, recebimentos, settlement, pdf, pessoa]
---

# Infraestrutura de Relatórios, Recebimentos e Pessoa — o que já existe

> Mapeado durante o brainstorm do módulo Fechamento (2026-08-31). Registrado aqui porque nenhum
> desses fatos estava documentado antes e são reutilizáveis para qualquer trabalho futuro nessas
> áreas — evita reabrir a mesma investigação de código.

## "Recebimentos" na UI = módulo `Settlement` no código

O menu "Recebimentos" (`/recebimentos/novo`, `/recebimentos/historico`) e o model/service internos
se chamam `Settlement`/`settlementService.js` — não "Recebimento". Um `Settlement` concilia uma
transação `recebivel` (`receivingTransactionId`) contra N transações `gasto` pendentes
(`appliedTransactions`), aplicando uma tag em cada uma. É uma ação pontual de conciliação — não tem
conceito de período nem de "pessoa dona do settlement": o vínculo com pessoa é indireto, via
`pagamentos.pessoa` da transação de recebimento.

`settlementService.js` já resolve o casamento "nome de pessoa (string) ↔ transações" via
`RegExp('^' + nome + '$', 'i')` sobre `Transacao.pagamentos.pessoa` — é o padrão de referência pra
qualquer feature nova que precise filtrar transações por pessoa sem um vínculo de schema direto
(usado como base do módulo Fechamento).

## Exportação de PDF já existe e é client-side

`@react-pdf/renderer` (frontend) já gera PDF de relatório — `utils/export/exportPDF.js` +
`components/PDF/{ReportDocument,ReportHeader,ReportFilters,ReportSummary,ReportTable,ReportFooter}.js`.
`exportDataToPDF(data, filterDetails, summaryInfo, categorias, tags, filename, templateUsed)` monta
o Blob via `pdf(<ReportDocument .../>).toBlob()` e dispara o download. **Nenhuma feature nova deveria
reimplementar geração de PDF** — só alimentar `ReportDocument` com os dados certos.

Exportação CSV (`utils/export/exportData.js`, `exportDataToCSV`) também é client-side, formata moeda
BR e datas automaticamente por heurística de nome de coluna (`valor`/`total`/`price`,
`data`/`date`). `exportDataToExcel` existe só como stub comentado (requer `xlsx`, nunca ativado).

**Não existe exportação em lote/zip** de nenhum tipo hoje — qualquer necessidade disso é capacidade
nova (mas a geração de PDF em si, individual, já está pronta pra ser chamada em loop).

## `ModeloRelatorio` é global, não por pessoa

`ModeloRelatorio` (regras de tag + `aggregation: 'default'|'devedor'`) é escopado só por `usuario`,
não por pessoa. O `reportEngine` (`backend/src/reportEngine/index.js`) aceita `templateId` no
formato `modelo-{id}` pra usar um modelo customizado, ou os templates built-in (`getTemplate`).
`generateReport({ templateId, filters, userId })` devolve `{ rows, summary, filterDetails,
templateUsed, templateName }` — motor pronto e reaproveitável por qualquer tela que precise gerar
relatório com filtro de período/pessoa/tags.

## Model `Pessoa` existe mas é subutilizado

`backend/src/models/pessoa.js`: `{ usuario, nome, contato, observacoes, ativo }`, índice único
`usuario+nome`. Hoje só é consumido pela tela `/pessoas` (dentro da seção Empréstimos da sidebar).
**Não é a mesma coisa que `Transacao.pagamentos[].pessoa`** (que é string livre, sem FK) — os dois
convivem sem vínculo de schema; o casamento entre eles é sempre por nome, em tempo de consulta
(nunca por `ObjectId` gravado em `Transacao`).
