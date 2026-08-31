// src/components/Fechamento/LinkarRecebimentoModal.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ModalTransacao from '../Modal/ModalTransacao';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { listarSettlements } from '../../api';
import './LinkarRecebimentoModal.css';

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const LinkarRecebimentoModal = ({ instancia, onClose, onLinkar }) => {
  const [settlements, setSettlements] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [linkando, setLinkando] = useState(null);

  const pessoaNome = instancia.cadastro?.pessoa?.nome;

  useEffect(() => {
    (async () => {
      try {
        const resultado = await listarSettlements({ pessoa: pessoaNome, limit: 20 });
        setSettlements(resultado.items || []);
      } catch (err) {
        toast.error(err.message || 'Erro ao listar conciliações.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [pessoaNome]);

  const handleLinkar = async (settlementId) => {
    setLinkando(settlementId);
    try {
      await onLinkar(instancia._id, settlementId);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao linkar recebimento.');
    } finally {
      setLinkando(null);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
        <h2 className="linkar-recebimento-modal__title">Linkar Recebimento — {pessoaNome}</h2>

        {carregando && <p>Carregando conciliações...</p>}
        {!carregando && settlements.length === 0 && (
          <p className="linkar-recebimento-modal__empty">
            Nenhuma conciliação encontrada para esta pessoa. Crie uma em "Recebimentos &gt; Nova Conciliação".
          </p>
        )}
        {!carregando && settlements.map((s) => (
          <div key={s._id || s.id} className="linkar-recebimento-modal__item">
            <div>
              <p className="linkar-recebimento-modal__desc">{s.receivingTransactionId?.descricao}</p>
              <p className="linkar-recebimento-modal__meta">
                {formatMoeda(s.totalApplied)} · {new Date(s.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={linkando === (s._id || s.id)}
              onClick={() => handleLinkar(s._id || s.id)}
            >
              Linkar
            </Button>
          </div>
        ))}

        <div className="linkar-recebimento-modal__actions">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </ModalTransacao>
  );
};

export default LinkarRecebimentoModal;
