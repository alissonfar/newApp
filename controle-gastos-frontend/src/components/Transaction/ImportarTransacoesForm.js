import React, { useState, useRef, useContext } from 'react';
import { toast } from 'react-toastify';
import { FaEdit, FaCheck, FaArrowLeft, FaTrash, FaInfoCircle } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import { processarDados, validarTransacoes } from '../../middleware/transformarDados';
import { registrarTransacoesEmMassa } from '../../api';
import EditarTransacaoItem from './EditarTransacaoItem';
import './ImportarTransacoesForm.css';

const ImportarTransacoesForm = ({ onSuccess, onClose, standalonePage = false }) => {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef(null);
  
  // Estado dos dados
  const [formato, setFormato] = useState('csv');
  const [transacoes, setTransacoes] = useState([]);
  const [original, setOriginal] = useState(null);
  const [erros, setErros] = useState([]);
  const [estaEditando, setEstaEditando] = useState(false);
  const [showJsonInfo, setShowJsonInfo] = useState(false);
  const [transacoesSalvas, setTransacoesSalvas] = useState(new Set());
  
  // Estado de UI
  const [estaProcessando, setEstaProcessando] = useState(false);
  const [estaEnviando, setEstaEnviando] = useState(false);
  const [etapa, setEtapa] = useState('upload'); // 'upload', 'preview', 'edit', 'success'
  
  // Handler para o input de arquivo
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setEstaProcessando(true);
    
    try {
      let dados;
      
      if (formato === 'csv') {
        dados = await processarArquivoCSV(file);
      } else if (formato === 'json') {
        dados = await processarArquivoJSON(file);
      }
      
      setOriginal(dados);
      processarTransacoes(dados);
    } catch (error) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      console.error('Erro ao processar arquivo:', error);
    } finally {
      setEstaProcessando(false);
    }
  };
  
  // Processa arquivo CSV
  const processarArquivoCSV = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const conteudo = e.target.result;
          // Divide por linhas e depois por vírgulas (ou outro delimitador)
          const linhas = conteudo.split('\n').map(linha => linha.split(','));
          resolve(linhas);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };
  
  // Processa arquivo JSON
  const processarArquivoJSON = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const conteudo = e.target.result;
          const dados = JSON.parse(conteudo);
          resolve(dados);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };
  
  // Processa as transações usando o middleware
  const processarTransacoes = (dados) => {
    try {
      // Criar um objeto de usuário seguro, mesmo que user seja undefined ou não tenha id
      const usuarioInfo = { 
        id: user?.id || 'temp-id', // Use um ID temporário se não houver user.id
        nome: user?.nome || 'Usuário' 
      };
      
      const transacoesProcessadas = processarDados(dados, formato, usuarioInfo);
      
      const validacao = validarTransacoes(transacoesProcessadas);
      setTransacoes(transacoesProcessadas);
      setErros(validacao.erros);
      
      if (validacao.valido) {
        setEtapa('preview');
      } else {
        toast.warning(`Foram encontrados ${validacao.erros.length} erros nos dados.`);
        setEtapa('preview');
      }
    } catch (error) {
      toast.error(`Erro ao processar dados: ${error.message}`);
      console.error('Erro ao processar dados:', error);
    }
  };
  
  // Handler para salvar uma transação editada
  const handleSaveTransacao = (index, transacaoAtualizada) => {
    const novasTransacoes = [...transacoes];
    novasTransacoes[index] = transacaoAtualizada;
    setTransacoes(novasTransacoes);
    
    // Revalidar as transações após a edição
    const validacao = validarTransacoes(novasTransacoes);
    setErros(validacao.erros);
    
    // Marcar a transação como salva
    setTransacoesSalvas(prev => new Set([...prev, index]));
    
    // Voltar para a tela de preview
    setEtapa('preview');
    setEstaEditando(false);
    
    toast.success(`Transação #${index + 1} atualizada.`);
  };
  
  // Enviar para o backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (transacoes.length === 0) {
      toast.warning('Nenhuma transação para enviar.');
      return;
    }
    
    const validacao = validarTransacoes(transacoes);
    if (!validacao.valido) {
      toast.error(`Existem ${validacao.erros.length} erros que precisam ser corrigidos antes de enviar.`);
      setErros(validacao.erros);
      return;
    }
    
    setEstaEnviando(true);
    
    try {
      const resultado = await registrarTransacoesEmMassa(transacoes);
      
      if (resultado.erro) {
        throw new Error(resultado.erro);
      }
      
      toast.success(`${transacoes.length} transações importadas com sucesso!`);
      setEtapa('success');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(`Erro ao enviar transações: ${error.message}`);
      console.error('Erro ao enviar transações:', error);
    } finally {
      setEstaEnviando(false);
    }
  };
  
  // Handler para voltar à etapa anterior
  const voltarEtapa = () => {
    if (etapa === 'preview') {
      setEtapa('upload');
      setTransacoes([]);
      setErros([]);
      setOriginal(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else if (etapa === 'edit') {
      setEtapa('preview');
      setEstaEditando(false);
    }
  };
  
  const handleRemoveTransacao = (index) => {
    const novasTransacoes = transacoes.filter((_, i) => i !== index);
    setTransacoes(novasTransacoes);
    toast.success('Transação removida da importação');
  };
  
  // Renderiza o modal de informações do JSON
  const renderJsonInfoModal = () => (
    <div className={`json-info-modal ${showJsonInfo ? 'show' : ''}`}>
      <div className="json-info-content">
        <button className="close-btn" onClick={() => setShowJsonInfo(false)}>×</button>
        <h3>Documento de Padronização para Importação em Massa</h3>
        
        <div className="json-info-description">
          <h4>Objetivo</h4>
          <p>Este documento tem como objetivo fornecer um guia para a formatação de dados em JSON que serão utilizados na importação em massa de transações. Os usuários devem seguir este padrão para garantir que os dados sejam processados corretamente.</p>

          <h4>Estrutura do JSON</h4>
          <p>A estrutura do JSON deve seguir o seguinte formato:</p>
          <pre>
{`[
  {
    "tipo": "",                            // Opcional (pode ser "gasto" ou "recebivel")
    "descricao": "",                       // Obrigatório
    "valor": 0.00,                         // Obrigatório
    "data": "",                            // Obrigatório (formato "YYYY-MM-DD")
    "pagamentos": [
      {
        "pessoa": "",                      // Opcional (pode ser deixado em branco)
        "valor": 0.00,                     // Opcional
        "tags": {                          // Opcional (pode ser omitido completamente se não houver tags)
          "Categoria": [""]                // Opcional  Array de strings, podendo conter uma ou mais categorias
        }
      }
    ]
  }
]`}
          </pre>

          <h4>Campos do JSON</h4>
          <ul className="json-fields">
            <li><strong>tipo</strong>: Uma string que indica se a transação é um "gasto" ou "recebivel". <span className="optional">(Opcional)</span></li>
            <li><strong>descricao</strong>: Uma string que descreve a transação. <span className="required">(Obrigatório)</span></li>
            <li><strong>valor</strong>: Um número que representa o valor da transação. <span className="required">(Obrigatório)</span></li>
            <li><strong>data</strong>: Uma string no formato "YYYY-MM-DD" que representa a data da transação. <span className="required">(Obrigatório)</span></li>
            <li><strong>pagamentos</strong>: Um array que contém objetos de pagamento.
              <ul>
                <li><strong>pessoa</strong>: Uma string que representa o nome da pessoa associada ao pagamento. <span className="optional">(Opcional, pode ser deixado em branco)</span></li>
                <li><strong>valor</strong>: Um número que representa o valor do pagamento. <span className="optional">(Opcional, pode ser deixado em branco)</span></li>
                <li><strong>tags</strong>: Um objeto que contém categorias e suas respectivas tags. <span className="optional">(Opcional, pode ser omitido se não houver tags)</span></li>
              </ul>
            </li>
          </ul>

          <h4>Exemplo de Payload</h4>
          <p>Aqui está um exemplo de payload com mais de uma transação para ilustrar a estrutura exata:</p>
          <pre>
{`[
  {
    "tipo": "gasto",
    "descricao": "Restaurante",
    "valor": 85.50,
    "data": "2023-10-17",
    "pagamentos": [
      {
        "pessoa": "Pedro",
        "valor": 85.50,
        "tags": {
          "Alimentação": ["Restaurante", "Almoço"]
        }
      }
    ]
  },
  {
    "tipo": "recebivel",
    "descricao": "Reembolso",
    "valor": 120.00,
    "data": "2023-10-18",
    "pagamentos": [
      {
        "pessoa": "Laura",
        "valor": 120.00
      }
    ]
  }
]`}
          </pre>

          <h4>Prompt para IA</h4>
          <p>Para solicitar à IA que converta informações de entrada para o formato JSON necessário, você pode usar o seguinte prompt:</p>
          <pre className="prompt">
{`Por favor, analise as seguintes informações e converta-as para o formato JSON necessário para a importação em massa de transações. As informações são:

- Tipo de transação: [gasto/recebivel] (opcional)
- Descrição da transação: [insira a descrição] (obrigatório)
- Valor da transação: [insira o valor] (obrigatório)
- Data da transação: [insira a data no formato YYYY-MM-DD] (obrigatório)
- Pagamentos:
  - Nome da pessoa: [insira o nome] (opcional, pode ser deixado em branco)
  - Valor do pagamento: [insira o valor] (opcional, pode ser deixado em branco)
  - Tags: [insira as categorias e tags, se houver] (opcional, pode ser omitido se não houver tags)

A saída deve ser um JSON formatado conforme a estrutura especificada, com campos obrigatórios preenchidos e campos opcionais deixados em branco.`}
          </pre>

          <h4>Conclusão</h4>
          <p>Este documento serve como um guia para a formatação de dados em JSON para importação em massa. Siga as instruções e utilize o prompt fornecido para garantir que suas informações sejam processadas corretamente.</p>
        </div>
      </div>
    </div>
  );
  
  // Renderiza o formulário de upload
  const renderUploadForm = () => (
    <div className="importar-form-upload">
      <h3>Importar Transações</h3>
      <div className="formato-selector">
        <label>
          <input 
            type="radio" 
            name="formato" 
            value="csv" 
            checked={formato === 'csv'} 
            onChange={() => setFormato('csv')} 
          />
          CSV
        </label>
        <label>
          <input 
            type="radio" 
            name="formato" 
            value="json" 
            checked={formato === 'json'} 
            onChange={() => setFormato('json')} 
          />
          JSON
          {formato === 'json' && (
            <button 
              className="info-btn"
              onClick={() => setShowJsonInfo(true)}
              title="Ver formato do JSON"
            >
              <FaInfoCircle />
            </button>
          )}
        </label>
        <label>
          <input 
            type="radio" 
            name="formato" 
            value="manual" 
            checked={formato === 'manual'} 
            onChange={() => setFormato('manual')} 
          />
          Manual
        </label>
      </div>
      
      {formato !== 'manual' ? (
        <div className="file-input-container">
          <input 
            type="file" 
            ref={fileInputRef}
            accept={formato === 'csv' ? '.csv' : '.json'} 
            onChange={handleFileChange} 
            disabled={estaProcessando}
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={estaProcessando}
          >
            {estaProcessando ? 'Processando...' : `Selecionar arquivo ${formato.toUpperCase()}`}
          </button>
        </div>
      ) : (
        <div className="manual-input-container">
          <button 
            type="button" 
            onClick={() => {
              // Exemplo de dados manuais
              const dadosManual = [{ 
                tipo: 'gasto',
                descricao: 'Nova transação',
                valor: 0,
                data: new Date().toISOString().split('T')[0],
                observacao: '',
                pagamentos: [{
                  pessoa: user?.nome || 'Eu',
                  valor: 0,
                  tags: { 'Geral': ['Nova'] }
                }],
              }];
              setOriginal(dadosManual);
              processarTransacoes(dadosManual);
            }}
          >
            Criar Transação Manual
          </button>
        </div>
      )}
      
      <div className="buttons">
        <button type="button" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
  
  // Renderiza a prévia das transações
  const renderPreview = () => (
    <div className="importar-form-preview">
      <h3>Prévia das Transações</h3>
      
      {transacoes.length === 0 ? (
        <p>Nenhuma transação processada.</p>
      ) : (
        <>
          <div className="preview-stats">
            <p>
              <strong>{transacoes.length}</strong> transações processadas
              {erros.length > 0 && (
                <span className="error-badge">
                  {erros.length} com erros
                </span>
              )}
            </p>
          </div>
          
          <div className="transacoes-list">
            {transacoes.map((transacao, index) => {
              const temErro = erros.some(e => e.index === index);
              const estaSalva = transacoesSalvas.has(index);
              
              return (
                <div 
                  key={index} 
                  className={`transacao-preview ${temErro ? 'with-error' : ''} ${estaSalva ? 'saved' : ''}`}
                >
                  <div className="transacao-header">
                    <span className={`tipo-badge ${transacao.tipo}`}>
                      {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
                    </span>
                    <h4>{transacao.descricao}</h4>
                    <div className="transacao-valor">
                      R$ {transacao.valor.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="transacao-details">
                    <p>
                      <strong>Data:</strong> {new Date(transacao.data).toLocaleDateString()}
                    </p>
                    {transacao.observacao && (
                      <p>
                        <strong>Observação:</strong> {transacao.observacao}
                      </p>
                    )}
                    <div className="pagamentos-preview">
                      <strong>Pagamentos:</strong>
                      {transacao.pagamentos.map((pag, pagIndex) => (
                        <div key={pagIndex} className="pagamento-item">
                          <span>{pag.pessoa}: R$ {pag.valor.toFixed(2)}</span>
                          {pag.tags && Object.entries(pag.tags).map(([categoria, tags]) => (
                            <div key={categoria} className="tags-preview">
                              <strong>{categoria}:</strong> {tags.join(', ')}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {temErro && (
                    <div className="transacao-erros">
                      <strong>Erros:</strong>
                      <ul>
                        {erros.find(erro => erro.indice === index)?.erros.map((erro, errIndex) => (
                          <li key={errIndex}>{erro}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="transacao-actions">
                    <button
                      className="btn-action edit-btn"
                      onClick={() => {
                        setEtapa('edit');
                        setEstaEditando(true);
                      }}
                    >
                      <FaEdit /> {estaSalva ? 'Editar Novamente' : 'Editar Transação'}
                    </button>
                    <button
                      className="btn-action delete-btn"
                      onClick={() => handleRemoveTransacao(index)}
                    >
                      <FaTrash /> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      
      <div className="buttons">
        <button 
          type="button" 
          onClick={voltarEtapa} 
          disabled={estaEnviando}
        >
          <FaArrowLeft style={{ marginRight: '8px' }} /> Voltar
        </button>
        <button 
          type="button" 
          onClick={handleSubmit} 
          disabled={estaEnviando || transacoes.length === 0 || erros.length > 0}
        >
          {estaEnviando ? 'Processando...' : <><FaCheck style={{ marginRight: '8px' }} /> Confirmar e Importar</>}
        </button>
      </div>
    </div>
  );
  
  // Renderiza o formulário de edição
  const renderEditForm = () => (
    <div className="importar-form-edit">
      <h3>Editar Transações</h3>
      
      <div className="transacoes-edit-list">
        {transacoes.map((transacao, index) => (
          <EditarTransacaoItem
            key={index}
            transacao={transacao}
            index={index}
            onSave={handleSaveTransacao}
            onClose={() => {}}
          />
        ))}
      </div>
      
      <div className="buttons">
        <button 
          type="button" 
          onClick={voltarEtapa} 
          disabled={estaEnviando}
        >
          <FaArrowLeft style={{ marginRight: '8px' }} /> Voltar
        </button>
        <button 
          type="button" 
          onClick={handleSubmit} 
          disabled={estaEnviando || transacoes.length === 0 || erros.length > 0}
        >
          {estaEnviando ? 'Processando...' : <><FaCheck style={{ marginRight: '8px' }} /> Confirmar e Importar</>}
        </button>
      </div>
    </div>
  );
  
  // Renderiza a mensagem de sucesso
  const renderSuccess = () => (
    <div className="importar-form-success">
      <h3>Transações Importadas com Sucesso!</h3>
      <p>{transacoes.length} transações foram importadas com sucesso.</p>
      <div className="buttons">
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
  
  // Renderiza a interface com base na etapa atual
  return (
    <div className={`importar-transacoes-form ${standalonePage ? 'standalone' : ''}`}>
      {renderJsonInfoModal()}
      {etapa === 'upload' && renderUploadForm()}
      {etapa === 'preview' && renderPreview()}
      {etapa === 'edit' && renderEditForm()}
      {etapa === 'success' && renderSuccess()}
    </div>
  );
};

export default ImportarTransacoesForm; 