import React from 'react';
// Remover ReactDOM, não usaremos Portal diretamente
// import ReactDOM from 'react-dom'; 
import { FaTimes } from 'react-icons/fa';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Importar componentes do Material UI
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider'; // Para substituir a borda
import Paper from '@mui/material/Paper'; // Para os itens da lista

// Estilo para o Box central do Modal MUI
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  bgcolor: 'background.paper',
  borderRadius: '8px',
  boxShadow: 24,
  width: { xs: '90%', sm: '80%', md: '500px' }, // Melhor responsividade
  maxWidth: '500px',
  display: 'flex', // Usar flexbox para layout
  flexDirection: 'column', // Empilhar cabeçalho, corpo, rodapé
  maxHeight: '90vh', // Limitar altura máxima geral
};

const DayDetailModal = ({ transactions, date, open, onClose }) => {
  // O Modal MUI controla a renderização baseado na prop 'open'
  // Não precisamos mais da verificação inicial `if (!transactions...)` aqui,
  // pois o componente pai (Home) só o renderizará com 'open=true' quando houver dados.

  const formattedDate = date ? format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="day-detail-modal-title"
      aria-describedby="day-detail-modal-description"
    >
      <Box sx={style}> 
        {/* Cabeçalho do Modal com sx */}
        <Box 
          sx={{
            p: 2, // Padding
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1, // Borda inferior
            borderColor: 'divider', // Cor da borda padrão do tema
            bgcolor: 'grey.50', // Fundo cinza claro
            borderTopLeftRadius: 'inherit', // Herdar cantos arredondados
            borderTopRightRadius: 'inherit'
          }}
        >
          <Typography id="day-detail-modal-title" variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Transações de {formattedDate}
          </Typography>
          <IconButton 
            onClick={onClose} 
            aria-label="Fechar modal" 
            size="small"
            sx={{ color: 'grey.600', '&:hover': { color: 'error.main' } }}
          >
            <FaTimes />
          </IconButton>
        </Box>

        {/* Corpo do Modal com sx */}
        <Box 
          id="day-detail-modal-description" 
          sx={{
            p: 2, // Padding
            overflowY: 'auto', // Scroll apenas no corpo
            flexGrow: 1, // Ocupa espaço disponível
            // max-h-[60vh] é controlado pelo maxHeight do Box principal e flexGrow
          }}
        >
          {transactions && transactions.length > 0 ? (
            transactions.map((t, index) => (
              // Usar Paper para cada item para um visual card-like
              <Paper 
                key={index} 
                elevation={0} // Sem sombra extra, apenas fundo e borda
                sx={{
                  mb: 1.5, // Margin bottom
                  p: 1.5, // Padding interno
                  borderRadius: '4px',
                  borderLeft: 4, // Borda esquerda grossa
                  borderColor: t.tipo === 'gasto' ? 'error.light' : 'success.light',
                  bgcolor: t.tipo === 'gasto' ? 'error.lighter' : 'success.lighter', // Usar cores mais claras do tema (pode precisar definir essas cores no tema se não existirem)
                  // Fallback para cores Tailwind se as do tema não existirem
                  // bgcolor: t.tipo === 'gasto' ? '#fee2e2' : '#dcfce7', // bg-red-50 / bg-green-50
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', mr: 1, flexGrow: 1 }}>
                    {t.descricao}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: t.tipo === 'gasto' ? 'error.dark' : 'success.dark'
                    }}
                  >
                    {t.tipo === 'gasto' ? '-' : '+'} R$ {t.valor.toFixed(2)}
                  </Typography>
                </Box>
                {t.categoria && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                    Categoria: {t.categoria.nome}
                  </Typography> 
                )}
                {t.tags && t.tags.length > 0 && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                    Tags: {t.tags.map(tag => tag.nome).join(', ')}
                  </Typography> 
                )}
              </Paper>
            ))
          ) : (
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
              Nenhuma transação encontrada para esta data.
            </Typography>
          )}
        </Box>

        {/* Rodapé do Modal com sx */}
        <Box 
          sx={{
            p: 1.5, 
            textAlign: 'right',
            borderTop: 1, 
            borderColor: 'divider',
            bgcolor: 'grey.100',
            borderBottomLeftRadius: 'inherit',
            borderBottomRightRadius: 'inherit'
          }}
        >
           <Button 
             onClick={onClose}
             variant="contained"
             size="small"
             sx={{ textTransform: 'none' }} 
           >
             Fechar
           </Button>
         </Box>
      </Box>
    </Modal>
  );
};

export default DayDetailModal; 