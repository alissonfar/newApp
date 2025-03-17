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

export default api; 