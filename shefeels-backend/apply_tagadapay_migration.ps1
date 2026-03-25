# PowerShell script to apply TagadaPay database migration
# Usage: .\apply_tagadapay_migration.ps1

# Database connection settings (from .env)
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "honey_db"
$DB_USER = "postgres"
$DB_PASSWORD = "123456"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TagadaPay Database Migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database: $DB_NAME"
Write-Host "Host: ${DB_HOST}:${DB_PORT}"
Write-Host "User: $DB_USER"
Write-Host ""
Write-Host "This will add TagadaPay fields to your database."
Write-Host "Press Ctrl+C to cancel, or any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Applying migration..." -ForegroundColor Green
Write-Host ""

# Set password environment variable
$env:PGPASSWORD = $DB_PASSWORD

# Apply the SQL migration
try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f sql\tagadapay_migration.sql
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "Migration complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verification:" -ForegroundColor Cyan
    Write-Host "Run this query to check the new columns:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "SELECT column_name, data_type FROM information_schema.columns" -ForegroundColor White
    Write-Host "WHERE table_name IN ('users', 'subscriptions')" -ForegroundColor White
    Write-Host "AND column_name LIKE '%tagada%';" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "ERROR: Failed to apply migration" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure PostgreSQL client (psql) is installed and in your PATH." -ForegroundColor Yellow
    Write-Host "You can also run the SQL file manually:" -ForegroundColor Yellow
    Write-Host "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f sql\tagadapay_migration.sql" -ForegroundColor White
    exit 1
}
finally {
    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
