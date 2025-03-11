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

export default api; 