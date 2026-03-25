import os
from decimal import Decimal
from datetime import datetime, date
from uuid import UUID

from sqlalchemy import create_engine, text, inspect, MetaData, Table
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.schema import CreateTable, CreateIndex


# --- Config ---
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/aichat-pronily",
)
OUT_PATH = os.path.join(os.path.dirname(__file__), "prefill_sql.sql")

# only dump INSERT rows for these
DATA_TABLES = {"app_config", "pricing_plan", "promo_management"}


def _sql_literal(value, dialect_name: str = "postgresql") -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if dialect_name != "sqlite" else "1"
    if isinstance(value, (int, Decimal)):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, (datetime, date)):
        return f"'{value.isoformat()}'"
    if isinstance(value, UUID):
        return f"'{str(value)}'"
    s = str(value).replace("'", "''")
    return f"'{s}'"


def _row_to_insert(table: str, row: dict, dialect_name: str = "postgresql") -> str:
    cols = list(row.keys())
    cols_sql = ", ".join(f'"{c}"' for c in cols)
    vals_sql = ", ".join(_sql_literal(row[c], dialect_name) for c in cols)
    return f'INSERT INTO "{table}" ({cols_sql}) VALUES ({vals_sql});'


# ---------- helpers to generate DDL via reflection ----------
def _reflect_table_and_compile(sync_conn, table_name: str):
    """
    Runs inside run_sync. Reflects a single table and compiles CREATE TABLE and CREATE INDEX statements.
    Returns (create_table_sql, [create_index_sql, ...])
    """
    md = MetaData()
    tbl = Table(table_name, md, autoload_with=sync_conn)
    dialect = sync_conn.dialect

    create_tbl_sql = str(CreateTable(tbl).compile(dialect=dialect))

    index_sqls = []
    for ix in tbl.indexes:
        index_sqls.append(str(CreateIndex(ix).compile(dialect=dialect)))

    return create_tbl_sql, index_sqls


def dump_tables_sync(engine: Engine, out_path: str = OUT_PATH) -> None:
    statements = []
    with engine.connect() as conn:
        inspector = inspect(conn)
        all_tables = inspector.get_table_names()
        dialect_name = engine.dialect.name

        for table in all_tables:
            # CREATE TABLE + INDEXES
            create_tbl_sql, index_sqls = _reflect_table_and_compile(conn, table)
            statements.append(f"-- Schema for table: {table}")
            statements.append(create_tbl_sql + ";")
            for idx_sql in index_sqls:
                statements.append(idx_sql + ";")
            statements.append("")

            # INSERT data only for chosen tables
            if table in DATA_TABLES:
                result = conn.execute(text(f'SELECT * FROM "{table}"'))
                rows = result.mappings().all()
                if not rows:
                    print(f"No rows found for table: {table}")
                else:
                    statements.append(f"-- Data for table: {table}")
                    for r in rows:
                        statements.append(_row_to_insert(table, r, dialect_name))
                    statements.append("")

    if not statements:
        print("No CREATE/INSERT statements generated.")
        return

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(statements))

    print(f"Wrote {len(statements)} lines to {out_path}")


async def dump_tables_async(async_engine: AsyncEngine, out_path: str = OUT_PATH) -> None:
    statements = []
    async with async_engine.connect() as conn:
        all_tables = await conn.run_sync(lambda sc: inspect(sc).get_table_names())
        dialect_name = "postgresql"

        for table in all_tables:
            # CREATE TABLE + INDEXES
            create_tbl_sql, index_sqls = await conn.run_sync(
                lambda sc, t=table: _reflect_table_and_compile(sc, t)
            )
            statements.append(f"-- Schema for table: {table}")
            statements.append(create_tbl_sql + ";")
            for idx_sql in index_sqls:
                statements.append(idx_sql + ";")
            statements.append("")

            # INSERT data only for chosen tables
            if table in DATA_TABLES:
                result = await conn.execute(text(f'SELECT * FROM "{table}"'))
                rows = result.mappings().all()
                if not rows:
                    print(f"No rows found for table: {table}")
                else:
                    statements.append(f"-- Data for table: {table}")
                    for r in rows:
                        statements.append(_row_to_insert(table, r, dialect_name))
                    statements.append("")

    if not statements:
        print("No CREATE/INSERT statements generated.")
        return

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(statements))

    print(f"Wrote {len(statements)} lines to {out_path}")


def main() -> None:
    url = DATABASE_URL
    if "+async" in url or url.startswith("postgresql+asyncpg"):
        async_engine = create_async_engine(url, future=True)
        import asyncio
        asyncio.run(dump_tables_async(async_engine, OUT_PATH))
    else:
        engine = create_engine(url, future=True)
        dump_tables_sync(engine, OUT_PATH)


if __name__ == "__main__":
    main()
