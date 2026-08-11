import React from 'react';
import EmprestimoSecao from '../Emprestimos/EmprestimoSecao';

export const TAB_AVANCADO = 'avancado';

const TabAvancado = ({
  parcelamento,
  valorTotal,
  transacao,
  emprestimoForm,
  tipoTransacao,
  qtdPagamentos = 1
}) => {
  const temParcelamento = Object.values(parcelamento.state.parcelamentos || {}).some(c => c?.ativo);

  return (
    <div data-tab="avancado" className="tab-panel tab-avancado">
      {temParcelamento && (
        <div className="form-section parcelamento-resumo">
          <p className="parcelamento-resumo-texto">
            <strong>Parcelamento configurado nos pagamentos.</strong> {' '}
            Cada participante pode ter seu proprio plano de parcelamento.
          </p>
        </div>
      )}

      {emprestimoForm && <EmprestimoSecao form={emprestimoForm} valorTotal={valorTotal} tipoTransacao={tipoTransacao} qtdPagamentos={qtdPagamentos} />}
    </div>
  );
};

export default TabAvancado;
