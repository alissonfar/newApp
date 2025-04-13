# Guia de Estilização - Sistema Everest

## 1. Visão Geral do Design

Este documento descreve o sistema de design implementado nas páginas Everest, com foco na padronização de componentes, cores, tipografia e interações. A implementação segue princípios de design consistente, acessibilidade e responsividade.

## 2. Componentes Principais

### 2.1. Navegação e Cabeçalho

#### Breadcrumb
```css
.breadcrumb-nav {
  display: flex !important;
  align-items: center !important;
  background-color: white !important;
  padding: 8px 16px !important;
  border-radius: 8px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
  font-size: 0.9rem !important;
}
```

- **Estrutura HTML**: Um elemento `nav` contendo links e separadores
- **Elementos**: Link para página principal, separador "/", texto atual da página
- **Estilos**: Fundo branco, sombra sutil, cantos arredondados

#### Botão Voltar
```css
.back-button {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 10px 16px !important;
  background: linear-gradient(to right, #e6f0ff, #f0f7ff) !important;
  border: 1px solid #c2d9ff !important;
  border-radius: 8px !important;
  color: #2563eb !important;
}
```

- **Estrutura**: Link com ícone SVG e texto "Voltar"
- **Animação**: Transição ao passar o mouse, movimento para a esquerda (-3px)
- **Posicionamento**: Alinhado à direita do breadcrumb

### 2.2. Cards e Containers

#### Card de Item (Nota, Link, etc)
```css
.note-card {
  position: relative !important;
  background-color: white !important;
  border-radius: 10px !important;
  border-left: 4px solid #3b82f6 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  padding: 1.5rem !important;
  padding-right: 5rem !important;
  transition: all 0.2s ease !important;
  margin-bottom: 1rem !important;
}
```

- **Estados**: Animação hover com elevação e sombra
- **Elementos internos**: Título, conteúdo, tags, botões de ação
- **Variações de cor**: Borda esquerda colorida baseada na tag principal

#### Container de Estatísticas
```css
.notes-stats-container {
  background-color: white !important;
  border-radius: 0.75rem !important;
  border: 1px solid #f3f4f6 !important;
  padding: 1.25rem !important;
  margin-bottom: 1.5rem !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05) !important;
}
```

- **Estrutura interna**: Cabeçalho, grid de estatísticas, lista de tags populares
- **Estilo**: Fundo branco, bordas sutis, sombra leve

### 2.3. Formulários e Controles

#### Barra de Pesquisa
```css
.notes-search-bar {
  position: relative !important;
  flex-grow: 1 !important;
}

.notes-search-input {
  width: 100% !important;
  padding: 0.75rem 1rem 0.75rem 2.75rem !important;
  border-radius: 0.75rem !important;
  border: 1px solid #e5e7eb !important;
}
```

- **Estrutura**: Input com ícone de lupa posicionado à esquerda
- **Estados**: Focus com borda azul e sombra
- **Responsividade**: Largura de 100% em mobile

#### Botão de Adicionar
```css
.notes-add-button {
  background: linear-gradient(to right, #2563eb, #3b82f6) !important;
  color: white !important;
  border-radius: 0.75rem !important;
  padding: 0.75rem 1.25rem !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
}
```

- **Estilo**: Gradiente azul, texto branco, ícone de adição
- **Animação**: Elevação e sombra ao passar o mouse
- **Responsividade**: Em mobile, fica abaixo da barra de pesquisa

### 2.4. Modais e Overlays

#### Modal Padrão
```css
.note-modal-overlay {
  position: fixed !important;
  top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
  background-color: rgba(0, 0, 0, 0.5) !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  z-index: 1000 !important;
}

.note-modal {
  background-color: #fff !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  width: 95% !important;
  max-width: 600px !important;
}
```

- **Estrutura**: Overlay com fundo semi-transparente + container modal
- **Elementos**: Cabeçalho, corpo, rodapé
- **Comportamento**: Centralizado na tela, máximo de 95% da largura

#### Modal de Confirmação para Exclusão
```css
.delete-confirm-modal {
  background-color: #fff !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12) !important;
  width: 95% !important;
  max-width: 450px !important;
  animation: fadeInScale 0.2s ease-out !important;
}
```

- **Elementos especiais**: Ícone de alerta, título destacado, texto de aviso
- **Estilo**: Header com fundo vermelho claro, texto de aviso em destaque
- **Botões**: "Cancelar" (cinza) e "Sim, excluir" (vermelho)

## 3. Botões de Ação

### 3.1. Botões Padrão do Sistema

#### Botão Primário
```css
.note-save-button {
  background-color: #007bff !important;
  border: 1px solid #007bff !important;
  color: white !important;
  padding: 8px 16px !important;
  border-radius: 4px !important;
}
```

#### Botão Secundário
```css
.note-cancel-button {
  background-color: #f8f9fa !important;
  border: 1px solid #ced4da !important;
  color: #495057 !important;
}
```

### 3.2. Botões de Ação em Cards

```css
.note-action-button {
  width: 42px !important;
  height: 42px !important;
  border-radius: 10px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.note-edit-button {
  background-color: #f5f3ff !important;
  border: 1px solid #e0e7ff !important;
}

.note-delete-button {
  background-color: #fef2f2 !important;
  border: 1px solid #fee2e2 !important;
}
```

