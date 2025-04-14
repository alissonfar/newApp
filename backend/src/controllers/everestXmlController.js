const EverestXmlSummary = require('../models/EverestXmlSummary');
const xml2js = require('xml2js');
const fs = require('fs');

// Helper para acesso seguro a propriedades aninhadas do objeto xml2js
const getVal = (obj, path, defaultValue = null) => {
    // path é um array de strings, ex: ['NFe', 0, 'infNFe', 0, 'ide', 0, 'nNF', 0]
    try {
        let current = obj;
        for (const key of path) {
            if (current === null || current === undefined) return defaultValue;
            current = current[key];
        }
        // Retorna defaultValue se o valor final for undefined, caso contrário o valor
        return current === undefined ? defaultValue : current;
    } catch (e) {
        return defaultValue;
    }
};

// Mapeamento de Códigos (Exemplos - expandir conforme necessário)
const mapFormaPagamento = (code) => {
    const map = { '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de Crédito', '04': 'Cartão de Débito', '05': 'Crédito Loja', '15': 'Boleto Bancário', '17': 'PIX', '90': 'Sem Pagamento', '99': 'Outros' }; // Adicionado 90
    return map[code] || `Desconhecido (${code})`; // Retorna código se não mapeado
};
const mapModFrete = (code) => {
    const map = { '0': 'Emitente (CIF)', '1': 'Destinatário/Remetente (FOB)', '2': 'Terceiros', '3': 'Próprio (Remetente)', '4': 'Próprio (Destinatário)', '9': 'Sem Frete' };
    return map[code] || `Desconhecido (${code})`;
}

