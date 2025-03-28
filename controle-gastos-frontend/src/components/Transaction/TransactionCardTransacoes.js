// src/components/Transaction/TransactionCardTransacoes.js
import React, { useEffect, useState } from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCardTransacoes.css';
import { formatDateBR } from '../../utils/dateUtils';
import { obterCategorias, obterTags } from '../../api';

const TransactionCardTransacoes = ({ transacao, onEdit, onDelete }) => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);

  // Carrega categorias e tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasData, tagsData] = await Promise.all([
          obterCategorias(),
          obterTags()
        ]);
        setCategorias(categoriasData);
        setTags(tagsData);
      } catch (error) {
        console.error('Erro ao carregar categorias e tags:', error);
      }
    };
    fetchData();
  }, []);

  // Função para converter IDs em nomes
  const getTagInfo = (tagId) => {
    const tag = tags.find(t => t._id === tagId);
    if (!tag) return null;
    
    // Tenta encontrar a categoria primeiro pelo ID, depois pelo nome
    let categoria = categorias.find(c => c._id === tag.categoria);
    if (!categoria) {
      // Se não encontrou pelo ID, tenta pelo nome (compatibilidade)
      categoria = categorias.find(c => c.nome === tag.categoria);
    }

    // Se ainda não encontrou, verifica se o próprio campo categoria é um objeto
    if (!categoria && typeof tag.categoria === 'object' && tag.categoria._id) {
      categoria = categorias.find(c => c._id === tag.categoria._id);
    }

    console.log('Tag:', tag.nome, 'Categoria encontrada:', categoria?.nome); // [DEBUG]

    return {
      tagNome: tag.nome,
      categoriaNome: categoria ? categoria.nome : 'Categoria não encontrada',
      cor: tag.cor || categoria?.cor || '#000000'
    };
  };

  // Define o ícone de acordo com o tipo da transação
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  // Formata a data usando a função utilitária
  const formattedDate = formatDateBR(transacao.data);

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <div className="card-header-left">
          <h3 className="card-title">{transacao.descricao}</h3>
          <span className="card-date">{formattedDate}</span>
        </div>
        <div className="card-header-right">
          {tipoIcon}
          <span className="card-value">
            R${parseFloat(transacao.valor).toFixed(2)}
          </span>
          <span className={`badge ${transacao.tipo}`}>
            {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
          </span>
        </div>
      </div>

      <div className="card-details">
        {/* Se houver pagamentos, exibe informações detalhadas */}
        {transacao.pagamentos && transacao.pagamentos.length > 0 && (
          <div className="payments-info">
            <h4>Pagamentos</h4>
            {transacao.pagamentos.map((pg, idx) => (
              <div key={idx} className="payment-item">
                <div className="payment-info">
                  <span className="payment-person">
                    <strong>Pessoa:</strong> {pg.pessoa}
                  </span>
                  <span className="payment-value">
                    <strong>Valor:</strong> R${parseFloat(pg.valor).toFixed(2)}
                  </span>
                </div>
                {/* Exibe tags associadas a esse pagamento, se houver */}
                {pg.tags && Object.entries(pg.tags).length > 0 ? (
                  <div className="payment-tags">
                    {Object.entries(pg.tags).map(([categoriaId, tagIds]) =>
                      tagIds.map((tagId) => {
                        const tagInfo = getTagInfo(tagId);
                        if (!tagInfo) return null;
                        
                        return (
                          <span
                            key={`${categoriaId}-${tagId}`}
                            className="tag-chip"
                            style={{
                              backgroundColor: `${tagInfo.cor}20`,
                              color: tagInfo.cor
                            }}
                          >
                            {tagInfo.categoriaNome}: {tagInfo.tagNome}
                          </span>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="payment-tags">
                    <span className="no-tags">Sem tags</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


      </div>

      <div className="card-actions">
        <button className="btn-action edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button className="btn-action delete-btn" onClick={() => onDelete(transacao.id)}>
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCardTransacoes;