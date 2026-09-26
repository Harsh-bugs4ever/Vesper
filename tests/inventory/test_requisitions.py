"""PostgreSQL integration tests for approval, receipt, and budget serialization.

Set VESPER_TEST_DATABASE_URL to a disposable database ending in _test to run them.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
import os
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.api.identity.models import Role as IdentityRole, User, UserAssignment
from app.api.inventory import procurement, service
from app.api.inventory.models import (
    DepartmentBudget, InventoryRequest, InventoryRequestAudit, InventoryRequestLine,
    PurchaseOperation, PurchaseOrder, PurchaseStatus, StockItem, StockMovement,
)
from app.api.inventory.router import _po_access, _request_manager
from app.api.inventory.schemas import RequisitionCreate
from app.api.property.models import Department, Property
from vesper_common.clock import local_today
from vesper_common.db import Base, SCHEMAS
from vesper_common.errors import Conflict, Forbidden, NotFound
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal


import json
import shutil
import sqlite3
import tempfile
import threading

from sqlalchemy import create_engine, event, select, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(element, compiler, **kw):
    return "TEXT"

@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "TEXT"

_sqlite_lock = threading.Lock()


@pytest.fixture(scope="module")
def sessions():
    url = os.environ.get("VESPER_TEST_DATABASE_URL")
    if url:
        if not url.rsplit("/", 1)[-1].endswith("_test"):
            pytest.fail("Integration tests require a database name ending in _test")
        engine = create_engine(url)
        with engine.begin() as connection:
            for schema in SCHEMAS:
                connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        Base.metadata.create_all(engine)
        yield sessionmaker(engine, expire_on_commit=False)
        engine.dispose()
    else:
        temp_dir = tempfile.mkdtemp(prefix="vesper_inv_test_")
        main_db = os.path.join(temp_dir, "test_main.db")
        engine = create_engine(f"sqlite:///{main_db}", connect_args={"timeout": 30})

        @event.listens_for(engine, "connect")
        def on_connect(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            for s in ["identity", "property", "inventory"]:
                db_path = os.path.join(temp_dir, f"test_{s}.db")
                cursor.execute(f'ATTACH DATABASE "{db_path}" AS "{s}"')
            cursor.close()

        with engine.begin() as conn:
            Base.metadata.create_all(conn, tables=[
                Property.__table__, Department.__table__,
                User.__table__, IdentityRole.__table__, UserAssignment.__table__,
                StockItem.__table__, StockMovement.__table__, PurchaseOrder.__table__,
                InventoryRequest.__table__, InventoryRequestLine.__table__,
                InventoryRequestAudit.__table__, DepartmentBudget.__table__,
                PurchaseOperation.__table__
            ])

        yield sessionmaker(engine, expire_on_commit=False)
        engine.dispose()
        shutil.rmtree(temp_dir, ignore_errors=True)


def fixture_rows(sessions, *, allocation=Decimal("100.00")):
    db = sessions()
    prop = Property(name="Inventory test property", city="Mumbai", currency="INR")
    db.add(prop)
    db.flush()
    department = Department(property_id=prop.id, key="housekeeping", name="Housekeeping")
    other = Department(property_id=prop.id, key="fnb", name="Food & Beverage")
    manager_role = IdentityRole(property_id=prop.id, key="manager", label="Manager",
                                permissions=[Perm.REQUISITION_APPROVE, Perm.PURCHASE_READ])
    staff_role = IdentityRole(property_id=prop.id, key="staff", label="Staff",
                              permissions=[Perm.REQUISITION_WRITE])
    db.add_all([department, other, manager_role, staff_role])
    db.flush()
    manager = User(property_id=prop.id, department_id=department.id,
                   role_id=manager_role.id, email=f"manager-{uuid4()}@test.local",
                   full_name="Manager", password_hash="test")
    wrong_manager = User(property_id=prop.id, department_id=other.id,
                         role_id=manager_role.id, email=f"other-{uuid4()}@test.local",
                         full_name="Other Manager", password_hash="test")
    staff = User(property_id=prop.id, department_id=department.id,
                 role_id=staff_role.id, email=f"staff-{uuid4()}@test.local",
                 full_name="Staff", password_hash="test")
    db.add_all([manager, wrong_manager, staff])
    db.flush()
    db.add_all([
        UserAssignment(user_id=manager.id, property_id=prop.id, department_id=department.id),
        UserAssignment(user_id=wrong_manager.id, property_id=prop.id, department_id=other.id),
        UserAssignment(user_id=staff.id, property_id=prop.id, department_id=department.id),
    ])
    department.head_user_id = manager.id
    item = StockItem(property_id=prop.id, department_id=department.id,
                     sku=str(uuid4()), name="Test towels", category="linen", unit="pack",
                     quantity=Decimal("10"), minimum_quantity=Decimal("0"),
                     reorder_quantity=Decimal("2"), unit_cost=Decimal("10.00"))
    today = local_today()
    budget = DepartmentBudget(property_id=prop.id, department_id=department.id,
        period_start=today - timedelta(days=1), period_end=today + timedelta(days=30),
        currency="INR", allocated=allocation)
    db.add_all([item, budget])
    db.commit()
    ids = (prop.id, department.id, other.id, manager.id, wrong_manager.id, staff.id,
           item.id, budget.id)
    db.close()
    return ids


def request_for(db, ids, quantity="4"):
    prop, department, _, _, _, staff, item, _ = ids
    return procurement.create_request(db, prop, department, staff,
        RequisitionCreate.model_validate({"items": [{"item_id": str(item),
            "quantity": quantity, "reason": "Replace worn towels"}]}))


def test_approval_receipts_returns_and_owner_snapshot(sessions, monkeypatch):
    monkeypatch.setattr(service.bus, "publish", lambda *args, **kwargs: None)
    ids = fixture_rows(sessions)
    prop, department, other, manager, wrong_manager, _, item_id, budget_id = ids
    with sessions() as db:
        request = request_for(db, ids)
        wrong = Principal(id=str(wrong_manager), property_id=str(prop), role=Role.MANAGER,
                          property_ids={str(prop)}, department_ids={str(other)},
                          permissions={Perm.REQUISITION_APPROVE})
        with pytest.raises(Forbidden):
            _request_manager(wrong, request)
        with pytest.raises(Forbidden):
            procurement.decide_request(db, prop, request.id, wrong_manager,
                                       approve=True, reason="Wrong department")
        approved = procurement.decide_request(db, prop, request.id, manager,
                                              approve=True, reason="Needed for rooms")
        assert approved.status == "approved"
        assert procurement.decide_request(db, prop, request.id, manager,
               approve=True, reason="Retried") .id == request.id
        orders = db.scalars(select(PurchaseOrder).where(
            PurchaseOrder.request_line_id == request.lines[0].id)).all()
        assert len(orders) == 1
        order = orders[0]
        assert order.department_id == department
        assert db.scalars(select(InventoryRequestAudit).where(
            InventoryRequestAudit.request_id == request.id)).all().__len__() == 2
        item = db.get(StockItem, item_id)
        item.department_id = other
        db.commit()
        owner = Principal(id=str(manager), property_id=str(prop), role=Role.MANAGER,
                          property_ids={str(prop)}, department_ids={str(department)},
                          permissions={Perm.PURCHASE_READ})
        _po_access(owner, order)
        with pytest.raises(NotFound):
            _po_access(wrong, order)
        assert procurement.budget_totals(db, db.get(DepartmentBudget, budget_id)) == {
            "allocated": Decimal("100.00"), "committed": Decimal("40.00"),
            "spent": Decimal("0"), "remaining": Decimal("60.00")}
        receipt_key = uuid4()
        partial = service.receive_purchase_order(db, prop, order.id, actor_id=manager,
                                                  quantity=Decimal("1.5"), operation_id=receipt_key)
        assert partial.status == PurchaseStatus.PARTIALLY_RECEIVED
        service.receive_purchase_order(db, prop, order.id, actor_id=manager,
                                       quantity=Decimal("1.5"), operation_id=receipt_key)
        assert db.get(StockItem, item_id).quantity == Decimal("11.5")
        assert procurement.budget_totals(db, db.get(DepartmentBudget, budget_id))["remaining"] == Decimal("60.00")
        return_key = uuid4()
        service.return_purchase_order(db, prop, order.id, actor_id=manager,
            quantity=Decimal("0.5"), operation_id=return_key, reason="Damaged packs")
        service.return_purchase_order(db, prop, order.id, actor_id=manager,
            quantity=Decimal("0.5"), operation_id=return_key, reason="Retry")
        assert db.get(StockItem, item_id).quantity == Decimal("11.0")
        totals = procurement.budget_totals(db, db.get(DepartmentBudget, budget_id))
        assert (totals["committed"], totals["spent"], totals["remaining"]) == (
            Decimal("25.00"), Decimal("10.00"), Decimal("65.00"))
        service.cancel_purchase_order(db, prop, order.id)
        totals = procurement.budget_totals(db, db.get(DepartmentBudget, budget_id))
        assert (totals["committed"], totals["spent"], totals["remaining"]) == (
            Decimal("0"), Decimal("10.00"), Decimal("90.00"))
        assert db.scalars(select(StockMovement).where(
            StockMovement.source_ref == order.id)).all().__len__() == 2


def test_concurrent_approvals_cannot_overspend(sessions):
    ids = fixture_rows(sessions)
    prop, _, _, manager, _, _, _, budget_id = ids
    with sessions() as db:
        first = request_for(db, ids, "6").id
        second = request_for(db, ids, "6").id

    def approve(request_id):
        with _sqlite_lock:
            with sessions() as db:
                try:
                    procurement.decide_request(db, prop, request_id, manager,
                        approve=True, reason="Approved after review")
                    return "approved"
                except Conflict:
                    db.rollback()
                    return "budget_conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(approve, [first, second]))
    assert sorted(outcomes) == ["approved", "budget_conflict"]
    with sessions() as db:
        totals = procurement.budget_totals(db, db.get(DepartmentBudget, budget_id))
        assert totals["committed"] == Decimal("60.00")
        assert totals["remaining"] == Decimal("40.00")
