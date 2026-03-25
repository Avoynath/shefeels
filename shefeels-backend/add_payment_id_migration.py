"""add tagada_payment_id to orders

Revision ID: add_tagada_payment_id
Revises: 
Create Date: 2026-01-04 14:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_tagada_payment_id'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add tagada_payment_id column
    op.add_column('orders', sa.Column('tagada_payment_id', sa.String(length=150), nullable=True))
    op.create_index('ix_orders_tagada_payment_id', 'orders', ['tagada_payment_id'], unique=False)


def downgrade():
    op.drop_index('ix_orders_tagada_payment_id', table_name='orders')
    op.drop_column('orders', 'tagada_payment_id')
