---
type: decision
status: active
created: 2026-06-21
tags: [meta, git, powershell, committer, limitação]
---

# ADR-003: Commits sem corpo de mensagem (limitação PowerShell)

## Contexto

O `newapp-committer` (subagent do opencode) usa o bash tool para rodar comandos git. Quando tentamos commitar com mensagem estruturada (assunto + corpo), descobrimos que o PowerShell tem uma limitação:

```bash
git commit -m "feat(api): adiciona endpoint X

- Detalhe 1
- Detalhe 2"
```

O PowerShell **não preserva corretamente** as quebras de linha e caracteres especiais passados via flag `-m` múltipla. O commit resultante fica só com o assunto, sem corpo.

## Tentativas consideradas

### Opção A: `git commit -m "subject" -m "body"` com aspas escapadas
- Tentamos no setup inicial
- Resultado: corpo não aparece
- Veredito: ❌ não funciona

### Opção B: `git commit -m $'linha1\nlinha2'` (here-string PowerShell)
- PowerShell tem `$'...'` (semelhante ao bash here-string)?
- Não nativamente — `$'...'` é do bash, não funciona em PowerShell
- PowerShell usa backtick `` `n `` mas o opencode bash tool pode não preservar
- Veredito: ❌ não confiável

### Opção C: `git commit -F arquivo.txt` com arquivo temporário
- Committer gera a mensagem completa (assunto + corpo) num arquivo temp
- Usa `git commit -F tempfile`
- Vantagem: preserva UTF-8 + múltiplas linhas + quoting
- Desvantagem:
  - Precisa limpar o arquivo temp depois
  - Risco de vazar arquivo temp com credenciais (improvável, mas real)
  - Mais código = mais coisa pra quebrar
- Veredito: ✅ funciona, mas optamos por NÃO usar

### Opção D: Manter como está (assunto sem corpo)
- Assunto de até 72 chars, descritivo o suficiente
- Sem corpo, mas Conventional Commits ainda é respeitado no assunto
- O `git show` mostra a lista de arquivos, que dá contexto similar ao corpo
- Veredito: ✅ **escolhido**

## Decisão

**Mantemos o `newapp-committer` gerando commits só com assunto (sem corpo).**

A lógica é:
- Assunto descritivo de até 72 chars já carrega 80% do valor
- `git show` lista arquivos alterados, que dá contexto similar ao corpo
- Conventional Commits funciona perfeitamente só com assunto
- Reduz superfície de bugs (sem arquivo temp, sem here-string, sem quoting)
- Alisson (humano) prefere simplicidade

**Trade-off aceito:** perdemos o "porquê detalhado" no corpo do commit. Mas o "porquê" pode ser recuperado via:
- Vault `.brain/sessions/` (sessão que documenta a mudança)
- PR description quando o PR for aberto
- `git log -p` mostra o diff completo
- Código legível + testes = documenta melhor que corpo de commit

## Quando reconsiderar

Se algum dos critérios abaixo for verdade, **revisar esta decisão e implementar Opção C**:

- [ ] Alisson pede explicitamente commits com corpo
- [ ] Convenções da equipe/empresa exigem corpo de commit
- [ ] Auditoria de compliance exige "porquê" no commit
- [ ] Ferramenta de code review (ex: GitHub PR template) absorve o "porquê" e corpo vira redundante — manter como está

## Consequências

### Pró
- Committer simples e robusto
- Sem superfície de bug extra
- Conventional Commits respeitado (assunto + tipo + escopo)
- Alisson não precisa se preocupar com a limitação

### Contra
- `git log --oneline` não dá contexto completo (precisa de `git show` ou `git log -p`)
- Histórico do projeto fica mais "raso" — sem a narrativa do "porquê"

## Referências

- Agente: `.opencode/agents/newapp-committer.md`
- Issue original: reportada pelo próprio `newapp-committer` durante FASE 4 do setup
- ADR de origem: [`2026-06-21-sintaxe-permissoes-agentes-opencode.md`](./2026-06-21-sintaxe-permissoes-agentes-opencode.md)
