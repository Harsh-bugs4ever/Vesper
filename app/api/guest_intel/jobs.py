"""Periodic work owned by guest-intel-service."""
import logging

from vesper_common.scheduler import Scheduler, for_each_property

from . import prompts

log = logging.getLogger(__name__)


def _prompt_departing(property_id: str) -> None:
    prompts.prompt_departing_stays(property_id)


def build() -> Scheduler:
    scheduler = Scheduler("guest-intel-service")
    # Every ten minutes: the prompt window opens an hour before checkout, so this is
    # fine-grained enough to catch it without asking the same people repeatedly — the
    # summary row records that it has already prompted.
    scheduler.add("prompt-departing-guest-reviews", 600, for_each_property(_prompt_departing))
    return scheduler
