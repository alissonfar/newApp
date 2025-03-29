import React, { createContext, useContext, useReducer } from 'react';

// Estado inicial
const initialState = {
  importacaoAtual: null, // Detalhes da importação atual
  transacoes: [],       // Lista de transações da importação
  progresso: {
    total: 0,
    salvas: 0,
    pendentes: 0
  },
  filtros: {
    data: null,
    valor: null,
    ordenacao: 'data'
  }
};

// Tipos de ações
const ACTIONS = {
  INICIAR_IMPORTACAO: 'INICIAR_IMPORTACAO',
  ATUALIZAR_TRANSACOES: 'ATUALIZAR_TRANSACOES',
  ATUALIZAR_PROGRESSO: 'ATUALIZAR_PROGRESSO',
  ATUALIZAR_FILTROS: 'ATUALIZAR_FILTROS',
  SALVAR_TRANSACAO: 'SALVAR_TRANSACAO',
  LIMPAR_IMPORTACAO: 'LIMPAR_IMPORTACAO'
};

// Reducer para gerenciar as ações
function importacaoReducer(state, action) {
  switch (action.type) {
    case ACTIONS.INICIAR_IMPORTACAO:
      return {
        ...state,
        importacaoAtual: action.payload,
        transacoes: [],
        progresso: {
          total: 0,
          salvas: 0,
          pendentes: 0
        }
      };

    case ACTIONS.ATUALIZAR_TRANSACOES:
      return {
        ...state,
        transacoes: action.payload,
        progresso: {
          total: action.payload.length,
          salvas: action.payload.filter(t => t.status === 'salva').length,
          pendentes: action.payload.filter(t => t.status === 'pendente').length
        }
      };

    case ACTIONS.ATUALIZAR_PROGRESSO:
      return {
        ...state,
        progresso: {
          ...state.progresso,
          ...action.payload
        }
      };

    case ACTIONS.ATUALIZAR_FILTROS:
      return {
        ...state,
        filtros: {
          ...state.filtros,
          ...action.payload
        }
      };

    case ACTIONS.SALVAR_TRANSACAO:
      const transacoesAtualizadas = state.transacoes.map(t => 
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      );
      return {
        ...state,
        transacoes: transacoesAtualizadas,
        progresso: {
          ...state.progresso,
          salvas: transacoesAtualizadas.filter(t => t.status === 'salva').length,
          pendentes: transacoesAtualizadas.filter(t => t.status === 'pendente').length
        }
      };

    case ACTIONS.LIMPAR_IMPORTACAO:
      return initialState;

    default:
      return state;
  }
}

// Criar o Context
const ImportacaoContext = createContext();

// Provider Component
export function ImportacaoProvider({ children }) {
  const [state, dispatch] = useReducer(importacaoReducer, initialState);

  // Funções auxiliares para dispatch de ações
  const iniciarImportacao = (dados) => {
    dispatch({ type: ACTIONS.INICIAR_IMPORTACAO, payload: dados });
  };

  const atualizarTransacoes = (transacoes) => {
    dispatch({ type: ACTIONS.ATUALIZAR_TRANSACOES, payload: transacoes });
  };

  const atualizarProgresso = (progresso) => {
    dispatch({ type: ACTIONS.ATUALIZAR_PROGRESSO, payload: progresso });
  };

  const atualizarFiltros = (filtros) => {
    dispatch({ type: ACTIONS.ATUALIZAR_FILTROS, payload: filtros });
  };

  const salvarTransacao = (transacao) => {
    dispatch({ type: ACTIONS.SALVAR_TRANSACAO, payload: transacao });
  };

  const limparImportacao = () => {
    dispatch({ type: ACTIONS.LIMPAR_IMPORTACAO });
  };

  const value = {
    state,
    iniciarImportacao,
    atualizarTransacoes,
    atualizarProgresso,
    atualizarFiltros,
    salvarTransacao,
    limparImportacao
  };

  return (
    <ImportacaoContext.Provider value={value}>
      {children}
    </ImportacaoContext.Provider>
  );
}

// Hook personalizado para usar o context
export function useImportacao() {
  const context = useContext(ImportacaoContext);
  if (!context) {
    throw new Error('useImportacao deve ser usado dentro de um ImportacaoProvider');
  }
  return context;
} 