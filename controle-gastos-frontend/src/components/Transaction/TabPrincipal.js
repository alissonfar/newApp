import React from 'react';
import DateFieldWithShortcuts from './DateFieldWithShortcuts';
import ValorMonetarioInput from './ValorMonetarioInput';

export const TAB_PRINCIPAL = 'principal';

const TabPrincipal = ({
  tipo, setTipo, tipoRef,
  descricao, setDescricao, descricaoRef,
  data, setData,
  valorTotal, onValorTotalChange, valorRef,
  observacao, setObservacao,
  onToday, onYesterday,
  showValidationWarning
}) => {
  return (
    <div data-tab="principal" className="tab-panel tab-principal">
      <div className="form-section">
        <label>Tipo:</label>
        <select ref={tipoRef} value={tipo} onChange={e => setTipo(e.target.value)} required tabIndex={1}>
          <option value="gasto">Gasto</option>
          <option value="recebivel">Recebível</option>
        </select>
      </div>
      <div className="form-section">
        <label>Descrição:</label>
        <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} required ref={descricaoRef} tabIndex={2} />
      </div>
      <DateFieldWithShortcuts value={data} onChange={setData} onToday={onToday} onYesterday={onYesterday} tabIndex={3} />
      <ValorMonetarioInput value={valorTotal} onChange={onValorTotalChange} showWarning={showValidationWarning} ref={valorRef} tabIndex={4} />
      <div className="form-section">
        <label>Observação:</label>
        <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows="3" placeholder="Adicione uma observação (opcional)" tabIndex={90} />
      </div>
    </div>
  );
};

export default TabPrincipal;
