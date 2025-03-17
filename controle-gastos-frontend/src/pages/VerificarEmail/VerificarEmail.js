import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verificarEmail, reenviarVerificacaoEmail } from '../../services/api';
import { Container, Paper, Typography, Button, Box, TextField, CircularProgress } from '@mui/material';
import { Alert } from '@mui/material';

const VerificarEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('');
  const [tipo, setTipo] = useState('info'); // 'success', 'error', 'info'
  const [loading, setLoading] = useState(true);
  const [mostrarReenvio, setMostrarReenvio] = useState(false);
  const [email, setEmail] = useState('');
  const [loadingReenvio, setLoadingReenvio] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState('');
  const [tipoMensagemReenvio, setTipoMensagemReenvio] = useState('info');

  const verificar = async () => {
    try {
      const response = await verificarEmail(token);
      setMensagem(response.mensagem || 'Email verificado com sucesso!');
      setTipo('success');
    } catch (error) {
      setMensagem(error.erro || 'Erro ao verificar email. Por favor, tente novamente.');
      setTipo('error');
      setMostrarReenvio(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReenviarEmail = async (e) => {
    e.preventDefault();
    if (!email) {
      setMensagemReenvio('Por favor, insira seu email.');
      setTipoMensagemReenvio('error');
      return;
    }

    setLoadingReenvio(true);
    try {
      const response = await reenviarVerificacaoEmail(email);
      setMensagemReenvio(response.mensagem);
      setTipoMensagemReenvio('success');
      setEmail('');
    } catch (error) {
      setMensagemReenvio(error.erro || 'Erro ao reenviar email de verificação.');
      setTipoMensagemReenvio('error');
    } finally {
      setLoadingReenvio(false);
    }
  };

  useEffect(() => {
    if (token) {
      verificar();
    }
  }, [token]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Verificação de Email
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Alert severity={tipo} sx={{ my: 2 }}>
              {mensagem}
            </Alert>
          )}

          {mostrarReenvio && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Solicitar novo email de verificação
              </Typography>
              <form onSubmit={handleReenviarEmail}>
                <TextField
                  fullWidth
                  label="Seu email"
                  variant="outlined"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loadingReenvio}
                  sx={{ mb: 2 }}
                />

                {mensagemReenvio && (
                  <Alert severity={tipoMensagemReenvio} sx={{ mb: 2 }}>
                    {mensagemReenvio}
                  </Alert>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loadingReenvio}
                >
                  {loadingReenvio ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Reenviar Email de Verificação'
                  )}
                </Button>
              </form>
            </Box>
          )}

          <Box mt={3} display="flex" justifyContent="center">
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate('/login')}
            >
              Voltar para Login
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default VerificarEmail; 