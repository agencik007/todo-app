"""add_groups_table_and_group_id_to_todos

Revision ID: f8e1d2c3b4a5
Revises: 786bdc9d1e12
Create Date: 2026-02-08 18:48:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f8e1d2c3b4a5"
down_revision: Union[str, Sequence[str], None] = "786bdc9d1e12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Get connection to check database type
    conn = op.get_bind()
    is_postgres = conn.dialect.name == "postgresql"

    # Create GroupColor enum type only for PostgreSQL
    if is_postgres:
        groupcolor = postgresql.ENUM(
            "blue",
            "green",
            "red",
            "yellow",
            "purple",
            "pink",
            "orange",
            "teal",
            "indigo",
            "gray",
            name="groupcolor",
        )
        groupcolor.create(conn, checkfirst=True)
        color_type = groupcolor
    else:
        # For SQLite and other databases, use String with application-level validation
        color_type = sa.String()

    # Create groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", color_type, nullable=False, server_default="blue"),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_groups_id"), "groups", ["id"], unique=False)
    op.create_index(op.f("ix_groups_user_id"), "groups", ["user_id"], unique=False)
    op.create_foreign_key(
        "fk_groups_user_id", "groups", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )

    # Add group_id column to todos table
    op.add_column("todos", sa.Column("group_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_todos_group_id"), "todos", ["group_id"], unique=False)
    op.create_foreign_key(
        "fk_todos_group_id",
        "todos",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Get connection to check database type
    conn = op.get_bind()
    is_postgres = conn.dialect.name == "postgresql"

    # Drop foreign key and column from todos
    op.drop_constraint("fk_todos_group_id", "todos", type_="foreignkey")
    op.drop_index(op.f("ix_todos_group_id"), table_name="todos")
    op.drop_column("todos", "group_id")

    # Drop groups table and constraints
    op.drop_constraint("fk_groups_user_id", "groups", type_="foreignkey")
    op.drop_index(op.f("ix_groups_user_id"), table_name="groups")
    op.drop_index(op.f("ix_groups_id"), table_name="groups")
    op.drop_table("groups")

    # Drop enum type only for PostgreSQL
    if is_postgres:
        postgresql.ENUM(name="groupcolor").drop(conn, checkfirst=True)
