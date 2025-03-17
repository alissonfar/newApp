import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert } from '@mui/material';
import api from '../../services/api';

const EmailNaoVerificado = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [mensagem, setMensagem] = useState('');

  const handleReenviarEmail = async () => {
    try {
      await api.post('/auth/reenviar-verificacao');
      setStatus('sucesso');
      setMensagem('Email de verificação reenviado com sucesso! Por favor, verifique sua caixa de entrada.');
    } catch (error) {
      setStatus('erro');
      setMensagem(error.response?.data?.message || 'Erro ao reenviar email de verificação.');
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      p={3}
    >
      <Typography variant="h5" gutterBottom>
        Email Não Verificado
      </Typography>

      <Typography variant="body1" textAlign="center" mb={3}>
        Para acessar esta área, é necessário verificar seu email.
        Por favor, verifique sua caixa de entrada ou solicite um novo email de verificação.
      </Typography>

      {status && (
        <Alert severity={status === 'sucesso' ? 'success' : 'error'} sx={{ mb: 2, width: '100%', maxWidth: 400 }}>
          {mensagem}
        </Alert>
      )}

      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleReenviarEmail}
        >
          Reenviar Email de Verificação
        </Button>

        <Button
          variant="outlined"
          onClick={() => navigate('/login')}
        >
          Voltar para Login
        </Button>
      </Box>
    </Box>
  );
};

export default EmailNaoVerificado; 