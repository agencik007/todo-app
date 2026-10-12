"""initial_schema_camel_case

Revision ID: 658f4b511d04
Revises:
Create Date: 2026-02-19 19:15:32.909673

The schema as it was at this revision (users, groups, todos with the
is_public column that c4a8c0f4b2d1 drops). This migration used to be
empty because the app creates the tables itself on startup, so
`alembic upgrade head` failed on an empty database. Databases that
already have an alembic_version row never run it again.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "658f4b511d04"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GROUP_COLORS = (
    "BLUE",
    "GREEN",
    "RED",
    "YELLOW",
    "PURPLE",
    "PINK",
    "ORANGE",
    "TEAL",
    "INDIGO",
    "GRAY",
)


def upgrade() -> None:
    """Upgrade schema."""
    group_color = postgresql.ENUM(*GROUP_COLORS, name="groupcolor")
    group_color.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("password_reset_token", sa.String(), nullable=True),
        sa.Column(
            "password_reset_expires_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("email_verification_token", sa.String(), nullable=True),
        sa.Column(
            "email_verification_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(
        op.f("ix_users_email_verification_token"),
        "users",
        ["email_verification_token"],
        unique=False,
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(
        op.f("ix_users_password_reset_token"),
        "users",
        ["password_reset_token"],
        unique=False,
    )

    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "color",
            postgresql.ENUM(name="groupcolor", create_type=False),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_groups_id"), "groups", ["id"], unique=False)
    op.create_index(op.f("ix_groups_user_id"), "groups", ["user_id"], unique=False)

    op.create_table(
        "todos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=True),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_todos_group_id"), "todos", ["group_id"], unique=False)
    op.create_index(op.f("ix_todos_id"), "todos", ["id"], unique=False)
    op.create_index(op.f("ix_todos_is_public"), "todos", ["is_public"], unique=False)
    op.create_index(op.f("ix_todos_user_id"), "todos", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("todos")
    op.drop_table("groups")
    op.drop_table("users")
    postgresql.ENUM(name="groupcolor").drop(op.get_bind(), checkfirst=True)
