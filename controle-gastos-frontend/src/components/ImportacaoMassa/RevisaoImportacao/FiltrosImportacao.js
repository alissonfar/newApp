import React, { useState } from 'react';
import { FaSearch, FaFilter, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import './FiltrosImportacao.css';

const FiltrosImportacao = ({ onFiltrosChange }) => {
  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    tipo: 'todos',
    dataInicio: '',
    dataFim: '',
    valorMinimo: '',
    valorMaximo: '',
    ordenacao: {
      campo: 'data',
      direcao: 'desc'
    }
  });

  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  const handleInputChange = (campo, valor) => {
    const novosFiltros = {
      ...filtros,
      [campo]: valor
    };
    setFiltros(novosFiltros);
    onFiltrosChange(novosFiltros);
  };

  const handleOrdenacaoChange = (campo) => {
    const novosFiltros = {
      ...filtros,
      ordenacao: {
        campo,
        direcao: filtros.ordenacao.campo === campo && filtros.ordenacao.direcao === 'asc' 
          ? 'desc' 
          : 'asc'
      }
    };
    setFiltros(novosFiltros);
    onFiltrosChange(novosFiltros);
  };

  const limparFiltros = () => {
    const filtrosLimpos = {
      busca: '',
      status: 'todos',
      tipo: 'todos',
      dataInicio: '',
      dataFim: '',
      valorMinimo: '',
      valorMaximo: '',
      ordenacao: {
        campo: 'data',
        direcao: 'desc'
      }
    };
    setFiltros(filtrosLimpos);
    onFiltrosChange(filtrosLimpos);
  };

  const IconeOrdenacao = ({ campo }) => {
    if (filtros.ordenacao.campo !== campo) {
      return null;
    }
    return filtros.ordenacao.direcao === 'asc' ? <FaSortAmountUp /> : <FaSortAmountDown />;
  };

  return (
    <div className="filtros-importacao">
      <div className="filtros-principais">
        <div className="campo-busca">
          <FaSearch className="icone-busca" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={filtros.busca}
            onChange={(e) => handleInputChange('busca', e.target.value)}
          />
        </div>

        <div className="filtros-rapidos">
          <select
            value={filtros.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="validada">Validadas</option>
          </select>

          <select
            value={filtros.tipo}
            onChange={(e) => handleInputChange('tipo', e.target.value)}
          >
            <option value="todos">Todos os Tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>

          <button 
            className={`btn-filtros-avancados ${mostrarFiltrosAvancados ? 'ativo' : ''}`}
            onClick={() => setMostrarFiltrosAvancados(!mostrarFiltrosAvancados)}
          >
            <FaFilter /> Filtros Avançados
          </button>
        </div>

        <div className="ordenacao">
          <button 
            className={`btn-ordenacao ${filtros.ordenacao.campo === 'data' ? 'ativo' : ''}`}
            onClick={() => handleOrdenacaoChange('data')}
          >
            Data <IconeOrdenacao campo="data" />
          </button>
          <button 
            className={`btn-ordenacao ${filtros.ordenacao.campo === 'valor' ? 'ativo' : ''}`}
            onClick={() => handleOrdenacaoChange('valor')}
          >
            Valor <IconeOrdenacao campo="valor" />
          </button>
        </div>
      </div>

      {mostrarFiltrosAvancados && (
        <div className="filtros-avancados">
          <div className="grupo-filtro">
            <label>Período</label>
            <div className="campos-data">
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleInputChange('dataInicio', e.target.value)}
                placeholder="Data Início"
              />
              <span>até</span>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleInputChange('dataFim', e.target.value)}
                placeholder="Data Fim"
              />
            </div>
          </div>

          <div className="grupo-filtro">
            <label>Faixa de Valor</label>
            <div className="campos-valor">
              <input
                type="number"
                value={filtros.valorMinimo}
                onChange={(e) => handleInputChange('valorMinimo', e.target.value)}
                placeholder="Valor Mínimo"
                step="0.01"
              />
              <span>até</span>
              <input
                type="number"
                value={filtros.valorMaximo}
                onChange={(e) => handleInputChange('valorMaximo', e.target.value)}
                placeholder="Valor Máximo"
                step="0.01"
              />
            </div>
          </div>

          <button className="btn-limpar" onClick={limparFiltros}>
            Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default FiltrosImportacao; 