- **Elementos**: Ícone SVG centralizado + tooltip ao passar o mouse
- **Estados**: Opacidade reduzida quando card em repouso, 100% no hover
- **Animação**: Elevação com transform: translateY(-3px)
- **Acessibilidade**: Textos explicativos com .sr-only para leitores de tela

## 4. Paleta de Cores

```
Cores Primárias:
- Azul principal: #3b82f6 (botões, links, destaques)
- Azul escuro: #2563eb (hover, gradientes)
- Azul claro: #dbeafe (backgrounds sutis)

Cores de Ação:
- Vermelho: #ef4444 (exclusão, alertas)
- Roxo: #4f46e5 (edição, destaques secundários)

Cores Neutras:
- Texto escuro: #1f2937
- Texto médio: #4b5563
- Texto claro: #6b7280
- Bordas: #e5e7eb
- Fundo: #f9fafc
- Branco: #ffffff
```

## 5. Tipografia

```
Fontes:
- Sistema padrão: system-ui, -apple-system, sans-serif

Tamanhos:
- Títulos maiores: 2rem (32px)
- Títulos médios: 1.2rem (19.2px)
- Título de cards: 1.1rem (17.6px)
- Texto normal: 0.95rem (15.2px)
- Texto pequeno: 0.85rem (13.6px)
- Texto muito pequeno: 0.75rem (12px)

Pesos:
- Regular: 400
- Medium: 500
- Semibold: 600
```

## 6. Elementos da Interface

### 6.1. Tags e Etiquetas

```css
.note-tag {
  font-size: 0.75rem !important;
  padding: 4px 10px !important;
  border-radius: 20px !important;
  background-color: #f3f4f8 !important;
  color: #4f46e5 !important;
  font-weight: 500 !important;
  border: 1px solid #e5e7eb !important;
}
```

- **Aparência**: Pill shape (border-radius grande), fundo sutil
- **Animação**: Elevação sutil ao passar o mouse
- **Variações**: As cores podem variar conforme a categoria (ver mapa de cores)

### 6.2. Estados da Interface

#### Estado Vazio
```css
.notes-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  background-color: var(--bg-element);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
  text-align: center;
}
```

- **Elementos**: Ícone representativo, texto explicativo, botão de ação
- **Estilo**: Centralizado, borda tracejada, fundo sutil

#### Estado de Carregamento
```css
.notes-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-secondary);
}
```

- **Elementos**: Ícone de spinner animado, texto "Carregando..."
- **Estilo**: Centralizado, cores suaves

## 7. Atalhos e Acessibilidade

### 7.1. Atalhos de Teclado
- **Modal**: Esc para fechar, Ctrl+Enter para salvar
- **Dicas visuais**: Texto no rodapé dos modais indicando atalhos disponíveis

### 7.2. Acessibilidade
```css
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border-width: 0 !important;
}
```

- **Textos para leitores de tela**: Descrições detalhadas com classe sr-only
- **ARIA attributes**: aria-label nos botões e elementos interativos
- **Tooltips**: Informações adicionais ao passar o mouse

## 8. Responsividade

```css
@media (max-width: 768px) {
  .everest-page section {
    padding: 1rem !important;
  }
  
  .everest-page .header-banner {
    padding: 1.5rem !important;
  }
}

@media (max-width: 640px) {
  .everest-page .notes-stats-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  
  .note-actions {
    position: static;
    margin-top: 1rem;
    justify-content: flex-end;
  }
}
```

- **Breakpoints principais**: 768px (tablet), 640px (mobile)
- **Adaptações**: Espaçamentos reduzidos, grid simplificado, posicionamento de botões

## 9. Animações e Transições

```css
/* Exemplos de animações */
@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transições padrão */
transition: all 0.2s ease !important;
```

- **Hover**: Escala, elevação, alteração de cor
- **Modais**: Entrada com fade + escala
- **Botões**: Movimento suave em hover

## 10. Implementação para Novas Páginas

Para implementar o estilo em uma nova página (como `/everest/links`):

1. Usar a mesma estrutura básica:
   - Breadcrumb + botão voltar
   - Container principal com fundo #f9fafc
   - Barra de pesquisa + botão adicionar
   - Lista de cards para os itens
   
2. Adaptar os nomes das classes:
   - Substituir `note-` por `link-` nos prefixos
   - Manter a mesma estrutura de CSS
   
3. Manter consistência nos elementos:
   - Mesmas cores para ações similares
   - Mesmos espaçamentos e tamanhos
   - Manter comportamentos interativos similares

4. Exemplo de adaptação para Links:
   ```css
   .link-card {
     /* Mesmas propriedades que .note-card */
   }
   
   .link-edit-button {
     /* Mesmas propriedades que .note-edit-button */
   }
   ```

## 11. Prevenção de Bugs Visuais

Para evitar problemas com SVGs ou outros elementos visuais:
   
```css
/* Esconder SVGs não desejados */
body > svg, 
main > svg,
div > svg:not([class]) {
  display: none !important;
  visibility: hidden !important;
  /* outras propriedades... */
}
```

## 12. Conclusão

Este guia de estilização fornece uma base sólida para manter a consistência visual em todas as páginas do sistema Everest. Os componentes foram projetados para serem reutilizáveis, acessíveis e responsivos, garantindo uma experiência de usuário de alta qualidade.

Ao criar novas páginas, mantenha a consistência nos padrões de cores, espaçamentos, tipografia e interações descritos neste documento. 