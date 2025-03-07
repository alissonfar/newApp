import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { registrarUsuario } from '../../api';
import './Registro.css';

function Registro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const navigate = useNavigate();

  const handleRegistro = async (e) => {
    e.preventDefault();
    try {
      const resposta = await registrarUsuario({ nome, email, senha });
      if (resposta.mensagem) {
        toast.success(resposta.mensagem);
        navigate('/login'); // Redireciona para a página de login após o registro
      } else {
        toast.error(resposta.erro || 'Falha no registro.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro interno ao registrar.');
    }
  };

  return (
    <div className="registro-container">
      <div className="registro-card">
        <h2>Registro</h2>
        <form onSubmit={handleRegistro}>
          <div className="form-group">
            <label>Nome:</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
            />
          </div>
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
          <button type="submit" className="btn-submit">Cadastrar</button>
        </form>
        <p className="link-login">
          Já possui uma conta? <a href="/login">Faça login</a>
        </p>
      </div>
    </div>
  );
}

export default Registro;
