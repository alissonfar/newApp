import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../shared/Card';
import SegmentedControl from '../shared/SegmentedControl';
import useSimulacao from '../../hooks/useSimulacao';
import './SimuladorForm.css';

const PERCENTUAIS_PRESET = [100, 110, 120];
const PERIODOS_PRESET = [1, 3, 6, 12];

const PERCENTUAL_OPTIONS = PERCENTUAIS_PRESET.map((p) => ({ value: String(p), label: `${p}%` }));
const PERIODO_OPTIONS = PERIODOS_PRESET.map((m) => ({
  value: String(m),
  label: m === 1 ? '1 mês' : `${m} meses`
}));

function formatarMoeda(v) {
  return `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SimuladorForm({ cdi }) {
  const [searchParams] = useSearchParams();
  const [valorInicial, setValorInicial] = useState('');
  const [percentualCDI, setPercentualCDI] = useState(100);
  const [percentualCustom, setPercentualCustom] = useState('');
  const [meses, setMeses] = useState(12);
  const [mesesCustom, setMesesCustom] = useState('');

  // Inicializar a partir de query params (ex: /patrimonio/simulador?valor=10000&percentual=110)
  useEffect(() => {
    const valorParam = searchParams.get('valor');
    const percentualParam = searchParams.get('percentual');
    if (valorParam) {
      const v = parseFloat(valorParam);
      if (!isNaN(v)) setValorInicial(String(v));
    }
    if (percentualParam) {
      const p = parseFloat(percentualParam);
      if (!isNaN(p)) {
        if (PERCENTUAIS_PRESET.includes(p)) {
          setPercentualCDI(p);
        } else {
          setPercentualCDI(0);
          setPercentualCustom(String(p));
        }
      }
    }
  }, [searchParams]);

  const percentualEfetivo = percentualCDI > 0 ? percentualCDI : parseFloat(percentualCustom) || 0;
  const mesesEfetivo = meses > 0 ? meses : (parseFloat(mesesCustom) || 0) || 12;

  const simulacao = useSimulacao(
    cdi?.taxaAnual,
    parseFloat(valorInicial) || 0,
    percentualEfetivo,
    mesesEfetivo
  );

  const temDadosValidos = cdi?.taxaAnual && valorInicial && parseFloat(valorInicial) > 0 && percentualEfetivo > 0 && mesesEfetivo > 0;

  return (
    <Card className="simulador-form">
      <h3 className="simulador-form__title">Simulação de Rendimento</h3>

      <div className="simulador-form__grid">
        <div className="simulador-form__inputs">
          <div className="form-group">
            <label>Valor inicial (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 10000"
              value={valorInicial}
              onChange={(e) => setValorInicial(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>% do CDI</label>
            <div className="simulador-form__opcoes">
              <SegmentedControl
                options={PERCENTUAL_OPTIONS}
                value={percentualCustom ? 'custom' : String(percentualCDI)}
                onChange={(v) => {
                  if (v === 'custom') return;
                  setPercentualCDI(Number(v));
                  setPercentualCustom('');
                }}
              />
              <div className="simulador-form__custom-wrapper">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Outro %"
                  className="simulador-form__input-custom"
                  value={percentualCustom}
                  onChange={(e) => {
                    setPercentualCustom(e.target.value);
                    if (e.target.value) setPercentualCDI(0);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Período</label>
            <div className="simulador-form__opcoes">
              <SegmentedControl
                options={PERIODO_OPTIONS}
                value={mesesCustom ? 'custom' : String(meses)}
                onChange={(v) => {
                  if (v === 'custom') return;
                  setMeses(Number(v));
                  setMesesCustom('');
                }}
              />
              <div className="simulador-form__custom-wrapper">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Outro (meses)"
                  className="simulador-form__input-custom"
                  value={mesesCustom}
                  onChange={(e) => {
                    setMesesCustom(e.target.value);
                    if (e.target.value) setMeses(0);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="simulador-form__resultados">
          {!cdi?.taxaAnual ? (
            <p className="simulador-form__aviso">Carregue os dados do CDI para simular.</p>
          ) : !temDadosValidos ? (
            <p className="simulador-form__aviso">Preencha valor, % CDI e período.</p>
          ) : (
            <>
              <div className="simulador-form__resultado-row">
                <span>Valor investido</span>
                <span>{formatarMoeda(parseFloat(valorInicial) || 0)}</span>
              </div>
              <div className="simulador-form__resultado-row simulador-form__resultado-row--destaque">
                <span>Valor final estimado</span>
                <span>{formatarMoeda(simulacao.valorFinal)}</span>
              </div>
              <div className="simulador-form__resultado-row simulador-form__resultado-row--positivo">
                <span>Total de rendimento</span>
                <span>+{formatarMoeda(simulacao.rendimentoTotal)}</span>
              </div>
              <div className="simulador-form__resultado-row">
                <span>% no período</span>
                <span>{simulacao.percentualPeriodo.toFixed(2)}%</span>
              </div>
              {simulacao.simulado100 && (
                <div className="simulador-form__comparacao">
                  <p>Comparação com 100% CDI:</p>
                  <p className="simulador-form__comparacao-valor">
                    100% CDI → {formatarMoeda(simulacao.simulado100.valorFinal)}
                    {percentualEfetivo > 100 && (
                      <span className="simulador-form__diferenca">
                        (você ganha {formatarMoeda(simulacao.valorFinal - simulacao.simulado100.valorFinal)} a mais)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default SimuladorForm;
