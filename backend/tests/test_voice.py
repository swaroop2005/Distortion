"""Smoke test for the shared empathy/voice layer."""
from backend.app.services import voice


def test_constants_present():
    assert isinstance(voice.TONE_GUIDE, str) and len(voice.TONE_GUIDE) > 50
    assert isinstance(voice.EXEMPLARS, list) and 3 <= len(voice.EXEMPLARS) <= 6
    assert all(isinstance(e, str) and e.strip() for e in voice.EXEMPLARS)


def test_no_banned_language():
    """Medical-honesty rule: never promise a cure, never gamify illness."""
    blob = (voice.TONE_GUIDE + " " + " ".join(voice.EXEMPLARS)).lower()
    for banned in ["cure", "cured", "curing", "game", "points", "badge", "level up"]:
        assert banned not in blob, f"banned word in voice layer: {banned}"


def test_system_prompt_includes_lang_and_tone():
    sp = voice.system_prompt("te")
    assert voice.TONE_GUIDE in sp
    assert "te" in sp  # instructs the model which language to answer in
    assert "only the facts" in sp.lower()  # anti-hallucination guard


if __name__ == "__main__":
    test_constants_present()
    test_no_banned_language()
    test_system_prompt_includes_lang_and_tone()
    print("test_voice OK")
