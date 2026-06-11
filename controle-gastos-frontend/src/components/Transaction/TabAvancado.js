import React from 'react';
import SubcontaSelect from '../shared/SubcontaSelect';
import EmprestimoSecao from '../Emprestimos/EmprestimoSecao';

export const TAB_AVANCADO = 'avancado';

const TabAvancado = ({
  parcelamento,
  contaConjunta,
  subcontas,
  subconta,
  setSubconta,
  valorTotal,
  parteUsuario,
  setParteUsuario,
  transacao,
  emprestimoForm
}) => {
  const { state: cState, setters: cSetters, toggle: ccToggle, parteOutro } = contaConjunta;

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

      <div className="form-section conta-conjunta-section">
        <label>
          <input
            type="checkbox"
            checked={cState.isContaConjunta}
            onChange={(e) => ccToggle(e.target.checked)}
            tabIndex={92}
          />
          {' '}Esta e uma conta conjunta
        </label>
        {cState.isContaConjunta && (
          <div className="conta-conjunta-campos">
            <div className="conjunta-campo">
              <label>Vinculo:</label>
              <select
                value={cState.vinculoId}
                onChange={(e) => cSetters.setVinculoId(e.target.value)}
                required={cState.isContaConjunta}
                tabIndex={93}
              >
                <option value="">Selecione...</option>
                {cState.vinculos.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.nome} ({v.participante})
                  </option>
                ))}
              </select>
            </div>
            <div className="conjunta-campo">
              <label>Quem pagou:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="pagoPor"
                    value="usuario"
                    checked={cState.pagoPor === 'usuario'}
                    onChange={() => cSetters.setPagoPor('usuario')}
                    tabIndex={94}
                  />
                  {' '}Eu paguei
                </label>
                <label>
                  <input
                    type="radio"
                    name="pagoPor"
                    value="outro"
                    checked={cState.pagoPor === 'outro'}
                    onChange={() => cSetters.setPagoPor('outro')}
                    tabIndex={95}
                  />
                  {' '}Outro participante pagou
                </label>
              </div>
            </div>
            {cState.pagoPor === 'outro' && (
              <>
                <div className="conjunta-campo">
                  <label>Valor total da compra:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cState.valorTotalCompra}
                    onChange={(e) => cSetters.setValorTotalCompra(e.target.value)}
                    tabIndex={96}
                  />
                </div>
                <div className="conjunta-campo">
                  <label>Minha parte:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={parteUsuario}
                    onChange={(e) => setParteUsuario(e.target.value)}
                    tabIndex={97}
                  />
                  {cState.valorTotalCompra && parteUsuario && (
                    <span className="parte-outro-info">
                      Parte do outro: R$ {parteOutro.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </>
            )}
            {cState.pagoPor === 'usuario' && (
              <div className="conjunta-campo">
                <label>Minha parte (do valor total):</label>
                <input
                  type="number"
                  step="0.01"
                  value={parteUsuario}
                  onChange={(e) => setParteUsuario(e.target.value)}
                  placeholder={valorTotal}
                  tabIndex={98}
                />
                {valorTotal && parteUsuario && (
                  <span className="parte-outro-info">
                    Parte do outro: R$ {parteOutro.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {subcontas.length > 0 && (
        <div className="form-section">
          <label>Subconta (opcional):</label>
          <SubcontaSelect
            subcontas={subcontas}
            value={subconta}
            onChange={setSubconta}
            placeholder="Nenhuma"
            allowEmpty
            className="subconta-select-nova-transacao"
            tabIndex={91}
          />
        </div>
      )}

      {emprestimoForm && <EmprestimoSecao form={emprestimoForm} valorTotal={valorTotal} />}
    </div>
  );
};

export default TabAvancado;
