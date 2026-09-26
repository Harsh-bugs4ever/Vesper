"""Persist room media and resort amenities; separate housekeeping from active stays.

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "room_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("property.properties.id"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("property.rooms.id")),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("property.room_categories.id")),
        sa.Column("url", sa.String(255), nullable=False),
        sa.Column("alt_text", sa.String(240), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("(room_id IS NULL) <> (category_id IS NULL)", name="one_image_subject"),
        schema="property",
    )
    for column in ("property_id", "room_id", "category_id"):
        op.create_index(f"ix_property_room_images_{column}", "room_images", [column], schema="property")
    op.create_index("uq_room_images_primary_room", "room_images", ["room_id"], unique=True,
                    postgresql_where=sa.text("is_primary AND room_id IS NOT NULL"), schema="property")
    op.create_index("uq_room_images_primary_category", "room_images", ["category_id"], unique=True,
                    postgresql_where=sa.text("is_primary AND category_id IS NOT NULL"), schema="property")
    op.create_table(
        "resort_amenities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("property.properties.id"), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("location", sa.String(160)),
        sa.Column("opening_hours", sa.String(240)),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("closure_reason", sa.String(240)),
        sa.Column("closed_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("property_id", "key"),
        schema="property",
    )
    op.create_index("ix_property_resort_amenities_property_id", "resort_amenities", ["property_id"], schema="property")
    # Legacy 'occupied' represented a stay, not a housekeeping condition. An open
    # stay is authoritative; a stale occupied flag without one needs turnover.
    op.execute("""
        UPDATE property.rooms AS r SET status = CASE WHEN EXISTS (
            SELECT 1 FROM frontdesk.stays s WHERE s.room_id = r.id AND s.status = 'in_house'
        ) THEN 'ready' ELSE 'dirty' END WHERE r.status = 'occupied'
    """)
    op.create_index("uq_frontdesk_one_active_stay_per_room", "stays", ["room_id"], unique=True,
                    postgresql_where=sa.text("status = 'in_house'"), schema="frontdesk")
    op.create_index("uq_frontdesk_one_active_stay_per_booking", "stays", ["booking_id"], unique=True,
                    postgresql_where=sa.text("status = 'in_house'"), schema="frontdesk")


def downgrade() -> None:
    op.drop_index("uq_frontdesk_one_active_stay_per_booking", table_name="stays", schema="frontdesk")
    op.drop_index("uq_frontdesk_one_active_stay_per_room", table_name="stays", schema="frontdesk")
    op.drop_index("ix_property_resort_amenities_property_id", table_name="resort_amenities", schema="property")
    op.drop_table("resort_amenities", schema="property")
    for column in ("property_id", "room_id", "category_id"):
        op.drop_index(f"ix_property_room_images_{column}", table_name="room_images", schema="property")
    op.drop_index("uq_room_images_primary_room", table_name="room_images", schema="property")
    op.drop_index("uq_room_images_primary_category", table_name="room_images", schema="property")
    op.drop_table("room_images", schema="property")
