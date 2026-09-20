"""Guest intelligence — sentiment, guest DNA, review scoring and the concierge.

The engines (.engines) and the RAG concierge (.rag) are plain modules: any handler
in the monolith can call them directly.

Serves /guest-intel, /guest-reviews and /staff-reviews.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .reviews_router import router as reviews_router
from .router import router
from .staff_reviews_router import router as staff_reviews_router

NAME = "guest_intel"
routers = (router, reviews_router, staff_reviews_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
