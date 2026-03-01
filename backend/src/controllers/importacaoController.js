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

class ImportacaoController {
    static async criar(req, res) {
        try {
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

            // Inicia o processamento do arquivo
            ImportacaoService.processarArquivo(importacao._id)
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
            const [totalTransacoes, transacoesSucesso, transacoesErro, transacoesJaImportadas, transacoesIgnoradas] = await Promise.all([
                TransacaoImportada.countDocuments({ importacao: id, status: { $ne: 'ignorada' } }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'validada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'erro' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'ja_importada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'ignorada' })
            ]);

            const transacoesNovas = totalTransacoes - transacoesJaImportadas;
            const totalIgnoradasNaImportacao = (importacao.totalIgnoradas || 0) + transacoesIgnoradas;

            const resultado = {
                ...importacao.toJSON(),
                estatisticas: {
                    totalTransacoes,
                    transacoesSucesso,
                    transacoesErro,
                    transacoesNovas,
                    transacoesJaImportadas,
                    transacoesIgnoradas,
                    totalIgnoradas: totalIgnoradasNaImportacao
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

            // Remove o arquivo se ainda existir
            if (importacao.caminhoArquivo) {
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

            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const transacoesCriadas = await Transacao.insertMany(transacoesReais, { session });

                for (const { ti, transacaoIndex } of mapeamentoTiParaTransacao) {
                    await TransacaoImportada.updateOne(
                        { _id: ti._id },
                        { $set: { status: 'processada', transacaoCriada: transacoesCriadas[transacaoIndex]._id } },
                        { session }
                    );
                }

                importacao.status = 'finalizada';
                await importacao.save({ session });
                await session.commitTransaction();
            } catch (err) {
                await session.abortTransaction();
                throw err;
            } finally {
                session.endSession();
            }

            // Opcional: atualizar saldo de subconta se subcontaId e saldo forem enviados
            const { subcontaId, saldo } = req.body || {};
            if (subcontaId && saldo != null && !isNaN(parseFloat(saldo))) {
                try {
                    const subconta = await Subconta.findOne({ _id: subcontaId, usuario: req.userId });
                    if (subconta) {
                        subconta.saldoAtual = parseFloat(saldo);
                        subconta.dataUltimaConfirmacao = new Date();
                        await subconta.save();
                        await HistoricoSaldo.create({
                            usuario: req.userId,
                            subconta: subconta._id,
                            saldo: parseFloat(saldo),
                            data: new Date(),
                            origem: 'importacao_csv',
                            observacao: `Importação #${importacao._id}`
                        });
                    }
                } catch (errSaldo) {
                    console.warn('[ImportacaoController] Erro ao atualizar saldo pós-importação:', errSaldo);
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

            // Buscar todas as transações desta importação
            const transacoesImportadas = await TransacaoImportada.find({
                importacao: importacao._id,
                status: 'processada'
            });

            if (transacoesImportadas.length === 0) {
                return res.status(400).json({ erro: 'Não há transações para estornar.' });
            }

            // Estornar transações reais: por transacaoCriada (preciso) ou fallback por descricao/valor/data
            for (const transacaoImportada of transacoesImportadas) {
                if (transacaoImportada.transacaoCriada) {
                    await Transacao.updateOne(
                        { _id: transacaoImportada.transacaoCriada, status: 'ativo' },
                        { $set: { status: 'estornado' } }
                    );
                } else {
                    await Transacao.updateMany(
                        {
                            descricao: transacaoImportada.descricao,
                            valor: transacaoImportada.valor,
                            data: transacaoImportada.data,
                            usuario: transacaoImportada.usuario,
                            status: 'ativo'
                        },
                        { $set: { status: 'estornado' } }
                    );
                }
            }

            // Atualizar status da importação
            importacao.status = 'estornada';
            await importacao.save();

            // Atualizar status das transações importadas
            await TransacaoImportada.updateMany(
                { importacao: importacao._id, status: 'processada' },
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
}

module.exports = ImportacaoController; 