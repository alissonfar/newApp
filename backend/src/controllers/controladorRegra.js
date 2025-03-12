const Regra = require('../models/regra');
const Transacao = require('../models/transacao');

// Função auxiliar para aplicar condições
const avaliarCondicao = (transacao, condicao) => {
  let valor;
  
  if (condicao.campo === 'pagamentos.pessoa') {
    // Para pagamentos.pessoa, verifica se qualquer pagamento tem a pessoa
    valor = transacao.pagamentos ? 
      transacao.pagamentos.some(p => p.pessoa === condicao.valor) :
      false;
    
    // Para operadores de igualdade, retornamos direto o resultado
    if (condicao.operador === 'igual') return valor;
    if (condicao.operador === 'diferente') return !valor;
    
    // Para outros operadores, não faz sentido com booleano
    return false;
  } else {
    // Para outros campos, mantém a lógica original
    valor = condicao.campo.includes('.')
      ? condicao.campo.split('.').reduce((obj, key) => obj ? obj[key] : undefined, transacao)
      : transacao[condicao.campo];
  }

  // Se o valor for undefined ou null, retorna false
  if (valor === undefined || valor === null) return false;

  switch (condicao.operador) {
    case 'igual':
      return valor === condicao.valor;
    case 'diferente':
      return valor !== condicao.valor;
    case 'maior':
      return valor > condicao.valor;
    case 'menor':
      return valor < condicao.valor;
    case 'contem':
      return Array.isArray(valor) 
        ? valor.includes(condicao.valor)
        : String(valor).includes(String(condicao.valor));
    case 'nao_contem':
      return Array.isArray(valor)
        ? !valor.includes(condicao.valor)
        : !String(valor).includes(String(condicao.valor));
    default:
      return false;
  }
};

// Função auxiliar para aplicar ações
const aplicarAcao = (transacao, acao) => {
  const novaTransacao = { ...transacao };
  
  switch (acao.tipo) {
    case 'adicionar_tag':
    case 'remover_tag': {
      // Separa categoria e tag do valor (formato "categoria: tag")
      const [categoria, tagNome] = acao.valor.split(': ');
      
      // Garante que cada pagamento tenha a estrutura correta de tags
      if (!novaTransacao.pagamentos) novaTransacao.pagamentos = [];
      
      novaTransacao.pagamentos = novaTransacao.pagamentos.map(pagamento => {
        const novoPagamento = { ...pagamento };
        
        // Garante que o pagamento tenha a estrutura de tags
        if (!novoPagamento.tags) novoPagamento.tags = {};
        if (!novoPagamento.tags[categoria]) novoPagamento.tags[categoria] = [];
        
        if (acao.tipo === 'adicionar_tag') {
          // Adiciona a tag se ela não existir
          if (!novoPagamento.tags[categoria].includes(tagNome)) {
            novoPagamento.tags[categoria] = [...novoPagamento.tags[categoria], tagNome];
          }
        } else { // remover_tag
          // Remove a tag se ela existir
          novoPagamento.tags[categoria] = novoPagamento.tags[categoria].filter(
            tag => tag !== tagNome
          );
          
          // Remove a categoria se ficar vazia
          if (novoPagamento.tags[categoria].length === 0) {
            delete novoPagamento.tags[categoria];
          }
          
          // Remove o objeto tags se ficar vazio
          if (Object.keys(novoPagamento.tags).length === 0) {
            delete novoPagamento.tags;
          }
        }
        
        return novoPagamento;
      });
      break;
    }
    
    case 'alterar_status': {
      // Validação: não permite mudar de estornado para ativo
      if (novaTransacao.status === 'estornado' && acao.valor === 'ativo') {
        throw new Error('Não é possível alterar o status de estornado para ativo');
      }
      
      // Validação: só permite os status válidos
      if (!['ativo', 'estornado'].includes(acao.valor)) {
        throw new Error('Status inválido. Use "ativo" ou "estornado"');
      }
      
      novaTransacao.status = acao.valor;
      break;
    }
      
    case 'alterar_valor': {
      // Não permite alterar valor de transação estornada
      if (novaTransacao.status === 'estornado') {
        throw new Error('Não é possível alterar o valor de uma transação estornada');
      }

      const novoValor = Number(parseFloat(acao.valor).toFixed(2));
      novaTransacao.valor = novoValor;
      
      // Se houver apenas um pagamento, atualiza o valor dele também
      if (novaTransacao.pagamentos && novaTransacao.pagamentos.length === 1) {
        novaTransacao.pagamentos[0].valor = novoValor;
      }
      break;
    }
  }
  
  return novaTransacao;
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