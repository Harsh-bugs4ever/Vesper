"""Keep merged migrations reachable through one unambiguous upgrade path."""
from pathlib import Path
import warnings

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migrations_have_unique_revisions_and_one_head():
    root = Path(__file__).resolve().parents[1]
    config = Config()
    config.set_main_option("script_location", str(root / "infra" / "migrations"))
    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        scripts = ScriptDirectory.from_config(config)
        revisions = list(scripts.walk_revisions())
        assert len(scripts.get_heads()) == 1
    assert len({revision.revision for revision in revisions}) == len(revisions)
    names = {Path(revision.path).name for revision in revisions}
    assert "0005_authorization_assignments.py" in names
    assert "0005_property_content_and_occupancy.py" in names
    assert "0007_three_manager_areas.py" in names
