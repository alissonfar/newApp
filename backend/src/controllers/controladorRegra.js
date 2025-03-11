const Regra = require('../models/regra');
const Transacao = require('../models/transacao');
const Tag = require('../models/tag');

// Função auxiliar para aplicar condições
const avaliarCondicao = (transacao, condicao) => {
  let valor;
  
  if (condicao.campo === 'pagamentos.tags') {
    // Busca em todos os pagamentos da transação
    valor = transacao.pagamentos.reduce((tags, pagamento) => {
      if (!pagamento.tags) return tags;
      
      // Converte o objeto de tags em um array de strings no formato "categoria: valor"
      const pagTags = Object.entries(pagamento.tags).map(([categoria, valores]) => {
        if (Array.isArray(valores)) {
          return valores.map(valor => `${categoria}: ${valor}`);
        }
        return [`${categoria}: ${valores}`];
      }).flat();
      
      return [...tags, ...pagTags];
    }, []);
  } else if (condicao.campo.startsWith('pagamentos.')) {
    // Para outros campos de pagamento, verifica em cada pagamento
    const campo = condicao.campo.split('.')[1];
    valor = transacao.pagamentos.map(p => p[campo]);
  } else {
    valor = transacao[condicao.campo];
  }

  // Converte os valores para o mesmo tipo antes de comparar
  const valorTransacao = typeof valor === 'string' ? valor.toLowerCase() : valor;
  const valorCondicao = typeof condicao.valor === 'string' ? condicao.valor.toLowerCase() : condicao.valor;

  switch (condicao.operador) {
    case 'igual':
      if (Array.isArray(valorTransacao)) {
        return valorTransacao.some(v => String(v).toLowerCase() === String(valorCondicao).toLowerCase());
      }
      return String(valorTransacao).toLowerCase() === String(valorCondicao).toLowerCase();
    case 'diferente':
      if (Array.isArray(valorTransacao)) {
        return !valorTransacao.some(v => String(v).toLowerCase() === String(valorCondicao).toLowerCase());
      }
      return String(valorTransacao).toLowerCase() !== String(valorCondicao).toLowerCase();
    case 'maior':
      return Number(valorTransacao) > Number(valorCondicao);
    case 'menor':
      return Number(valorTransacao) < Number(valorCondicao);
    case 'contem':
      if (Array.isArray(valorTransacao)) {
        return valorTransacao.some(v => 
          String(v).toLowerCase() === String(valorCondicao).toLowerCase()
        );
      }
      return String(valorTransacao).toLowerCase().includes(String(valorCondicao).toLowerCase());
    case 'nao_contem':
      if (Array.isArray(valorTransacao)) {
        return !valorTransacao.some(v => 
          String(v).toLowerCase() === String(valorCondicao).toLowerCase()
        );
      }
      return !String(valorTransacao).toLowerCase().includes(String(valorCondicao).toLowerCase());
    default:
      return false;
  }
};

// Função auxiliar para aplicar ações
const aplicarAcao = (transacao, acao) => {
  const novaTransacao = { ...transacao };
  
  switch (acao.tipo) {
    case 'adicionar_tag':
      // Adiciona a tag em todos os pagamentos mantendo a estrutura correta
      novaTransacao.pagamentos = novaTransacao.pagamentos.map(pagamento => {
        const novoTags = pagamento.tags || {};
        const [categoria, valor] = acao.valor.split(':').map(s => s.trim());
        
        if (!novoTags[categoria]) {
          novoTags[categoria] = [];
        }
        
        if (Array.isArray(novoTags[categoria])) {
          if (!novoTags[categoria].includes(valor)) {
            novoTags[categoria].push(valor);
          }
        } else {
          novoTags[categoria] = [valor];
        }
        
        return {
          ...pagamento,
          tags: novoTags
        };
      });
      break;
    case 'remover_tag':
      // Remove a tag de todos os pagamentos
      novaTransacao.pagamentos = novaTransacao.pagamentos.map(pagamento => {
        const novoTags = { ...pagamento.tags };
        const [categoria, valor] = acao.valor.split(':').map(s => s.trim());
        
        if (novoTags[categoria]) {
          if (Array.isArray(novoTags[categoria])) {
            novoTags[categoria] = novoTags[categoria].filter(tag => 
              tag.toLowerCase() !== valor.toLowerCase()
            );
            if (novoTags[categoria].length === 0) {
              delete novoTags[categoria];
            }
          } else {
            delete novoTags[categoria];
          }
        }
        
        return {
          ...pagamento,
          tags: novoTags
        };
      });
      break;
    case 'alterar_status':
      // Adiciona o status como uma tag na categoria 'Status'
      novaTransacao.pagamentos = novaTransacao.pagamentos.map(pagamento => {
        const novoTags = pagamento.tags || {};
        novoTags['Status'] = [acao.valor];
        return {
          ...pagamento,
          tags: novoTags
        };
      });
      break;
    case 'alterar_valor':
      novaTransacao.valor = Number(acao.valor);
      break;
  }
  
  return novaTransacao;
};

