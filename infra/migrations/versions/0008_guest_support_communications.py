"""Guest support cases, private department threads and idempotent work sources.

Revision ID: 0008
Revises: 0007
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _id(nullable=False):
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True)


def _timestamps():
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def upgrade() -> None:
    duplicate_task = op.get_bind().execute(sa.text("""
        SELECT 1 FROM staff.tasks WHERE source_ref IS NOT NULL
        GROUP BY property_id, source, source_ref HAVING count(*) > 1 LIMIT 1
    """)).first()
    if duplicate_task:
        raise RuntimeError("Resolve duplicate source-linked tasks before migrating guest support")
    op.create_table(
        "support_conversations",
        _id(),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True)),
        sa.Column("guest_id", postgresql.UUID(as_uuid=True)),
        sa.Column("room_id", postgresql.UUID(as_uuid=True)),
        sa.Column("room_number", sa.String(12)),
        sa.Column("department_id", postgresql.UUID(as_uuid=True)),
        sa.Column("topic", sa.String(48), nullable=False),
        sa.Column("urgency", sa.String(12), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("escalation_reason", sa.String(64)),
        sa.Column("assigned_owner_id", postgresql.UUID(as_uuid=True)),
        sa.Column("request_id", postgresql.UUID(as_uuid=True)),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        *_timestamps(), schema="guest",
    )
    op.create_index("ix_guest_support_conversations_property_id", "support_conversations", ["property_id"], schema="guest")
    op.create_table(
        "support_posts",
        _id(),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("guest.support_conversations.id"), nullable=False),
        sa.Column("client_message_id", postgresql.UUID(as_uuid=True)),
        sa.Column("author_kind", sa.String(12), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("visibility", sa.String(12), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("property_id", "client_message_id", name="uq_support_post_client_message"),
        schema="guest",
    )
    op.create_index("ix_guest_support_posts_conversation_id", "support_posts", ["conversation_id"], schema="guest")
    op.create_table(
        "support_participants",
        _id(),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("guest.support_conversations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True)),
        *_timestamps(),
        sa.UniqueConstraint("conversation_id", "user_id"), schema="guest",
    )
    op.create_index("ix_guest_support_participants_conversation_id", "support_participants", ["conversation_id"], schema="guest")
    op.create_index("ix_guest_support_participants_user_id", "support_participants", ["user_id"], schema="guest")
    op.add_column("service_requests", sa.Column("source_message_id", postgresql.UUID(as_uuid=True)), schema="guest")
    op.create_index("uq_guest_request_source_message", "service_requests", ["source_message_id"],
                    unique=True, postgresql_where=sa.text("source_message_id IS NOT NULL"), schema="guest")
    op.add_column("concierge_messages", sa.Column("conversation_id", postgresql.UUID(as_uuid=True)), schema="guest_intel")
    op.create_index("ix_guest_intel_concierge_messages_conversation_id", "concierge_messages", ["conversation_id"], schema="guest_intel")
    op.create_index("uq_staff_task_source", "tasks", ["property_id", "source", "source_ref"],
                    unique=True, postgresql_where=sa.text("source_ref IS NOT NULL"), schema="staff")


def downgrade() -> None:
    op.drop_index("uq_staff_task_source", table_name="tasks", schema="staff")
    op.drop_index("ix_guest_intel_concierge_messages_conversation_id", table_name="concierge_messages", schema="guest_intel")
    op.drop_column("concierge_messages", "conversation_id", schema="guest_intel")
    op.drop_index("uq_guest_request_source_message", table_name="service_requests", schema="guest")
    op.drop_column("service_requests", "source_message_id", schema="guest")
    op.drop_index("ix_guest_support_participants_user_id", table_name="support_participants", schema="guest")
    op.drop_index("ix_guest_support_participants_conversation_id", table_name="support_participants", schema="guest")
    op.drop_table("support_participants", schema="guest")
    op.drop_index("ix_guest_support_posts_conversation_id", table_name="support_posts", schema="guest")
    op.drop_table("support_posts", schema="guest")
    op.drop_index("ix_guest_support_conversations_property_id", table_name="support_conversations", schema="guest")
    op.drop_table("support_conversations", schema="guest")
