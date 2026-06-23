---
type: decision
status: active
created: 2026-06-23
tags: [tailwind, design-system, css]
---

# ADR-009: Tailwind `important: false` + tokens como fonte única

## Contexto

O projeto tinha Tailwind 4 com `important: true` em `tailwind.config.js`. Isso forçava `!important` em **todas** as classes Tailwind, criando guerra de especificidade com o MUI. Resultado: era difícil sobrescrever estilos Tailwind com CSS local (porque o `!important` sempre vencia), e o tema MUI tinha dificuldade para se impor sobre utilities Tailwind.

A modernização visual adotou tokens centralizados (`src/theme/tokens.js`) e o tema MUI como fonte de verdade (ADR-007). Tailwind deveria ser usado como utilitário pontual, não como fundação de estilo.

## Opções consideradas

- **Opção A:** Remover Tailwind do projeto. Mais radical, simplifica.
- **Opção B:** Manter `important: true` mas configurar ordem de CSS. Não resolve a guerra.
- **Opção C (escolhida):** `important: false` + `theme.extend` lendo de `tokens.js` + aliases no `tokens.css`.

## Decisão

**Opção C: Tailwind sem `!important` forçado, lendo dos tokens.**

Em `tailwind.config.js`:
- `important: false` — ordem CSS natural volta a funcionar
- `theme.extend.colors`, `borderRadius`, `spacing`, `fontFamily` lêem de `./src/theme/tokens.js` (via `require`)
- Utilitários como `bg-primary`, `rounded-md`, `p-base` continuam funcionando, mas agora não brigam com MUI
- Quem precisar de `!important` pontual usa explicitamente (raro)

Páginas que **dependiam** do `!important` do Tailwind (poucas) foram ajustadas na Fase 6 ou continuam com o mesmo comportamento (Tailwind sem `!important` ainda funciona, só respeita ordem natural).

## Consequências

- **Pró:**
  - Ordem CSS natural volta a funcionar — MUI > CSS local > Tailwind (cascade previsível)
  - Tailwind ainda disponível para utilitários pontuais (spacing, layout helpers)
  - Tokens são a fonte única de cores, espaçamentos, radii — Tailwind herda deles
- **Contra:**
  - Se algum dev tinha classe Tailwind sobrescrevendo MUI com força de `!important`, agora perde (raro, mas pode acontecer)
  - Risco de regressão sutil em estilos que dependiam de especificidade agressiva
- **Mitigação:**
  - Smoke test visual após a mudança (Fase 5) — verificado pelo executor que `nenhum !important forçado pelo Tailwind` apareceu na saída
  - Quem precisa de força usa `!important` explícito no próprio seletor

## Relacionado

- ADR-006 (estrutura de tokens)
- ADR-007 (tema MUI como fonte de verdade)
- Fase 5 do plano de modernização visual
