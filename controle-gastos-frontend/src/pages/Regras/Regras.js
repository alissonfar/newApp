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
import * as regraService from '../../services/regraService';
import './Regras.css';

// ... existing code ...

return (
    <Container maxWidth="lg" className="regras-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" className="regras-titulo">Regras de Automação</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          className="regras-btn-novo"
        >
          Nova Regra
        </Button>
      </Box>

      <TableContainer component={Paper} className="regras-table">
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
        className="regras-dialog"
      >
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
              <Typography variant="h6" className="regras-form-title">Condições</Typography>
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
                <Box key={index} className="regras-form-section">
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Campo</InputLabel>
                        <Select
                          value={condicao.campo}
                          onChange={(e) => {
                            const novasCondicoes = [...regraAtual.condicoes];
                            novasCondicoes[index].campo = e.target.value;
                            setRegraAtual({ ...regraAtual, condicoes: novasCondicoes });
                          }}
                        >
                          <MenuItem value="tipo">Tipo</MenuItem>
                          <MenuItem value="valor">Valor</MenuItem>
                          <MenuItem value="data">Data</MenuItem>
                          <MenuItem value="tags">Tags</MenuItem>
                          <MenuItem value="status">Status</MenuItem>
                          <MenuItem value="pagamentos.pessoa">Participante</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    // ... rest of the conditions code ...
                  </Grid>
                </Box>
              ))}
              <Button onClick={handleAddCondicao}>Adicionar Condição</Button>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" className="regras-form-title">Ações</Typography>
              {regraAtual?.acoes.map((acao, index) => (
                <Box key={index} className="regras-form-section">
                  // ... actions code ...
                </Box>
              ))}
              <Button onClick={handleAddAcao}>Adicionar Ação</Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSalvarRegra} variant="contained" className="regras-btn-confirmar">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        className="regras-preview-dialog"
      >
        <DialogTitle>
          Pré-visualização da Execução - {regraPreview?.nome}
        </DialogTitle>
        <DialogContent>
          <Box className="regras-preview-section">
            <Typography variant="h6" className="regras-preview-title">
              Ações que serão executadas:
            </Typography>
            <Paper variant="outlined" className="regras-preview-paper">
              <List dense>
                {renderAcoes()}
              </List>
            </Paper>
          </Box>

          <Typography variant="h6" className="regras-preview-title">
            Transações afetadas ({previewData?.quantidadeAfetada || 0}):
          </Typography>
          
          {previewData?.quantidadeAfetada > 0 ? (
            <TableContainer component={Paper} className="regras-table">
              // ... preview table code ...
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
            className="regras-btn-confirmar"
            disabled={!previewData || previewData.quantidadeAfetada === 0}
          >
            Confirmar Execução
          </Button>
        </DialogActions>
      </Dialog>

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
// ... existing code ... 