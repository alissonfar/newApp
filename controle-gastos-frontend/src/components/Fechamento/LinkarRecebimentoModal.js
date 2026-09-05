// src/components/Fechamento/LinkarRecebimentoModal.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ModalCompacto from '../Modal/ModalCompacto';
import Card from '../shared/Card';
import Button from '../shared/Button';
import SettlementCandidateCard from './SettlementCandidateCard';
import { listarSettlements } from '../../api';
import './LinkarRecebimentoModal.css';

const LinkarRecebimentoModal = ({ instancia, onClose, onLinkar }) => {
  const [settlements, setSettlements] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [linkando, setLinkando] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);

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

  const handleToggleExpandir = (settlementId) => {
    setExpandidoId((atual) => (atual === settlementId ? null : settlementId));
  };

  return (
    <ModalCompacto onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
        <h2 className="linkar-recebimento-modal__title">Linkar Recebimento — {pessoaNome}</h2>

        {carregando && <p>Carregando conciliações...</p>}
        {!carregando && settlements.length === 0 && (
          <p className="linkar-recebimento-modal__empty">
            Nenhuma conciliação encontrada para esta pessoa. Crie uma em "Recebimentos &gt; Nova Conciliação".
          </p>
        )}
        {!carregando && settlements.map((s) => (
          <SettlementCandidateCard
            key={s._id || s.id}
            settlement={s}
            pessoaAtual={pessoaNome}
            expandido={expandidoId === (s._id || s.id)}
            onToggleExpandir={handleToggleExpandir}
            onLinkar={handleLinkar}
            linkando={linkando === (s._id || s.id)}
          />
        ))}

        <div className="linkar-recebimento-modal__actions">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </ModalCompacto>
  );
};

export default LinkarRecebimentoModal;
