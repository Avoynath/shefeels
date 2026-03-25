import os
import re
from sqlalchemy import create_engine, MetaData, Table, select, func
from sqlalchemy.dialects.postgresql import insert

def get_db_urls():
    local_url = None
    prod_url = None
    
    # Assuming script is run from /script or /scripts folder, .env is in parent directory
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    
    if not os.path.exists(env_path):
        env_path = '.env' # fallback if run from root
        
    with open(env_path, 'r') as f:
        content = f.read()
        
    for line in content.splitlines():
        if line.startswith('#DATABASE_URL='):
            # Taking the commented one as prod based on the hostname in .env
            prod_url = line.split('=', 1)[1].strip()
        elif line.startswith('DATABASE_URL='):
            local_url = line.split('=', 1)[1].strip()
            
    # Remove asyncpg driver to use default psycopg2 for synchronous execution
    if local_url:
        local_url = local_url.replace('+asyncpg', '')
    if prod_url:
        prod_url = prod_url.replace('+asyncpg', '')
        
    return local_url, prod_url

def main():
    local_url, prod_url = get_db_urls()
    
    if not local_url or not prod_url:
        print("Error: Could not find both local and prod database URLs in .env")
        print(f"Local URL: {local_url}")
        print(f"Prod URL: {prod_url}")
        return

    print("Connecting to databases...")
    local_engine = create_engine(local_url)
    prod_engine = create_engine(prod_url)

    metadata = MetaData()
    
    print("Reflecting local 'characters' table...")
    try:
        local_characters_table = Table('characters', metadata, autoload_with=local_engine)
    except Exception as e:
        print(f"Failed to reflect local table: {e}")
        return

    # Fetch data: target only male anime characters
    with local_engine.connect() as local_conn:
        print("Querying local characters...")
        query = select(local_characters_table).where(
            func.lower(local_characters_table.c.gender) == 'male',
            func.lower(local_characters_table.c.style) == 'realistic'
        )
        result = local_conn.execute(query)
        rows = [dict(row._mapping) for row in result]

    if not rows:
        print("No male anime characters found in the local database to migrate.")
        return

    print(f"Found {len(rows)} male anime character(s).")
    
    print("Reflecting prod 'characters' table...")
    prod_metadata = MetaData()
    try:
        prod_characters_table = Table('characters', prod_metadata, autoload_with=prod_engine)
    except Exception as e:
        print(f"Failed to reflect prod table: {e}")
        return

    print("Inserting data into prod database...")
    try:
        with prod_engine.begin() as prod_conn:
            stmt = insert(prod_characters_table).values(rows)
            # DO NOTHING on conflict to avoid errors on characters that have already been migrated
            stmt = stmt.on_conflict_do_nothing(index_elements=['id'])
            prod_conn.execute(stmt)
        print("Successfully migrated characters to prod DB!")
    except Exception as e:
        print(f"Error inserting into prod DB: {e}")

if __name__ == "__main__":
    main()
