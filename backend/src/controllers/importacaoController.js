const path = require('path');
const fs = require('fs').promises;
const Importacao = require('../models/importacao');
const TransacaoImportada = require('../models/transacaoImportada');
const ImportacaoService = require('../services/importacaoService');
const Transacao = require('../models/transacao');

class ImportacaoController {
    static async criar(req, res) {
        try {
            if (!req.file) {
                console.error('[Importação] Erro: Nenhum arquivo enviado');
                return res.status(400).json({ erro: 'Nenhum arquivo foi enviado' });
            }

            const { descricao, tagsPadrao: tagsPadraoRaw } = req.body;
            if (!descricao) {
                console.error('[Importação] Erro: Descrição não fornecida');
                return res.status(400).json({ erro: 'Descrição é obrigatória' });
            }

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
                tagsPadrao
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

            // Busca estatísticas das transações
            const [totalTransacoes, transacoesSucesso, transacoesErro] = await Promise.all([
                TransacaoImportada.countDocuments({ importacao: id }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'validada' }),
                TransacaoImportada.countDocuments({ importacao: id, status: 'erro' })
            ]);

            const resultado = {
                ...importacao.toJSON(),
                estatisticas: {
                    totalTransacoes,
                    transacoesSucesso,
                    transacoesErro
                }
            };

            console.log('[Importação] Detalhes encontrados:', { id, estatisticas: resultado.estatisticas });
            return res.json(resultado);
        } catch (erro) {
            console.error('[Importação] Erro ao obter detalhes da importação:', erro);
            return res.status(500).json({ erro: 'Erro ao obter detalhes da importação' });
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

            // Criar as transações reais
            const transacoesReais = transacoesImportadas.map(ti => ({
                tipo: ti.tipo,
                descricao: ti.descricao,
                valor: ti.valor,
                data: ti.data,
                observacao: ti.observacao || `Importado via importação #${ti.importacao}`,
                pagamentos: ti.pagamentos && ti.pagamentos.length > 0 
                    ? ti.pagamentos
                    : [{
                        pessoa: 'Importação Automática',
                        valor: ti.valor,
                        tags: {}
                    }],
                usuario: ti.usuario
            }));

            // Salvar todas as transações no banco
            await Transacao.insertMany(transacoesReais);

            // Atualizar status da importação
            importacao.status = 'finalizada';
            await importacao.save();

            // Atualizar status das transações importadas
            await TransacaoImportada.updateMany(
                { importacao: importacao._id, status: 'validada' },
                { $set: { status: 'processada' } }
            );

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

            // Estornar todas as transações reais
            for (const transacaoImportada of transacoesImportadas) {
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