// Novo endpoint para buscar opções de campos
exports.obterOpcoesCampos = async (req, res) => {
  try {
    // Busca todas as tags disponíveis
    const tags = await Tag.find({ usuario: req.userId });
    
    // Agrupa tags por categoria
    const tagsPorCategoria = tags.reduce((acc, tag) => {
      if (!acc[tag.categoria]) {
        acc[tag.categoria] = [];
      }
      acc[tag.categoria].push(tag.nome);
      return acc;
    }, {});

    // Busca status únicos das transações
    const status = await Transacao.find({ usuario: req.userId }).distinct('status');

    // Define as opções disponíveis para cada campo
    const opcoes = {
      campos: [
        { 
          valor: 'tipo',
          rotulo: 'Tipo',
          operadores: ['igual', 'diferente'],
          valores: ['gasto', 'recebivel']
        },
        {
          valor: 'valor',
          rotulo: 'Valor',
          operadores: ['igual', 'maior', 'menor'],
          tipo: 'numero'
        },
        {
          valor: 'status',
          rotulo: 'Status',
          operadores: ['igual', 'diferente'],
          valores: status
        },
        {
          valor: 'pagamentos.tags',
          rotulo: 'Tags dos Pagamentos',
          operadores: ['contem', 'nao_contem'],
          valores: Object.entries(tagsPorCategoria).map(([categoria, tags]) => 
            tags.map(tag => `${categoria}: ${tag}`)
          ).flat()
        }
      ],
      operadores: {
        igual: 'Igual a',
        diferente: 'Diferente de',
        maior: 'Maior que',
        menor: 'Menor que',
        contem: 'Contém',
        nao_contem: 'Não contém'
      },
      acoes: [
        {
          tipo: 'adicionar_tag',
          rotulo: 'Adicionar Tag',
          requerValor: true,
          valores: Object.entries(tagsPorCategoria).map(([categoria, tags]) => 
            tags.map(tag => `${categoria}: ${tag}`)
          ).flat()
        },
        {
          tipo: 'remover_tag',
          rotulo: 'Remover Tag',
          requerValor: true,
          valores: Object.entries(tagsPorCategoria).map(([categoria, tags]) => 
            tags.map(tag => `${categoria}: ${tag}`)
          ).flat()
        },
        {
          tipo: 'alterar_status',
          rotulo: 'Alterar Status',
          requerValor: true,
          valores: status
        },
        {
          tipo: 'alterar_valor',
          rotulo: 'Alterar Valor',
          requerValor: true,
          tipo: 'numero'
        }
      ]
    };

    res.json(opcoes);
  } catch (erro) {
    console.error('Erro ao buscar opções:', erro);
    res.status(500).json({ erro: erro.message });
  }
};

exports.criarRegra = async (req, res) => {
  try {
    const regra = new Regra({
      ...req.body,
      usuario: req.userId
    });
    await regra.save();
    res.status(201).json(regra);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
};

exports.listarRegras = async (req, res) => {
  try {
    const regras = await Regra.find({ usuario: req.userId });
    res.json(regras);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
};

exports.obterRegraPorId = async (req, res) => {
  try {
    const regra = await Regra.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });
    res.json(regra);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
};

exports.atualizarRegra = async (req, res) => {
  try {
    // Garante que a estrutura de execucaoAutomatica esteja correta
    const dadosAtualizacao = { ...req.body };
    
    // Se execucaoAutomatica estiver presente, garante que tenha a estrutura completa
    if (dadosAtualizacao.execucaoAutomatica) {
      dadosAtualizacao.execucaoAutomatica = {
        ativa: dadosAtualizacao.execucaoAutomatica.ativa || false,
        frequencia: dadosAtualizacao.execucaoAutomatica.ativa ? 
          (dadosAtualizacao.execucaoAutomatica.frequencia || 'diaria') : undefined
      };
    }

    const regra = await Regra.findOneAndUpdate(
      { _id: req.params.id, usuario: req.userId },
      dadosAtualizacao,
      { new: true, runValidators: true }
    );
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });
    res.json(regra);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
};

