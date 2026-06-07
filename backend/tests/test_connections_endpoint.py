"""Endpoint flow + error-mapping tests for the connection system."""
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services import community_store as cs
from backend.app.services.store import all_patients

client = TestClient(app)


def _patient():
    return all_patients()[0]


def test_full_flow():
    cs._reset()
    p = _patient()
    r = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 2, "need_by": "2026-06-09"})
    assert r.status_code == 201
    rid = r.json()["request_id"]
    m = client.get(f"/community/requests/{rid}/matches")
    assert m.status_code == 200
    donor_id = m.json()["matches"][0]["donor_id"]
    c = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id})
    assert c.status_code == 201
    cid = c.json()["connection_id"]
    assert c.json()["status"] == "pending"
    a = client.post(f"/community/connections/{cid}/respond",
                    json={"donor_id": donor_id, "action": "accept"})
    assert a.status_code == 200 and a.json()["status"] == "accepted"
    msg = client.post(f"/community/connections/{cid}/messages",
                      json={"sender_id": p["user_id"], "text": "Thank you!"})
    assert msg.status_code == 201
    t = client.get(f"/community/connections/{cid}/messages", params={"user_id": p["user_id"]})
    assert t.status_code == 200 and len(t.json()["messages"]) == 1


def test_message_before_accept_400():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    cid = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}).json()["connection_id"]
    r = client.post(f"/community/connections/{cid}/messages",
                    json={"sender_id": p["user_id"], "text": "too early"})
    assert r.status_code == 400


def test_non_participant_read_403():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    cid = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}).json()["connection_id"]
    client.post(f"/community/connections/{cid}/respond",
                json={"donor_id": donor_id, "action": "accept"})
    r = client.get(f"/community/connections/{cid}/messages", params={"user_id": "STRANGER"})
    assert r.status_code == 403


def test_unknown_request_404():
    cs._reset()
    assert client.get("/community/requests/NOPE/matches").status_code == 404


def test_duplicate_connection_409():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    body = {"request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}
    assert client.post("/community/connections", json=body).status_code == 201
    assert client.post("/community/connections", json=body).status_code == 409


def test_cancel_endpoint_200():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    cid = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}).json()["connection_id"]
    r = client.post(f"/community/connections/{cid}/cancel", json={"patient_id": p["user_id"]})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"


if __name__ == "__main__":
    test_full_flow()
    test_message_before_accept_400()
    test_non_participant_read_403()
    test_unknown_request_404()
    test_duplicate_connection_409()
    test_cancel_endpoint_200()
    print("test_connections_endpoint OK")
