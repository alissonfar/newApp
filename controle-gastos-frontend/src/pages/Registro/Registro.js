import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaSpinner } from 'react-icons/fa';
import { registrarUsuario } from '../../api';
import './Registro.css';

function Registro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!nome) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }
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

  const handleRegistro = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const resposta = await registrarUsuario({ nome, email, senha });
      if (resposta.mensagem) {
        toast.success(resposta.mensagem);
        navigate('/login');
      } else {
        toast.error(resposta.erro || 'Falha no registro.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro interno ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registro-container">
      <div className="registro-card">
        <h2>Criar Conta</h2>
        <form onSubmit={handleRegistro} className="registro-form">
          <div className={`form-group ${errors.nome ? 'error' : ''}`}>
            <label>Nome:</label>
            <div className="input-group">
              <FaUser className="input-icon" />
              <input
                type="text"
                value={nome}
                onChange={e => {
                  setNome(e.target.value);
                  if (errors.nome) {
                    const newErrors = { ...errors };
                    delete newErrors.nome;
                    setErrors(newErrors);
                  }
                }}
                placeholder="Seu nome completo"
                required
              />
            </div>
            {errors.nome && <span className="error-message">{errors.nome}</span>}
          </div>
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
                placeholder="Seu melhor email"
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
                placeholder="Crie uma senha forte"
                required
              />
            </div>
            {errors.senha && <span className="error-message">{errors.senha}</span>}
          </div>
          <button 
            type="submit" 
            className={`btn-submit ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="spinner" />
                Criando conta...
              </>
            ) : (
              'Criar Conta'
            )}
          </button>
        </form>
        <p className="link-login">
          Já possui uma conta? <a href="/login">Faça login</a>
        </p>
      </div>
    </div>
  );
}

export default Registro;