exports.excluirRegra = async (req, res) => {
  try {
    const regra = await Regra.findOneAndDelete({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });
    res.json({ mensagem: 'Regra excluída com sucesso' });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
};

exports.simularRegra = async (req, res) => {
  try {
    const regra = await Regra.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });

    const transacoes = await Transacao.find({ usuario: req.userId });
    const transacoesAfetadas = [];

    for (const transacao of transacoes) {
      const resultadosCondicoes = regra.condicoes.map(condicao => 
        avaliarCondicao(transacao, condicao)
      );

      const deveAplicar = regra.operadorLogico === 'E'
        ? resultadosCondicoes.every(resultado => resultado)
        : resultadosCondicoes.some(resultado => resultado);

      if (deveAplicar) {
        let transacaoModificada = { ...transacao.toObject() };
        
        // Simula as alterações
        for (const acao of regra.acoes) {
          transacaoModificada = aplicarAcao(transacaoModificada, acao);
        }

        transacoesAfetadas.push({
          original: transacao,
          modificada: transacaoModificada,
          alteracoes: regra.acoes.map(acao => {
            let descricao = '';
            switch (acao.tipo) {
              case 'adicionar_tag':
                descricao = `Adicionar tag "${acao.valor}"`;
                break;
              case 'remover_tag':
                descricao = `Remover tag "${acao.valor}"`;
                break;
              case 'alterar_status':
                descricao = `Alterar status de "${transacao.status || 'não definido'}" para "${acao.valor}"`;
                break;
              case 'alterar_valor':
                descricao = `Alterar valor de R$ ${transacao.valor} para R$ ${acao.valor}`;
                break;
            }
            return {
              tipo: acao.tipo,
              valor: acao.valor,
              descricao
            };
          })
        });
      }
    }

    res.json({
      quantidadeAfetada: transacoesAfetadas.length,
      transacoes: transacoesAfetadas.map(t => ({
        _id: t.original._id,
        descricao: t.original.descricao,
        tipo: t.original.tipo,
        valor: t.original.valor,
        data: t.original.data,
        tags: t.original.tags || [],
        alteracoes: t.alteracoes,
        estadoFinal: {
          valor: t.modificada.valor,
          status: t.modificada.status,
          tags: t.modificada.tags || []
        }
      }))
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
};

exports.executarRegra = async (req, res) => {
  try {
    const regra = await Regra.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });

    const transacoes = await Transacao.find({ usuario: req.userId });
    const transacoesAfetadas = [];
    const estadoAnterior = [];

    for (const transacao of transacoes) {
      const resultadosCondicoes = regra.condicoes.map(condicao => 
        avaliarCondicao(transacao, condicao)
      );

      const deveAplicar = regra.operadorLogico === 'E'
        ? resultadosCondicoes.every(resultado => resultado)
        : resultadosCondicoes.some(resultado => resultado);

      if (deveAplicar) {
        estadoAnterior.push(transacao.toObject());
        let transacaoModificada = { ...transacao.toObject() };
        
        for (const acao of regra.acoes) {
          transacaoModificada = aplicarAcao(transacaoModificada, acao);
        }

        await Transacao.findByIdAndUpdate(transacao._id, transacaoModificada);
        transacoesAfetadas.push(transacao._id);
      }
    }

    // Atualiza o registro da última execução
    regra.ultimaExecucao = {
      data: new Date(),
      transacoesAfetadas,
      estadoAnterior
    };
    await regra.save();

    res.json({
      mensagem: 'Regra executada com sucesso',
      transacoesAfetadas: transacoesAfetadas.length
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
};

exports.desfazerUltimaExecucao = async (req, res) => {
  try {
    const regra = await Regra.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    
    if (!regra) return res.status(404).json({ erro: 'Regra não encontrada' });
    if (!regra.ultimaExecucao) {
      return res.status(400).json({ erro: 'Não há execução para desfazer' });
    }

    const { estadoAnterior, transacoesAfetadas } = regra.ultimaExecucao;

    for (let i = 0; i < transacoesAfetadas.length; i++) {
      await Transacao.findByIdAndUpdate(
        transacoesAfetadas[i],
        estadoAnterior[i]
      );
    }

    regra.ultimaExecucao = null;
    await regra.save();

    res.json({
      mensagem: 'Última execução desfeita com sucesso',
      transacoesRevertidas: transacoesAfetadas.length
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
}; 