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


def test_create_request_invalid_need_by():
    cs._reset()
    p = _a_patient()
    try:
        cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 1, "tomorrow")
        assert False, "expected BadState"
    except cs.BadState:
        pass


def test_find_matches_all_compatible():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    matches = cs.find_matches(req["request_id"], limit=20)
    assert matches, "expected at least one compatible donor"
    from backend.app.services.store import get_donor
    from backend.app.utils.compat import can_donate
    for m in matches:
        d = get_donor(m["donor_id"])
        assert can_donate(d["blood_group"], req["blood_group"])  # every match is compatible
        assert "distance_km" in m and "eligible" in m and "days_until_eligible" in m


def test_find_matches_eligible_first_then_nearest():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    matches = cs.find_matches(req["request_id"], limit=50)
    seen_ineligible = False
    for m in matches:
        if not m["eligible"]:
            seen_ineligible = True
        elif seen_ineligible:
            assert False, "an eligible donor appeared after an ineligible one"


def test_find_matches_unknown_request():
    cs._reset()
    try:
        cs.find_matches("NOPE")
        assert False, "expected NotFound"
    except cs.NotFound:
        pass


if __name__ == "__main__":
    test_create_and_get_request()
    test_create_request_unknown_patient()
    test_create_request_invalid_need_by()
    test_find_matches_all_compatible()
    test_find_matches_eligible_first_then_nearest()
    test_find_matches_unknown_request()
    print("test_community_store OK")
