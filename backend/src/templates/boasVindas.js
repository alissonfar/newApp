module.exports = (nome, siteUrl) => {
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
                    background-color: #28a745;
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
                <h2>Bem-vindo(a) ${nome}!</h2>
                <p>Seu email foi verificado com sucesso e sua conta está pronta para uso!</p>
                
                <p>Você agora tem acesso completo a todas as funcionalidades da nossa plataforma.</p>
                
                <a href="${siteUrl}/login" class="button">Acessar minha conta</a>
                
                <p>Algumas dicas para começar:</p>
                <ul>
                    <li>Complete seu perfil</li>
                    <li>Configure suas preferências</li>
                    <li>Explore nossas funcionalidades</li>
                </ul>
                
                <div class="footer">
                    <p>Se precisar de ajuda, nossa equipe de suporte está sempre disponível.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}; 