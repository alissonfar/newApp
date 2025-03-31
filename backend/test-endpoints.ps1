# Configurações
$baseUrl = "http://localhost:3001/api"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2U2MGY5MDhiNDEwNTU3M2E4ZTRhMDYiLCJpYXQiOjE3NDMyNzQ2MjUsImV4cCI6MTc0Mzg3OTQyNX0.1SoPLQamnOOZB8ih8Yk4BEXDFzYDXDKMcH6wZ_nKcjo" # Substitua pelo token válido

# Função para fazer requisições HTTP com tratamento de erro
function Invoke-ApiRequest {
    param (
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [string]$ContentType = "application/json"
    )

    $headers = @{
        "Authorization" = "Bearer $token"
    }

    $params = @{
        Method = $Method
        Uri = "$baseUrl$Endpoint"
        Headers = $headers
        ContentType = $ContentType
    }

    if ($Body) {
        $params.Body = $Body
    }

    try {
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $response
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $statusDescription = $_.Exception.Response.StatusDescription
        $rawError = $_.Exception.Message

        return @{
            Success = $false
            StatusCode = $statusCode
            Error = "$statusDescription - $rawError"
        }
    }
}

# Função para exibir resultado formatado
function Show-TestResult {
    param (
        [string]$TestName,
        [object]$Result
    )

    Write-Host "`n=== $TestName ===" -ForegroundColor Cyan
    
    if ($Result.Success) {
        Write-Host "Status: " -NoNewline
        Write-Host "SUCCESS" -ForegroundColor Green
        Write-Host "Response:`n" -ForegroundColor Gray
        $Result.Data | ConvertTo-Json -Depth 10
    }
    else {
        Write-Host "Status: " -NoNewline
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "Error: $($Result.Error)" -ForegroundColor Red
        Write-Host "Status Code: $($Result.StatusCode)" -ForegroundColor Red
    }
    
    Write-Host "----------------------------------------`n"
}

# 1. Testar GET /importacoes (Listar todas)
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/importacoes"
Show-TestResult -TestName "GET /importacoes (Listar todas)" -Result $result

# 2. Testar GET /importacoes com paginação
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/importacoes?page=1&limit=10"
Show-TestResult -TestName "GET /importacoes (Com paginação)" -Result $result

# 3. Testar POST /importacoes (Criar nova importação)
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"
$filePath = "./uploads/importacao/exemplo_transacoes.json"
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileContent = [System.Text.Encoding]::UTF8.GetString($fileBytes)

$body = @"
--$boundary
Content-Disposition: form-data; name="descricao"

Teste via PowerShell
--$boundary
Content-Disposition: form-data; name="tipoArquivo"

json
--$boundary
Content-Disposition: form-data; name="arquivo"; filename="exemplo_transacoes.json"
Content-Type: application/json

$fileContent
--$boundary--
"@

$result = Invoke-ApiRequest -Method "POST" -Endpoint "/importacoes" -Body $body -ContentType "multipart/form-data; boundary=$boundary"
Show-TestResult -TestName "POST /importacoes (Criar nova)" -Result $result

# Guardar ID da importação criada para os próximos testes
if ($result.Success) {
    $importacaoId = $result.Data._id
}
else {
    $importacaoId = "id_nao_encontrado"
}

# 4. Testar GET /importacoes/{id} (Obter detalhes)
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/importacoes/$importacaoId"
Show-TestResult -TestName "GET /importacoes/{id} (Obter detalhes)" -Result $result

# 5. Testar GET /importacoes/{id}/transacoes
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/importacoes/$importacaoId/transacoes"
Show-TestResult -TestName "GET /importacoes/{id}/transacoes" -Result $result

# 6. Testar PUT /importacoes/{id}/finalizar
$result = Invoke-ApiRequest -Method "PUT" -Endpoint "/importacoes/$importacaoId/finalizar"
Show-TestResult -TestName "PUT /importacoes/{id}/finalizar" -Result $result

Write-Host "`nTestes finalizados!" -ForegroundColor Green
pause 