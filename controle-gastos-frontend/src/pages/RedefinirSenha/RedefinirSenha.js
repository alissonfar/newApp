import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Box, Typography, TextField, Button, Alert, Paper, CircularProgress } from '@mui/material';
import { FaLock } from 'react-icons/fa';
import { verificarTokenRedefinicao, redefinirSenha } from '../../services/api';

const RedefinirSenha = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificandoToken, setVerificandoToken] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const verificarToken = async () => {
      try {
        await verificarTokenRedefinicao(token);
        setTokenValido(true);
      } catch (error) {
        setErro('Token inválido ou expirado. Por favor, solicite uma nova redefinição de senha.');
        toast.error('Token inválido ou expirado.');
      } finally {
        setVerificandoToken(false);
      }
    };

    if (token) {
      verificarToken();
    } else {
      setVerificandoToken(false);
      setErro('Token não fornecido.');
    }
  }, [token]);

  const validarSenha = (senha) => {
    return senha.length >= 6;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (!validarSenha(novaSenha)) {
      setErro('A senha deve conter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await redefinirSenha(token, novaSenha);
      toast.success('Senha redefinida com sucesso!');
      navigate('/login');
    } catch (error) {
      setErro(error.response?.data?.message || 'Erro ao redefinir senha. Por favor, tente novamente.');
      toast.error('Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  if (verificandoToken) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          borderRadius: 2
        }}
      >
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Redefinir Senha
        </Typography>

        {!tokenValido ? (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {erro}
            </Alert>
            <Button
              onClick={() => navigate('/esqueci-senha')}
              variant="contained"
              fullWidth
            >
              Solicitar Nova Redefinição
            </Button>
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            {erro && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {erro}
              </Alert>
            )}

            <TextField
              fullWidth
              type="password"
              label="Nova Senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              InputProps={{
                startAdornment: <FaLock style={{ marginRight: 8 }} />
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="password"
              label="Confirmar Nova Senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              InputProps={{
                startAdornment: <FaLock style={{ marginRight: 8 }} />
              }}
              sx={{ mb: 2 }}
            />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              A senha deve conter pelo menos 6 caracteres.
            </Typography>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default RedefinirSenha; 