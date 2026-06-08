import api from './api';

const importacaoService = {
  // Criar nova importação (modo legado: FormData com arquivo)
  criarImportacao: async (formData) => {
    try {
      const response = await api.post('/importacoes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error('Erro ao criar importação: ' + error.message);
    }
  },

  // Phase 3+4: Analisar arquivo e retornar metadados inferidos (não persiste)
  previewArquivo: async (file) => {
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const response = await api.post('/importacoes/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.erro || error.response?.data?.mensagem || error.message;
      throw new Error(msg);
    }
  },

  // Phase 3+4: Confirmar preview (criar Importacao a partir de previewId)
  confirmarPreview: async ({ previewId, descricao, tipoImportacao, tagsPadrao }) => {
    try {
      const body = { previewId, descricao };
      if (tipoImportacao) body.tipoImportacao = tipoImportacao;
      if (tagsPadrao && Object.keys(tagsPadrao).length > 0) {
        body.tagsPadrao = tagsPadrao;
      }
      const response = await api.post('/importacoes', body, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.erro || error.response?.data?.mensagem || error.message;
      throw new Error(msg);
    }
  },

  // Phase 3+4: Cancelar preview
  cancelarPreview: async (previewId) => {
    try {
      await api.delete(`/importacoes/preview/${previewId}`);
    } catch (e) { /* silencioso */ }
  },

  // Listar importações
  listarImportacoes: async (page = 1, limit = 10) => {
    try {
      const response = await api.get(`/importacoes?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao listar importações: ' + error.message);
    }
  },

  // Obter detalhes de uma importação
  obterImportacao: async (id) => {
    try {
      const response = await api.get(`/importacoes/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao obter detalhes da importação: ' + error.message);
    }
  },

  // Excluir uma importação
  excluirImportacao: async (id) => {
    try {
      const response = await api.delete(`/importacoes/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao excluir importação: ' + error.message);
    }
  },

  // Listar transações de uma importação
  // Opções: { page, limit, status, status_not } - status_not exclui transações com esse status (ex: 'ja_importada')
  listarTransacoes: async (importacaoId, page = 1, limit = 1000, options = {}) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (options.status) params.append('status', options.status);
      if (options.status_not) params.append('status_not', options.status_not);
      const response = await api.get(`/importacoes/${importacaoId}/transacoes?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao listar transações da importação: ' + error.message);
    }
  },

  // Validar uma transação
  validarTransacao: async (importacaoId, transacaoId) => {
    try {
      const response = await api.post(`/importacoes/transacoes/${transacaoId}/validar`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao validar transação: ' + error.message);
    }
  },

  // Validar múltiplas transações
  validarMultiplas: async (importacaoId, transacoesIds) => {
    try {
      const response = await api.post(`/importacoes/${importacaoId}/transacoes/validar-multiplas`, {
        ids: transacoesIds
      });
      return response.data;
    } catch (error) {
      throw new Error('Erro ao validar transações: ' + error.message);
    }
  },

  // Atualizar uma transação
  atualizarTransacao: async (importacaoId, transacaoId, dados) => {
    try {
      if (!importacaoId) {
        throw new Error('ID da importação é obrigatório');
      }

      if (!transacaoId) {
        throw new Error('ID da transação é obrigatório');
      }
      
      // Usando a rota correta do backend
      const response = await api.put(`/importacoes/transacoes/${transacaoId}`, {
        ...dados,
        importacao: importacaoId
      });

      return response.data;
    } catch (error) {
      console.error('Erro na requisição de atualização:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw new Error('Erro ao atualizar transação: ' + (error.response?.data?.message || error.message));
    }
  },

  // Marcar transação com erro
  marcarErro: async (importacaoId, transacaoId, mensagemErro) => {
    try {
      const response = await api.post(`/importacoes/${importacaoId}/transacoes/${transacaoId}/erro`, {
        erro: mensagemErro
      });
      return response.data;
    } catch (error) {
      throw new Error('Erro ao marcar transação com erro: ' + error.message);
    }
  },

  // Ações em massa
  acoesMassa: async (ids, acao) => {
    try {
      const response = await api.post('/importacoes/transacoes/acoes-massa', { ids, acao });
      return response.data;
    } catch (error) {
      const mensagem = error.response?.data?.erro || error.message;
      throw new Error(mensagem);
    }
  },

  // Excluir uma transação importada (marca como ignorada)
  excluirTransacao: async (transacaoId) => {
    try {
      // A rota correta é /importacoes/transacoes/:id - backend retorna 204 No Content em sucesso
      await api.delete(`/importacoes/transacoes/${transacaoId}`);
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao excluir transação:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      // Retorna a mensagem de erro do backend, se disponível
      const mensagemErro = error.response?.data?.erro || 'Erro ao excluir transação.';
      throw new Error(mensagemErro);
    }
  },

  // Restaurar transação (reverte ignorada/ja_importada para pendente)
  restaurarTransacao: async (transacaoId) => {
    try {
      const response = await api.post(`/importacoes/transacoes/${transacaoId}/restaurar`);
      return response.data;
    } catch (error) {
      const mensagem = error.response?.data?.erro || error.message;
      throw new Error(mensagem);
    }
  },

  // Finalizar importação (opcional: { subcontaId, saldo } para atualizar saldo de subconta)
  finalizarImportacao: async (importacaoId, opts = {}) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/finalizar`, opts);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao finalizar importação: ' + error.message);
    }
  },

  // Estornar importação
  estornarImportacao: async (importacaoId) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/estornar`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao estornar importação: ' + error.message);
    }
  },

  // Duplicar importação
  duplicarImportacao: async (importacaoId) => {
    try {
      const response = await api.post(`/importacoes/${importacaoId}/duplicate`);
      return response.data;
    } catch (error) {
      const mensagem = error.response?.data?.erro || error.message;
      throw new Error(mensagem);
    }
  },

  // Importar transações do Open Finance (Pluggy)
  importarDaPluggy: async (opcoes = {}) => {
    try {
      const response = await api.post('/importacoes/from-pluggy', opcoes);
      return response.data;
    } catch (error) {
      const mensagem = error.response?.data?.erro || error.message;
      throw new Error(mensagem);
    }
  },

  // Preview de importação do Open Finance (Pluggy)
  previewPluggy: async (dados) => {
    try {
      const response = await api.post('/importacoes/preview-pluggy', dados);
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.erro || error.response?.data?.mensagem || error.message;
      throw new Error(msg);
    }
  }
};

export default importacaoService; 