# Quick Token Credit Script
# Usage: .\credit_tokens.ps1 <email> <tokens>
# Example: .\credit_tokens.ps1 admin@tripleminds.co 300

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [int]$Tokens
)

$body = @{
    email = $Email
    tokens = $Tokens
    source = "manual_credit"
    order_id = "MANUAL_$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

$response = Invoke-WebRequest `
    -Uri "http://localhost:8000/api/v1/tagada/internal/debug-credit-tokens" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body

$result = $response.Content | ConvertFrom-Json

Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
Write-Host "User: $($result.user_id)" -ForegroundColor Cyan
Write-Host "Tokens Credited: $($result.tokens)" -ForegroundColor Yellow
Write-Host "New Balance: $($result.new_balance)" -ForegroundColor Green
Write-Host "`n"
