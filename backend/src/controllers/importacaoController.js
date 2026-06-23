const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Importacao = require('../models/importacao');
const TransacaoImportada = require('../models/transacaoImportada');
const ImportacaoService = require('../services/importacaoService');
const Transacao = require('../models/transacao');
const Subconta = require('../models/subconta');
const HistoricoSaldo = require('../models/historicoSaldo');
const installmentUtils = require('../utils/installmentUtils');
const transacaoService = require('../services/transacaoService');
const ledgerService = require('../services/ledgerService');
const previewStorage = require('../utils/previewStorage');
const parserRegistry = require('../services/parsers');
const inferencia = require('../services/inferenciaImportacaoService');
const Categoria = require('../models/categoria');
const Tag = require('../models/tag');
const Usuario = require('../models/usuarios');
const Emprestimo = require('../models/emprestimo');
const Pessoa = require('../models/pessoa');
const emprestimoService = require('../services/emprestimoService');
const PluggyConfig = require('../models/pluggyConfig');
const pluggyService = require('../services/pluggyService');
const pluggySyncService = require('../services/pluggySyncService');
const { normalizarDataUTC } = require('../utils/dateUtils');
const cotacaoService = require('../services/cotacaoService');

function chaveAgrupamentoEmprestimo(cfg) {
  if (!cfg) return null;
  const pessoa = cfg.pessoaId ? String(cfg.pessoaId) : '';
  const prazo = cfg.prazoFinal instanceof Date
    ? cfg.prazoFinal.getTime()
    : (cfg.prazoFinal ? new Date(cfg.prazoFinal).getTime() : 0);
  return [
    pessoa,
    cfg.tipoRetorno || 'valor_fixo',
    cfg.valorEsperadoRetorno != null ? Number(cfg.valorEsperadoRetorno) : 0,
    prazo
  ].join('|');
}

async function criarEmprestimosParaImportacao(transacoesImportadas, usuarioId) {
  if (!Array.isArray(transacoesImportadas) || transacoesImportadas.length === 0) return;

  const candidatos = transacoesImportadas.filter((ti) => {
    const cfg = ti.emprestimoConfig;
    return cfg && cfg.criarEmprestimo === true && !ti.emprestimoId && !cfg.empEmprestimoIdExistente;
  });
  if (candidatos.length === 0) return;

  const grupos = new Map();
  for (const ti of candidatos) {
    const chave = chaveAgrupamentoEmprestimo(ti.emprestimoConfig);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(ti);
  }

  for (const [, grupo] of grupos) {
    const cfg = grupo[0].emprestimoConfig;
    const pessoaId = cfg.pessoaId;
    let pessoa = null;
    if (pessoaId) {
      pessoa = await Pessoa.findOne({ _id: pessoaId, usuario: usuarioId, ativo: true });
    }
    if (!pessoa) {
      const pessoaNome = cfg.pessoaNomeSnapshot
        || (grupo[0].pagamentos?.[0]?.pessoa)
        || 'Importação';
      pessoa = await Pessoa.create({
        usuario: usuarioId,
        nome: pessoaNome,
        ativo: true
      });
    }

    const novoEmprestimo = await Emprestimo.create({
      usuario: usuarioId,
      pessoaId: pessoa._id,
      pessoaNomeSnapshot: pessoa.nome,
      pessoaContatoSnapshot: pessoa.contato || null,
      valorEsperadoRetorno: cfg.valorEsperadoRetorno != null ? Number(cfg.valorEsperadoRetorno) : 0,
      tipoRetorno: cfg.tipoRetorno || 'valor_fixo',
      prazoFinal: cfg.prazoFinal || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      observacao: cfg.observacao || `Criado a partir de importação em ${new Date().toISOString().split('T')[0]}`,
      status: 'ativo'
    });

    const ids = grupo.map((ti) => ti._id);
    await TransacaoImportada.updateMany(
      { _id: { $in: ids }, usuario: usuarioId },
      {
        $set: {
          emprestimoId: novoEmprestimo._id,
          emprestimoIdOrigemCriado: novoEmprestimo._id,
          emprestimoProcessado: true
        }
      }
    );
    for (const ti of grupo) {
      ti.emprestimoId = novoEmprestimo._id;
      ti.emprestimoIdOrigemCriado = novoEmprestimo._id;
      ti.emprestimoProcessado = true;
    }
  }
}

