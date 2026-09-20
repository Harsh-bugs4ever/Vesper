"""Vesper — the whole backend, as one package.

`app.main:app` is the only entry point. Everything the product does lives under
`app.api`, one package per bounded context, and the routes they serve are the same
URLs the three frontends have always called.
"""
__version__ = "1.0.0"
