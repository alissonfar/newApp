import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Undo as UndoIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import * as regraService from '../services/regraService';

const Regras = () => {
  const [regras, setRegras] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [opcoesCampos, setOpcoesCampos] = useState(null);
  const [regraAtual, setRegraAtual] = useState({
    nome: '',
    descricao: '',
    condicoes: [{
      campo: '',
      operador: 'igual',
      valor: ''
    }],
    operadorLogico: 'E',
    acoes: [{
      tipo: '',
      valor: ''
    }]
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [regraPreview, setRegraPreview] = useState(null);

  useEffect(() => {
    carregarRegras();
    carregarOpcoesCampos();
  }, []);

  const carregarRegras = async () => {
    try {
      const data = await regraService.listarRegras();
      setRegras(data);
    } catch (erro) {
      mostrarSnackbar('Erro ao carregar regras', 'error');
    }
  };

  const carregarOpcoesCampos = async () => {
    try {
      const opcoes = await regraService.obterOpcoesCampos();
      setOpcoesCampos(opcoes);
    } catch (erro) {
      mostrarSnackbar('Erro ao carregar opções dos campos', 'error');
    }
  };

  const mostrarSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenDialog = (regra = null) => {
    if (regra) {
      setRegraAtual(regra);
      setModoEdicao(true);
    } else {
      setRegraAtual({
        nome: '',
        descricao: '',
        condicoes: [{
          campo: '',
          operador: 'igual',
          valor: ''
        }],
        operadorLogico: 'E',
        acoes: [{
          tipo: '',
          valor: ''
        }]
      });
      setModoEdicao(false);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setRegraAtual(null);
  };

  const handleSalvarRegra = async () => {
    try {
      if (modoEdicao) {
        await regraService.atualizarRegra(regraAtual._id, regraAtual);
        mostrarSnackbar('Regra atualizada com sucesso');
      } else {
        await regraService.criarRegra(regraAtual);
        mostrarSnackbar('Regra criada com sucesso');
      }
      handleCloseDialog();
      carregarRegras();
    } catch (erro) {
      mostrarSnackbar('Erro ao salvar regra', 'error');
    }
  };

  const handleExcluirRegra = async (id) => {
    try {
      await regraService.excluirRegra(id);
      mostrarSnackbar('Regra excluída com sucesso');
      carregarRegras();
    } catch (erro) {
      mostrarSnackbar('Erro ao excluir regra', 'error');
    }
  };

  const handlePreviewRegra = async (regra) => {
    try {
      const resultado = await regraService.simularRegra(regra._id);
      setPreviewData(resultado);
      setRegraPreview(regra);
      setPreviewDialogOpen(true);
    } catch (erro) {
      mostrarSnackbar('Erro ao simular regra', 'error');
    }
  };

  const handleConfirmarExecucao = async () => {
    try {
      const resultado = await regraService.executarRegra(regraPreview._id);
      mostrarSnackbar(`Regra executada com sucesso. ${resultado.transacoesAfetadas} transações afetadas.`);
      setPreviewDialogOpen(false);
      carregarRegras();
    } catch (erro) {
      mostrarSnackbar('Erro ao executar regra', 'error');
    }
  };

  const handleDesfazerExecucao = async (id) => {
    try {
      await regraService.desfazerUltimaExecucao(id);
      mostrarSnackbar('Última execução desfeita com sucesso');
      carregarRegras();
    } catch (erro) {
      mostrarSnackbar('Erro ao desfazer execução', 'error');
    }
  };

  const handleAddCondicao = () => {
    setRegraAtual({
      ...regraAtual,
      condicoes: [
        ...regraAtual.condicoes,
        { campo: '', operador: 'igual', valor: '' }
      ]
    });
  };

  const handleRemoveCondicao = (index) => {
    const novasCondicoes = regraAtual.condicoes.filter((_, i) => i !== index);
    setRegraAtual({
      ...regraAtual,
      condicoes: novasCondicoes
    });
  };

  const handleAddAcao = () => {
    setRegraAtual({
      ...regraAtual,
      acoes: [
        ...regraAtual.acoes,
        { tipo: '', valor: '' }
      ]
    });
  };

  const handleRemoveAcao = (index) => {
    const novasAcoes = regraAtual.acoes.filter((_, i) => i !== index);
    setRegraAtual({
      ...regraAtual,
      acoes: novasAcoes
    });
  };

  // Componente de pré-visualização das alterações
  const PreviewDialog = () => {
    if (!previewData || !regraPreview) return null;

    const renderAcoes = () => {
      return regraPreview.acoes.map((acao, index) => {
        let descricao = '';
        switch (acao.tipo) {
          case 'adicionar_tag':
            descricao = `Adicionar a tag "${acao.valor}"`;
            break;
          case 'remover_tag':
            descricao = `Remover a tag "${acao.valor}"`;
            break;
          case 'alterar_status':
            descricao = `Alterar status para "${acao.valor}"`;
            break;
          case 'alterar_valor':
            descricao = `Alterar valor para R$ ${acao.valor}`;
            break;
        }
        return (
          <ListItem key={index}>
            <ListItemText primary={descricao} />
          </ListItem>
        );
      });
    };

    const renderAlteracoes = (transacao) => {
      return (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Alterações:
          </Typography>
          <List dense>
            {transacao.alteracoes.map((alteracao, index) => (
              <ListItem key={index}>
                <ListItemText 
                  primary={alteracao.descricao}
                  sx={{ color: 'text.secondary' }}
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="subtitle2" color="text.secondary">
            Estado Final:
          </Typography>
          <Box sx={{ pl: 2 }}>
            {transacao.estadoFinal.valor !== transacao.valor && (
              <Typography variant="body2">
                Valor: R$ {transacao.estadoFinal.valor}
              </Typography>
            )}
            {transacao.estadoFinal.status !== transacao.status && (
              <Typography variant="body2">
                Status: {transacao.estadoFinal.status}
              </Typography>
            )}
            {JSON.stringify(transacao.estadoFinal.tags) !== JSON.stringify(transacao.tags) && (
              <Box>
                <Typography variant="body2" component="span">
                  Tags:{' '}
                </Typography>
                {transacao.estadoFinal.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      );
    };

    return (
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Pré-visualização da Execução - {regraPreview.nome}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Ações que serão executadas:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <List dense>
                {renderAcoes()}
              </List>
            </Paper>
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Transações afetadas ({previewData.quantidadeAfetada}):
          </Typography>
          
          {previewData.quantidadeAfetada > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Descrição</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell>Alterações Previstas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.transacoes.map((transacao) => (
                    <TableRow key={transacao._id}>
                      <TableCell>{transacao.descricao}</TableCell>
                      <TableCell>{transacao.tipo}</TableCell>
                      <TableCell>R$ {transacao.valor}</TableCell>
                      <TableCell>
                        {new Date(transacao.data).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {transacao.tags?.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ mr: 0.5 }}
                          />
                        ))}
                      </TableCell>
                      <TableCell>
                        {renderAlteracoes(transacao)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              Nenhuma transação será afetada por esta regra.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmarExecucao}
            variant="contained"
            color="primary"
            disabled={previewData.quantidadeAfetada === 0}
          >
            Confirmar Execução
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Regras de Automação</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nova Regra
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Última Execução</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {regras.map((regra) => (
              <TableRow key={regra._id}>
                <TableCell>{regra.nome}</TableCell>
                <TableCell>{regra.descricao}</TableCell>
                <TableCell>
                  {regra.ultimaExecucao?.data
                    ? new Date(regra.ultimaExecucao.data).toLocaleString()
                    : 'Nunca executada'}
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handlePreviewRegra(regra)}>
                    <PreviewIcon />
                  </IconButton>
                  {regra.ultimaExecucao && (
                    <IconButton onClick={() => handleDesfazerExecucao(regra._id)}>
                      <UndoIcon />
                    </IconButton>
                  )}
                  <IconButton onClick={() => handleOpenDialog(regra)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleExcluirRegra(regra._id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {modoEdicao ? 'Editar Regra' : 'Nova Regra'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome"
                value={regraAtual?.nome || ''}
                onChange={(e) => setRegraAtual({ ...regraAtual, nome: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrição"
                multiline
                rows={2}
                value={regraAtual?.descricao || ''}
                onChange={(e) => setRegraAtual({ ...regraAtual, descricao: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>Condições</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Operador Lógico</InputLabel>
                <Select
                  value={regraAtual?.operadorLogico || 'E'}
                  onChange={(e) => setRegraAtual({ ...regraAtual, operadorLogico: e.target.value })}
                >
                  <MenuItem value="E">E (todas as condições)</MenuItem>
                  <MenuItem value="OU">OU (qualquer condição)</MenuItem>
                </Select>
              </FormControl>

              {regraAtual?.condicoes.map((condicao, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Campo</InputLabel>
                        <Select
                          value={condicao.campo}
                          onChange={(e) => {
                            const novasCondicoes = [...regraAtual.condicoes];
                            novasCondicoes[index] = {
                              ...novasCondicoes[index],
                              campo: e.target.value,
                              operador: '',
                              valor: ''
                            };
                            setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                          }}
                        >
                          {opcoesCampos?.campos.map(campo => (
                            <MenuItem key={campo.valor} value={campo.valor}>
                              {campo.rotulo}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Operador</InputLabel>
                        <Select
                          value={condicao.operador}
                          onChange={(e) => {
                            const novasCondicoes = [...regraAtual.condicoes];
                            novasCondicoes[index] = {
                              ...novasCondicoes[index],
                              operador: e.target.value,
                              valor: ''
                            };
                            setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                          }}
                        >
                          {opcoesCampos?.campos
                            .find(c => c.valor === condicao.campo)
                            ?.operadores.map(op => (
                              <MenuItem key={op} value={op}>
                                {opcoesCampos.operadores[op]}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      {condicao.campo && opcoesCampos?.campos.find(c => c.valor === condicao.campo)?.valores ? (
                        <FormControl fullWidth>
                          <InputLabel>Valor</InputLabel>
                          <Select
                            value={condicao.valor}
                            onChange={(e) => {
                              const novasCondicoes = [...regraAtual.condicoes];
                              novasCondicoes[index].valor = e.target.value;
                              setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                            }}
                          >
                            {opcoesCampos.campos
                              .find(c => c.valor === condicao.campo)
                              .valores.map(valor => (
                                <MenuItem key={valor} value={valor}>
                                  {valor}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          label="Valor"
                          type={opcoesCampos?.campos.find(c => c.valor === condicao.campo)?.tipo === 'numero' ? 'number' : 'text'}
                          value={condicao.valor}
                          onChange={(e) => {
                            const novasCondicoes = [...regraAtual.condicoes];
                            novasCondicoes[index].valor = e.target.value;
                            setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                          }}
                        />
                      )}
                    </Grid>
                  </Grid>
                  {index > 0 && (
                    <Button
                      color="error"
                      onClick={() => handleRemoveCondicao(index)}
                      sx={{ mt: 1 }}
                    >
                      Remover Condição
                    </Button>
                  )}
                </Box>
              ))}
              <Button onClick={handleAddCondicao}>Adicionar Condição</Button>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ações</Typography>
              {regraAtual?.acoes.map((acao, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Tipo de Ação</InputLabel>
                        <Select
                          value={acao.tipo}
                          onChange={(e) => {
                            const novasAcoes = [...regraAtual.acoes];
                            novasAcoes[index] = {
                              ...novasAcoes[index],
                              tipo: e.target.value,
                              valor: ''
                            };
                            setRegraAtual({ ...regraAtual, acoes: novasAcoes });
                          }}
                        >
                          {opcoesCampos?.acoes.map(opcao => (
                            <MenuItem key={opcao.tipo} value={opcao.tipo}>
                              {opcao.rotulo}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      {acao.tipo && opcoesCampos?.acoes.find(a => a.tipo === acao.tipo)?.valores ? (
                        <FormControl fullWidth>
                          <InputLabel>Valor</InputLabel>
                          <Select
                            value={acao.valor}
                            onChange={(e) => {
                              const novasAcoes = [...regraAtual.acoes];
                              novasAcoes[index].valor = e.target.value;
                              setRegraAtual({ ...regraAtual, acoes: novasAcoes });
                            }}
                          >
                            {opcoesCampos.acoes
                              .find(a => a.tipo === acao.tipo)
                              .valores.map(valor => (
                                <MenuItem key={valor} value={valor}>
                                  {valor}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          label="Valor"
                          type={opcoesCampos?.acoes.find(a => a.tipo === acao.tipo)?.tipo === 'numero' ? 'number' : 'text'}
                          value={acao.valor}
                          onChange={(e) => {
                            const novasAcoes = [...regraAtual.acoes];
                            novasAcoes[index].valor = e.target.value;
                            setRegraAtual({ ...regraAtual, acoes: novasAcoes });
                          }}
                        />
                      )}
                    </Grid>
                  </Grid>
                  {index > 0 && (
                    <Button
                      color="error"
                      onClick={() => handleRemoveAcao(index)}
                      sx={{ mt: 1 }}
                    >
                      Remover Ação
                    </Button>
                  )}
                </Box>
              ))}
              <Button onClick={handleAddAcao}>Adicionar Ação</Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSalvarRegra} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <PreviewDialog />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Regras; 