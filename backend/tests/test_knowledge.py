"""Smoke test for the curated FAQ knowledge bank."""
from backend.app.services import knowledge


def test_entries_have_source():
    assert len(knowledge.FAQ) >= 4
    for entry in knowledge.FAQ:
        assert entry["answer"].strip()
        assert entry["source"].strip()
        assert isinstance(entry["keywords"], list) and entry["keywords"]


def test_lookup_matches_thalassemia():
    hit = knowledge.lookup("what is thalassemia?")
    assert hit is not None
    assert "lifelong" in hit["answer"].lower()
    assert hit["source"]


def test_lookup_no_match_returns_none():
    assert knowledge.lookup("what's the weather in paris") is None


def test_lookup_no_substring_false_positives():
    # ordinary words must NOT trigger FAQ keyword matches
    assert knowledge.lookup("I ride a bicycle to work") is None
    assert knowledge.lookup("I am from Cambridge") is None
    assert knowledge.lookup("that was 190 days ago") is None


if __name__ == "__main__":
    test_entries_have_source()
    test_lookup_matches_thalassemia()
    test_lookup_no_match_returns_none()
    test_lookup_no_substring_false_positives()
    print("test_knowledge OK")
