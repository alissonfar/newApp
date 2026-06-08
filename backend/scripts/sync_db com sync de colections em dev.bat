@echo off
SET ATLAS_URI="mongodb+srv://..."
SET LOCAL_URI="mongodb://localhost:27017/?replicaSet=rs0"

echo === 1. Backup LOCAL completo (preserva coleções dev) ===
mongodump --uri=%LOCAL_URI% --out=./temp_local

echo === 2. Backup PRODUÇÃO ===
mongodump --uri=%ATLAS_URI% --out=./temp_prod

echo === 3. Restaura PRODUÇÃO (--drop limpa tudo) ===
mongorestore --uri=%LOCAL_URI% --drop ./temp_prod/controle_gastos

echo === 4. Restaura coleções que SÓ EXISTEM localmente ===
for /f "delims=" %%f in ('dir /b ./temp_local/controle_gastos/*.bson 2^>nul') do (
    if not exist "./temp_prod/controle_gastos/%%f" (
        echo Restaurando: %%~nf
        mongorestore --uri=%LOCAL_URI% --nsInclude="controle_gastos.%%~nf" ./temp_local
    )
)

echo === 5. Limpeza ===
rd /s /q temp_local temp_prod

echo === Sincronização concluída! ===
pause