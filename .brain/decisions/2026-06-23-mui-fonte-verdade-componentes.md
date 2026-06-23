---
type: decision
status: active
created: 2026-06-23
tags: [theme, mui, design-system, componentes]
---

# ADR-007: Tema MUI como fonte de verdade para componentes base

## Contexto

MUI 6.4 já estava instalado no projeto, mas **sem `ThemeProvider` configurado**. Componentes MUI rodavam com tema default (cinza/roxo genérico). Cada página tinha seu próprio CSS local sobrescrevendo comportamentos do MUI, gerando inconsistência.

A modernização visual precisava unificar a aparência de:
- Botões (MUI Button vs Button custom em `shared/`)
- Inputs (MUI TextField vs input HTML puro)
- Cards (MuiCard vs div.glass-card)
- Dialogs (MuiDialog vs Modal custom)
- Menus, Tooltips, Tabs, etc

## Opções consideradas

- **Opção A:** Reescrever cada componente MUI usado (criar `Button`, `Input`, `Card` shared) e proibir uso direto do MUI.
- **Opção B:** Usar o tema MUI para sobrescrever `MuiButton`, `MuiCard`, etc, e permitir que devs usem tanto MUI direto quanto shared (escolhida).
- **Opção C:** Migrar para outra lib (shadcn/ui, Radix). Fora do escopo.

## Decisão

**Opção B: Tema MUI sobrescreve componentes base + componentes `shared/` opcionais.**

Em `src/theme/muiTheme.js`, `components.MuiButton`, `MuiCard`, `MuiPaper`, `MuiAppBar`, `MuiTextField`, `MuiOutlinedInput`, `MuiDialog`, `MuiMenu`, `MuiTooltip`, `MuiSwitch`, `MuiTab` recebem `styleOverrides` para alinhar com a família glass.

A pasta `src/components/shared/` tem wrappers (`Card`, `Button`, `Badge`, `SectionHeader`, `EmptyState`) que adicionam valor semântico (variantes `glass`, `default`, `elevated`; props de domínio). Quem usa `MuiButton` direto do MUI também fica consistente.

## Consequências

- **Pró:**
  - Componentes MUI herdam a "cara" do app automaticamente (qualquer `MuiButton` em página não refatorada fica consistente)
  - Componentes `shared/` adicionam valor (variantes semânticas, props de domínio) sem duplicar markup
  - Dev tem **uma escolha** — MUI direto (mais simples) ou `shared/` (mais poder). Os dois ficam alinhados
  - Migração gradual: páginas podem ir adotando `shared/` aos poucos
- **Contra:**
  - Dois caminhos pra mesma coisa (MUI vs shared) — confusão possível
  - Tema MUI é "mágico" (efeitos colaterais em componentes não usados explicitamente)
- **Mitigação:**
  - Documentado em `src/theme/README.md` (futuro) e nos comentários do `muiTheme.js`
  - Decisão consciente: shared é o "preferred" para novos componentes, MUI é aceitável para casos pontuais

## Relacionado

- ADR-006 (estrutura de tokens)
- Design doc seção "Tema MUI"
