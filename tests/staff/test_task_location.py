from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.staff import router
from vesper_common.errors import NotFound
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal


def test_task_location_reveals_only_the_visible_tasks_room(monkeypatch):
    property_id, department_id, room_id = uuid4(), uuid4(), uuid4()
    staff_id, other_staff_id = uuid4(), uuid4()
    task = SimpleNamespace(id=uuid4(), property_id=property_id,
                           department_id=department_id, assignee_id=staff_id,
                           room_id=room_id)
    room = SimpleNamespace(id=room_id, property_id=property_id,
                           number="407", floor=4)
    db = SimpleNamespace(get=lambda model, value: room)
    monkeypatch.setattr(router.service, "get_task",
                        lambda db, requested_property, task_id: task if
                        requested_property == property_id and task_id == task.id else
                        (_ for _ in ()).throw(NotFound("Task not found")))

    def principal(user_id, *, property_scope=property_id, department_scope=department_id,
                  pool=False):
        return Principal(id=str(user_id), property_id=str(property_scope),
                         role=Role.STAFF,
                         permissions={Perm.TASKS_READ, *([Perm.TASKS_POOL_READ] if pool else [])},
                         property_ids={str(property_scope)},
                         department_ids={str(department_scope)})

    result = router.task_location(task.id, principal(staff_id), db)
    assert result.room_number == "407" and result.floor == 4
    with pytest.raises(NotFound):
        router.task_location(task.id, principal(other_staff_id), db)
    with pytest.raises(HTTPException):
        router.task_location(task.id, principal(staff_id, department_scope=uuid4()), db)
    with pytest.raises(NotFound):
        router.task_location(task.id, principal(staff_id, property_scope=uuid4()), db)

    task.assignee_id = None
    assert router.task_location(task.id, principal(other_staff_id, pool=True), db).room_id == room_id
    with pytest.raises(NotFound):
        router.task_location(task.id, principal(other_staff_id), db)

    room.property_id = uuid4()
    with pytest.raises(NotFound):
        router.task_location(task.id, principal(other_staff_id, pool=True), db)
    room.property_id = property_id
    task.room_id = None
    with pytest.raises(NotFound):
        router.task_location(task.id, principal(other_staff_id, pool=True), db)