class ImportacaoController {
    static async previewArquivo(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ erro: 'Nenhum arquivo foi enviado' });
            }
            const arquivo = req.file;
            const buffer = await fs.readFile(arquivo.path);
            const { previewId, caminhoAbsoluto, nomeOriginal } = await previewStorage.salvarPreview({
                buffer,
                originalname: arquivo.originalname
            });
            // remove o arquivo temporário que multer criou em uploads/importacao
            await fs.unlink(arquivo.path).catch(() => {});

            let deteccao = null;
            let transacoes = [];
            let avisos = [];
            const conteudo = buffer.toString('utf8');

            try {
                deteccao = parserRegistry.detectar({ filename: nomeOriginal, conteudo });
                transacoes = deteccao.parser.parse({ conteudo });
            } catch (parseErr) {
                await previewStorage.removerPreview(previewId);
                return res.status(422).json({
                    erro: 'Não foi possível identificar o formato do arquivo.',
                    detalhe: parseErr.message
                });
            }

            const meta = inferencia.extrairMetadados({
                transacoes,
                filename: nomeOriginal,
                parserId: deteccao.parser.id
            });

            let complementar = { sugestao: false, motivo: null, sobrepostas: 0 };
            try {
                complementar = await inferencia.detectarPossivelComplementar(Importacao, {
                    usuarioId: req.userId,
                    dataInicial: meta.dataInicial,
                    dataFinal: meta.dataFinal,
                    origem: deteccao.parser.id
                });
            } catch (compErr) {
                console.warn('[Preview] Falha ao detectar complementar:', compErr.message);
            }

            // Inferência avançada: tag sugerida + nº complemento (apenas para nubank_fatura)
            let tagSugerida = null;
            let numeroComplemento = null;
            let categoriaCartaoNaoConfigurada = false;
            let categoriaCartaoDeletada = false;
            let motivoFalhaTag = null;
            if (meta.isFaturaCartao && meta.mesVencimento) {
                try {
                    const usuario = await Usuario.findById(req.userId)
                        .select('preferencias.categoriaCartaoCreditoId')
                        .lean();
                    const categoriaCartaoId = usuario?.preferencias?.categoriaCartaoCreditoId || null;
                    if (!categoriaCartaoId) {
                        categoriaCartaoNaoConfigurada = true;
                        motivoFalhaTag = 'categoria_nao_configurada';
                    } else {
                        const tags = await Tag.find({ usuario: req.userId }).lean();
                        const inferenciaTag = await inferencia.inferirTagPorMes({
                            categoriaCartaoId,
                            tags,
                            parserId: deteccao.parser.id,
                            mesVencimento: meta.mesVencimento,
                            Categoria,
                            Tag,
                            usuarioId: req.userId
                        });
                        if (inferenciaTag.motivo === 'categoria_deletada') {
                            categoriaCartaoDeletada = true;
                            motivoFalhaTag = 'categoria_deletada';
                        } else if (inferenciaTag.tagSugerida === null && inferenciaTag.motivo) {
                            motivoFalhaTag = inferenciaTag.motivo;
                        } else {
                            tagSugerida = inferenciaTag;
                        }
                        numeroComplemento = await inferencia.contarComplementosAnteriores(Importacao, {
                            usuarioId: req.userId,
                            parserId: deteccao.parser.id,
                            mesVencimento: meta.mesVencimento
                        });
                    }
                } catch (tagErr) {
                    console.warn('[Preview] Falha ao inferir tag de fatura:', tagErr.message);
                }
            }

            // Recalcular título com o nº complemento real (se já calculado)
            const tituloFinal = (meta.isFaturaCartao && numeroComplemento != null)
                ? inferencia.sugerirTitulo({
                    filename: nomeOriginal,
                    parserId: deteccao.parser.id,
                    competencia: meta.periodoCompetencia,
                    dataInicial: meta.dataInicial,
                    dataFinal: meta.dataFinal,
                    vencimento: meta.vencimento,
                    numeroComplemento
                })
                : meta.tituloSugerido;

            return res.json({
                previewId,
                parser: {
                    id: deteccao.parser.id,
                    nome: deteccao.parser.nome,
                    confianca: deteccao.score,
                    tipoDestino: deteccao.parser.tipoDestino || null
                },
                metadadosSugeridos: {
                    titulo: tituloFinal,
                    dataInicial: meta.dataInicial,
                    dataFinal: meta.dataFinal,
                    periodoCompetencia: meta.periodoCompetencia,
                    totalRegistros: meta.totalRegistros,
                    totalCreditos: meta.totalCreditos,
                    totalDebitos: meta.totalDebitos,
                    vencimento: meta.vencimento,
                    mesVencimento: meta.mesVencimento,
                    isFaturaCartao: meta.isFaturaCartao,
                    sugerirComplementarAutomaticamente: meta.sugerirComplementarAutomaticamente,
                    tagSugerida,
                    numeroComplemento,
                    categoriaCartaoNaoConfigurada,
                    categoriaCartaoDeletada,
                    motivoFalhaTag
                },
                sugestaoComplementar: complementar,
                amostraTransacoes: transacoes.slice(0, 5).map(t => ({
                    descricao: t.descricao,
                    valor: t.valor,
                    data: t.data,
                    tipo: t.tipo
                })),
                avisos
            });
        } catch (erro) {
            console.error('[Importação] Erro no preview:', erro);
            return res.status(500).json({ erro: 'Erro ao analisar arquivo' });
        }
    }

    static async cancelarPreview(req, res) {
        try {
            const { previewId } = req.params;
            await previewStorage.removerPreview(previewId);
            return res.status(204).send();
        } catch (erro) {
            console.error('[Importação] Erro ao cancelar preview:', erro);
            return res.status(500).json({ erro: 'Erro ao cancelar preview' });
        }
    }

    static async criar(req, res) {
        try {
            // Modo 2 (novo): JSON com previewId — reutiliza arquivo já enviado
            if (req.is('application/json')) {
                const { previewId, descricao, tagsPadrao: tagsPadraoRaw, tipoImportacao: tipoImportacaoRaw, metadados: metadadosRaw } = req.body || {};
                if (!previewId) {
                    return res.status(400).json({ erro: 'previewId é obrigatório' });
                }
                if (!descricao) {
                    return res.status(400).json({ erro: 'Descrição é obrigatória' });
                }
                const destino = path.join('uploads', 'importacao');
                let novoCaminho;
                try {
                    novoCaminho = await previewStorage.consumirPreview(previewId, destino);
                } catch (e) {
                    return res.status(410).json({ erro: e.message });
                }
                const nomeOriginal = path.basename(novoCaminho).replace(/^\d+-/, '');

                const tipoImportacao = (tipoImportacaoRaw === 'complementar') ? 'complementar' : 'normal';
                let tagsPadrao = {};
                if (tagsPadraoRaw) {
                    try {
                        tagsPadrao = typeof tagsPadraoRaw === 'string' ? JSON.parse(tagsPadraoRaw) : tagsPadraoRaw;
                        if (typeof tagsPadrao !== 'object' || tagsPadrao === null) tagsPadrao = {};
                    } catch { tagsPadrao = {}; }
                }
                let metadados = {};
                if (metadadosRaw) {
                    try {
                        metadados = typeof metadadosRaw === 'string' ? JSON.parse(metadadosRaw) : metadadosRaw;
                        if (typeof metadados !== 'object' || metadados === null) metadados = {};
                    } catch { metadados = {}; }
                }

                const importacao = new Importacao({
                    descricao,
                    usuario: req.userId,
                    nomeArquivo: nomeOriginal,
                    caminhoArquivo: novoCaminho,
                    status: 'pendente',
                    tagsPadrao,
                    tipoImportacao,
                    vencimento: metadados.vencimento || null,
                    mesVencimento: metadados.mesVencimento || null,
                    numeroComplemento: (typeof metadados.numeroComplemento === 'number') ? metadados.numeroComplemento : null,
                    tagSugeridaId: metadados.tagSugeridaId || null,
                    categoriaSugeridaId: metadados.categoriaSugeridaId || null
                });
                await importacao.save();
                ImportacaoService.processarArquivo(importacao._id, req.userId)
                    .then(r => console.log('[Importação] Processamento concluído:', r))
                    .catch(e => console.error('[Importação] Erro ao processar arquivo:', e));
                return res.status(201).json(importacao);
            }

            // Modo 1 (legado): multipart com arquivo
            if (!req.file) {
                console.error('[Importação] Erro: Nenhum arquivo enviado');
                return res.status(400).json({ erro: 'Nenhum arquivo foi enviado' });
            }

            const { descricao, tagsPadrao: tagsPadraoRaw, tipoImportacao: tipoImportacaoRaw } = req.body;
            if (!descricao) {
                console.error('[Importação] Erro: Descrição não fornecida');
                return res.status(400).json({ erro: 'Descrição é obrigatória' });
            }

            const tipoImportacao = (tipoImportacaoRaw === 'complementar') ? 'complementar' : 'normal';

            // Parse tagsPadrao se vier como JSON string (FormData envia strings)
            let tagsPadrao = {};
            if (tagsPadraoRaw) {
                try {
                    tagsPadrao = typeof tagsPadraoRaw === 'string' ? JSON.parse(tagsPadraoRaw) : tagsPadraoRaw;
                    if (typeof tagsPadrao !== 'object' || tagsPadrao === null) tagsPadrao = {};
                } catch {
                    tagsPadrao = {};
                }
            }

            const usuario = req.userId;
            const arquivo = req.file;

            console.log('[Importação] Criando nova importação:', {
                descricao,
                nomeArquivo: arquivo.originalname,
                tamanho: arquivo.size,
                tipo: arquivo.mimetype,
                usuario,
                tagsPadrao: Object.keys(tagsPadrao || {}).length > 0 ? tagsPadrao : undefined
            });

            // Cria o registro da importação
            const importacao = new Importacao({
                descricao,
                usuario,
                nomeArquivo: arquivo.originalname,
                caminhoArquivo: arquivo.path,
                status: 'pendente',
                tagsPadrao,
                tipoImportacao
            });

            await importacao.save();
            console.log('[Importação] Nova importação criada:', importacao._id);

            // Inicia o processamento do arquivo (passa usuarioId para validação de ownership)
            ImportacaoService.processarArquivo(importacao._id, usuario)
                .then(resultado => {
                    console.log('[Importação] Processamento concluído:', resultado);
                })
                .catch(erro => {
                    console.error('[Importação] Erro ao processar arquivo:', erro);
                });

            return res.status(201).json(importacao);
        } catch (erro) {
            console.error('[Importação] Erro ao criar importação:', erro);
            return res.status(500).json({ erro: 'Erro ao criar importação' });
        }
    }

    static async listar(req, res) {
        try {
            const usuario = req.userId;
            const { page = 1, limit = 10 } = req.query;

            console.log('[Importação] Listando importações:', { usuario, page, limit });

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { createdAt: -1 },
                populate: {
                    path: 'usuario',
                    select: 'nome email'
                }
            };

            const importacoes = await Importacao.paginate({ usuario }, options);
            
            // Adiciona estatísticas para cada importação
            const resultado = {
                ...importacoes,
                docs: await Promise.all(importacoes.docs.map(async (importacao) => {
                    const stats = {
                        totalTransacoes: await TransacaoImportada.countDocuments({ importacao: importacao._id }),
                        transacoesSucesso: await TransacaoImportada.countDocuments({ 
                            importacao: importacao._id,
                            status: 'validada'
                        }),
                        transacoesErro: await TransacaoImportada.countDocuments({ 
                            importacao: importacao._id,
                            status: 'erro'
                        })
                    };
                    return {
                        ...importacao.toJSON(),
                        estatisticas: stats
                    };
                }))
            };

            console.log('[Importação] Total de importações encontradas:', resultado.totalDocs);
            return res.json(resultado);
        } catch (erro) {
            console.error('[Importação] Erro ao listar importações:', erro);
            return res.status(500).json({ erro: 'Erro ao listar importações' });
        }
    }

    static async obterDetalhes(req, res) {
        try {
            const { id } = req.params;
            const usuario = req.userId;

            console.log('[Importação] Buscando detalhes:', { id, usuario });

            const importacao = await Importacao.findOne({ _id: id, usuario })
                .populate('usuario', 'nome email');

            if (!importacao) {
                console.error('[Importação] Importação não encontrada:', { id, usuario });
                return res.status(404).json({ erro: 'Importação não encontrada' });
            }

            // Busca estatísticas das transações (exclui ignoradas do total exibido)
            const [totalTransacoes, transacoesSucesso, transacoesErro, transacoesJaImportadas, transacoesIgnoradas, transacoesPossivelDuplicata] = await Promise.all([
                TransacaoImportada.countDocuments({ importacao: id, status: { $ne: 'ignorada' } }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'validada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'erro' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'ja_importada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'ignorada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'possivel_duplicata' })
            ]);

            const transacoesNovas = totalTransacoes - transacoesJaImportadas - transacoesPossivelDuplicata;
            const totalIgnoradasNaImportacao = (importacao.totalIgnoradas || 0) + transacoesIgnoradas;
            // Fallback de contagem para possível duplicata (defesa em profundidade):
            // se o importacao.totalPossiveisDuplicatas não foi gravado (versões antigas),
            // usa a contagem real das transações.
            const possivelDuplicataFinal = (importacao.totalPossiveisDuplicatas != null)
                ? importacao.totalPossiveisDuplicatas
                : transacoesPossivelDuplicata;

            const resultado = {
                ...importacao.toJSON(),
                estatisticas: {
                    totalTransacoes,
                    transacoesSucesso,
                    transacoesErro,
                    transacoesNovas,
                    transacoesJaImportadas,
                    transacoesIgnoradas,
                    totalIgnoradas: totalIgnoradasNaImportacao,
                    transacoesPossivelDuplicata: possivelDuplicataFinal
                }
            };

            console.log('[Importação] Detalhes encontrados:', { id, estatisticas: resultado.estatisticas });
            return res.json(resultado);
        } catch (erro) {
            console.error('[Importação] Erro ao obter detalhes da importação:', erro);
            return res.status(500).json({ erro: 'Erro ao obter detalhes da importação' });
        }
    }

    static async duplicar(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.userId;

            const novaImportacao = await ImportacaoService.duplicarImportacao(id, usuarioId);

            return res.status(201).json(novaImportacao);
        } catch (erro) {
            console.error('[Importação] Erro ao duplicar importação:', erro);
            if (erro.message === 'Importação não encontrada.') {
                return res.status(404).json({ erro: erro.message });
            }
            if (erro.message.includes('Não é possível duplicar') || erro.message.includes('Não há transações')) {
                return res.status(400).json({ erro: erro.message });
            }
            return res.status(500).json({ erro: 'Erro ao duplicar importação.' });
        }
    }

    static async excluir(req, res) {
        try {
            const { id } = req.params;
            const usuario = req.userId;

            console.log('[Importação] Tentando excluir:', { id, usuario });

            const importacao = await Importacao.findOne({ _id: id, usuario });
            if (!importacao) {
                console.error('[Importação] Importação não encontrada para exclusão:', { id, usuario });
                return res.status(404).json({ erro: 'Importação não encontrada' });
            }

            // Verifica se o status permite a exclusão
            if (importacao.status === 'finalizada' || importacao.status === 'estornada') {
                console.warn('[Importação] Tentativa de excluir importação já processada:', { id, status: importacao.status });
                return res.status(400).json({ erro: 'Não é possível excluir uma importação com status ' + importacao.status + '.' });
            }

            // Remove as transações importadas associadas
            await TransacaoImportada.deleteMany({ importacao: id, usuario: usuario }); // Garante que só remove do usuário
            console.log('[Importação] Transações importadas removidas:', { id });

            // Remove o arquivo se ainda existir (ignora importações sem arquivo real, como Pluggy)
            if (importacao.caminhoArquivo && importacao.caminhoArquivo !== 'pluggy') {
                try {
                    await fs.unlink(importacao.caminhoArquivo);
                    console.log('[Importação] Arquivo removido:', importacao.caminhoArquivo);
                } catch (erroArquivo) {
                    console.warn('[Importação] Erro ao remover arquivo:', erroArquivo);
                }
            }

            // Remove a importação do banco de dados
            await Importacao.deleteOne({ _id: id, usuario: usuario }); // Usar deleteOne ou findOneAndDelete
            console.log('[Importação] Importação removida com sucesso:', { id });

            return res.status(204).send();
        } catch (erro) {
            console.error('[Importação] Erro ao excluir importação:', erro);
            return res.status(500).json({ erro: 'Erro ao excluir importação' });
        }
    }

    static async finalizarImportacao(req, res) {
        try {
            const importacao = await Importacao.findOne({
                _id: req.params.id,
                usuario: req.userId
            });

            if (!importacao) {
                return res.status(404).json({ erro: 'Importação não encontrada.' });
            }

            // Buscar todas as transações validadas desta importação
            const transacoesImportadas = await TransacaoImportada.find({
                importacao: importacao._id,
                status: 'validada'
            });

            if (transacoesImportadas.length === 0) {
                return res.status(400).json({ erro: 'Não há transações validadas para finalizar.' });
            }

            // Agrupar parcelas por installmentGroupId para detectar se precisa expandir
            const gruposParcelados = new Map(); // installmentGroupId -> [ti, ti, ...]
            const avulsas = []; // transações não parceladas

            for (const ti of transacoesImportadas) {
                if (ti.isInstallment && ti.installmentTotal >= 2) {
                    const key = (ti.installmentGroupId || ti._id).toString();
                    if (!gruposParcelados.has(key)) gruposParcelados.set(key, []);
                    gruposParcelados.get(key).push(ti);
                } else {
                    avulsas.push(ti);
                }
            }

            const transacoesReais = [];
            const mapeamentoTiParaTransacao = []; // [{ ti, transacaoIndex }] para saber qual Transacao vincular a cada ti

            // Fase 2.x — Criar Empréstimos a partir de emprestimoConfig preenchido na revisão
            // 1) Coletar todas as ti com criarEmprestimo: true e sem empEmprestimoIdExistente
            // 2) Agrupar por chave natural (pessoa + direcao + valorEsperado + tipoRetorno + ...)
            // 3) Para cada grupo, criar 1 Empréstimo e setar emprestimoId nas ti correspondentes
            await criarEmprestimosParaImportacao(transacoesImportadas, req.userId);

            const montarTransacao = (ti, valor, data, installmentNumber, installmentTotal, installmentGroupId, intervalDays, dedupKeyOverride) => {
                const pagamentos = ti.pagamentos && ti.pagamentos.length > 0
                    ? ti.pagamentos.map(p => {
                        const base = p.toObject ? p.toObject() : (typeof p === 'object' ? { ...p } : { pessoa: 'Importação Automática', tags: {} });
                        const valorPagamento = (base.valor != null && base.valor !== undefined)
                            ? parseFloat(base.valor)
                            : valor;
                        return { pessoa: base.pessoa || 'Importação Automática', valor: valorPagamento, tags: base.tags || {} };
                    })
                    : [{ pessoa: 'Importação Automática', valor, tags: {} }];
                const obj = {
                    tipo: ti.tipo,
                    descricao: ti.descricao,
                    valor,
                    data,
                    observacao: ti.observacao || `Importado via importação #${ti.importacao}`,
                    pagamentos,
                    usuario: ti.usuario,
                    subconta: ti.subconta || null,
                    emprestimoId: ti.emprestimoId || null,
                    deduplicationKey: dedupKeyOverride != null ? dedupKeyOverride : (ti.deduplicationKey || null),
                    isInstallment: !!installmentGroupId,
                    installmentGroupId: installmentGroupId || null,
                    installmentNumber: installmentNumber != null ? installmentNumber : null,
                    installmentTotal: installmentTotal != null ? installmentTotal : null,
                    installmentIntervalMonths: null,
                    installmentIntervalDays: intervalDays != null ? intervalDays : null
                };
                if (ti.contaConjunta?.ativo) {
                    const preparado = transacaoService.prepararValorEContaConjunta({
                        valor,
                        contaConjunta: { ...ti.contaConjunta, ativo: true }
                    });
                    obj.valor = preparado.valor;
                    obj.contaConjunta = preparado.contaConjunta;
                }
                return obj;
            };

            // Processar grupos parcelados: expandir se 1 linha representa o total
            for (const [, grupo] of gruposParcelados) {
                const totalInstallments = grupo[0].installmentTotal || grupo.length;
                const intervalDays = grupo[0].installmentIntervalDays != null
                    ? grupo[0].installmentIntervalDays
                    : (grupo[0].installmentIntervalMonths != null ? grupo[0].installmentIntervalMonths * 30 : 30);
                const installmentGroupId = grupo[0].installmentGroupId || new mongoose.Types.ObjectId();

                if (grupo.length < totalInstallments) {
                    // Precisa expandir: 1 linha com valor total -> N transações
                    const ti = grupo[0];
                    const valorTotal = Math.abs(parseFloat(ti.valor) || 0);
                    const dataStr = ti.data instanceof Date ? ti.data.toISOString().split('T')[0] : String(ti.data).split('T')[0];
                    const resultado = installmentUtils.generateInstallments({
                        totalAmount: valorTotal,
                        totalInstallments,
                        intervalInDays: intervalDays,
                        startDate: dataStr
                    });
                    if (resultado.erro) {
                        throw new Error(`Erro ao expandir parcelamento: ${resultado.erro}`);
                    }
                    const baseIndex = transacoesReais.length;
                    const usuarioStr = ti.usuario.toString();
                    for (const p of resultado.parcelas) {
                        const dataParcela = new Date(p.date + 'T12:00:00.000Z');
                        const dedupKey = ImportacaoService.gerarDeduplicationKey(usuarioStr, {
                            descricao: ti.descricao,
                            valor: p.value,
                            data: dataParcela,
                            tipo: ti.tipo,
                            identificador: ti.dadosOriginais?.identificador,
                            installmentGroupId: installmentGroupId.toString(),
                            installmentNumber: p.installmentNumber
                        });
                        transacoesReais.push(montarTransacao(ti, p.value, dataParcela, p.installmentNumber, totalInstallments, installmentGroupId, intervalDays, dedupKey));
                    }
                    mapeamentoTiParaTransacao.push({ ti, transacaoIndex: baseIndex });
                } else {
                    // Já expandido: 1 linha por parcela
                    for (const ti of grupo) {
                        const dataVal = ti.data instanceof Date ? ti.data : new Date(ti.data);
                        transacoesReais.push(montarTransacao(
                            ti, ti.valor, dataVal,
                            ti.installmentNumber, ti.installmentTotal, installmentGroupId, intervalDays
                        ));
                        mapeamentoTiParaTransacao.push({ ti, transacaoIndex: transacoesReais.length - 1 });
                    }
                }
            }

            // Processar transações avulsas (não parceladas)
            for (const ti of avulsas) {
                const dataVal = ti.data instanceof Date ? ti.data : new Date(ti.data);
                transacoesReais.push(montarTransacao(ti, ti.valor, dataVal, null, null, null, null));
                mapeamentoTiParaTransacao.push({ ti, transacaoIndex: transacoesReais.length - 1 });
            }

            for (const tr of transacoesReais) {
                if (tr.contaConjunta?.ativo) {
                    transacaoService.validarSomaPagamentos(tr, tr.pagamentos);
                    await transacaoService.validarContaConjunta({
                        contaConjunta: tr.contaConjunta,
                        usuarioId: tr.usuario
                    });
                }
            }

            const { subcontaId, saldo } = req.body || {};
            const saldoNum = (subcontaId && saldo != null && !isNaN(parseFloat(saldo)))
                ? parseFloat(saldo)
                : null;

            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const transacoesCriadas = await Transacao.insertMany(transacoesReais, { session });

                for (const { ti, transacaoIndex } of mapeamentoTiParaTransacao) {
                    await TransacaoImportada.updateOne(
                        { _id: ti._id, usuario: req.userId },
                        { $set: { status: 'processada', transacaoCriada: transacoesCriadas[transacaoIndex]._id } },
                        { session }
                    );
                }

                importacao.status = 'finalizada';
                await importacao.save({ session });

                if (subcontaId && saldoNum != null) {
                    const subconta = await Subconta.findOne({ _id: subcontaId, usuario: req.userId }).session(session);
                    if (subconta) {
                        const saldoAntes = subconta.saldoAtual ?? 0;
                        const delta = saldoNum - saldoAntes;

                        subconta.saldoAtual = saldoNum;
                        subconta.dataUltimaConfirmacao = new Date();
                        await subconta.save({ session });

                        await HistoricoSaldo.create([{
                            usuario: req.userId,
                            subconta: subconta._id,
                            saldo: saldoNum,
                            data: new Date(),
                            origem: 'importacao_csv',
                            tipo: 'ajuste',
                            observacao: `Importação #${importacao._id}`
                        }], { session });

                        if (delta !== 0) {
                            await ledgerService.registrarEvento({
                                usuarioId: req.userId,
                                subcontaId: subconta._id,
                                valor: delta,
                                tipoEvento: 'importacao_csv',
                                origemSistema: 'importacao_csv',
                                referenciaTipo: 'importacao',
                                referenciaId: importacao._id,
                                descricao: `Importação #${importacao._id}`,
                                dataEvento: new Date()
                            }, session);
                        }
                    }
                }

                await session.commitTransaction();
            } catch (err) {
                await session.abortTransaction();
                throw err;
            } finally {
                session.endSession();
            }

            // Fase 2.y — Após commit, recalcular status de cada empréstimo envolvido.
            // Se uma transação atingiu o valor esperado, será quitada e a tx de juros auto
            // será criada/atualizada pelo emprestimoService.
            const emprestimosParaRecalcular = new Set();
            for (const tr of transacoesReais) {
                if (tr.emprestimoId) {
                    emprestimosParaRecalcular.add(String(tr.emprestimoId));
                }
            }
            for (const empId of emprestimosParaRecalcular) {
                try {
                    await emprestimoService.recalcularStatus(empId, req.userId);
                } catch (errEmp) {
                    console.error('[ImportacaoController] Erro ao recalcular empréstimo', empId, errEmp.message);
                }
            }

            res.json({
                mensagem: 'Importação finalizada com sucesso',
                totalTransacoes: transacoesReais.length
            });
        } catch (error) {
            console.error('[ImportacaoController] Erro ao finalizar importação:', error);
            res.status(500).json({ erro: 'Erro ao finalizar importação.' });
        }
    }

    static async estornarImportacao(req, res) {
        try {
            const importacao = await Importacao.findOne({
                _id: req.params.id,
                usuario: req.userId,
                status: 'finalizada'
            });

            if (!importacao) {
                return res.status(404).json({ erro: 'Importação não encontrada ou não está finalizada.' });
            }

            // Buscar todas as transações desta importação (filtro usuario para isolamento)
            const transacoesImportadas = await TransacaoImportada.find({
                importacao: importacao._id,
                usuario: req.userId,
                status: 'processada'
            });

            if (transacoesImportadas.length === 0) {
                return res.status(400).json({ erro: 'Não há transações para estornar.' });
            }

            // Estornar transações reais: por transacaoCriada (preciso) ou fallback por descricao/valor/data
            const emprestimosAfetados = new Set();
            for (const transacaoImportada of transacoesImportadas) {
                if (transacaoImportada.transacaoCriada) {
                    const tx = await Transacao.findOne({
                        _id: transacaoImportada.transacaoCriada,
                        usuario: req.userId
                    });
                    if (tx) {
                        tx.status = 'estornado';
                        await tx.save();
                        if (tx.emprestimoId) {
                            emprestimosAfetados.add(String(tx.emprestimoId));
                        }
                    }
                } else {
                    const encontradas = await Transacao.find({
                        descricao: transacaoImportada.descricao,
                        valor: transacaoImportada.valor,
                        data: transacaoImportada.data,
                        usuario: transacaoImportada.usuario,
                        status: 'ativo'
                    });
                    for (const tx of encontradas) {
                        tx.status = 'estornado';
                        await tx.save();
                        if (tx.emprestimoId) {
                            emprestimosAfetados.add(String(tx.emprestimoId));
                        }
                    }
                }
            }

            // Atualizar status da importação
            importacao.status = 'estornada';
            await importacao.save();

            // Recalcular status dos empréstimos afetados (reverter quitação se totalReceived < valorEsperado)
            for (const empId of emprestimosAfetados) {
                try {
                    await emprestimoService.recalcularStatus(empId, req.userId);
                } catch (errEmp) {
                    console.error('[ImportacaoController] Erro ao recalcular empréstimo no estorno', empId, errEmp.message);
                }
            }

            // Atualizar status das transações importadas (filtro usuario)
            await TransacaoImportada.updateMany(
                { importacao: importacao._id, usuario: req.userId, status: 'processada' },
                { $set: { status: 'estornada' } }
            );

            res.json({ 
                mensagem: 'Importação estornada com sucesso',
                totalTransacoes: transacoesImportadas.length
            });
        } catch (error) {
            console.error('[ImportacaoController] Erro ao estornar importação:', error);
            res.status(500).json({ erro: 'Erro ao estornar importação.' });
        }
    }

    static async previewPluggy(req, res) {
        try {
            const { itemId, accountId, dateFrom, dateTo } = req.body || {};
            const usuarioId = req.userId;

            if (!itemId || !accountId) {
                return res.status(400).json({ erro: 'itemId e accountId são obrigatórios.' });
            }

            const config = await PluggyConfig.findOne({ usuario: usuarioId, ativo: true });
            if (!config) {
                return res.status(400).json({ erro: 'Pluggy não configurado. Configure o Open Finance primeiro.' });
            }

            const item = config.items.find(i =>
                String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId) && i.ativo && i.subconta
            );
            if (!item) {
                return res.status(400).json({ erro: 'Conta Pluggy não encontrada ou não mapeada a uma subconta.' });
            }

            // Garante dados frescos: sincroniza antes de consultar
            const syncInicio = Date.now();
            let syncOk = false;
            try {
                syncOk = await pluggyService.sincronizarItem(usuarioId, itemId);
                const syncDur = ((Date.now() - syncInicio) / 1000).toFixed(1);
                console.log('[PreviewPluggy] Sync concluido em ' + syncDur + 's');
            } catch (syncErr) {
                console.warn('[PreviewPluggy] Sync falhou, usando cache:', syncErr.message);
            }

            // Verificar accounts do item para confirmar accountId existe
            try {
                const accounts = await pluggyService.buscarAccountsDoItem(usuarioId, itemId);
                const accountExiste = accounts.some(a => String(a.id) === String(accountId));
                if (!accountExiste) {
                    console.warn('[PreviewPluggy] ** ATENCAO: accountId nao encontrado nas accounts retornadas pela API **');
                }
                // Apos sync, re-ler status do item da config
                const configAtualizada = await PluggyConfig.findOne({ usuario: usuarioId, ativo: true }).lean();
                if (configAtualizada) {
                    const itemAtual = configAtualizada.items.find(i =>
                        String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId)
                    );
                }
            } catch (accErr) {
                console.warn('[PreviewPluggy] Falha ao verificar accounts:', accErr.message);
            }

            const txs = await pluggyService.buscarTodasTransacoes(usuarioId, accountId, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            });

            const isCredit = item.accountType === 'CREDIT';
            const transacoesMapeadas = [];
            let skippedPending = 0, skippedSemData = 0, skippedSemId = 0, pendingIncluidos = 0;
            let totalMoedaEstrangeira = 0, totalFalhaConversao = 0;
            const moedasEncontradas = new Set();
            for (const tx of txs) {
                if (!tx || !tx.id) { skippedSemId++; continue; }
                if (tx.status === 'PENDING') {
                    if (isCredit) {
                        pendingIncluidos++;
                    } else {
                        skippedPending++;
                        continue;
                    }
                }
                const data = tx.date ? normalizarDataUTC(tx.date) : null;
                if (!data || isNaN(data.getTime())) { skippedSemData++; continue; }

                const conv = await cotacaoService.converterSeMoedaEstrangeira(tx);
                const dadosOriginais = Object.assign({}, tx);
                if (conv.moedaOriginal) {
                    totalMoedaEstrangeira++;
                    moedasEncontradas.add(conv.moedaOriginal);
                    dadosOriginais._moedaOriginal = conv.moedaOriginal;
                    dadosOriginais._cotacaoUsada = conv.cotacaoUsada;
                    dadosOriginais._valorOriginal = conv.valorOriginal;
                    let statusObservacao = null;
                    if (!conv.cotacaoUsada) {
                        totalFalhaConversao++;
                        statusObservacao = 'Moeda ' + conv.moedaOriginal + ' sem cotação disponível';
                    }
                    transacoesMapeadas.push({
                        descricao: (tx.description || tx.descriptionRaw || 'Transação Pluggy').trim(),
                        valor: conv.valorConvertido,
                        data,
                        tipo: tx.type === 'CREDIT' ? 'recebivel' : 'gasto',
                        categoria: tx.category || null,
                        dadosOriginais,
                        moedaOriginal: conv.moedaOriginal,
                        cotacaoUsada: conv.cotacaoUsada,
                        statusObservacao
                    });
                } else {
                    transacoesMapeadas.push({
                        descricao: (tx.description || tx.descriptionRaw || 'Transação Pluggy').trim(),
                        valor: conv.valorConvertido,
                        data,
                        tipo: tx.type === 'CREDIT' ? 'recebivel' : 'gasto',
                        categoria: tx.category || null,
                        dadosOriginais
                    });
                }
            }
            console.log('[PreviewPluggy] Transacoes:', transacoesMapeadas.length,
                '| pendentes:', skippedPending, '| moeda estr.:', totalMoedaEstrangeira);

            const parserId = isCredit ? 'pluggy_fatura' : 'pluggy_extrato';
            const parserNome = isCredit ? 'Pluggy Cartão de Crédito' : 'Pluggy Conta Corrente';

            const meta = inferencia.extrairMetadados({
                transacoes: transacoesMapeadas,
                filename: item.connectorName || 'Pluggy',
                parserId
            });

            // Para Pluggy CREDIT: mesVencimento é calculado das datas das transações (mês seguinte)
            if (isCredit && !meta.mesVencimento && transacoesMapeadas.length > 0) {
                const ultimaData = transacoesMapeadas.reduce(function(max, t) {
                    return t.data > max ? t.data : max;
                }, transacoesMapeadas[0].data);
                const mes = ultimaData.getUTCMonth();
                const ano = ultimaData.getUTCFullYear();
                const proximoMes = mes + 1;
                const anoProximoMes = proximoMes > 11 ? ano + 1 : ano;
                const mesStr = String((proximoMes % 12) + 1).padStart(2, '0');
                meta.mesVencimento = anoProximoMes + '-' + mesStr;
                console.log('[PreviewPluggy] mesVencimento:', meta.mesVencimento);
            }

            let sugestaoComplementar = { sugestao: false, motivo: null, sobrepostas: 0 };
            try {
                sugestaoComplementar = await inferencia.detectarPossivelComplementar(Importacao, {
                    usuarioId,
                    dataInicial: meta.dataInicial,
                    dataFinal: meta.dataFinal,
                    origem: parserId
                });
            } catch (compErr) {
                console.warn('[PreviewPluggy] Falha detectar complementar:', compErr.message);
            }

            let tagSugerida = null;
            let numeroComplemento = null;
            let categoriaCartaoNaoConfigurada = false;
            let categoriaCartaoDeletada = false;
            let motivoFalhaTag = null;

            if (isCredit && meta.mesVencimento) {
                try {
                    const usuario = await Usuario.findById(usuarioId)
                        .select('preferencias.categoriaCartaoCreditoId')
                        .lean();
                    const categoriaCartaoId = usuario?.preferencias?.categoriaCartaoCreditoId || null;
                    if (!categoriaCartaoId) {
                        categoriaCartaoNaoConfigurada = true;
                        motivoFalhaTag = 'categoria_nao_configurada';
                    } else {
                        const tags = await Tag.find({ usuario: usuarioId }).lean();
                        const inferenciaTag = await inferencia.inferirTagPorMes({
                            categoriaCartaoId,
                            tags,
                            parserId,
                            mesVencimento: meta.mesVencimento,
                            Categoria,
                            Tag,
                            usuarioId
                        });
                        if (inferenciaTag.motivo === 'categoria_deletada') {
                            categoriaCartaoDeletada = true;
                            motivoFalhaTag = 'categoria_deletada';
                        } else if (inferenciaTag.tagSugerida === null && inferenciaTag.motivo) {
                            motivoFalhaTag = inferenciaTag.motivo;
                        } else {
                            tagSugerida = inferenciaTag;
                        }
                        numeroComplemento = await inferencia.contarComplementosAnteriores(Importacao, {
                            usuarioId,
                            parserId,
                            mesVencimento: meta.mesVencimento
                        });
                    }
                } catch (tagErr) {
                    console.warn('[PreviewPluggy] Falha inferir tag:', tagErr.message);
                }
            }

            console.log('[PreviewPluggy] Metadados inferidos:', {
                totalRegistros: meta.totalRegistros,
                dataInicial: meta.dataInicial,
                dataFinal: meta.dataFinal,
                periodoCompetencia: meta.periodoCompetencia,
                totalCreditos: meta.totalCreditos,
                totalDebitos: meta.totalDebitos,
                isFaturaCartao: isCredit
            });
            const avisos = [];
            if (isCredit && pendingIncluidos > 0) {
                avisos.push(pendingIncluidos + ' transação(ões) PENDING (não confirmadas pelo banco) foram incluídas na prévia, pois são compras recentes do cartão de crédito.');
            }
            if (totalMoedaEstrangeira > 0) {
                const moedasList = Array.from(moedasEncontradas).join(', ');
                avisos.push(totalMoedaEstrangeira + ' transação(ões) em moeda estrangeira (' + moedasList + ') foram convertidas para BRL usando a cotação do banco ou awesomeapi.');
            }
            if (totalFalhaConversao > 0) {
                avisos.push(totalFalhaConversao + ' transação(ões) em moeda estrangeira não puderam ser convertidas (cotação indisponível). Revise o valor manualmente.');
            }



            const tituloFinal = (isCredit && meta.periodoCompetencia)
                ? 'Fatura ' + (item.connectorName || 'Cart\u00e3o') + ' - ' + inferencia.formatarCompetenciaPT(meta.periodoCompetencia) + (numeroComplemento ? ' (' + numeroComplemento + '\u00ba Complemento)' : '')
                : meta.tituloSugerido || 'Importação ' + (item.connectorName || 'Pluggy');

            return res.json({
                isPluggy: true,
                pluggyParams: { itemId, accountId, accountType: item.accountType, dateFrom, dateTo },
                parser: {
                    id: parserId,
                    nome: parserNome,
                    confianca: 1.0,
                    tipoDestino: isCredit ? 'fatura' : 'extrato'
                },
                metadadosSugeridos: {
                    titulo: tituloFinal,
                    dataInicial: meta.dataInicial,
                    dataFinal: meta.dataFinal,
                    periodoCompetencia: meta.periodoCompetencia,
                    totalRegistros: meta.totalRegistros,
                    totalCreditos: meta.totalCreditos,
                    totalDebitos: meta.totalDebitos,
                    vencimento: meta.vencimento,
                    mesVencimento: meta.mesVencimento,
                    isFaturaCartao: isCredit,
                    sugerirComplementarAutomaticamente: isCredit,
                    tagSugerida,
                    numeroComplemento,
                    categoriaCartaoNaoConfigurada,
                    categoriaCartaoDeletada,
                    motivoFalhaTag
                },
                sugestaoComplementar,
                amostraTransacoes: transacoesMapeadas.slice(0, 5).map(t => ({
                    descricao: t.descricao,
                    valor: t.valor,
                    data: t.data,
                    tipo: t.tipo
                })),
                avisos
            });
        } catch (erro) {
            console.error('[PreviewPluggy] Erro:', erro);
            return res.status(500).json({ erro: 'Erro ao analisar transações do Open Finance.' });
        }
    }

    static async criarDaPluggy(req, res) {
        try {
            const { itemId, accountId, dateFrom, dateTo, descricao, tagsPadrao, tipoImportacao, metadados } = req.body || {};
            const usuarioId = req.userId;

            if (!itemId || !accountId) {
                return res.status(400).json({ erro: 'itemId e accountId são obrigatórios.' });
            }
            if (!descricao) {
                return res.status(400).json({ erro: 'Descrição é obrigatória.' });
            }

            const config = await PluggyConfig.findOne({ usuario: usuarioId, ativo: true });
            if (!config) {
                return res.status(400).json({ erro: 'Pluggy não configurado.' });
            }

            const item = config.items.find(i =>
                String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId) && i.ativo && i.subconta
            );
            if (!item) {
                return res.status(400).json({ erro: 'Conta Pluggy não encontrada.' });
            }

            const usuario = await Usuario.findById(usuarioId).select('preferencias.proprietario').lean();
            const proprietarioPadrao = usuario?.preferencias?.proprietario?.trim() || 'Titular';

            const isCredit = item.accountType === 'CREDIT';
            const parserId = isCredit ? 'pluggy_fatura' : 'pluggy_extrato';

            let tagsPadraoObj = {};
            if (tagsPadrao) {
                try {
                    tagsPadraoObj = typeof tagsPadrao === 'string' ? JSON.parse(tagsPadrao) : tagsPadrao;
                } catch (e) { tagsPadraoObj = {}; }
            }

            const importacao = new Importacao({
                descricao,
                usuario: usuarioId,
                origem: parserId,
                nomeArquivo: (item.connectorName || 'Pluggy') + ' - ' + (item.accountName || item.accountId),
                caminhoArquivo: 'pluggy',
                status: 'pendente',
                tagsPadrao: tagsPadraoObj,
                tipoImportacao: tipoImportacao === 'complementar' ? 'complementar' : 'normal'
            });
            if (metadados) {
                const m = typeof metadados === 'string' ? JSON.parse(metadados) : metadados;
                if (m.vencimento) importacao.vencimento = m.vencimento;
                if (m.mesVencimento) importacao.mesVencimento = m.mesVencimento;
                if (typeof m.numeroComplemento === 'number') importacao.numeroComplemento = m.numeroComplemento;
                if (m.tagSugeridaId) importacao.tagSugeridaId = m.tagSugeridaId;
                if (m.categoriaSugeridaId) importacao.categoriaSugeridaId = m.categoriaSugeridaId;
            }
            await importacao.save();

            const txs = await pluggyService.buscarTodasTransacoes(usuarioId, accountId, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            });

            let totalTransacoes = 0;
            let totalIgnoradas = 0;
            let totalPossiveisDuplicatas = 0;
            let totalJaImportadas = 0;
            const txIdsVistos = new Set();
            const transacoesParaProcessar = [];
            let skippedSemId = 0, skippedDuplicado = 0, skippedPending = 0, skippedSemData = 0;
            let pendingIncluidos = 0;

            for (const tx of txs) {
                if (!tx || !tx.id) { skippedSemId++; totalIgnoradas++; continue; }
                if (txIdsVistos.has(tx.id)) { skippedDuplicado++; totalIgnoradas++; continue; }
                txIdsVistos.add(tx.id);
                if (tx.status === 'PENDING') {
                    if (isCredit) {
                        pendingIncluidos++;
                    } else {
                        skippedPending++;
                        totalIgnoradas++;
                        continue;
                    }
                }

                let amount = Math.abs(parseFloat(tx.amount) || 0);
                let moedaOriginal = null, cotacaoUsada = null, valorOriginal = null;
                if (tx.currencyCode && tx.currencyCode !== 'BRL') {
                    moedaOriginal = tx.currencyCode;
                    valorOriginal = amount;
                    if (tx.amountInAccountCurrency != null) {
                        amount = Math.abs(parseFloat(tx.amountInAccountCurrency));
                        cotacaoUsada = valorOriginal !== 0 ? amount / valorOriginal : null;
                    } else {
                        const cotacao = await cotacaoService.obterCotacao(tx.currencyCode + '-BRL');
                        if (cotacao) {
                            cotacaoUsada = cotacao;
                            amount = valorOriginal * cotacao;
                        }
                    }
                }
                const tipo = tx.type === 'CREDIT' ? 'recebivel' : 'gasto';
                const data = tx.date ? normalizarDataUTC(tx.date) : null;
                if (!data || isNaN(data.getTime())) { skippedSemData++; totalIgnoradas++; continue; }

                const desc = (tx.description || tx.descriptionRaw || 'Transação Pluggy').trim();
                const dedupKey = pluggySyncService.gerarDeduplicationKeyPluggy(
                    usuarioId.toString(), item.subconta.toString(), tx.id
                );

                let status = 'pendente';
                const snapshot = {};

                const existeImportada = await TransacaoImportada.findOne({
                    usuario: usuarioId, pluggyTransactionId: tx.id,
                    status: { $in: ['pendente', 'validada', 'processada', 'ja_importada', 'revisada'] }
                }).lean();
                const existeIgnorada = await TransacaoImportada.findOne({
                    usuario: usuarioId, pluggyTransactionId: tx.id, status: 'ignorada'
                }).lean();

                if (existeImportada) {
                    totalJaImportadas++;
                    status = 'ja_importada';
                    if (existeImportada.transacaoCriada) {
                        snapshot.transacaoSemelhanteId = existeImportada.transacaoCriada;
                    }
                } else if (existeIgnorada) {
                    totalIgnoradas++;
                    status = 'ignorada';
                } else {
                    // Mesmo dia calendário: busca match exato em Transacao (não TransacaoImportada)
                    const msDia = 86400000;
                    const dataTs = data.getTime();
                    const mesmoDiaInicio = new Date(Math.floor((dataTs - 12 * 3600000) / msDia) * msDia);
                    const mesmoDiaFim = new Date(mesmoDiaInicio.getTime() + msDia);
                    const descExact = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const duplicataMesmoDia = await Transacao.findOne({
                        usuario: usuarioId,
                        status: 'ativo',
                        descricao: new RegExp('^\\s*' + descExact + '\\s*$', 'i'),
                        valor: { $gte: amount - ImportacaoService.TOLERANCIA_VALOR, $lte: amount + ImportacaoService.TOLERANCIA_VALOR },
                        data: { $gte: mesmoDiaInicio, $lt: mesmoDiaFim }
                    }).lean();
                    if (duplicataMesmoDia) {
                        status = 'possivel_duplicata';
                        totalPossiveisDuplicatas++;
                        snapshot.transacaoSemelhanteId = duplicataMesmoDia._id;
                        snapshot.transacaoSemelhanteDistanciaDias = 0;
                        snapshot.transacaoSemelhanteData = duplicataMesmoDia.data;
                        snapshot.transacaoSemelhanteValor = duplicataMesmoDia.valor;
                        snapshot.transacaoSemelhanteDescricao = duplicataMesmoDia.descricao;
                    } else {
                        // Fallback normalizado: busca transações do mesmo dia + mesmo valor,
                        // compara descrição via normalizarDescricaoComparacao (ignora variações como " - Parcela X/Y")
                        const descNorm = ImportacaoService.normalizarDescricaoComparacao(desc);
                        const candidatasNorm = await Transacao.find({
                            usuario: usuarioId,
                            status: 'ativo',
                            valor: { $gte: amount - ImportacaoService.TOLERANCIA_VALOR, $lte: amount + ImportacaoService.TOLERANCIA_VALOR },
                            data: { $gte: mesmoDiaInicio, $lt: mesmoDiaFim }
                        }).lean();
                        const duplicataNorm = candidatasNorm.find(function(t) {
                            return ImportacaoService.normalizarDescricaoComparacao(t.descricao || '') === descNorm;
                        });
                        if (duplicataNorm) {
                            status = 'possivel_duplicata';
                            totalPossiveisDuplicatas++;
                            snapshot.transacaoSemelhanteId = duplicataNorm._id;
                            snapshot.transacaoSemelhanteDistanciaDias = 0;
                            snapshot.transacaoSemelhanteData = duplicataNorm.data;
                            snapshot.transacaoSemelhanteValor = duplicataNorm.valor;
                            snapshot.transacaoSemelhanteDescricao = duplicataNorm.descricao;
                        } else {
                            const fuzzyMatch = await ImportacaoService.buscarPossivelDuplicata(usuarioId, {
                                descricao: desc, valor: amount, data
                            });
                            if (fuzzyMatch) {
                                const distDias = Math.round(Math.abs(
                                    new Date(fuzzyMatch.data).getTime() - data.getTime()
                                ) / 86400000);
                                status = 'possivel_duplicata';
                                totalPossiveisDuplicatas++;
                                snapshot.transacaoSemelhanteId = fuzzyMatch._id;
                                snapshot.transacaoSemelhanteDistanciaDias = distDias;
                                snapshot.transacaoSemelhanteData = fuzzyMatch.data;
                                snapshot.transacaoSemelhanteValor = fuzzyMatch.valor;
                                snapshot.transacaoSemelhanteDescricao = fuzzyMatch.descricao;
                            }
                        }
                    }
                }

                if (moedaOriginal && !cotacaoUsada) {
                    status = 'erro';
                }

                const txEnriquecido = moedaOriginal
                    ? Object.assign(Object.assign({}, tx), { _moedaOriginal: moedaOriginal, _cotacaoUsada: cotacaoUsada, _valorOriginal: valorOriginal })
                    : tx;
                transacoesParaProcessar.push({ tx: txEnriquecido, amount, tipo, data, desc, dedupKey, status, snapshot });
            }

            if (transacoesParaProcessar.length === 0) {
                importacao.status = 'finalizada';
                await importacao.save();
                return res.json({
                    importacaoId: importacao._id,
                    totalTransacoes: 0, totalJaImportadas, totalIgnoradas, totalPossiveisDuplicatas,
                    mensagem: 'Nenhuma transação nova encontrada.'
                });
            }

            for (const t of transacoesParaProcessar) {
                const pagamentosComTags = ImportacaoService.mergeTagsPadrao(
                    [{ pessoa: proprietarioPadrao, valor: t.amount, tags: {} }],
                    tagsPadraoObj
                );
                const transacaoImportada = new TransacaoImportada({
                    importacao: importacao._id, usuario: usuarioId,
                    descricao: t.desc, valor: t.amount, data: t.data, tipo: t.tipo,
                    status: t.status,
                    dadosOriginais: t.tx,
                    deduplicationKey: t.dedupKey,
                    pluggyTransactionId: t.tx.id,
                    subconta: item.subconta,
                    pagamentos: pagamentosComTags,
                    ...t.snapshot
                });
                await transacaoImportada.save();
                totalTransacoes++;
            }

            importacao.totalProcessado = totalTransacoes;
            importacao.totalSucesso = totalTransacoes;
            importacao.totalIgnoradas = totalIgnoradas;
            importacao.totalPossiveisDuplicatas = totalPossiveisDuplicatas;
            importacao.status = 'validado';
            await importacao.save();

            try {
                const inferenciaPessoaService = require('../services/inferenciaPessoaService');
                const transacoesParaInferir = await TransacaoImportada.find({
                    importacao: importacao._id, status: 'pendente'
                }).lean();
                const inferencias = await inferenciaPessoaService.inferirPessoasEmLote(
                    transacoesParaInferir.map(t => ({
                        descricao: t.descricao, valor: t.valor, data: t.data, tipo: t.tipo
                    })),
                    usuarioId
                );
                for (let i = 0; i < transacoesParaInferir.length; i++) {
                    const inf = inferencias[i];
                    if (inf) {
                        await TransacaoImportada.updateOne(
                            { _id: transacoesParaInferir[i]._id },
                            { $set: {
                                pessoaSugerida: inf.pessoa,
                                pessoaSugeridaCount: inf.count,
                                pessoaSugeridaConfianca: inf.confianca,
                                pessoaSugeridaSample: inf.sample || null,
                                pessoaSugeridaTransacaoIds: inf.transacaoIds || [],
                                pessoaSugeridaAplicada: false
                            }}
                        );
                    }
                }
            } catch (inferenciaErr) {
                console.warn('[ImportacaoPluggy] Falha inferência pessoa:', inferenciaErr.message);
            }

            return res.status(201).json({
                importacaoId: importacao._id,
                totalTransacoes, totalJaImportadas, totalIgnoradas, totalPossiveisDuplicatas,
                mensagem: 'Importação criada com ' + totalTransacoes + ' transações novas.'
            });
        } catch (erro) {
            console.error('[ImportacaoPluggy] Erro:', erro);
            return res.status(500).json({ erro: 'Erro ao criar importação a partir do Open Finance.' });
        }
    }
}

module.exports = ImportacaoController; 