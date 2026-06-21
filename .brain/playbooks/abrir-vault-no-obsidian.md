---
type: playbook
status: active
created: 2026-06-21
tags: [obsidian, vault, setup]
---

# Como abrir o vault `.brain/` no Obsidian

> **TL;DR:** Abra **SÓ a pasta `.brain/`** como vault no Obsidian. Isso mantém o vault focado, o Graph View limpo e evita indexar arquivos do código.

## Por que abrir SÓ a `.brain/` e não a raiz

A pasta `.brain/` contém exclusivamente markdowns com frontmatter (notas de vault). Abrindo SÓ ela:

- **Foco:** o Obsidian trata tudo como "nota de conhecimento", não mistura com código
- **Graph view limpo:** só aparecem nós das decisões, sessões, contextos e playbooks
- **Performance:** não indexa `backend/`, `frontend/`, `node_modules/`, etc
- **Intenção clara:** o vault é separado do código, ainda que versionados juntos no Git

**Trade-off aceito:** wikilinks para arquivos do código (ex: `[[backend/app.js]]`) não funcionam. Se precisar referenciar código em uma nota, use caminho relativo em texto normal:

```markdown
Ver `backend/src/app.js:5-9` para detalhes do switch de env.
```

O código continua no mesmo repo Git (versionado junto), só não aparece no Obsidian.

## Pré-requisitos

- [Obsidian](https://obsidian.md/) instalado (grátis, qualquer plataforma)
- Acesso à pasta `C:\PROJETOS\newApp` (este projeto)

## Passo a passo

### 1. Abrir a pasta como vault

1. Abra o Obsidian
2. Na tela inicial, clique em **"Open folder as vault"**
3. Navegue até `C:\PROJETOS\newApp\.brain`
4. Selecione a pasta `.brain` (NÃO a raiz do projeto)
5. Dê um nome ao vault (ex: "Controle de Gastos - Memória")
6. Clique em **Open**

### 2. Configurações recomendadas

Após abrir, vá em **Settings** (engrenagem) e ajuste:

#### Files & Links

- ✅ **"Always update links"** — wikilinks `[[nota]]` sempre apontam pro arquivo certo, mesmo se renomear
- ✅ **"Use [[Wikilinks]]"** — facilita criar links entre notas
- **"New link format":** `Shortest path` (recomendado) ou `Absolute path in vault`
- **"Default location for new notes":** `In subfolder under current folder` (mantém organizado)

#### Appearance

- Opcional: **"Show inline title"** (gosto pessoal — mostra o nome da nota no topo)

#### Core plugins (deixe ativados)

- ✅ File explorer
- ✅ Search
- ✅ Graph view
- ✅ Backlinks
- ✅ Tags pane
- ✅ Daily notes (opcional — pode ser útil pra journal)

#### Community plugins (opcional, mas recomendado)

- **Templater** — criar templates de ADRs/sessões automaticamente
- **Dataview** — queries tipo SQL nas notas (ex: "listar todos os ADRs ativos")
- **Calendar** — visualização em calendário das sessões
- **Excalidraw** — diagramas à mão

### 3. Verificar que está tudo certo

1. Abra o **File Explorer** (Ctrl/Cmd + Shift + E)
2. Você deve ver **na raiz do vault** (que é a `.brain/`):
   - `README.md`
   - `decisions/`, `context/`, `sessions/`, `playbooks/`
3. Abra o `README.md` — deve aparecer com frontmatter `type: context` no topo
4. Abra o Graph View (Ctrl/Cmd + G) — deve mostrar 4-5 nós conectados (1 README + 4 notas modelo)

Se algo não aparecer, volte nas configurações e confira os toggles de "Detect all file extensions" e "Always update links".

## Dicas de uso

### Criar uma nota nova

1. Ctrl/Cmd + N
2. Escolha a pasta (decisions/context/sessions/playbooks)
3. Use o frontmatter padrão:

```yaml
---
type: <decisão | context | session | playbook>
status: active
created: <YYYY-MM-DD>
tags: [<tags>]
---
```

### Criar um ADR

1. Copie o template de `decisions/2026-06-21-usar-vault-como-memoria.md`
2. Renomeie pro padrão `YYYY-MM-DD-titulo-curto.md`
3. Preencha as seções (Contexto, Opções, Decisão, Consequências)
4. Adicione tags relevantes

### Linkar entre notas

Use `[[nome-da-nota]]` pra criar wikilinks. O Obsidian autocomplete ajuda.

Exemplo: na nota de uma sessão, referencie o ADR relacionado:

```markdown
Esta sessão implementou o ADR-001 (ver [[2026-06-21-usar-vault-como-memoria]]).
```

### Buscar

- **Quick switcher:** Ctrl/Cmd + O — abre nota por título
- **Search:** Ctrl/Cmd + Shift + F — busca full-text
- **Tag pane:** clique numa tag na barra lateral pra ver todas as notas com ela

## Troubleshooting

### "Não vejo a pasta `.brain/` no file explorer"

- Pode ser que o Obsidian esteja filtrando pastas ocultas. Vá em Settings → Files & Links → **Show all file extensions** (ou desmarque "Hide ignored files" se estiver usando `.gitignore`)
- Verifique se a pasta existe mesmo: rode `ls -la .brain/` no terminal

### "Os wikilinks não atualizam quando renomeio nota"

- Certifique-se que **"Always update links"** está ativado em Settings → Files & Links

### "Graph view está vazio"

- Aumente o **"Search depth"** no Graph View (slider na lateral) — pode estar em 1
- Se ainda assim estiver vazio, é porque as notas não têm wikilinks entre si ainda. Conforme você for criando notas e linkando, o grafo vai densificar

### "Posso sincronizar o vault entre máquinas?"

- Sim, mas precisa decidir a estratégia:
  - **Git:** commit `.brain/` no repo (recomendado pra este projeto, já que é o que fizemos)
  - **Obsidian Sync:** serviço pago do Obsidian, mas tem criptografia E2E e versionamento
  - **iCloud / Google Drive / Dropbox:** funciona, mas cuidado com conflitos de merge

## Manutenção

- **Mensalmente:** revise `.brain/context/stack.md` pra ver se ainda reflete a realidade
- **A cada decisão:** crie um ADR em `decisions/`
- **A cada sessão de planejamento:** crie uma nota em `sessions/`
- **A cada padrão recorrente:** crie um playbook em `playbooks/`

A regra é: **se você ia esquecer em 3 meses, escreva no vault agora**.
