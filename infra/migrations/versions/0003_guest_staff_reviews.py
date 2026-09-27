"""Guests reviewing staff, and the performance board built from it

The mirror of the staff-reviewing-guests tables added in 17ce50d62c3e, with the
constraints that matter written into the schema rather than left to the service:

`uq_staff_review_one_per_guest_per_stay` is what makes a rating one-per-pair-per-stay.
Enforcing it here rather than in Python means two concurrent submissions cannot both
pass the "have you already rated this person?" check and both insert.

`score` on the summary is nullable on purpose and stays null until four separate guests
have rated someone. A nullable column is the honest representation of "not enough
evidence"; a zero would sort them bottom of a board that reads worst-to-best.

Revision ID: 0003
Revises: 17ce50d62c3e
Create Date: 2026-09-20 14:05:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "17ce50d62c3e"
branch_labels = None
depends_on = None

SCHEMA = "guest_intel"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    staff_reviews_exists = inspector.has_table("guest_staff_reviews", schema=SCHEMA)
    if not staff_reviews_exists:
        op.create_table(
        "guest_staff_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sentiment_label", sa.String(length=16), nullable=False, server_default="neutral"),
        sa.Column("sentiment_method", sa.String(length=16), nullable=False, server_default="lexicon"),
        sa.Column("during_complaint", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        # A rating outside 1–5 is not a rating. The service checks it too; this is the
        # line that holds if anything ever writes to the table directly.
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_staff_review_rating_range"),
        sa.UniqueConstraint(
            "stay_id", "staff_id", "guest_id", name="uq_staff_review_one_per_guest_per_stay"
        ),
            schema=SCHEMA,
        )
        op.create_index("ix_gsr_stay", "guest_staff_reviews", ["stay_id"], schema=SCHEMA)
        op.create_index("ix_gsr_guest", "guest_staff_reviews", ["guest_id"], schema=SCHEMA)
        op.create_index("ix_gsr_staff", "guest_staff_reviews", ["staff_id"], schema=SCHEMA)

    if not inspector.has_table("staff_performance_summaries", schema=SCHEMA):
        op.create_table(
        "staff_performance_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mean_rating", sa.Float(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tier", sa.String(length=20), nullable=False, server_default="unrated"),
        sa.Column(
            "reasons",
            postgresql.ARRAY(sa.String(length=300)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("complaint_context_reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("thin_evidence", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("deserves_recognition", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("merits_a_conversation", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("property_id", "staff_id", name="uq_staff_performance_one_per_staff"),
            schema=SCHEMA,
        )
        op.create_index("ix_sps_staff", "staff_performance_summaries", ["staff_id"], schema=SCHEMA)
        op.create_index("ix_sps_department", "staff_performance_summaries", ["department_id"], schema=SCHEMA)
        op.create_index("ix_sps_score", "staff_performance_summaries", ["score"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("staff_performance_summaries", schema=SCHEMA)
    op.drop_table("guest_staff_reviews", schema=SCHEMA)
