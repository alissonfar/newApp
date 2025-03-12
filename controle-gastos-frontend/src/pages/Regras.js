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
  Divider,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Undo as UndoIcon,
  Preview as PreviewIcon,
  Close as CloseIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import * as regraService from '../services/regraService';
import { obterCategorias, obterTags, obterTransacoes } from '../api';

const Regras = () => {
  const [regras, setRegras] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  
  // Novos estados para armazenar opções disponíveis
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [tagsPorCategoria, setTagsPorCategoria] = useState({});

  const [regraAtual, setRegraAtual] = useState({
    nome: '',
    descricao: '',
    condicoes: [{
      campo: 'status',
      operador: 'igual',
      valor: 'ativo'
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
    carregarOpcoes();
  }, []);

  const carregarRegras = async () => {
    try {
      const data = await regraService.listarRegras();
      setRegras(data);
    } catch (erro) {
      mostrarSnackbar('Erro ao carregar regras', 'error');
    }
  };

  const carregarOpcoes = async () => {
    try {
      // Carregar categorias e tags
      const cats = await obterCategorias();
      const tgs = await obterTags();
      setCategorias(cats);
      setTags(tgs);

      // Agrupar tags por categoria
      const tagsAgrupadas = tgs.reduce((acc, tag) => {
        if (tag.categoria) {
          if (!acc[tag.categoria]) {
            acc[tag.categoria] = [];
          }
          acc[tag.categoria].push(tag.nome);
        }
        return acc;
      }, {});
      setTagsPorCategoria(tagsAgrupadas);

      // Carregar transações para extrair pessoas únicas
      const { transacoes } = await obterTransacoes();
      const pessoasUnicas = new Set();
      transacoes.forEach(tr => {
        if (tr.pagamentos) {
          tr.pagamentos.forEach(p => {
            if (p.pessoa) pessoasUnicas.add(p.pessoa);
          });
        }
      });
      setPessoas(Array.from(pessoasUnicas));
    } catch (erro) {
      console.error('Erro ao carregar opções:', erro);
      mostrarSnackbar('Erro ao carregar opções disponíveis', 'error');
    }
  };

  const obterOpcoesValor = (campo) => {
    switch (campo) {
      case 'tipo':
        return ['gasto', 'recebivel'];
      case 'status':
        return ['ativo', 'estornado'];
      case 'pagamentos.pessoa':
        return pessoas;
      case 'tags':
        return Object.entries(tagsPorCategoria).map(([categoria, tags]) => 
          tags.map(tag => `${categoria}: ${tag}`)
        ).flat();
      default:
        return [];
    }
  };

  // Nova função para obter opções de valor para ações
  const obterOpcoesValorAcao = (tipo) => {
    switch (tipo) {
      case 'adicionar_tag':
      case 'remover_tag':
        return Object.entries(tagsPorCategoria).map(([categoria, tags]) => 
          tags.map(tag => `${categoria}: ${tag}`)
        ).flat();
      case 'alterar_status':
        return ['estornado']; // Só permite alterar para estornado
      case 'alterar_valor':
        return []; // Valor numérico, usa TextField
      default:
        return [];
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
          campo: 'status',
          operador: 'igual',
          valor: 'ativo'
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
        { campo: '', operador: '', valor: '' }
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
        let icone = null;
        
        switch (acao.tipo) {
          case 'adicionar_tag':
            descricao = `Adicionar a tag "${acao.valor}"`;
            icone = <AddIcon fontSize="small" sx={{ color: 'success.main' }} />;
            break;
          case 'remover_tag':
            descricao = `Remover a tag "${acao.valor}"`;
            icone = <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />;
            break;
          case 'alterar_status':
            descricao = `Alterar status para "${acao.valor}"`;
            icone = <EditIcon fontSize="small" sx={{ color: 'info.main' }} />;
            break;
          case 'alterar_valor':
            descricao = `Alterar valor para R$ ${acao.valor}`;
            icone = <EditIcon fontSize="small" sx={{ color: 'info.main' }} />;
            break;
        }
        return (
          <ListItem key={index} sx={{ py: 0.5 }}>
            {icone}
            <ListItemText 
              primary={descricao} 
              sx={{ ml: 1 }}
            />
          </ListItem>
        );
      });
    };

    const renderAlteracoes = (transacao) => {
      const temAlteracaoValor = transacao.estadoFinal.valor !== transacao.valor;
      const temAlteracaoStatus = transacao.estadoFinal.status !== transacao.status;
      const temAlteracaoTags = JSON.stringify(transacao.estadoFinal.tags) !== JSON.stringify(transacao.tags);

      return (
        <Box>
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.default' }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Estado Atual
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Valor: <Typography component="span" variant="body2" color={temAlteracaoValor ? 'text.disabled' : 'text.primary'}>
                      R$ {transacao.valor}
                    </Typography>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Status: <Typography component="span" variant="body2" color={temAlteracaoStatus ? 'text.disabled' : 'text.primary'}>
                      {transacao.status}
                    </Typography>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Tags:
                  </Typography>
                  <Box>
                    {transacao.tags?.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ 
                          mr: 0.5, 
                          mb: 0.5,
                          opacity: temAlteracaoTags ? 0.5 : 1
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ bgcolor: '#b6ffb3' }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                Estado Final
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Valor: <Typography component="span" variant="body2" color={temAlteracaoValor ? 'success.dark' : 'text.primary'} fontWeight={temAlteracaoValor ? 'bold' : 'regular'}>
                      R$ {transacao.estadoFinal.valor}
                    </Typography>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Status: <Typography component="span" variant="body2" color={temAlteracaoStatus ? 'success.dark' : 'text.primary'} fontWeight={temAlteracaoStatus ? 'bold' : 'regular'}>
                      {transacao.estadoFinal.status}
                    </Typography>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Tags:
                  </Typography>
                  <Box>
                    {transacao.estadoFinal.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ 
                          mr: 0.5, 
                          mb: 0.5,
                          bgcolor: temAlteracaoTags ? 'success.main' : 'default',
                          color: temAlteracaoTags ? 'white' : 'default'
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      );
    };

    return (
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            overflowY: 'auto'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          pb: 2
        }}>
          <Box>
            <Typography variant="h5" fontWeight="500">
              Pré-visualização da Execução
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              {regraPreview.nome}
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Card variant="outlined" sx={{ mb: 3, bgcolor: 'info.light' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <InfoIcon sx={{ color: 'info.dark', mr: 1 }} />
                <Typography variant="h6" color="info.dark">
                  Ações que serão executadas
                </Typography>
              </Box>
              <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                {renderAcoes()}
              </List>
            </CardContent>
          </Card>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Transações afetadas
              </Typography>
              <Chip 
                label={`${previewData.quantidadeAfetada} ${previewData.quantidadeAfetada === 1 ? 'transação' : 'transações'}`}
                color={previewData.quantidadeAfetada > 0 ? "primary" : "default"}
                size="small"
              />
            </Box>
            
            {previewData.quantidadeAfetada > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Valor</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Data</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Alterações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.transacoes.map((transacao) => (
                      <TableRow key={transacao._id} hover>
                        <TableCell>{transacao.descricao}</TableCell>
                        <TableCell>
                          <Chip 
                            label={transacao.tipo} 
                            size="small"
                            color={transacao.tipo === 'gasto' ? 'error' : 'success'}
                          />
                        </TableCell>
                        <TableCell>R$ {transacao.valor}</TableCell>
                        <TableCell>
                          {new Date(transacao.data).toLocaleDateString()}
                        </TableCell>
                        <TableCell sx={{ width: '40%' }}>
                          {renderAlteracoes(transacao)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert 
                severity="info"
                icon={<InfoIcon />}
                sx={{ 
                  bgcolor: 'info.light',
                  '& .MuiAlert-icon': {
                    color: 'info.dark'
                  }
                }}
              >
                Nenhuma transação será afetada por esta regra.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ 
          borderTop: '1px solid rgba(0, 0, 0, 0.12)', 
          p: 2,
          bgcolor: 'background.default'
        }}>
          <Button 
            onClick={() => setPreviewDialogOpen(false)}
            variant="contained"
            sx={{ 
              bgcolor: 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'error.dark',
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarExecucao}
            variant="contained"
            color="success"
            disabled={previewData.quantidadeAfetada === 0}
            startIcon={<PlayIcon />}
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

      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            overflowY: 'auto'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          pb: 2,
          mb: 3
        }}>
          <Typography variant="h5" fontWeight="500">
            {modoEdicao ? 'Editar Regra' : 'Nova Regra'}
          </Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome"
                value={regraAtual?.nome || ''}
                onChange={(e) => setRegraAtual({ ...regraAtual, nome: e.target.value })}
                variant="outlined"
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
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>Condições</Typography>
                    <Tooltip title="Defina as condições que as transações devem atender para que as ações sejam aplicadas">
                      <InfoIcon color="action" sx={{ ml: 1 }} />
                    </Tooltip>
                  </Box>
                  
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Operador Lógico</InputLabel>
                      <Select
                        value={regraAtual?.operadorLogico || 'E'}
                        onChange={(e) => setRegraAtual({ ...regraAtual, operadorLogico: e.target.value })}
                      >
                        <MenuItem value="E">E (todas as condições devem ser verdadeiras)</MenuItem>
                        <MenuItem value="OU">OU (pelo menos uma condição deve ser verdadeira)</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {regraAtual?.condicoes.map((condicao, index) => (
                    <Card 
                      key={index} 
                      variant="outlined" 
                      sx={{ 
                        mb: 2,
                        position: 'relative',
                        '&:hover': {
                          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1)'
                        }
                      }}
                    >
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                              <InputLabel>Campo</InputLabel>
                              <Select
                                value={condicao.campo}
                                onChange={(e) => {
                                  const novasCondicoes = [...regraAtual.condicoes];
                                  novasCondicoes[index].campo = e.target.value;
                                  novasCondicoes[index].valor = '';
                                  setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                                }}
                              >
                                <MenuItem value="tipo">Tipo</MenuItem>
                                <MenuItem value="valor">Valor</MenuItem>
                                <MenuItem value="data">Data</MenuItem>
                                <MenuItem value="tags">Tags</MenuItem>
                                <MenuItem value="status">Status</MenuItem>
                                <MenuItem value="pagamentos.pessoa">Pessoa</MenuItem>
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
                                  novasCondicoes[index].operador = e.target.value;
                                  setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                                }}
                              >
                                <MenuItem value="igual">Igual a</MenuItem>
                                <MenuItem value="diferente">Diferente de</MenuItem>
                                <MenuItem value="maior">Maior que</MenuItem>
                                <MenuItem value="menor">Menor que</MenuItem>
                                <MenuItem value="contem">Contém</MenuItem>
                                <MenuItem value="nao_contem">Não contém</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            {condicao.campo === 'valor' ? (
                              <TextField
                                fullWidth
                                label="Valor"
                                type="number"
                                value={condicao.valor}
                                onChange={(e) => {
                                  const novasCondicoes = [...regraAtual.condicoes];
                                  novasCondicoes[index].valor = e.target.value;
                                  setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                                }}
                              />
                            ) : condicao.campo === 'data' ? (
                              <TextField
                                fullWidth
                                label="Data"
                                type="date"
                                value={condicao.valor}
                                InputLabelProps={{ shrink: true }}
                                onChange={(e) => {
                                  const novasCondicoes = [...regraAtual.condicoes];
                                  novasCondicoes[index].valor = e.target.value;
                                  setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                                }}
                              />
                            ) : (
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
                                  {obterOpcoesValor(condicao.campo).map((opcao, i) => (
                                    <MenuItem key={i} value={opcao}>
                                      {opcao}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          </Grid>
                        </Grid>
                        {index > 0 && (
                          <Tooltip title="Remover condição">
                            <IconButton
                              onClick={() => handleRemoveCondicao(index)}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'error.light',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'error.main',
                                }
                              }}
                              size="small"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button 
                    onClick={handleAddCondicao}
                    startIcon={<AddIcon />}
                    variant="contained"
                    fullWidth
                    sx={{ 
                      mt: 2,
                      bgcolor: 'primary.light',
                      color: 'primary.dark',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: 'white',
                      }
                    }}
                  >
                    Adicionar Condição
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>Ações</Typography>
                    <Tooltip title="Defina as ações que serão aplicadas às transações que atenderem às condições">
                      <InfoIcon color="action" sx={{ ml: 1 }} />
                    </Tooltip>
                  </Box>

                  {regraAtual?.acoes.map((acao, index) => (
                    <Card 
                      key={index} 
                      variant="outlined" 
                      sx={{ 
                        mb: 2,
                        position: 'relative',
                        '&:hover': {
                          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1)'
                        }
                      }}
                    >
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                              <InputLabel>Tipo de Ação</InputLabel>
                              <Select
                                value={acao.tipo}
                                onChange={(e) => {
                                  const novasAcoes = [...regraAtual.acoes];
                                  novasAcoes[index].tipo = e.target.value;
                                  novasAcoes[index].valor = '';
                                  setRegraAtual({ ...regraAtual, acoes: novasAcoes });
                                }}
                              >
                                <MenuItem value="adicionar_tag">Adicionar Tag</MenuItem>
                                <MenuItem value="remover_tag">Remover Tag</MenuItem>
                                <MenuItem value="alterar_status">Alterar Status</MenuItem>
                                <MenuItem value="alterar_valor">Alterar Valor</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            {acao.tipo === 'alterar_valor' ? (
                              <TextField
                                fullWidth
                                label="Valor"
                                type="number"
                                value={acao.valor}
                                onChange={(e) => {
                                  const novasAcoes = [...regraAtual.acoes];
                                  novasAcoes[index].valor = e.target.value;
                                  setRegraAtual({ ...regraAtual, acoes: novasAcoes });
                                }}
                              />
                            ) : (
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
                                  {obterOpcoesValorAcao(acao.tipo).map((opcao, i) => (
                                    <MenuItem key={i} value={opcao}>
                                      {opcao}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          </Grid>
                        </Grid>
                        {index > 0 && (
                          <Tooltip title="Remover ação">
                            <IconButton
                              onClick={() => handleRemoveAcao(index)}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'error.light',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'error.main',
                                }
                              }}
                              size="small"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button 
                    onClick={handleAddAcao}
                    startIcon={<AddIcon />}
                    variant="contained"
                    fullWidth
                    sx={{ 
                      mt: 2,
                      bgcolor: 'primary.light',
                      color: 'primary.dark',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: 'white',
                      }
                    }}
                  >
                    Adicionar Ação
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(0, 0, 0, 0.12)', p: 2 }}>
          <Button 
            onClick={handleCloseDialog} 
            variant="contained"
            sx={{ 
              bgcolor: 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'error.dark',
              }
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvarRegra} 
            variant="contained"
            disabled={!regraAtual?.nome || regraAtual.acoes.some(a => !a.tipo || !a.valor)}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark',
              }
            }}
          >
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