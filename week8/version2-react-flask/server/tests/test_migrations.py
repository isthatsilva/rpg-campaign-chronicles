from app.db import connect, init_database

DND = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]


def attributes_of(conn, character_id):
    rows = conn.execute(
        "SELECT name, value FROM character_attributes WHERE character_id = ? ORDER BY position, id", (character_id,)
    ).fetchall()
    return [f"{r['name']}={r['value']}" for r in rows]


def test_existing_characters_without_attributes_get_dnd_defaults_once(tmp_path):
    path = str(tmp_path / "app.db")

    # build a database as it looked before the migration existed (user_version 0)
    init_database(path)
    conn = connect(path)
    user_id = conn.execute("INSERT INTO users (email, password_hash) VALUES ('old@example.com', 'x')").lastrowid
    empty = conn.execute("INSERT INTO characters (user_id, name) VALUES (?, 'Empty Hero')", (user_id,)).lastrowid
    custom = conn.execute("INSERT INTO characters (user_id, name) VALUES (?, 'Custom Hero')", (user_id,)).lastrowid
    conn.execute(
        "INSERT INTO character_attributes (character_id, name, value, position) VALUES (?, 'Sanity', 'Shaken', 0)",
        (custom,),
    )
    conn.execute("PRAGMA user_version = 0")
    conn.close()

    init_database(path)
    conn = connect(path)
    assert attributes_of(conn, empty) == [f"{n}=10" for n in DND]
    assert attributes_of(conn, custom) == ["Sanity=Shaken"], "characters that already have attributes are untouched"
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 1

    # the user removes every attribute: restarting must not bring the defaults back
    conn.execute("DELETE FROM character_attributes WHERE character_id = ?", (empty,))
    conn.close()
    init_database(path)
    conn = connect(path)
    assert attributes_of(conn, empty) == []
    conn.close()
