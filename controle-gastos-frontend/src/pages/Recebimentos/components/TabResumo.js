import React, { useContext } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { useRecebimentos } from '../context/RecebimentosContext';
import { AuthContext } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import TagBadge from './TagBadge';
import Card, { CardContent } from '../../../components/shared/Card';
import SectionHeader from '../../../components/shared/SectionHeader';
import Button from '../../../components/shared/Button';
import EmptyState from '../../../components/shared/EmptyState';
import { formatDateBR } from '../../../utils/dateUtils';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TabResumo = () => {
  const { usuario } = useContext(AuthContext);
  const { tags } = useData();
  const proprietario = usuario?.preferencias?.proprietario || '';

  const {
    recebimentoSelecionado,
    tagSelecionada,
    pendentes,
    transacoesSelecionadasSet,
    confirmando,
    handleConfirmar
  } = useRecebimentos();

  const transacoesQuitadas = pendentes.filter((t) => transacoesSelecionadasSet.has(t._id));
  const totalAplicado = transacoesQuitadas.reduce(
    (s, t) => s + Math.abs(parseFloat(t.valor) || 0),
    0
  );
  const valorRecebimento = recebimentoSelecionado
    ? Math.abs(parseFloat(recebimentoSelecionado.valor) || 0)
    : 0;
  const sobra = Math.round((valorRecebimento - totalAplicado) * 100) / 100;
  const tagSelecionadaObj = (tags || []).find((t) => t._id === tagSelecionada);

  const podeConfirmar =
    recebimentoSelecionado &&
    tagSelecionada &&
    transacoesQuitadas.length > 0 &&
    totalAplicado <= valorRecebimento;

  if (!recebimentoSelecionado) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            message="Complete as etapas anteriores para ver o resumo."
            icon={<FaCheckCircle size={48} />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="tab-resumo-card">
      <CardContent>
        <SectionHeader title="Resumo da conciliação" icon={<FaCheckCircle size={18} />} />
        <div className="tab-resumo-valores">
          <div className="resumo-item">
            <span>Valor total recebido:</span>
            <strong>R$ {formatarValor(valorRecebimento)}</strong>
          </div>
          <div className="resumo-item">
            <span>Total aplicado:</span>
            <strong>R$ {formatarValor(totalAplicado)}</strong>
          </div>
          <div className="resumo-item sobra">
            <span>Valor de sobra:</span>
            <strong>R$ {formatarValor(sobra)}</strong>
          </div>
        </div>

        <div className="tab-resumo-detalhes">
          <h4>Transações que serão quitadas</h4>
          <ul>
            {transacoesQuitadas.map((t) => (
              <li key={t._id}>
                {t.descricao} — R$ {formatarValor(t.valor)} ({formatDateBR(t.data)})
              </li>
            ))}
          </ul>
        </div>

        <div className="tab-resumo-info">
          <p><strong>Tag aplicada:</strong> {tagSelecionadaObj ? <TagBadge tag={tagSelecionadaObj} size={16} /> : '-'}</p>
          {sobra > 0 && (
            <p className="info-sobra">
              Será criada uma nova transação de receita real de R$ {formatarValor(sobra)} para{' '}
              {proprietario || 'Titular'}.
            </p>
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={handleConfirmar}
          disabled={!podeConfirmar || confirmando}
          className="tab-resumo-btn-confirmar"
        >
          {confirmando ? 'Processando...' : 'Confirmar Conciliação'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TabResumo;
