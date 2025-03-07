import React, { useState, useContext } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { loginUsuario } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import './Login.css';

function Login() {
  const { setToken, setUsuario } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const resposta = await loginUsuario({ email, senha });
      if (resposta.token) {
        // Armazena o token e o usuário no contexto
        setToken(resposta.token);
        setUsuario(resposta.usuario);
        toast.success('Login realizado com sucesso!');
        navigate('/'); // Redireciona para a página principal
      } else {
        toast.error(resposta.erro || 'Falha no login.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro interno ao fazer login.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Senha:</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-submit">Entrar</button>
        </form>
        <p className="link-registro">
          Não possui uma conta? <a href="/registro">Cadastre-se aqui</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
