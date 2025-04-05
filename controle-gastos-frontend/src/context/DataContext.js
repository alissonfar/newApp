// src/context/DataContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { obterCategorias, obterTags } from '../api'; // Ajuste o caminho conforme necessário
import { toast } from 'react-toastify';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      setErrorData(null);
      try {
        // Usar Promise.all para buscar em paralelo
        const [cats, tgs] = await Promise.all([
          obterCategorias(),
          obterTags()
        ]);
        setCategorias(cats);
        setTags(tgs);
      } catch (error) {
        console.error("Erro ao carregar dados iniciais (categorias/tags):", error);
        setErrorData(error);
        toast.error("Falha ao carregar dados essenciais (categorias/tags).");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
    // O array de dependências vazio [] garante que isso rode apenas uma vez na montagem
  }, []);

  const refreshData = async () => {
    setLoadingData(true);
    setErrorData(null);
    try {
      const [cats, tgs] = await Promise.all([
        obterCategorias(),
        obterTags()
      ]);
      setCategorias(cats);
      setTags(tgs);
      toast.info("Dados de categorias e tags atualizados.");
    } catch (error) {
      console.error("Erro ao atualizar dados (categorias/tags):", error);
      setErrorData(error);
      toast.error("Falha ao atualizar categorias/tags.");
    } finally {
      setLoadingData(false);
    }
  };


  return (
    <DataContext.Provider value={{ categorias, tags, loadingData, errorData, refreshData }}>
      {children}
    </DataContext.Provider>
  );
};

// Hook customizado para facilitar o uso do contexto
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
}; 