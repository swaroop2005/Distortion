"""State-machine, privacy, ownership and matching tests for the community store."""
from backend.app.services import community_store as cs
from backend.app.services.store import all_patients


def _a_patient():
    return all_patients()[0]


def test_create_and_get_request():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    assert req["status"] == "open"
    assert req["patient_id"] == str(p["user_id"])
    assert cs.get_request(req["request_id"]) == req
    assert cs.list_requests(p["user_id"]) == [req]


def test_create_request_unknown_patient():
    cs._reset()
    try:
        cs.create_request("NOPE-404", "O+", "Hyderabad", 1, "2026-06-09")
        assert False, "expected NotFound"
    except cs.NotFound:
        pass


if __name__ == "__main__":
    test_create_and_get_request()
    test_create_request_unknown_patient()
    print("test_community_store OK")
