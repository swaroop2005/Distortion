"""Smoke test for the chatbot additions to the Mock LLM adapter."""
from backend.app.services.outreach import MockLLM


def test_classify_intent_labels():
    m = MockLLM()
    assert m.classify_intent("when can I donate again?")["intent"] == "personal_eligibility"
    assert m.classify_intent("how is my bridge doing")["intent"] == "bridge_status"
    assert m.classify_intent("is O+ available near me")["intent"] == "stock_lookup"
    assert m.classify_intent("what is thalassemia")["intent"] == "general_faq"
    assert m.classify_intent("asdfghjkl")["intent"] == "fallback"


def test_classify_intent_hindi_telugu():
    m = MockLLM()
    assert m.classify_intent("main kab donate kar sakta hoon")["intent"] == "personal_eligibility"
    assert m.classify_intent("naaku eppudu donate cheyochu")["intent"] == "personal_eligibility"


def test_compose_chat_reply_uses_facts_only():
    m = MockLLM()
    facts = {"eligible": False, "days_until": 12, "total_donations": 4}
    reply = m.compose_chat_reply(facts, {"role": "donor"}, "en")
    assert "12" in reply  # the real number is surfaced
    assert reply.strip()


def test_compose_chat_reply_missing_facts_is_honest():
    m = MockLLM()
    reply = m.compose_chat_reply({"note": "no_record"}, {"role": "donor"}, "en")
    assert reply.strip()


def test_classify_intent_wellness():
    m = MockLLM()
    assert m.classify_intent("what should I eat to stay healthy?")["intent"] == "wellness"
    assert m.classify_intent("any tips for me?")["intent"] == "wellness"


def test_compose_wellness_reply_has_disclaimer_and_caution():
    from backend.app.services.outreach import WELLNESS_DISCLAIMER
    m = MockLLM()
    facts = {
        "suggestions": ["Avoid excess iron per your doctor.", "Stay hydrated."],
        "caution": "Avoid excess iron per your doctor.",
    }
    reply = m.compose_chat_reply(facts, {"role": "patient"}, "en")
    assert WELLNESS_DISCLAIMER in reply
    assert "important note" in reply.lower()  # caution surfaced first
    assert "hydrated" in reply


def test_compose_wellness_reply_no_caution_still_has_disclaimer():
    from backend.app.services.outreach import WELLNESS_DISCLAIMER
    m = MockLLM()
    reply = m.compose_chat_reply({"suggestions": ["Stay hydrated."]}, {"role": "donor"}, "en")
    assert WELLNESS_DISCLAIMER in reply          # disclaimer fires even with no caution
    assert "important note" not in reply.lower()  # no caution => no caution preamble
    assert "hydrated" in reply


if __name__ == "__main__":
    test_classify_intent_labels()
    test_classify_intent_hindi_telugu()
    test_compose_chat_reply_uses_facts_only()
    test_compose_chat_reply_missing_facts_is_honest()
    test_classify_intent_wellness()
    test_compose_wellness_reply_has_disclaimer_and_caution()
    test_compose_wellness_reply_no_caution_still_has_disclaimer()
    print("test_outreach_chat OK")
