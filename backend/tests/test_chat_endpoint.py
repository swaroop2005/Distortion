"""Endpoint smoke test for POST /chat using FastAPI's TestClient."""
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.store import all_donors

client = TestClient(app)


def test_chat_happy_path():
    did = all_donors()[0]["user_id"]
    r = client.post("/chat", json={
        "message": "when can I donate again?",
        "role": "donor",
        "user_id": did,
    })
    assert r.status_code == 200
    body = r.json()
    for key in ("reply", "intent", "lang", "grounded_facts", "sources"):
        assert key in body
    assert body["intent"] == "personal_eligibility"


def test_chat_no_record():
    r = client.post("/chat", json={
        "message": "when can I donate again?",
        "role": "donor",
        "user_id": "NOPE-404",
    })
    assert r.status_code == 200
    assert r.json()["grounded_facts"].get("note") == "no_record"


if __name__ == "__main__":
    test_chat_happy_path()
    test_chat_no_record()
    print("test_chat_endpoint OK")
