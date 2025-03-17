module.exports = (nome, token, siteUrl) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #dc3545;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Olá ${nome}!</h2>
                <p>Recebemos uma solicitação para redefinir sua senha. Se você não fez esta solicitação, por favor ignore este email.</p>
                
                <p>Para redefinir sua senha, clique no botão abaixo:</p>
                
                <a href="${siteUrl}/redefinir-senha/${token}" class="button">Redefinir Senha</a>
                
                <p>Se o botão acima não funcionar, você pode copiar e colar o seguinte link em seu navegador:</p>
                <p>${siteUrl}/redefinir-senha/${token}</p>
                
                <p>Este link é válido por 1 hora.</p>
                
                <div class="footer">
                    <p>Por razões de segurança, não compartilhe este email com ninguém.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}; 