// Função de Extração Detalhada para NF-e
const extractDetailedNFeData = (xmlObj) => {
  try {
    // --- Localiza nós principais --- (Adiciona mais verificações e logs para robustez)
    const nfeProc = getVal(xmlObj, ['nfeProc']);
    const nfeNode = getVal(nfeProc, ['NFe', 0]) || getVal(xmlObj, ['NFe', 0]); // Tenta ambos os locais
    if (!nfeNode) {
        console.warn('Nó NFe não encontrado na estrutura esperada.');
        return { error: 'Estrutura NFe não encontrada.' };
    }
    const infNFe = getVal(nfeNode, ['infNFe', 0]);
    if (!infNFe) {
         console.warn('Nó infNFe não encontrado dentro de NFe.');
         return { error: 'Estrutura infNFe não encontrada.' };
    }
    // -- Correção na extração da Chave de Acesso --
    // Prioriza a chave dentro de protNFe (nota autorizada), fallback para Id de infNFe
    const protNFe = getVal(nfeProc, ['protNFe', 0, 'infProt', 0]);
    let chave = getVal(protNFe, ['chNFe', 0]); 
    if (!chave || chave.length !== 44) { // Se não achou em protNFe ou é inválida
        console.warn('Chave não encontrada ou inválida em protNFe.infProt.chNFe. Tentando infNFe.@.Id...');
        chave = getVal(infNFe, ['$', 'Id'])?.replace('NFe', '');
    }

    if (!chave || chave.length !== 44) {
        console.error('Chave de acesso final inválida ou não encontrada.');
        // Decide se retorna erro ou continua sem chave (depende da criticidade)
        // return { error: 'Chave de acesso inválida ou não encontrada.' }; 
    }

    // --- Identificação --- (Adiciona parseFloat/parseInt para segurança)
    const ide = getVal(infNFe, ['ide', 0]);
    const identificacao = {
        cUF: getVal(ide, ['cUF', 0]),
        cNF: getVal(ide, ['cNF', 0]),
        natOp: getVal(ide, ['natOp', 0]),
        mod: getVal(ide, ['mod', 0]),
        serie: getVal(ide, ['serie', 0]),
        nNF: getVal(ide, ['nNF', 0]),
        dhEmi: getVal(ide, ['dhEmi', 0]) ? new Date(getVal(ide, ['dhEmi', 0])) : null,
        dhSaiEnt: getVal(ide, ['dhSaiEnt', 0]) ? new Date(getVal(ide, ['dhSaiEnt', 0])) : null,
        tpNF: getVal(ide, ['tpNF', 0]),
        idDest: getVal(ide, ['idDest', 0]),
        cMunFG: getVal(ide, ['cMunFG', 0]),
        tpImp: getVal(ide, ['tpImp', 0]),
        tpEmis: getVal(ide, ['tpEmis', 0]),
        cDV: getVal(ide, ['cDV', 0]),
        tpAmb: getVal(ide, ['tpAmb', 0]),
        finNFe: getVal(ide, ['finNFe', 0]),
        indFinal: getVal(ide, ['indFinal', 0]),
        indPres: getVal(ide, ['indPres', 0]),
        procEmi: getVal(ide, ['procEmi', 0]),
        verProc: getVal(ide, ['verProc', 0]),
        chaveAcesso: chave // Usa a chave extraída acima
    };

    // --- Emitente --- (Trata endereço ausente)
    const emit = getVal(infNFe, ['emit', 0]);
    const enderEmit = getVal(emit, ['enderEmit', 0]);
    const emitente = emit ? {
        nome: getVal(emit, ['xNome', 0]),
        nomeFantasia: getVal(emit, ['xFant', 0]),
        cnpj: getVal(emit, ['CNPJ', 0]),
        ie: getVal(emit, ['IE', 0]),
        crt: getVal(emit, ['CRT', 0]),
        endereco: enderEmit ? {
            logradouro: getVal(enderEmit, ['xLgr', 0]),
            numero: getVal(enderEmit, ['nro', 0]),
            complemento: getVal(enderEmit, ['xCpl', 0]),
            bairro: getVal(enderEmit, ['xBairro', 0]),
            codigoMunicipio: getVal(enderEmit, ['cMun', 0]),
            municipio: getVal(enderEmit, ['xMun', 0]),
            uf: getVal(enderEmit, ['UF', 0]),
            cep: getVal(enderEmit, ['CEP', 0]),
            codigoPais: getVal(enderEmit, ['cPais', 0]),
            pais: getVal(enderEmit, ['xPais', 0]),
            fone: getVal(enderEmit, ['fone', 0])
        } : null
    } : null;

    // --- Destinatário --- (Trata endereço ausente)
    const dest = getVal(infNFe, ['dest', 0]);
    const enderDest = getVal(dest, ['enderDest', 0]);
    const destinatario = dest ? {
        nome: getVal(dest, ['xNome', 0]),
        cpfCnpj: getVal(dest, ['CNPJ', 0]) || getVal(dest, ['CPF', 0]),
        ie: getVal(dest, ['IE', 0]),
        indIEDest: getVal(dest, ['indIEDest', 0]),
        email: getVal(dest, ['email', 0]),
        endereco: enderDest ? {
           logradouro: getVal(enderDest, ['xLgr', 0]),
           numero: getVal(enderDest, ['nro', 0]),
           complemento: getVal(enderDest, ['xCpl', 0]),
           bairro: getVal(enderDest, ['xBairro', 0]),
           codigoMunicipio: getVal(enderDest, ['cMun', 0]),
           municipio: getVal(enderDest, ['xMun', 0]),
           uf: getVal(enderDest, ['UF', 0]),
           cep: getVal(enderDest, ['CEP', 0]),
           codigoPais: getVal(enderDest, ['cPais', 0]),
           pais: getVal(enderDest, ['xPais', 0]),
           fone: getVal(enderDest, ['fone', 0])
        } : null
    } : null;

    // --- Itens --- (Garante que é um array)
    const detItems = getVal(infNFe, ['det'], []); // Default to empty array
    const itens = detItems.map((itemXml, index) => {
        const prod = getVal(itemXml, ['prod', 0]);
        const imposto = getVal(itemXml, ['imposto', 0]);
        const icmsNode = getVal(imposto, ['ICMS', 0]);
        const icmsContentNode = icmsNode ? Object.values(icmsNode)[0]?.[0] : null;
        const ipiNode = getVal(imposto, ['IPI', 0]);
        const ipiContentNode = ipiNode ? Object.values(ipiNode)[0]?.[0] : null; // Seja IPITrib ou IPINT
        const pisNode = getVal(imposto, ['PIS', 0]) ? Object.values(getVal(imposto, ['PIS', 0]))[0]?.[0] : null;
        const cofinsNode = getVal(imposto, ['COFINS', 0]) ? Object.values(getVal(imposto, ['COFINS', 0]))[0]?.[0] : null;

        return {
            numeroItem: parseInt(getVal(itemXml, ['$', 'nItem'], index + 1)), // Usa index se nItem não existir
            codigoProduto: getVal(prod, ['cProd', 0]),
            cEAN: getVal(prod, ['cEAN', 0]),
            descricao: getVal(prod, ['xProd', 0]),
            ncm: getVal(prod, ['NCM', 0]),
            cfop: getVal(prod, ['CFOP', 0]),
            unidadeComercial: getVal(prod, ['uCom', 0]),
            quantidadeComercial: parseFloat(getVal(prod, ['qCom', 0], 0)),
            valorUnitarioComercial: parseFloat(getVal(prod, ['vUnCom', 0], 0)),
            valorTotalBruto: parseFloat(getVal(prod, ['vProd', 0], 0)),
            cEANTrib: getVal(prod, ['cEANTrib', 0]),
            unidadeTributavel: getVal(prod, ['uTrib', 0]),
            quantidadeTributavel: parseFloat(getVal(prod, ['qTrib', 0], 0)),
            valorUnitarioTributavel: parseFloat(getVal(prod, ['vUnTrib', 0], 0)),
            vFrete: parseFloat(getVal(prod, ['vFrete', 0], 0)),
            vSeg: parseFloat(getVal(prod, ['vSeg', 0], 0)),
            vDesc: parseFloat(getVal(prod, ['vDesc', 0], 0)),
            vOutro: parseFloat(getVal(prod, ['vOutro', 0], 0)),
            indTot: getVal(prod, ['indTot', 0]),
            impostos: {
              vTotTrib: parseFloat(getVal(imposto, ['vTotTrib', 0], 0)),
              icms: icmsContentNode ? {
                  origem: getVal(icmsContentNode, ['orig', 0]),
                  cst: getVal(icmsContentNode, ['CST', 0]) || getVal(icmsContentNode, ['CSOSN', 0]),
                  modBC: getVal(icmsContentNode, ['modBC', 0]),
                  pRedBC: parseFloat(getVal(icmsContentNode, ['pRedBC', 0], 0)),
                  vBC: parseFloat(getVal(icmsContentNode, ['vBC', 0], 0)),
                  pICMS: parseFloat(getVal(icmsContentNode, ['pICMS', 0], 0)),
                  vICMS: parseFloat(getVal(icmsContentNode, ['vICMS', 0], 0)),
                  vICMSDeson: parseFloat(getVal(icmsContentNode, ['vICMSDeson', 0], 0)),
                  motDesICMS: getVal(icmsContentNode, ['motDesICMS', 0]),
              } : null,
              ipi: ipiContentNode ? { // Pega CST mesmo se for IPINT
                  cst: getVal(ipiContentNode, ['CST', 0]),
                  clEnq: getVal(ipiContentNode, ['clEnq', 0]),     // Só existe em IPIAlíq/IPIQuant
                  cnpjProd: getVal(ipiContentNode, ['CNPJProd', 0]),
                  cSelo: getVal(ipiContentNode, ['cSelo', 0]),
                  qSelo: parseInt(getVal(ipiContentNode, ['qSelo', 0], 0)),
                  cEnq: getVal(ipiContentNode, ['cEnq', 0]),
                  vBC: parseFloat(getVal(ipiContentNode, ['vBC', 0], 0)), // Só existe em IPIAlíq
                  pIPI: parseFloat(getVal(ipiContentNode, ['pIPI', 0], 0)), // Só existe em IPIAlíq
                  vIPI: parseFloat(getVal(ipiContentNode, ['vIPI', 0], 0)), // Só existe em IPIAlíq
              } : null,
              pis: pisNode ? {
                  cst: getVal(pisNode, ['CST', 0]),
                  vBC: parseFloat(getVal(pisNode, ['vBC', 0], 0)),
                  pPIS: parseFloat(getVal(pisNode, ['pPIS', 0], 0)),
                  vPIS: parseFloat(getVal(pisNode, ['vPIS', 0], 0)),
              } : null,
              cofins: cofinsNode ? {
                  cst: getVal(cofinsNode, ['CST', 0]),
                  vBC: parseFloat(getVal(cofinsNode, ['vBC', 0], 0)),
                  pCOFINS: parseFloat(getVal(cofinsNode, ['pCOFINS', 0], 0)),
                  vCOFINS: parseFloat(getVal(cofinsNode, ['vCOFINS', 0], 0)),
              } : null,
            }
        };
    });

    // --- Totais --- (Trata ausência)
    const icmsTotNode = getVal(infNFe, ['total', 0, 'ICMSTot', 0]);
    const totais = icmsTotNode ? {
      icmsTot: {
        vBC: parseFloat(getVal(icmsTotNode, ['vBC', 0], 0)),
        vICMS: parseFloat(getVal(icmsTotNode, ['vICMS', 0], 0)),
        vICMSDeson: parseFloat(getVal(icmsTotNode, ['vICMSDeson', 0], 0)),
        vFCP: parseFloat(getVal(icmsTotNode, ['vFCP', 0], 0)),
        vBCST: parseFloat(getVal(icmsTotNode, ['vBCST', 0], 0)),
        vST: parseFloat(getVal(icmsTotNode, ['vST', 0], 0)),
        vFCPST: parseFloat(getVal(icmsTotNode, ['vFCPST', 0], 0)),
        vFCPSTRet: parseFloat(getVal(icmsTotNode, ['vFCPSTRet', 0], 0)),
        vProd: parseFloat(getVal(icmsTotNode, ['vProd', 0], 0)),
        vFrete: parseFloat(getVal(icmsTotNode, ['vFrete', 0], 0)),
        vSeg: parseFloat(getVal(icmsTotNode, ['vSeg', 0], 0)),
        vDesc: parseFloat(getVal(icmsTotNode, ['vDesc', 0], 0)),
        vII: parseFloat(getVal(icmsTotNode, ['vII', 0], 0)),
        vIPI: parseFloat(getVal(icmsTotNode, ['vIPI', 0], 0)),
        vIPIDevol: parseFloat(getVal(icmsTotNode, ['vIPIDevol', 0], 0)),
        vPIS: parseFloat(getVal(icmsTotNode, ['vPIS', 0], 0)),
        vCOFINS: parseFloat(getVal(icmsTotNode, ['vCOFINS', 0], 0)),
        vOutro: parseFloat(getVal(icmsTotNode, ['vOutro', 0], 0)),
        vNF: parseFloat(getVal(icmsTotNode, ['vNF', 0], 0)),
        vTotTrib: parseFloat(getVal(icmsTotNode, ['vTotTrib', 0], 0)),
      }
    } : null;

    // --- Pagamento --- (Trata ausência e garante array)
    const pagNode = getVal(infNFe, ['pag', 0]);
    const detPagItems = getVal(pagNode, ['detPag'], []);
    const pagamento = pagNode ? {
        detalhes: detPagItems.map(detPagXml => {
           const forma = getVal(detPagXml, ['tPag', 0]);
           return {
               indPag: getVal(detPagXml, ['indPag', 0]),
               formaPagamento: forma,
               descricaoPagamento: mapFormaPagamento(forma),
               valor: parseFloat(getVal(detPagXml, ['vPag', 0], 0)),
           };
        }),
        vTroco: parseFloat(getVal(pagNode, ['vTroco', 0], 0))
    } : null;

    // --- Transporte --- (Trata ausência e garante array)
    const transpNode = getVal(infNFe, ['transp', 0]);
    const transportaNode = getVal(transpNode, ['transporta', 0]);
    const veicTranspNode = getVal(transpNode, ['veicTransp', 0]);
    const volItems = getVal(transpNode, ['vol'], []);
    const modFreteCode = getVal(transpNode, ['modFrete', 0]);
    const transporte = transpNode ? {
        modFrete: modFreteCode,
        descricaoModFrete: mapModFrete(modFreteCode),
        transportadora: transportaNode ? {
            nome: getVal(transportaNode, ['xNome', 0]),
            cnpjCpf: getVal(transportaNode, ['CNPJ', 0]) || getVal(transportaNode, ['CPF', 0]),
            ie: getVal(transportaNode, ['IE', 0]),
            enderecoCompleto: getVal(transportaNode, ['xEnder', 0]),
            municipio: getVal(transportaNode, ['xMun', 0]),
            uf: getVal(transportaNode, ['UF', 0]),
        } : null,
        veiculo: veicTranspNode ? {
            placa: getVal(veicTranspNode, ['placa', 0]),
            uf: getVal(veicTranspNode, ['UF', 0]),
            rntc: getVal(veicTranspNode, ['RNTC', 0]),
        } : null,
        volumes: volItems.map(volXml => ({
            quantidade: parseFloat(getVal(volXml, ['qVol', 0], 0)),
            especie: getVal(volXml, ['esp', 0]),
            marca: getVal(volXml, ['marca', 0]),
            numeracao: getVal(volXml, ['nVol', 0]),
            pesoLiquido: parseFloat(getVal(volXml, ['pesoL', 0], 0)),
            pesoBruto: parseFloat(getVal(volXml, ['pesoB', 0], 0)),
        }))
    } : null;


    // --- Monta Objeto Final --- (Retorna null se faltar identificacao essencial)
    if (!identificacao || !emitente || !destinatario || !totais) {
       console.warn('Dados essenciais (identificacao, emitente, destinatario, totais) não puderam ser extraídos.');
       return { error: 'Dados essenciais da NF-e não encontrados.' };
    }

    return {
        identificacao,
        emitente,
        destinatario,
        itens,
        transporte, // Será null se não existir no XML
        pagamento,  // Será null se não existir no XML
        totais
    };

  } catch (error) {
    console.error("Erro detalhado ao extrair dados NF-e:", error);
    // Retorna um objeto de erro em vez de lançar, para controle no caller
    return { error: `Erro na extração: ${error.message}` };
  }
};


