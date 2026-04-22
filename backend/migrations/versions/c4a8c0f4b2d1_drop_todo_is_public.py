"""drop_todo_is_public

Revision ID: c4a8c0f4b2d1
Revises: 658f4b511d04
Create Date: 2026-04-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4a8c0f4b2d1"
down_revision: Union[str, Sequence[str], None] = "658f4b511d04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_is_public_index_name() -> str | None:
    """Return the index name for todos.is_public when it exists."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    for index in inspector.get_indexes("todos"):
        if index.get("column_names") == ["is_public"]:
            return index["name"]

    return None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {column["name"] for column in inspector.get_columns("todos")}

    if "is_public" not in columns:
        return

    index_name = _get_is_public_index_name()

    with op.batch_alter_table("todos") as batch_op:
        if index_name:
            batch_op.drop_index(index_name)
        batch_op.drop_column("is_public")


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {column["name"] for column in inspector.get_columns("todos")}

    if "is_public" in columns:
        return

    with op.batch_alter_table("todos") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_public",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.create_index("ix_todos_is_public", ["is_public"], unique=False)
