import React from 'react';
import { Tooltip } from '@mui/material';
import TagSelector from './TagSelector';
import { formatDateBR } from '../../utils/dateUtils';

export const TAB_PAGAMENTOS = 'pagamentos';

const ParcelaPreview = ({ preview, index }) => {
  if (!preview || !Array.isArray(preview) || preview.length === 0) return null;

  const filteredByPessoa = preview.filter(p => {
    return p.installmentNumber != null;
  });

  if (filteredByPessoa.length === 0) return null;

  return (
    <div className="preview-parcelas-mini">
      <div className="preview-parcelas-mini-header">Preview das parcelas</div>
      <div className="preview-parcelas-table-wrapper">
        <table className="preview-parcelas-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Pessoa</th>
              <th>Data</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((p, i) => (
              <tr key={i}>
                <td>{p.installmentNumber}/{p.installmentTotal || '?'}</td>
                <td>{p.pessoa}</td>
                <td>{p.date ? formatDateBR(p.date) : '—'}</td>
                <td>R$ {parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TabPagamentos = ({
  pagamentos,
  handlePagamentoChange,
  addPagamento,
  removePagamento,
  splitEqually,
  splitInto,
  duplicatePagamento,
  parcelamentos,
  previews,
  toggleParcelamento,
  setParcelamentoField,
  categorias,
  allTags,
  proprietarioPadrao,
  showInForm
}) => {

  return (
    <div data-tab="pagamentos" className="tab-panel tab-pagamentos">
      <div className="form-section pagamentos-section">
        <div className="pagamentos-header">
          <h3>Pagamentos</h3>
          <div className="pagamentos-actions">
            {pagamentos.length > 1 && (
              <button type="button" className="btn-rateio" onClick={splitEqually}>
                Rateio igual
              </button>
            )}
            <div className="divide-by-select">
              <span>Dividir em</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (n >= 2) {
                    splitInto(n);
                    e.target.value = '';
                  }
                }}
              >
                <option value="" disabled>—</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="8">8</option>
                <option value="10">10</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pagamentos-resumo">
          {pagamentos.map((p, i) => (
            <span key={i}>
              {p.pessoa || `Pag. ${i + 1}`}: R$ {parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}
              {parcelamentos && parcelamentos[i]?.ativo && ` (${parcelamentos[i].quantidade}x)`}
              {i < pagamentos.length - 1 && ' | '}
            </span>
          ))}
        </div>

        {pagamentos.map((pag, index) => {
          const isParcelado = parcelamentos && parcelamentos[index]?.ativo;
          const preview = previews && previews[index];

          return (
            <div key={index} className="pagamento-item">
              <div className="pagamento-item-header">
                <span className="pagamento-numero">Pagamento {index + 1}</span>
                <div className="pagamento-item-actions">
                  <button type="button" onClick={() => duplicatePagamento(index)} title="Duplicar">
                    Duplicar
                  </button>
                  {pagamentos.length > 1 && (
                    <button type="button" onClick={() => removePagamento(index)} title="Remover">
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div className="pagamento-campos-principais">
                <div className="pagamento-field-pessoa form-section">
                  <label>Pessoa</label>
                  <input
                    type="text"
                    value={pag.pessoa}
                    onChange={e => handlePagamentoChange(index, 'pessoa', e.target.value)}
                    required
                    tabIndex={5 + (index * 10)}
                  />
                </div>
                <div className="pagamento-field-valor form-section">
                  <label>Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pag.valor}
                    onChange={e => handlePagamentoChange(index, 'valor', e.target.value)}
                    required
                    tabIndex={6 + (index * 10)}
                  />
                </div>
              </div>

              {showInForm && (
                <div className="pagamento-parcelamento-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!isParcelado}
                      onChange={(e) => toggleParcelamento(index, e.target.checked)}
                      tabIndex={40 + (index * 10)}
                    />
                    {' '}Parcelar este pagamento?
                  </label>
                  {isParcelado && (
                    <div className="parcelamento-campos-inline">
                      <div className="form-section-inline">
                        <label>Qtd:</label>
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={parcelamentos[index]?.quantidade || '2'}
                          onChange={(e) => setParcelamentoField(index, 'quantidade', e.target.value)}
                          tabIndex={41 + (index * 10)}
                          className="parcelamento-qtd-input"
                        />
                      </div>
                      <div className="form-section-inline">
                        <label>Intervalo (dias):</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={parcelamentos[index]?.intervaloDias || '30'}
                          onChange={(e) => setParcelamentoField(index, 'intervaloDias', e.target.value)}
                          tabIndex={42 + (index * 10)}
                          className="parcelamento-intervalo-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {preview && isParcelado && (
                <ParcelaPreview preview={preview} index={index} />
              )}

              <div className="pagamento-tags-summary">
                <TagSelector
                  categorias={categorias}
                  allTags={allTags}
                  paymentTags={pag.paymentTags}
                  onTagsChange={(newTags) => handlePagamentoChange(index, 'paymentTags', newTags)}
                  tabIndex={50 + (index * 10)}
                />
              </div>
            </div>
          );
        })}

        <Tooltip title="Alt + P">
          <button type="button" onClick={addPagamento} className="btn-adicionar-pagamento">
            + Adicionar Pagamento
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default TabPagamentos;
