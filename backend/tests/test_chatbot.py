"""Main smoke test for the chatbot intent router + grounded handlers."""
from backend.app.services import chatbot
from backend.app.services.store import all_donors, all_patients
from backend.app.utils.eligibility import days_until_eligible


def _a_donor_id():
    return all_donors()[0]["user_id"]


def _a_patient_id():
    return all_patients()[0]["user_id"]


def test_personal_eligibility_grounded():
    did = _a_donor_id()
    res = chatbot.handle_chat("when can I donate again?", role="donor", user_id=did)
    assert res["intent"] == "personal_eligibility"
    # grounded_facts number must equal what the data layer returns — no hallucination
    from backend.app.services.store import get_donor
    expected = days_until_eligible(get_donor(did))
    assert res["grounded_facts"]["days_until"] == max(0, expected)
    assert "Dataset.csv" in res["sources"]
    assert res["reply"].strip()


def test_bridge_status_intent():
    pid = _a_patient_id()
    res = chatbot.handle_chat("how is my bridge doing?", role="patient", user_id=pid)
    assert res["intent"] == "bridge_status"
    assert "bridges" in res["grounded_facts"]


def test_stock_lookup_uses_real_supply():
    res = chatbot.handle_chat("is O+ available in Hyderabad?", role="public", user_id=None)
    assert res["intent"] == "stock_lookup"
    assert "banks" in res["grounded_facts"]
    assert "e-RaktKosh" in " ".join(res["sources"])


def test_general_faq():
    res = chatbot.handle_chat("what is thalassemia?", role="public", user_id=None)
    assert res["intent"] == "general_faq"
    assert "lifelong" in res["grounded_facts"]["answer"].lower()


def test_fallback():
    res = chatbot.handle_chat("asdfghjkl", role="public", user_id=None)
    assert res["intent"] == "fallback"


def test_role_gating_no_leak():
    """A donor asking a patient-only question gets a graceful refusal, not data."""
    did = _a_donor_id()
    res = chatbot.handle_chat("how is my bridge doing?", role="donor", user_id=did)
    assert res["grounded_facts"].get("note") == "wrong_role"
    assert "bridges" not in res["grounded_facts"]


def test_unknown_user_no_fabrication():
    res = chatbot.handle_chat("when can I donate again?", role="donor", user_id="NOPE-404")
    assert res["grounded_facts"].get("note") == "no_record"
    assert "days_until" not in res["grounded_facts"]


def test_language_detection():
    # Telugu phrase containing existing detector markers ("nenu", "cheyandi")
    # plus the eligibility keyword "eppudu".
    res = chatbot.handle_chat("nenu eppudu donate cheyandi", role="donor", user_id=_a_donor_id())
    assert res["lang"] == "te"
    assert res["intent"] == "personal_eligibility"


if __name__ == "__main__":
    test_personal_eligibility_grounded()
    test_bridge_status_intent()
    test_stock_lookup_uses_real_supply()
    test_general_faq()
    test_fallback()
    test_role_gating_no_leak()
    test_unknown_user_no_fabrication()
    test_language_detection()
    print("test_chatbot OK")
