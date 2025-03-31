@echo off
setlocal

REM Configurar o token de autenticação
set TOKEN= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2U2MGY5MDhiNDEwNTU3M2E4ZTRhMDYiLCJpYXQiOjE3NDMyNzQ2MjUsImV4cCI6MTc0Mzg3OTQyNX0.1SoPLQamnOOZB8ih8Yk4BEXDFzYDXDKMcH6wZ_nKcjo

echo Testando endpoints da API de Importacao
echo =====================================

echo.
echo 1. Testando GET /importacoes (Listar todas)
curl -v -H "Authorization: Bearer %TOKEN%" http://localhost:3001/api/importacoes
timeout /t 2

echo.
echo 2. Testando GET /importacoes com paginacao
curl -v -H "Authorization: Bearer %TOKEN%" "http://localhost:3001/api/importacoes?page=1&limit=10"
timeout /t 2

echo.
echo 3. Testando POST /importacoes (Criar nova importacao)
curl -v -X POST ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: multipart/form-data" ^
  -F "descricao=Teste via Curl" ^
  -F "tipoArquivo=json" ^
  -F "arquivo=@./uploads/importacao/exemplo_transacoes.json" ^
  http://localhost:3001/api/importacoes
timeout /t 2

echo.
echo 4. Testando GET /importacoes/{id} (Obter detalhes)
set IMPORTACAO_ID=seu_id_aqui
curl -v -H "Authorization: Bearer %TOKEN%" http://localhost:3001/api/importacoes/%IMPORTACAO_ID%
timeout /t 2

echo.
echo 5. Testando GET /importacoes/{id}/transacoes (Listar transacoes)
curl -v -H "Authorization: Bearer %TOKEN%" http://localhost:3001/api/importacoes/%IMPORTACAO_ID%/transacoes
timeout /t 2

echo.
echo 6. Testando PUT /importacoes/{id}/finalizar (Finalizar importacao)
curl -v -X PUT ^
  -H "Authorization: Bearer %TOKEN%" ^
  http://localhost:3001/api/importacoes/%IMPORTACAO_ID%/finalizar
timeout /t 2

echo.
echo Testes finalizados!
pause 