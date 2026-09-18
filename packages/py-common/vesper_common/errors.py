"""Uniform error shape so the three frontends handle failures identically."""
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "invalid"


def _body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(VesperError)
    async def _vesper(_: Request, exc: VesperError) -> JSONResponse:
        return JSONResponse(exc.status_code, content=_body(exc.code, exc.message, exc.details))

    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(exc.status_code, content=_body("http_error", str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body("invalid", "Request validation failed", {"errors": exc.errors()}),
        )
