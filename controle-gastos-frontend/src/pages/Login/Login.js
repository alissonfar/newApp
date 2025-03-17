import React, { useState, useContext } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import { FaEnvelope, FaLock, FaSpinner } from 'react-icons/fa';
import { loginUsuario } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import './Login.css';

function Login() {
  const { setToken, setUsuario, atualizarStatusEmail } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email inválido';
    }
    if (!senha) {
      newErrors.senha = 'Senha é obrigatória';
    } else if (senha.length < 6) {
      newErrors.senha = 'A senha deve ter pelo menos 6 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const resposta = await loginUsuario({ email, senha });
      if (resposta.token) {
        setToken(resposta.token);
        setUsuario(resposta.usuario);
        atualizarStatusEmail(resposta.usuario.emailVerificado || false);

        if (!resposta.usuario.emailVerificado) {
          toast.warning('Por favor, verifique seu email antes de continuar.');
          navigate('/email-nao-verificado');
          return;
        }

        toast.success('Login realizado com sucesso!');
        navigate('/');
      } else {
        toast.error(resposta.erro || 'Falha no login.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro interno ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className={`form-group ${errors.email ? 'error' : ''}`}>
            <label>Email:</label>
            <div className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    const newErrors = { ...errors };
                    delete newErrors.email;
                    setErrors(newErrors);
                  }
                }}
                placeholder="Seu email"
                required
              />
            </div>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          <div className={`form-group ${errors.senha ? 'error' : ''}`}>
            <label>Senha:</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type="password"
                value={senha}
                onChange={e => {
                  setSenha(e.target.value);
                  if (errors.senha) {
                    const newErrors = { ...errors };
                    delete newErrors.senha;
                    setErrors(newErrors);
                  }
                }}
                placeholder="Sua senha"
                required
              />
            </div>
            {errors.senha && <span className="error-message">{errors.senha}</span>}
          </div>
          <div className="form-links">
            <Link to="/esqueci-senha" className="forgot-password-link">
              Esqueci minha senha
            </Link>
          </div>
          <button 
            type="submit" 
            className={`btn-submit ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="spinner" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
        <p className="link-registro">
          Não possui uma conta? <Link to="/registro">Cadastre-se aqui</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
