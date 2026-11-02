"""starts the api: python run.py (reads .env; see .env.example)."""

from app import create_app

app = create_app()

if __name__ == "__main__":
    config = app.config["RCC"]
    print(f"RPG Campaign Chronicles API listening on http://localhost:{config['port']}", flush=True)
    print(f"database: {config['database_path']}", flush=True)
    # threaded: each request gets its own thread and its own sqlite connection
    app.run(host="127.0.0.1", port=config["port"], threaded=True, debug=False)
