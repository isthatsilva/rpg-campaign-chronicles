import json
from pathlib import Path

from flask import Flask, abort, g, request, send_from_directory

from .auth import load_session
from .config import load_config
from .db import close_db, init_database
from .errors import HttpError, register_error_handlers
from .routes import auth, characters, plans

CLIENT_DIST = Path(__file__).resolve().parent.parent.parent / "client" / "dist"


def _reject_constant(name):
    # python's json accepts NaN/Infinity, javascript's doesn't; keep the two servers identical
    raise ValueError(f"invalid JSON constant {name}")


def parse_json_body():
    """api-only request preprocessing: content-type check, json parsing, session lookup."""
    if not request.path.startswith("/api/"):
        return
    g.body = None
    has_body = (request.content_length or 0) > 0 or "chunked" in request.headers.get("Transfer-Encoding", "")
    is_json = request.mimetype == "application/json"
    # a cross-site html form can't send application/json, so requiring it on writes
    # (together with the SameSite=Lax cookie) blocks csrf-style requests
    if request.method in ("POST", "PUT", "PATCH") and has_body and not is_json:
        raise HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Requests must be sent as JSON.")
    if has_body and is_json:
        # get_data enforces MAX_CONTENT_LENGTH (413)
        raw = request.get_data()
        try:
            body = json.loads(raw, parse_constant=_reject_constant)
        except (ValueError, UnicodeDecodeError):
            raise HttpError(400, "INVALID_JSON", "Request body is not valid JSON.") from None
        # like express.json(): only objects and arrays are accepted at the top level
        if not isinstance(body, (dict, list)):
            raise HttpError(400, "INVALID_JSON", "Request body is not valid JSON.")
        g.body = body
    load_session()


def create_app(overrides=None):
    config = load_config(overrides)
    init_database(config["database_path"])

    app = Flask(__name__, static_folder=None)
    app.config["RCC"] = config
    app.config["MAX_CONTENT_LENGTH"] = 100 * 1024
    app.json.sort_keys = False

    app.before_request(parse_json_body)
    app.teardown_appcontext(close_db)
    register_error_handlers(app)
    for module in (auth, plans, characters):
        app.register_blueprint(module.bp)

    # optional: serve the built react app from the same port (npm run build in client/ first)
    if (CLIENT_DIST / "index.html").exists():

        @app.get("/")
        @app.get("/<path:path>")
        def spa(path=""):
            if path == "api" or path.startswith("api/"):
                abort(404)
            if path and (CLIENT_DIST / path).is_file():
                return send_from_directory(CLIENT_DIST, path)
            return send_from_directory(CLIENT_DIST, "index.html")

    return app
