from flask import g


def request_body():
    # the parsed json body (see parse_json_body in app/__init__.py), or {} when there was none
    body = g.get("body")
    return {} if body is None else body
