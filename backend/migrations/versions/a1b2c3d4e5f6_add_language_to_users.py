"""add language to users

Revision ID: a1b2c3d4e5f6
Revises: 1793c297ab63
Create Date: 2026-02-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "1793c297ab63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("language", sa.String(), nullable=False, server_default="en")
    )


def downgrade() -> None:
    op.drop_column("users", "language")
