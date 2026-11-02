from flask import jsonify, request
from werkzeug.exceptions import HTTPException


class HttpError(Exception):
    def __init__(self, status, code, message, fields=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


def bad_request(message, fields=None):
    return HttpError(400, "VALIDATION_ERROR", message, fields)


def unauthorized(message="Please log in to continue."):
    return HttpError(401, "UNAUTHORIZED", message)


def not_found(message="Not found."):
    return HttpError(404, "NOT_FOUND", message)


def _error_response(status, code, message, fields=None):
    body = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    return jsonify({"error": body}), status


def register_error_handlers(app):
    @app.errorhandler(HttpError)
    def handle_http_error(err):
        return _error_response(err.status, err.code, err.message, err.fields)

    @app.errorhandler(HTTPException)
    def handle_werkzeug_error(err):
        # 405 is reported as 404 like version 1, which only knows "no such route"
        if err.code in (404, 405):
            return _error_response(404, "NOT_FOUND", f"No API route for {request.method} {request.path}.")
        if err.code == 413:
            return _error_response(413, "PAYLOAD_TOO_LARGE", "Request body is too large.")
        return _error_response(err.code or 500, "HTTP_ERROR", err.description or "Request failed.")

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        # anything else is a bug or a database failure: log it, but never send the stack trace
        app.logger.exception("unhandled error")
        return _error_response(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.")
