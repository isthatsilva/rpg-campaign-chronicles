from conftest import create_character, query, register_user


def test_full_character_crud_with_optional_system_neutral_fields(app):
    client, _, _ = register_user(app)
    # only a name is required: no race, class or d&d stats needed
    minimal = create_character(client, name="Nameless Investigator")
    assert minimal["level"] is None
    assert minimal["species"] is None

    created = create_character(
        client, name="Thorne Ashford", species="Human", role="Ranger", level=5, health=42, maxHealth=50,
        experience=1200, abilities="Tracking", biography="A wandering ranger.",
        attributes=[{"name": "Strength", "value": "14"}, {"name": "Sanity", "value": "Shaken"}],
    )
    profile = client.get(f"/api/characters/{created['id']}").get_json()["character"]
    assert profile["maxHealth"] == 50
    assert [(a["name"], a["value"]) for a in profile["attributes"]] == [("Strength", "14"), ("Sanity", "Shaken")]

    updated = client.put(f"/api/characters/{created['id']}", json={**profile, "level": 6, "health": 50})
    assert updated.status_code == 200
    assert updated.get_json()["character"]["level"] == 6

    assert client.delete(f"/api/characters/{created['id']}").status_code == 204
    assert client.get(f"/api/characters/{created['id']}").status_code == 404


def test_attribute_equipment_and_journal_crud(app):
    client, _, _ = register_user(app)
    c = create_character(client)
    base = f"/api/characters/{c['id']}"

    attr = client.post(f"{base}/attributes", json={"name": "Magic", "value": "7"}).get_json()["item"]
    assert client.put(f"{base}/attributes/{attr['id']}", json={"name": "Magic", "value": "9"}).get_json()["item"]["value"] == "9"
    assert client.delete(f"{base}/attributes/{attr['id']}").status_code == 204
    assert client.get(f"{base}/attributes").get_json()["items"] == []

    item = client.post(f"{base}/equipment", json={"itemName": "Healing Potion", "itemType": "Consumable", "quantity": 3}).get_json()["item"]
    assert item["quantity"] == 3
    defaulted = client.post(f"{base}/equipment", json={"itemName": "Longbow"}).get_json()["item"]
    assert defaulted["quantity"] == 1
    assert client.put(f"{base}/equipment/{item['id']}", json={"itemName": "Healing Potion", "quantity": 2}).get_json()["item"]["quantity"] == 2
    assert client.delete(f"{base}/equipment/{defaulted['id']}").status_code == 204
    assert len(client.get(f"{base}/equipment").get_json()["items"]) == 1

    res = client.post(f"{base}/journal", json={
        "sessionDate": "2026-10-25", "campaignName": "The Lost Kingdom", "title": "The Forgotten Temple",
        "attendees": "Alex, Sarah, Mike", "events": "Defeated a guardian", "rewards": "200 XP", "notes": "Return next session",
    })
    assert res.status_code == 201
    [saved] = client.get(f"{base}/journal").get_json()["items"]
    assert saved["attendees"] == "Alex, Sarah, Mike"
    edited = client.put(f"{base}/journal/{saved['id']}", json={**saved, "title": "Temple, Part 1"})
    assert edited.get_json()["item"]["title"] == "Temple, Part 1"
    assert client.delete(f"{base}/journal/{saved['id']}").status_code == 204
    assert client.delete(f"{base}/journal/{saved['id']}").status_code == 404


def test_deleting_a_character_cascades_to_attributes_equipment_and_journal(app):
    client, _, _ = register_user(app)
    keep = create_character(client, name="Keeper", attributes=[{"name": "Luck", "value": "3"}])
    c = create_character(client, name="Doomed", attributes=[{"name": "Strength", "value": "14"}])
    client.post(f"/api/characters/{c['id']}/equipment", json={"itemName": "Sword"})
    client.post(f"/api/characters/{c['id']}/journal", json={"sessionDate": "2026-10-25", "title": "Last stand"})

    assert client.delete(f"/api/characters/{c['id']}").status_code == 204
    for table in ("character_attributes", "equipment", "journal_entries"):
        [[n]] = query(app, f"SELECT COUNT(*) FROM {table} WHERE character_id = ?", (c["id"],))
        assert n == 0, f"{table} should be empty for the deleted character"
    [[n]] = query(app, "SELECT COUNT(*) FROM character_attributes WHERE character_id = ?", (keep["id"],))
    assert n == 1


def test_validation_errors_return_400_with_per_field_messages(app):
    client, _, _ = register_user(app)

    no_name = client.post("/api/characters", json={"name": "   ", "level": "abc", "maxHealth": -1})
    assert no_name.status_code == 400
    error = no_name.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert sorted(error["fields"]) == ["level", "maxHealth", "name"]

    bad_attr = client.post("/api/characters", json={"name": "Ok", "attributes": [{"name": "", "value": "1"}]})
    assert bad_attr.status_code == 400
    # the failed create must not have used up a slot
    assert client.get("/api/characters").get_json()["characters"] == []

    c = create_character(client)
    base = f"/api/characters/{c['id']}"
    assert client.post(f"{base}/equipment", json={"itemName": "Arrows", "quantity": -1}).status_code == 400
    assert client.post(f"{base}/equipment", json={"itemName": "Arrows", "quantity": 1.5}).status_code == 400
    assert client.post(f"{base}/equipment", json={"itemName": "Arrows", "quantity": True}).status_code == 400
    assert client.post(f"{base}/attributes", json={"name": "Wits"}).status_code == 400

    bad_journal = client.post(f"{base}/journal", json={"sessionDate": "2026-02-30"})
    assert bad_journal.status_code == 400
    assert {"sessionDate", "title"} <= bad_journal.get_json()["error"]["fields"].keys()

    assert client.post(f"{base}/journal", json={"sessionDate": "10/25/2026", "title": "x"}).status_code == 400
    assert client.post("/api/characters", json={"name": "x" * 101}).status_code == 400


def test_malformed_requests_and_unknown_ids_are_handled_without_leaking_internals(app):
    client, _, _ = register_user(app)

    bad_json = client.post("/api/characters", data='{"name": ', content_type="application/json")
    assert bad_json.status_code == 400
    assert bad_json.get_json()["error"]["code"] == "INVALID_JSON"
    assert "Traceback" not in bad_json.get_data(as_text=True)

    assert client.post("/api/characters", data="name=x", content_type="text/plain").status_code == 415
    assert client.post("/api/characters", data="x" * 200_000, content_type="application/json").status_code == 413

    assert client.post("/api/characters", json=[1, 2]).status_code == 400
    assert client.get("/api/characters/abc").status_code == 404
    assert client.get("/api/characters/999999").status_code == 404
    assert client.get("/api/nope").status_code == 404
    assert client.patch("/api/characters", json={}).status_code == 404
