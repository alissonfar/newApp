import React from 'react';
import SubcontaSelect from '../shared/SubcontaSelect';
import { formatDateBR } from '../../utils/dateUtils';

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
  transacao
}) => {
  const { state: pState, setters: pSetters } = parcelamento;
  const { state: cState, setters: cSetters, toggle: ccToggle, parteOutro } = contaConjunta;

  return (
    <div data-tab="avancado" className="tab-panel tab-avancado">
      {pState.showInForm && (
        <div className="form-section parcelamento-section">
          <label>
            <input
              type="checkbox"
              checked={pState.isParcelado}
              onChange={(e) => pSetters.setIsParcelado(e.target.checked)}
              tabIndex={41}
            />
            {' '}Parcelado?
          </label>
          {pState.isParcelado && (
            <div className="parcelamento-campos">
              <div className="form-section">
                <label>Quantidade de parcelas:</label>
                <input
                  type="number"
                  min="2"
                  max="60"
                  value={pState.totalParcelas}
                  onChange={(e) => pSetters.setTotalParcelas(e.target.value)}
                  tabIndex={42}
                />
              </div>
              <div className="form-section">
                <label>Intervalo (dias):</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={pState.intervaloDias}
                  onChange={(e) => pSetters.setIntervaloDias(e.target.value)}
                  tabIndex={43}
                />
              </div>
            </div>
          )}
          {pState.previewParcelas && pState.previewParcelas.parcelas && pState.previewParcelas.parcelas.length > 0 && (
            <div className="preview-parcelas-section">
              <h4>Preview das parcelas</h4>
              <div className="preview-parcelas-table-wrapper">
                <table className="preview-parcelas-table">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Data</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pState.previewParcelas.parcelas.map((p) => (
                      <tr key={p.installmentNumber}>
                        <td>{p.installmentNumber}/{pState.previewParcelas.parcelas.length}</td>
                        <td>{formatDateBR(p.date)}</td>
                        <td>R$ {parseFloat(p.value).toFixed(2).replace('.', ',')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="preview-parcelas-resumo">
                <p><strong>Valor total:</strong> R$ {parseFloat(pState.previewParcelas.valorTotal || 0).toFixed(2).replace('.', ',')}</p>
                <p><strong>Intervalo:</strong> {pState.previewParcelas.intervalInDays} dias</p>
                <p><strong>Data inicial:</strong> {formatDateBR(pState.previewParcelas.startDate)}</p>
              </div>
            </div>
          )}
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
            <div className="form-section">
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
            <div className="form-section">
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
                <div className="form-section">
                  <label>Valor total da compra:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cState.valorTotalCompra}
                    onChange={(e) => cSetters.setValorTotalCompra(e.target.value)}
                    tabIndex={96}
                  />
                </div>
                <div className="form-section">
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
              <div className="form-section">
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
    </div>
  );
};

export default TabAvancado;
