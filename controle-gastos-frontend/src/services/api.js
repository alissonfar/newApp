import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE
});

// Interceptor para adicionar o token em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  response => response,
  error => {
    // Redireciona para login se for erro de autenticação (401)
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Usa a URL de redirecionamento fornecida pelo backend ou fallback para /login
      const redirectUrl = error.response?.data?.redirectUrl || '/login';
      window.location.href = redirectUrl;
    }
    return Promise.reject(error);
  }
);

// Função para verificação de email
export const verificarEmail = async (token) => {
  try {
    const response = await api.get(`/usuarios/verificar-email/${token}`);
    return response.data;
  } catch (error) {
    // Se o erro for 400 e o email já foi verificado, retornamos sucesso
    if (error.response?.status === 400 && 
        error.response?.data?.erro === "Token de verificação inválido ou expirado." &&
        error.response?.data?.emailVerificado) {
      return { mensagem: "Email já foi verificado anteriormente!" };
    }
    throw error.response?.data || error;
  }
};

// Função para reenviar email de verificação
export const reenviarVerificacaoEmail = async (email) => {
  try {
    const response = await api.post('/usuarios/reenviar-verificacao', { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Função para solicitar redefinição de senha
export const solicitarRedefinicaoSenha = async (email) => {
  try {
    const response = await api.post('/usuarios/esqueci-senha', { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Função para verificar token de redefinição
export const verificarTokenRedefinicao = async (token) => {
  try {
    const response = await api.get(`/usuarios/redefinir-senha/${token}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Função para redefinir a senha
export const redefinirSenha = async (token, novaSenha) => {
  try {
    const response = await api.post(`/usuarios/redefinir-senha/${token}`, { novaSenha });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Função para login do usuário
export const loginUsuario = async (dados) => {
  try {
    const response = await api.post('/usuarios/login', dados);
    return response.data;
  } catch (error) {
    if (error.response?.data?.erro === 'Email não verificado') {
      // Retornamos um objeto especial para indicar que o email não está verificado
      return {
        emailNaoVerificado: true,
        usuario: { email: dados.email },
        erro: 'Email não verificado'
      };
    }
    throw error.response?.data || error;
  }
};

export default api;

// Funções de API para importação
export const importacaoApi = {
  // Criar nova importação
  criar: async (dados) => {
    try {
      const response = await api.post('/importacoes', dados);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload de arquivo
  uploadArquivo: async (importacaoId, arquivo) => {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const response = await api.post(`/importacoes/${importacaoId}/arquivo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Obter detalhes de uma importação
  obter: async (importacaoId) => {
    try {
      const response = await api.get(`/importacoes/${importacaoId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Listar todas as importações
  listar: async () => {
    try {
      const response = await api.get('/importacoes');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Listar transações de uma importação
  listarTransacoes: async (importacaoId) => {
    try {
      const response = await api.get(`/importacoes/${importacaoId}/transacoes`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Salvar uma transação da importação
  salvarTransacao: async (importacaoId, transacaoId, dados) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/transacoes/${transacaoId}`, dados);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Finalizar importação
  finalizar: async (importacaoId) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/finalizar`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
}; 