from types import SimpleNamespace

import pytest

from app.api.action.models import CardStatus
from app.api.action.service import _assert_actionable
from vesper_common.errors import Conflict


def test_approved_card_cannot_be_executed_again():
    card = SimpleNamespace(status=CardStatus.APPROVED, expires_at=None)
    with pytest.raises(Conflict):
        _assert_actionable(card)
