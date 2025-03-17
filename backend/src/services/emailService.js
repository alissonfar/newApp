const { transportador, configPadrao } = require('../config/email');
const emailVerificacaoTemplate = require('../templates/emailVerificacao');
const redefinicaoSenhaTemplate = require('../templates/redefinicaoSenha');
const boasVindasTemplate = require('../templates/boasVindas');

class EmailService {
    constructor() {
        this.transportador = transportador;
        this.configPadrao = configPadrao;
    }

    async enviarEmail(para, assunto, html) {
        const tentativasMaximas = 3;
        let tentativa = 1;

        while (tentativa <= tentativasMaximas) {
            try {
                const resultado = await this.transportador.sendMail({
                    from: this.configPadrao.from,
                    to: para,
                    subject: assunto,
                    html: html
                });

                console.log('Email enviado com sucesso:', resultado.messageId);
                return true;
            } catch (erro) {
                console.error(`Tentativa ${tentativa} falhou:`, erro);
                
                if (tentativa === tentativasMaximas) {
                    throw new Error('Falha ao enviar email após várias tentativas');
                }
                
                // Espera 2 segundos antes da próxima tentativa
                await new Promise(resolve => setTimeout(resolve, 2000));
                tentativa++;
            }
        }
    }

    async enviarEmailVerificacao(usuario, token) {
        const html = emailVerificacaoTemplate(
            usuario.nome,
            token,
            this.configPadrao.siteUrl
        );

        return this.enviarEmail(
            usuario.email,
            'Verifique seu email',
            html
        );
    }

    async enviarEmailRedefinicaoSenha(usuario, token) {
        const html = redefinicaoSenhaTemplate(
            usuario.nome,
            token,
            this.configPadrao.siteUrl
        );

        return this.enviarEmail(
            usuario.email,
            'Redefinição de Senha',
            html
        );
    }

    async enviarEmailBoasVindas(usuario) {
        const html = boasVindasTemplate(
            usuario.nome,
            this.configPadrao.siteUrl
        );

        return this.enviarEmail(
            usuario.email,
            'Bem-vindo(a)! Sua conta está ativa',
            html
        );
    }
}

module.exports = new EmailService(); 