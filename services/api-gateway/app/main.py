"""The single entry point. Every browser request starts here."""
from vesper_common.app_factory import create_app

from .api import close_client, router

app = create_app(
    name="api-gateway",
    title="Vesper API Gateway",
    # The catch-all proxy route is registered last so /health and /ready still resolve.
    routers=(router,),
    # Close the pooled HTTP client so in-flight upstream connections drain cleanly.
    on_shutdown=close_client,
)
