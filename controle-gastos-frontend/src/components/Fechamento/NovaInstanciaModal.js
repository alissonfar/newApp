// src/components/Fechamento/NovaInstanciaModal.js
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';
import ModalTransacao from '../Modal/ModalTransacao';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { listarPessoas, listarModelosRelatorio, listarCadastrosFechamento } from '../../api';
import './NovaInstanciaModal.css';

function mesAtualISO() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: fim.toISOString().slice(0, 10)
  };
}

const NovaInstanciaModal = ({ onClose, onCriar }) => {
  const [pessoas, setPessoas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cadastros, setCadastros] = useState([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);
  const [modeloSelecionado, setModeloSelecionado] = useState(null);
  const periodoInicial = mesAtualISO();
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pessoasData, modelosData, cadastrosData] = await Promise.all([
          listarPessoas(),
          listarModelosRelatorio(),
          listarCadastrosFechamento()
        ]);
        setPessoas(pessoasData);
        setModelos(modelosData);
        setCadastros(cadastrosData);
      } catch (err) {
        toast.error(err.message || 'Erro ao carregar dados para o formulário.');
      }
    })();
  }, []);

  const cadastroExistente = pessoaSelecionada
    ? cadastros.find((c) => c.pessoa?._id === pessoaSelecionada.value)
    : null;

  const handleSalvar = async () => {
    if (!pessoaSelecionada) {
      toast.error('Selecione uma pessoa.');
      return;
    }
    if (!cadastroExistente && !modeloSelecionado) {
      toast.error('Selecione um modelo de relatório para esta pessoa.');
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error('Defina o período (início e fim).');
      return;
    }

    setSalvando(true);
    try {
      await onCriar({
        cadastro: cadastroExistente?._id,
        pessoa: cadastroExistente ? undefined : pessoaSelecionada.value,
        modeloRelatorio: cadastroExistente ? undefined : modeloSelecionado?.value,
        dataInicio,
        dataFim
      });
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao criar instância.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="nova-instancia-modal">
        <h2 className="nova-instancia-modal__title">Nova Instância de Fechamento</h2>

        <div className="nova-instancia-modal__field">
          <label>Pessoa</label>
          <Select
            classNamePrefix="cg-select"
            options={pessoas.map((p) => ({ value: p._id, label: p.nome }))}
            value={pessoaSelecionada}
            onChange={setPessoaSelecionada}
            placeholder="Buscar pessoa..."
          />
        </div>

        {pessoaSelecionada && cadastroExistente && (
          <p className="nova-instancia-modal__hint">
            Modelo padrão desta pessoa: <b>{cadastroExistente.modeloRelatorio?.nome}</b>
          </p>
        )}

        {pessoaSelecionada && !cadastroExistente && (
          <div className="nova-instancia-modal__field">
            <label>Modelo de Relatório (esta pessoa ainda não tem um cadastro)</label>
            <Select
              classNamePrefix="cg-select"
              options={modelos.map((m) => ({ value: m._id, label: m.nome }))}
              value={modeloSelecionado}
              onChange={setModeloSelecionado}
              placeholder="Selecionar modelo..."
            />
          </div>
        )}

        <div className="nova-instancia-modal__field nova-instancia-modal__field--row">
          <div>
            <label>Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label>Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        <div className="nova-instancia-modal__actions">
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>Criar</Button>
        </div>
      </Card>
    </ModalTransacao>
  );
};

export default NovaInstanciaModal;
