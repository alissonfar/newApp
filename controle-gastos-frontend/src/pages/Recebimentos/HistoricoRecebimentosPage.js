import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { listarSettlements, excluirSettlement } from '../../api';
import { useData } from '../../context/DataContext';
import TagBadge from './components/TagBadge';
import { formatDateBR } from '../../utils/dateUtils';
import './Recebimentos.css';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const HistoricoRecebimentosPage = () => {
  const { tags } = useData();
  const [settlements, setSettlements] = useState({ items: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const getTagCompleta = (tagId) => {
    if (!tagId) return null;
    const id = typeof tagId === 'object' ? tagId._id : tagId;
    const idStr = id ? String(id) : null;
    const tag = (tags || []).find((t) => t._id === id || String(t._id) === idStr);
    return tag || (tagId?.nome ? { nome: tagId.nome, cor: tagId.cor || '#64748b', icone: tagId.icone || 'tag' } : null);
  };

  const carregarSettlements = async (page = 1) => {
    setLoading(true);
    try {
      const resultado = await listarSettlements({ page, limit: 15 });
      setSettlements(resultado);
    } catch (err) {
      setSettlements({ items: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSettlements();
  }, []);

  const handleExcluir = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta conciliação? Todas as alterações serão revertidas.')) return;
    try {
      await excluirSettlement(id);
      toast.success('Conciliação excluída.');
      carregarSettlements(settlements.page);
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir.');
    }
  };

  const pessoaRecebimento = (s) => {
    const rec = s.receivingTransactionId;
    if (!rec?.pagamentos?.[0]) return '-';
    return rec.pagamentos[0].pessoa;
  };

  return (
    <div className="recebimentos-historico-page">
      <header className="recebimentos-historico-header">
        <h1>Histórico de Conciliações</h1>
        <Link to="/recebimentos/novo" className="link-nova">
          Nova Conciliação
        </Link>
      </header>

      <div className="recebimentos-historico-content">
        {loading ? (
          <div className="historico-loading">
            <CircularProgress />
            <p>Carregando...</p>
          </div>
        ) : settlements.items.length === 0 ? (
          <p className="sem-dados">Nenhuma conciliação registrada.</p>
        ) : (
          <div className="historico-accordion-list">
            {settlements.items.map((s) => (
              <Accordion key={s._id} className="historico-accordion">
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <div className="accordion-summary-content">
                    <span className="accordion-id">#{s._id?.slice(-6)}</span>
                    <span className="accordion-data">{formatDateBR(s.createdAt)}</span>
                    <span className="accordion-pessoa">{pessoaRecebimento(s)}</span>
                    <span className="accordion-valor">
                      R$ {formatarValor(s.receivingTransactionId?.valor)}
                    </span>
                    <span className="accordion-tag">
                      {getTagCompleta(s.tagId) ? <TagBadge tag={getTagCompleta(s.tagId)} size={14} /> : '-'}
                    </span>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={(e) => handleExcluir(s._id, e)}
                      className="btn-excluir-accordion"
                    >
                      Excluir
                    </Button>
                  </div>
                </AccordionSummary>
                <AccordionDetails>
                  <div className="accordion-details">
                    <div className="detail-row">
                      <span>Valor original:</span>
                      <strong>R$ {formatarValor(s.receivingTransactionId?.valor)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Valor aplicado:</span>
                      <strong>R$ {formatarValor(s.totalApplied)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Valor de sobra:</span>
                      <strong>R$ {formatarValor(s.leftoverAmount || 0)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Tag aplicada:</span>
                      <strong>
                        {getTagCompleta(s.tagId) ? <TagBadge tag={getTagCompleta(s.tagId)} size={14} /> : '-'}
                      </strong>
                    </div>
                    <div className="transacoes-quitadas">
                      <h4>Transações quitadas</h4>
                      <ul>
                        {(s.appliedTransactions || []).map((at, idx) => (
                          <li key={idx}>
                            {at.transactionId?.descricao || 'N/A'} — R${' '}
                            {formatarValor(at.amountApplied || at.transactionId?.valor)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        )}

        {settlements.totalPages > 1 && (
          <div className="paginacao">
            <button
              disabled={settlements.page <= 1}
              onClick={() => carregarSettlements(settlements.page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {settlements.page} de {settlements.totalPages}
            </span>
            <button
              disabled={settlements.page >= settlements.totalPages}
              onClick={() => carregarSettlements(settlements.page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoRecebimentosPage;
