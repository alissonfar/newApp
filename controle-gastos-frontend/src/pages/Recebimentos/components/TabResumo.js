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
    handleConfirmar,
    handleConfirmarEContinuar,
    conciliacoesNaSessao
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

  const motivoBloqueio = (() => {
    if (!recebimentoSelecionado) return null;
    if (!tagSelecionada) return 'Selecione uma tag na aba Configuração — é ela que marca os gastos como quitados.';
    if (transacoesQuitadas.length === 0) return 'Selecione ao menos uma transação na aba Seleção.';
    if (totalAplicado > valorRecebimento) return `Total aplicado (R$ ${formatarValor(totalAplicado)}) excede o recebimento (R$ ${formatarValor(valorRecebimento)}).`;
    return null;
  })();

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

        <div className="tab-resumo-acoes-finais">
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirmar}
            disabled={!podeConfirmar || confirmando}
            className="tab-resumo-btn-confirmar"
            title={motivoBloqueio || 'Confirmar conciliação'}
          >
            {confirmando ? 'Processando...' : 'Confirmar Conciliação'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleConfirmarEContinuar}
            disabled={!podeConfirmar || confirmando}
            className="tab-resumo-btn-confirmar-continuar"
            title={motivoBloqueio || 'Confirma e volta para Configuração, mantendo as tags para iniciar a próxima'}
          >
            {confirmando ? 'Processando...' : 'Confirmar e Conciliar Próxima →'}
          </Button>
        </div>
        {motivoBloqueio && (
          <div className="tab-resumo-aviso-bloqueio" role="alert">
            <span aria-hidden>⚠️</span> {motivoBloqueio}
          </div>
        )}
        {conciliacoesNaSessao > 0 && (
          <p className="tab-resumo-sessao-info">
            {conciliacoesNaSessao} conciliação(ões) já realizada(s) nesta sessão.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TabResumo;
