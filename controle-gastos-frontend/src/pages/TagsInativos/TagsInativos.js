import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toast } from 'react-toastify';
import { obterTags, obterCategorias, ativarTag, ativarCategoria } from '../../api.js';
import { useData } from '../../context/DataContext';
import IconRenderer from '../../components/shared/IconRenderer';
import PageHeader from '../../components/shared/PageHeader';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import './TagsInativos.css';

const TagsInativos = () => {
  const navigate = useNavigate();
  const { refreshData } = useData();
  const [aba, setAba] = useState('tags');
  // Listas completas (ativas + inativas) — necessárias para resolver a
  // categoria de uma tag inativa e as tags de uma categoria inativa,
  // já que uma tag pode estar inativa com a categoria ainda ativa (e vice-versa).
  const [todasTags, setTodasTags] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [tags, categorias] = await Promise.all([
        obterTags(true),
        obterCategorias(true)
      ]);
      setTodasTags(tags);
      setTodasCategorias(categorias);
    } catch (error) {
      toast.error('Falha ao carregar itens inativos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const tagsInativas = useMemo(() => todasTags.filter(t => t.ativo === false), [todasTags]);
  const categoriasInativas = useMemo(() => todasCategorias.filter(c => c.ativo === false), [todasCategorias]);

  const categoriaPorId = useMemo(() => {
    const map = {};
    todasCategorias.forEach(cat => { map[cat._id] = cat; });
    return map;
  }, [todasCategorias]);

  const tagsPorCategoria = useCallback((categoriaId) => {
    return todasTags.filter(t => t.categoria === categoriaId);
  }, [todasTags]);

  const handleAtivarTag = async (codigo) => {
    try {
      await ativarTag(codigo);
      await carregar();
      await refreshData();
      toast.success('Tag ativada com sucesso!');
    } catch (error) {
      // Backend bloqueia com mensagem específica quando a categoria da tag está inativa.
      toast.error(error.message || 'Erro ao ativar tag.');
    }
  };

  const handleAtivarCategoria = async (codigo) => {
    try {
      const resultado = await ativarCategoria(codigo);
      await carregar();
      await refreshData();
      if (resultado?.tagsAtivadas > 0) {
        toast.success(`Categoria ativada! ${resultado.tagsAtivadas} tag(s) também foram reativadas.`);
      } else {
        toast.success('Categoria ativada com sucesso!');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao ativar categoria.');
    }
  };

  return (
    <div className="tags-inativos-page-container">
      <div className="tags-inativos-header">
        <button className="btn-voltar" onClick={() => navigate('/tags')}>
          <FaArrowLeft size={14} /> Voltar
        </button>
        <PageHeader icon={<LocalOfferIcon />} title="Itens Inativados" />
      </div>

      <div className="tags-inativos-tabs">
        <button
          className={aba === 'tags' ? 'tab-ativa' : ''}
          onClick={() => setAba('tags')}
        >
          Tags inativas ({tagsInativas.length})
        </button>
        <button
          className={aba === 'categorias' ? 'tab-ativa' : ''}
          onClick={() => setAba('categorias')}
        >
          Categorias inativas ({categoriasInativas.length})
        </button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : aba === 'tags' ? (
        tagsInativas.length > 0 ? (
          <ul className="inativos-list">
            {tagsInativas.map(tag => {
              const categoria = categoriaPorId[tag.categoria];
              return (
                <li key={tag.codigo} className="inativo-item">
                  <div className="icone-preview" style={{ color: tag.cor }}>
                    <IconRenderer nome={tag.icone} size={24} cor={tag.cor} />
                  </div>
                  <div className="inativo-item-info">
                    <span className="inativo-nome">{tag.nome}</span>
                    {categoria && (
                      <span className="inativo-categoria-chip" style={{ color: categoria.cor, borderColor: categoria.cor }}>
                        <IconRenderer nome={categoria.icone} size={14} cor={categoria.cor} />
                        {categoria.nome}
                        {categoria.ativo === false && <span className="chip-inativa-marca"> (inativa)</span>}
                      </span>
                    )}
                  </div>
                  <button className="btn-success" onClick={() => handleAtivarTag(tag.codigo)}>
                    <FaCheckCircle size={14} /> Ativar
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Nenhuma tag inativada.</p>
        )
      ) : (
        categoriasInativas.length > 0 ? (
          <div className="categorias-inativas-accordions">
            {categoriasInativas.map(cat => {
              const tagsDaCategoria = tagsPorCategoria(cat._id);
              return (
                <Accordion key={cat.codigo} className="categoria-inativa-accordion">
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <div className="categoria-accordion-summary">
                      <div className="icone-preview" style={{ color: cat.cor }}>
                        <IconRenderer nome={cat.icone} size={24} cor={cat.cor} />
                      </div>
                      <span className="inativo-nome">{cat.nome}</span>
                      <span className="tags-count-badge">{tagsDaCategoria.length} tag(s)</span>
                    </div>
                  </AccordionSummary>
                  <AccordionDetails>
                    <div className="categoria-accordion-actions">
                      <button className="btn-success" onClick={() => handleAtivarCategoria(cat.codigo)}>
                        <FaCheckCircle size={14} /> Ativar categoria
                      </button>
                    </div>
                    {tagsDaCategoria.length > 0 ? (
                      <ul className="inativos-list inativos-list-aninhada">
                        {tagsDaCategoria.map(tag => (
                          <li key={tag.codigo} className="inativo-item">
                            <div className="icone-preview" style={{ color: tag.cor }}>
                              <IconRenderer nome={tag.icone} size={20} cor={tag.cor} />
                            </div>
                            <div className="inativo-item-info">
                              <span className="inativo-nome">{tag.nome}</span>
                              <span className={tag.ativo === false ? 'badge-inativa' : 'badge-ativa'}>
                                {tag.ativo === false ? 'Inativa' : 'Ativa'}
                              </span>
                            </div>
                            {tag.ativo === false && (
                              <button className="btn-success" onClick={() => handleAtivarTag(tag.codigo)}>
                                <FaCheckCircle size={14} /> Ativar
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Esta categoria não tem tags cadastradas.</p>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </div>
        ) : (
          <p>Nenhuma categoria inativada.</p>
        )
      )}
    </div>
  );
};

export default TagsInativos;
