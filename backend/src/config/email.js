const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Configurações padrão para os emails
const configPadrao = {
    from: process.env.EMAIL_FROM || 'Sua Aplicação <noreply@suaaplicacao.com>',
    siteUrl: process.env.SITE_URL || 'http://localhost:3000'
};

// Função para testar a conexão do email
const testarConexao = async () => {
    try {
        await transportador.verify();
        console.log('Conexão com servidor de email estabelecida com sucesso');
        return true;
    } catch (erro) {
        console.error('Erro ao conectar com servidor de email:', erro);
        return false;
    }
};

module.exports = {
    transportador,
    configPadrao,
    testarConexao
}; 