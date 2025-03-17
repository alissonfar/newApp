const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Rota de teste para verificar a conexão com o serviço de email
router.post('/teste', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                sucesso: false, 
                mensagem: 'Email é obrigatório' 
            });
        }

        await emailService.enviarEmail(
            email,
            'Teste de Email',
            '<h1>Teste de Email</h1><p>Se você recebeu este email, o serviço está funcionando corretamente!</p>'
        );

        res.json({ 
            sucesso: true, 
            mensagem: 'Email de teste enviado com sucesso' 
        });
    } catch (erro) {
        console.error('Erro ao enviar email de teste:', erro);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: 'Erro ao enviar email de teste',
            erro: erro.message 
        });
    }
});

module.exports = router; 