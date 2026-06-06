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


def test_find_matches_eligible_sorted_by_distance():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    matches = cs.find_matches(req["request_id"], limit=50)
    eligible = [m for m in matches if m["eligible"]]
    dists = [m["distance_km"] if m["distance_km"] is not None else 1e9 for m in eligible]
    assert dists == sorted(dists), "eligible matches must be ordered nearest-first"


def _request_and_compatible_donor():
    """Create a request and return (request, a real compatible donor_id)."""
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    donor_id = cs.find_matches(req["request_id"], limit=1)[0]["donor_id"]
    return req, donor_id


def test_send_connection_pending():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    assert conn["status"] == "pending"
    assert conn["donor_id"] == donor_id


def test_send_connection_wrong_patient_forbidden():
    req, donor_id = _request_and_compatible_donor()
    try:
        cs.send_connection(req["request_id"], "SOMEONE-ELSE", donor_id)
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass


def test_send_connection_incompatible_donor_badstate():
    req, donor_id = _request_and_compatible_donor()
    compatible = {m["donor_id"] for m in cs.find_matches(req["request_id"], limit=10000)}
    from backend.app.services.store import all_donors
    incompatible = next(str(d["user_id"]) for d in all_donors()
                        if str(d["user_id"]) not in compatible)
    try:
        cs.send_connection(req["request_id"], req["patient_id"], incompatible)
        assert False, "expected BadState"
    except cs.BadState:
        pass


def test_send_connection_duplicate_conflict():
    req, donor_id = _request_and_compatible_donor()
    cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    try:
        cs.send_connection(req["request_id"], req["patient_id"], donor_id)
        assert False, "expected Conflict"
    except cs.Conflict:
        pass


def test_donor_accepts():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    out = cs.respond_connection(conn["connection_id"], donor_id, "accept")
    assert out["status"] == "accepted"
    assert out["responded_at"]


def test_wrong_donor_cannot_respond():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    try:
        cs.respond_connection(conn["connection_id"], "OTHER-DONOR", "accept")
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass


def test_patient_cancels():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    out = cs.cancel_connection(conn["connection_id"], req["patient_id"])
    assert out["status"] == "cancelled"


def test_list_connections_by_role():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    assert conn in cs.list_connections(req["patient_id"], "patient")
    assert conn in cs.list_connections(donor_id, "donor")


if __name__ == "__main__":
    test_create_and_get_request()
    test_create_request_unknown_patient()
    test_create_request_invalid_need_by()
    test_find_matches_all_compatible()
    test_find_matches_eligible_first_then_nearest()
    test_find_matches_unknown_request()
    test_find_matches_eligible_sorted_by_distance()
    test_send_connection_pending()
    test_send_connection_wrong_patient_forbidden()
    test_send_connection_incompatible_donor_badstate()
    test_send_connection_duplicate_conflict()
    test_donor_accepts()
    test_wrong_donor_cannot_respond()
    test_patient_cancels()
    test_list_connections_by_role()
    print("test_community_store OK")
