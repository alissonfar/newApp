import React, { useState, useMemo } from 'react';
import Card from '../shared/Card';
import useSimulacao from '../../hooks/useSimulacao';
import './ComparacaoRapidaCard.css';

const MESES_PADRAO = 12;
const VALOR_PADRAO = 10000;

function formatarMoeda(v) {
  return `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ComparacaoRapidaCard({ cdi }) {
  const [valorBase, setValorBase] = useState(VALOR_PADRAO);

  const valorNum = parseFloat(valorBase) || 0;

  const sim100 = useSimulacao(cdi?.taxaAnual, valorNum, 100, MESES_PADRAO);
  const sim110 = useSimulacao(cdi?.taxaAnual, valorNum, 110, MESES_PADRAO);
  const sim120 = useSimulacao(cdi?.taxaAnual, valorNum, 120, MESES_PADRAO);

  const resultados = useMemo(() => [
    { percentual: 100, valorFinal: sim100.valorFinal },
    { percentual: 110, valorFinal: sim110.valorFinal },
    { percentual: 120, valorFinal: sim120.valorFinal }
  ], [sim100.valorFinal, sim110.valorFinal, sim120.valorFinal]);

  return (
    <Card className="comparacao-rapida-card">
      <h3 className="comparacao-rapida-card__title">Comparação Rápida</h3>
      <p className="comparacao-rapida-card__subtitulo">
        Para R${' '}
        <input
          type="number"
          min="0"
          step="100"
          className="comparacao-rapida-card__input-valor"
          value={valorBase}
          onChange={(e) => setValorBase(e.target.value)}
        />{' '}
        em {MESES_PADRAO} meses:
      </p>

      {!cdi?.taxaAnual ? (
        <p className="comparacao-rapida-card__aviso">Carregue os dados do CDI.</p>
      ) : valorNum <= 0 ? (
        <p className="comparacao-rapida-card__aviso">Informe um valor válido.</p>
      ) : (
        <div className="comparacao-rapida-card__tabela">
          {resultados.map((r) => (
            <div key={r.percentual} className="comparacao-rapida-card__linha">
              <span className="comparacao-rapida-card__percentual">{r.percentual}% CDI</span>
              <span className="comparacao-rapida-card__valor">{formatarMoeda(r.valorFinal)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default ComparacaoRapidaCard;
