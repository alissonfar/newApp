import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';
import { FaEnvelope } from 'react-icons/fa';
import { solicitarRedefinicaoSenha } from '../../services/api';

const EsqueciSenha = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErro('Por favor, insira um email válido.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      await solicitarRedefinicaoSenha(email);
      setSucesso(true);
      toast.success('Email de redefinição enviado com sucesso!');
    } catch (error) {
      // Por segurança, não revelamos se o email existe ou não
      setSucesso(true);
      toast.success('Se o email existir em nossa base, você receberá as instruções para redefinição de senha.');
    } finally {
      setLoading(false);
    }
  };

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
          Esqueceu sua senha?
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }} align="center" color="text.secondary">
          Digite seu email e enviaremos instruções para redefinir sua senha.
        </Typography>

        {sucesso ? (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              Verifique seu email para as instruções de redefinição de senha.
            </Alert>
            <Button
              component={Link}
              to="/login"
              variant="contained"
              fullWidth
            >
              Voltar para Login
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
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              InputProps={{
                startAdornment: <FaEnvelope style={{ marginRight: 8 }} />
              }}
              sx={{ mb: 2 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ mb: 2 }}
            >
              {loading ? 'Enviando...' : 'Enviar Instruções'}
            </Button>

            <Button
              component={Link}
              to="/login"
              variant="text"
              fullWidth
            >
              Voltar para Login
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default EsqueciSenha; 