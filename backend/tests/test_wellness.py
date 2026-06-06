"""Smoke + safety tests for the wellness suggestion bank."""
from backend.app.services import wellness


def test_rows_well_formed():
    rows = wellness.load()
    assert len(rows) >= 12
    for r in rows:
        assert r["id"].strip()
        assert r["topic"] in {"diet", "hydration", "emotional"}
        assert r["audience"] in {"patient", "donor", "any"}
        assert r["suggestion"].strip()
        assert r["source"].strip()
        assert r["caution_flag"] in {"none", "iron_overload"}


def test_patient_never_gets_donor_rows():
    """Safety invariant 1: the iron trap — no donor-only row reaches a patient."""
    rows = wellness.suggest("patient", limit=50)
    assert rows
    assert all(r["audience"] in {"patient", "any"} for r in rows)
    assert not any(r["audience"] == "donor" for r in rows)


def test_donor_never_gets_patient_rows():
    rows = wellness.suggest("donor", limit=50)
    assert rows
    assert all(r["audience"] in {"donor", "any"} for r in rows)


def test_public_gets_only_any_rows():
    rows = wellness.suggest("any", limit=50)
    assert rows
    assert all(r["audience"] == "any" for r in rows)


def test_patient_diet_has_iron_caution():
    """Safety invariant 2: at least one patient diet row carries the iron caution."""
    rows = wellness.suggest("patient", topic="diet", limit=50)
    assert any(r["caution_flag"] == "iron_overload" for r in rows)


def test_caution_rows_sorted_first():
    rows = wellness.suggest("patient", topic="diet", limit=3)
    assert rows[0]["caution_flag"] == "iron_overload"


def test_detect_topic():
    assert wellness.detect_topic("what should I eat?") == "diet"
    assert wellness.detect_topic("I feel so alone and stressed") == "emotional"
    assert wellness.detect_topic("how much water should I drink") == "hydration"
    assert wellness.detect_topic("xyzzy") is None


if __name__ == "__main__":
    test_rows_well_formed()
    test_patient_never_gets_donor_rows()
    test_donor_never_gets_patient_rows()
    test_public_gets_only_any_rows()
    test_patient_diet_has_iron_caution()
    test_caution_rows_sorted_first()
    test_detect_topic()
    print("test_wellness OK")
