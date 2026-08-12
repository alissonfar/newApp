import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaPause, FaPlay, FaTrash, FaPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import contaFixaApi from '../../services/contaFixaApi';
import ContaFixaFormModal from './ContaFixaFormModal';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import PageHeader from '../../components/shared/PageHeader';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import { formatarMoeda } from '../../utils/format';
import './ContasFixas.css';

const STATUS_BADGE = {
  ativa: { variant: 'success', label: 'Ativa' },
  pausada: { variant: 'warning', label: 'Pausada' },
  encerrada: { variant: 'default', label: 'Encerrada' }
};

const COLUNAS = [
  { key: 'nome', label: 'Nome' },
  { key: 'tipo', label: 'Tipo', width: 100 },
  { key: 'valorEsperado', label: 'Valor esperado', align: 'right', width: 140 },
  { key: 'dias', label: 'Dias (lanç. / venc.)', width: 150 },
  { key: 'modo', label: 'Modo', width: 130 },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'acoes', label: 'Ações', width: 220 }
];

const ContasFixas = () => {
  const navigate = useNavigate();
  const [contasFixas, setContasFixas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaFixaEditando, setContaFixaEditando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listar();
      setContasFixas(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNova = () => {
    setContaFixaEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (contaFixa) => {
    setContaFixaEditando(contaFixa);
    setModalAberto(true);
  };

  const handleSalvar = async (dados) => {
    if (contaFixaEditando) {
      await contaFixaApi.atualizar(contaFixaEditando._id, dados);
      toast.success('Conta fixa atualizada.');
    } else {
      await contaFixaApi.criar(dados);
      toast.success('Conta fixa criada.');
    }
    setModalAberto(false);
    await carregar();
  };

  const handlePausarOuReativar = async (contaFixa) => {
    try {
      if (contaFixa.status === 'pausada') {
        await contaFixaApi.reativar(contaFixa._id);
        toast.success('Conta fixa reativada.');
      } else {
        await contaFixaApi.pausar(contaFixa._id);
        toast.success('Conta fixa pausada.');
      }
      await carregar();
    } catch (err) {
      toast.error('Erro ao atualizar conta fixa.');
    }
  };

  const handleExcluir = async (contaFixa) => {
    const result = await Swal.fire({
      title: `Excluir "${contaFixa.nome}"?`,
      text: 'Isso não afeta transações já geradas por essa regra.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      await contaFixaApi.excluir(contaFixa._id);
      toast.success('Conta fixa excluída.');
      await carregar();
    } catch (err) {
      toast.error('Erro ao excluir conta fixa.');
    }
  };

  const renderCell = (row, col) => {
    switch (col.key) {
      case 'tipo':
        return row.tipo === 'gasto' ? 'Despesa' : 'Receita';
      case 'valorEsperado':
        return formatarMoeda(row.valorEsperado);
      case 'dias':
        return `${row.diaLancamento} / ${row.diaVencimento}`;
      case 'modo':
        return row.modo === 'automatico' ? 'Automático' : 'Confirmação';
      case 'status': {
        const badge = STATUS_BADGE[row.status] || STATUS_BADGE.encerrada;
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      }
      case 'acoes':
        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="ghost" size="sm" startIcon={<FaEdit />} onClick={() => abrirEdicao(row)}>Editar</Button>
            <Button
              variant="ghost"
              size="sm"
              startIcon={row.status === 'pausada' ? <FaPlay /> : <FaPause />}
              onClick={() => handlePausarOuReativar(row)}
            >
              {row.status === 'pausada' ? 'Reativar' : 'Pausar'}
            </Button>
            <Button variant="ghost" size="sm" startIcon={<FaTrash />} onClick={() => handleExcluir(row)}>Excluir</Button>
          </div>
        );
      default:
        return row[col.key];
    }
  };

  return (
    <div className="contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <PageHeader
            icon={<EventRepeatIcon />}
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>Ver pendências</Button>
                <Button variant="primary" startIcon={<FaPlus />} onClick={abrirNova}>Nova Conta Fixa</Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : (
            <DataTable
              columns={COLUNAS}
              rows={contasFixas}
              renderCell={renderCell}
              variant="glass"
              emptyMessage="Nenhuma conta fixa cadastrada ainda."
            />
          )}
        </CardContent>
      </Card>

      {modalAberto && (
        <ContaFixaFormModal
          contaFixa={contaFixaEditando}
          onSave={handleSalvar}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
};

export default ContasFixas;
