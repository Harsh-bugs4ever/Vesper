"""Identity publishes nothing today and listens to nothing.

The module exists so every service has the same six files; when de-provisioning on
termination lands (backlog) it subscribes here.
"""


def start_subscriptions() -> None:
    return None
