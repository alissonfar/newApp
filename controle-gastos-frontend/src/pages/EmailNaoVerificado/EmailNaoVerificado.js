import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, Button, Box, CircularProgress, Alert } from '@mui/material';
import { reenviarVerificacaoEmail } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const EmailNaoVerificado = () => {
  const navigate = useNavigate();
  const { usuario } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [mensagem, setMensagem] = useState('');

  const handleReenviarEmail = async () => {
    if (!usuario?.email) {
      toast.error('Email não encontrado. Por favor, faça login novamente.');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await reenviarVerificacaoEmail(usuario.email);
      setStatus('success');
      setMensagem(response.mensagem || 'Email de verificação reenviado com sucesso! Por favor, verifique sua caixa de entrada.');
      toast.success('Email de verificação reenviado!');
    } catch (error) {
      setStatus('error');
      setMensagem(error.erro || 'Erro ao reenviar email de verificação.');
      toast.error('Erro ao reenviar email de verificação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Verificação de Email
          </Typography>

          <Typography variant="body1" sx={{ mb: 3 }}>
            Para acessar sua conta, é necessário verificar seu email.
            {usuario?.email && (
              <Box component="span" display="block" mt={1}>
                Email cadastrado: <strong>{usuario.email}</strong>
              </Box>
            )}
          </Typography>

          {status && (
            <Alert severity={status} sx={{ mb: 3 }}>
              {mensagem}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleReenviarEmail}
              disabled={loading}
              sx={{
                py: 1.5,
                position: 'relative',
                '&:disabled': {
                  backgroundColor: 'primary.main',
                  opacity: 0.7
                }
              }}
            >
              {loading ? (
                <>
                  <CircularProgress
                    size={24}
                    sx={{
                      color: 'white',
                      position: 'absolute',
                      left: '50%',
                      marginLeft: '-12px'
                    }}
                  />
                  <span style={{ opacity: 0 }}>Reenviar Email de Verificação</span>
                </>
              ) : (
                'Reenviar Email de Verificação'
              )}
            </Button>

            <Button
              variant="outlined"
              onClick={() => navigate('/login')}
              sx={{ py: 1.5 }}
            >
              Voltar para Login
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Não recebeu o email? Verifique sua pasta de spam ou clique no botão acima para reenviar.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default EmailNaoVerificado; 