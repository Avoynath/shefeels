#!/bin/bash
# Quick script to apply TagadaPay database migration
# Usage: ./apply_tagadapay_migration.sh

# Database connection settings (from .env)
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="honey_db"
DB_USER="postgres"
DB_PASSWORD="123456"

echo "=========================================="
echo "TagadaPay Database Migration"
echo "=========================================="
echo ""
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""
echo "This will add TagadaPay fields to your database."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo ""
echo "Applying migration..."
echo ""

# Apply the SQL migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f sql/tagadapay_migration.sql

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
echo ""
echo "Verification:"
echo "Run this query to check the new columns:"
echo ""
echo "SELECT column_name, data_type FROM information_schema.columns"
echo "WHERE table_name IN ('users', 'subscriptions')"
echo "AND column_name LIKE '%tagada%';"
echo ""
