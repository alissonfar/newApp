@echo off
SET ATLAS_URI="mongodb+srv://alissonfariascamargo:tLltGI5g4Qd4DIiO@newapp-controlefinancei.k98qx.mongodb.net/controle_gastos"
SET LOCAL_URI="mongodb://localhost:27017"

echo === 1. Iniciando Backup do Atlas (Produção) ===
mongodump --uri=%ATLAS_URI% --out=./temp_backup

echo === 2. Restaurando dados no Docker (Local) ===
:: O --drop limpa o banco local antes de subir o novo para não duplicar dados
mongorestore --uri=%LOCAL_URI% --drop ./temp_backup

echo === 3. Limpando arquivos temporários ===
rd /s /q temp_backup

echo === Sincronização concluída com sucesso! ===
pause