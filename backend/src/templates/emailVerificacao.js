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
                    background-color: #007bff;
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
                <p>Obrigado por se cadastrar em nossa plataforma. Para ativar sua conta, por favor clique no botão abaixo:</p>
                
                <a href="${siteUrl}/verificar-email/${token}" class="button">Verificar Email</a>
                
                <p>Se o botão acima não funcionar, você pode copiar e colar o seguinte link em seu navegador:</p>
                <p>${siteUrl}/verificar-email/${token}</p>
                
                <p>Este link é válido por 24 horas.</p>
                
                <div class="footer">
                    <p>Se você não solicitou esta verificação, por favor ignore este email.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}; 