// src/components/Transaction/TransactionCard.js
import React, { useEffect, useState } from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCard.css';
import { obterCategorias, obterTags } from '../../api';

const TransactionCard = ({ transacao, onEdit, onDelete }) => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);

  // Carrega categorias (incluindo inativas) e tags para exibir histórico
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasData, tagsData] = await Promise.all([
          obterCategorias(true),
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

    return {
      tagNome: tag.nome,
      categoriaNome: categoria ? categoria.nome : 'Categoria não encontrada',
      cor: tag.cor || categoria?.cor || '#000000',
      icone: tag.icone || categoria?.icone || 'tag'
    };
  };

  // Define o ícone de acordo com o tipo
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  return (
    <div className="transaction-card">
      <div className="card-header">
        <div className="card-title">
          <span className={`tipo-badge ${transacao.tipo}`}>
            {transacao.tipo === 'gasto' ? (
              <><FaArrowDown /> Gasto</>
            ) : (
              <><FaArrowUp /> Recebível</>
            )}
          </span>
          <h3>{transacao.descricao}</h3>
        </div>
        <div className="card-value">
          R$ {parseFloat(transacao.valor).toFixed(2)}
        </div>
      </div>

      <div className="card-details">
        <div className="transaction-info">
          <span className="date">
            {new Date(transacao.data).toLocaleDateString()}
          </span>
          {transacao.observacao && (
            <span className="observation">
              {transacao.observacao}
            </span>
          )}
        </div>

        {/* Exibe cada pagamento, incluindo as tags associadas */}
        {transacao.pagamentos && transacao.pagamentos.length > 0 && (
          <div className="payments-container">
            {transacao.pagamentos.map((pg, idx) => {
              return (
                <div key={idx} className="payment-item">
                  <div className="payment-header">
                    <span className="person">
                      {pg.pessoa}
                    </span>
                    <span className="value">
                      R$ {parseFloat(pg.valor).toFixed(2)}
                    </span>
                  </div>
                  <div className="payment-tags">
                    {pg.tags && Object.entries(pg.tags).length > 0 ? (
                      Object.entries(pg.tags).map(([categoriaId, tagIds]) => {
                        return tagIds.map((tagId) => {
                          const tagInfo = getTagInfo(tagId);
                          if (!tagInfo) return null;
                          
                          return (
                            <span
                              key={`${categoriaId}-${tagId}`}
                              className="tag-chip"
                              style={{
                                backgroundColor: `${tagInfo.cor}20`,
                                color: tagInfo.cor,
                                border: `1px solid ${tagInfo.cor}`
                              }}
                            >
                              <i className={`fas fa-${tagInfo.icone}`} />
                              {tagInfo.categoriaNome}: {tagInfo.tagNome}
                            </span>
                          );
                        });
                      })
                    ) : (
                      <span className="no-tags">Sem tags</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-actions">
        <button className="action-btn edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button className="action-btn delete-btn" onClick={() => onDelete(transacao.id)}>
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCard;