module.exports = {
  async processXmlUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo XML enviado.' });
    }
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;
    const userId = req.user.userId;
    let summaryToSave = null; // Variável para o registro de erro

    try {
        const xmlContent = fs.readFileSync(filePath, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: true, ignoreAttrs: false, mergeAttrs: true }); // Manter atributos pode ser útil
        const xmlObj = await parser.parseStringPromise(xmlContent);

        // Chama a nova função de extração detalhada
        const extractedDataResult = extractDetailedNFeData(xmlObj);

        // Verifica se a extração retornou um erro interno
        if (extractedDataResult.error) {
            console.warn(`Falha na extração para ${originalFilename}: ${extractedDataResult.error}`);
            summaryToSave = { // Prepara registro de erro
                userId,
                originalFilename,
                xmlType: 'NFe', // Assume NFe mesmo com erro
                processingError: extractedDataResult.error
                // Não adiciona outros campos para não falhar validação do Mongoose
            };
             await new EverestXmlSummary(summaryToSave).save();
             fs.unlinkSync(filePath);
             return res.status(400).json({ erro: `Não foi possível extrair dados da NF-e: ${extractedDataResult.error}` });
        }

        // Verifica se a chave de acesso foi extraída (indicador principal)
        if (!extractedDataResult?.identificacao?.chaveAcesso) {
             summaryToSave = { userId, originalFilename, xmlType: 'NFe', processingError: 'Chave de acesso não encontrada ou inválida.' };
             await new EverestXmlSummary(summaryToSave).save();
             fs.unlinkSync(filePath);
             return res.status(400).json({ erro: 'Chave de acesso da NF-e não encontrada ou inválida.' });
        }

        // Salvar o resumo detalhado no banco
        const newSummary = new EverestXmlSummary({
            userId,
            originalFilename,
            xmlType: 'NFe',
            identificacao: extractedDataResult.identificacao,
            emitente: extractedDataResult.emitente,
            destinatario: extractedDataResult.destinatario,
            itens: extractedDataResult.itens,
            transporte: extractedDataResult.transporte,
            pagamento: extractedDataResult.pagamento,
            totais: extractedDataResult.totais,
            processingError: null // Sucesso
        });

        await newSummary.save();
        fs.unlinkSync(filePath); // Remove o temp após sucesso

        // Retorna o resumo completo salvo
        return res.status(201).json(newSummary);

    } catch (error) {
        console.error('Erro crítico ao processar XML ou salvar:', error);
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Erro ao remover temp após erro crítico:', e); }

        // Salva registro de erro APENAS se tivermos uma chave (evita duplicados com chave null)
        const potentialChave = errorDataForLog?.identificacao?.chaveAcesso; // Tenta pegar a chave mesmo no erro
        
        if (potentialChave) { // Só tenta salvar o erro no banco se a chave foi extraída
             try {
                 const errorSummary = new EverestXmlSummary({
                     userId,
                     originalFilename,
                     xmlType: 'NFe',
                     processingError: `Erro no processamento: ${error.message}`,
                     identificacao: { chaveAcesso: potentialChave } // Salva pelo menos a chave
                     // Não preenche outros campos obrigatórios para evitar falha de validação
                 });
                  await errorSummary.save();
             } catch (saveError) {
                 // Se mesmo com chave der erro de duplicidade (improvável mas possível), loga
                 if (saveError.code === 11000) {
                    console.warn(`Não foi possível salvar registro de erro para ${originalFilename} (chave ${potentialChave} já existe com erro?). Erro original: ${error.message}`);
                 } else {
                    console.error("Erro ao salvar registro de erro do XML:", saveError);
                 }
             }
        } else {
            console.warn(`Não foi possível extrair a chave de acesso para ${originalFilename}, registro de erro não será salvo no DB. Erro original: ${error.message}`);
        }
        
        return res.status(500).json({ erro: 'Erro interno ao processar o arquivo XML.', details: error.message });
    }
  },

  // --- Obter Resumos (Sumarizados para a Lista) ---
  async getSummaries(req, res) {
    try {
      const userId = req.user.userId;
      const summaries = await EverestXmlSummary.find(
          { userId }, // Busca todos, inclusive os com erro para possível visualização
          // Projeção: Seleciona campos para o card + erro
          '_id originalFilename createdAt identificacao.chaveAcesso identificacao.nNF totais.icmsTot.vNF emitente.nome destinatario.nome processingError'
        )
        .sort({ createdAt: -1 });

      // Mapeia para o formato do card, indicando erro se houver
      const summarizedList = summaries.map(s => ({
          id: s._id,
          filename: s.originalFilename,
          date: s.createdAt,
          key: s.identificacao?.chaveAcesso ?? 'N/A',
          number: s.identificacao?.nNF ?? 'N/A',
          value: s.totais?.icmsTot?.vNF,
          emitter: s.emitente?.nome ?? 'N/A',
          receiver: s.destinatario?.nome ?? 'N/A',
          error: s.processingError // Passa a mensagem de erro para o frontend
      }));

      return res.json(summarizedList);

    } catch (error) {
      console.error('Erro ao buscar resumos XML:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar resumos XML.' });
    }
  },

  // --- Obter Resumo Completo por ID (para o Modal) ---
  async getSummaryById(req, res) {
    try {
      const userId = req.user.userId;
      const summaryId = req.params.id;

      const summary = await EverestXmlSummary.findOne({ _id: summaryId, userId });

      if (!summary) {
        return res.status(404).json({ erro: 'Resumo XML não encontrado ou não pertence a este usuário.' });
      }
      // Se houve erro no processamento, retorna o objeto, mas o frontend deve tratar
      // if (summary.processingError) {
      //    return res.status(400).json({ erro: `Este XML (${summary.originalFilename}) teve um erro durante o processamento: ${summary.processingError}`, summaryWithError: summary });
      // }

      // Retorna o objeto completo (pode conter processingError se falhou)
      return res.json(summary);

    } catch (error) {
       console.error('Erro ao buscar resumo XML por ID:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de resumo inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao buscar resumo XML.' });
    }
  },
  
  // --- Excluir Resumo por ID ---
  async deleteSummary(req, res) {
    try {
      const userId = req.user.userId;
      const summaryId = req.params.id;

      // Tenta encontrar e excluir o documento que pertence ao usuário
      const result = await EverestXmlSummary.findOneAndDelete({ _id: summaryId, userId });

      if (!result) {
        // Se não encontrou, pode ser ID inválido ou não pertence ao usuário
        return res.status(404).json({ erro: 'Resumo XML não encontrado ou você não tem permissão para excluí-lo.' });
      }

      return res.json({ message: 'Resumo XML excluído com sucesso.' });

    } catch (error) {
       console.error('Erro ao excluir resumo XML por ID:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de resumo inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao excluir resumo XML.' });
    }
  }
}; 