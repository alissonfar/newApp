import React, { useState, useCallback } from 'react';
import { Tooltip } from '@mui/material';
import TagSelector from './TagSelector';

export const TAB_PAGAMENTOS = 'pagamentos';

const TabPagamentos = ({
  pagamentos,
  handlePagamentoChange,
  addPagamento,
  removePagamento,
  splitEqually,
  splitInto,
  clearPaymentTags,
  duplicatePagamento,
  isParcelado,
  totalParcelas,
  categorias,
  allTags,
  proprietarioPadrao
}) => {
  const [expandedTagIndex, setExpandedTagIndex] = useState(null);

  const toggleTags = useCallback((index) => {
    setExpandedTagIndex(prev => prev === index ? null : index);
  }, []);

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
            {!isParcelado && (
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
            )}
          </div>
        </div>

        <div className="pagamentos-resumo">
          {pagamentos.map((p, i) => (
            <span key={i}>
              {p.pessoa || `Pag. ${i + 1}`}: R$ {parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}
              {i < pagamentos.length - 1 && ' | '}
            </span>
          ))}
        </div>

        {pagamentos.map((pag, index) => {
          const hasTags = pag.paymentTags && Object.keys(pag.paymentTags).some(k => (pag.paymentTags[k] || []).length > 0);
          const isExpanded = expandedTagIndex === index;

          return (
            <div key={index} className="pagamento-item">
              <div className="pagamento-item-header">
                <span className="pagamento-numero">Pagamento {index + 1}</span>
                <div className="pagamento-item-actions">
                  {!isParcelado && (
                    <button type="button" onClick={() => duplicatePagamento(index)} title="Duplicar">
                      Duplicar
                    </button>
                  )}
                  {!isParcelado && pagamentos.length > 1 && (
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
                  {isParcelado ? (
                    <span className="parcela-valor-info">{totalParcelas} parcelas</span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={pag.valor}
                      onChange={e => handlePagamentoChange(index, 'valor', e.target.value)}
                      required
                      tabIndex={6 + (index * 10)}
                    />
                  )}
                </div>
              </div>

              {!isParcelado && (
                <div className="pagamento-tags-summary">
                  {hasTags ? (
                    <div className="tags-chips">
                      {categorias.map(cat => {
                        const catTags = (pag.paymentTags && pag.paymentTags[cat._id]) || [];
                        if (catTags.length === 0) return null;
                        const catColor = cat.cor || '#666';
                        return (
                          <span
                            key={cat._id}
                            className="tag-chip"
                            style={{ backgroundColor: catColor + '18', color: catColor, border: '1px solid ' + catColor + '30' }}
                          >
                            <span className="tag-chip-category">{cat.nome}:</span>
                            {catTags.length}
                          </span>
                        );
                      })}
                      <button type="button" className="tag-clear-btn" onClick={() => clearPaymentTags(index)} title="Limpar tags">
                        limpar
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Sem tags</span>
                  )}
                  <button
                    type="button"
                    className="tags-expand-btn"
                    onClick={() => toggleTags(index)}
                  >
                    {isExpanded ? 'Fechar tags' : 'Editar tags'}
                  </button>

                  {isExpanded && (
                    <div className="tags-expanded-section">
                      <TagSelector
                        categorias={categorias}
                        allTags={allTags}
                        paymentTags={pag.paymentTags}
                        onTagsChange={(newTags) => handlePagamentoChange(index, 'paymentTags', newTags)}
                        tabIndex={50 + (index * 10)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!isParcelado && (
          <Tooltip title="Alt + P">
            <button type="button" onClick={addPagamento} className="btn-adicionar-pagamento">
              + Adicionar Pagamento
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default TabPagamentos;
