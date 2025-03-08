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
    // Redireciona para login apenas se for erro de token inválido/expirado
    if (error.response?.status === 401 && 
        error.response?.data?.erro?.includes('Token')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 