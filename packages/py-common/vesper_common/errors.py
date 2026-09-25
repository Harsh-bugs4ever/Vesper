"""Uniform error shape so the three frontends handle failures identically."""
import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

error_log = logging.getLogger("vesper.errors")


class VesperError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "vesper_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFound(VesperError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class Conflict(VesperError):
    """Two managers reached for the same card, or a room is already occupied."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class Forbidden(VesperError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class Invalid(VesperError):
    # Starlette renamed its 422 constant; the status code itself is stable.
    status_code = 422
    code = "invalid"


def _body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(VesperError)
    async def _vesper(request: Request, exc: VesperError) -> JSONResponse:
        error_log.warning(
            "[%s] %s %s -> %d: %s",
            exc.code,
            request.method,
            request.url.path,
            exc.status_code,
            exc.message,
        )
        return JSONResponse(content=_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(HTTPException)
    async def _http(request: Request, exc: HTTPException) -> JSONResponse:
        error_log.warning(
            "[http_error] %s %s -> %d: %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
        return JSONResponse(content=_body("http_error", str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        error_log.warning(
            "[invalid] %s %s -> 422 validation failed: %d field error(s)",
            request.method,
            request.url.path,
            len(exc.errors()),
        )
        return JSONResponse(
            content=_body("invalid", "Request validation failed", {"errors": exc.errors()}),
            status_code=422,
        )
