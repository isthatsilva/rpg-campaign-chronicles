from conftest import create_character, query, register_user


def test_a_user_cannot_read_change_or_delete_another_users_characters_or_records(app):
    alice, _, _ = register_user(app)
    bob, _, _ = register_user(app)

    alice_char = create_character(alice, name="Alice Hero", attributes=[{"name": "Sanity", "value": "50"}])
    base = f"/api/characters/{alice_char['id']}"
    item = alice.post(f"{base}/equipment", json={"itemName": "Sword"}).get_json()["item"]
    entry = alice.post(f"{base}/journal", json={"sessionDate": "2026-10-25", "title": "The Forgotten Temple"}).get_json()["item"]
    [attr] = query(app, "SELECT id FROM character_attributes WHERE character_id = ?", (alice_char["id"],))

    bob_char = create_character(bob, name="Bob Hero")

    # list only shows your own
    assert [c["name"] for c in bob.get("/api/characters").get_json()["characters"]] == ["Bob Hero"]

    # direct access by guessed id -> 404 (doesn't even reveal that the id exists)
    assert bob.get(base).status_code == 404
    assert bob.put(base, json={"name": "Hacked"}).status_code == 404
    assert bob.delete(base).status_code == 404
    for path in ("attributes", "equipment", "journal"):
        assert bob.get(f"{base}/{path}").status_code == 404, path
    assert bob.post(f"{base}/equipment", json={"itemName": "Planted"}).status_code == 404
    assert bob.put(f"{base}/equipment/{item['id']}", json={"itemName": "Stolen"}).status_code == 404
    assert bob.delete(f"{base}/journal/{entry['id']}").status_code == 404

    # mixing bob's own character id with alice's child ids must not work either
    mixed = f"/api/characters/{bob_char['id']}"
    assert bob.put(f"{mixed}/equipment/{item['id']}", json={"itemName": "Stolen"}).status_code == 404
    assert bob.delete(f"{mixed}/journal/{entry['id']}").status_code == 404
    assert bob.put(f"{mixed}/attributes/{attr['id']}", json={"name": "X", "value": "1"}).status_code == 404

    # alice's data is untouched
    after = alice.get(base).get_json()["character"]
    assert after["name"] == "Alice Hero"
    assert after["equipment"][0]["itemName"] == "Sword"
    assert len(after["journalEntries"]) == 1
    assert after["attributes"][0]["name"] == "Sanity"


def test_journals_are_per_character_even_for_the_same_campaign(app):
    client, _, _ = register_user(app)
    a = create_character(client, name="Thorne")
    b = create_character(client, name="Mira")
    client.post(f"/api/characters/{a['id']}/journal",
                json={"sessionDate": "2026-10-25", "title": "The Forgotten Temple", "campaignName": "The Lost Kingdom"})
    assert client.get(f"/api/characters/{b['id']}/journal").get_json()["items"] == []
