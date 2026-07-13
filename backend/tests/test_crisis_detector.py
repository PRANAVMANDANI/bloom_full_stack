"""Unit tests for the chat crisis-keyword detector."""

from app.services.crisis_detector import detect_crisis


def test_empty_text_is_not_a_crisis():
    result = detect_crisis("")
    assert result.is_crisis is False
    assert result.matched_patterns == []


def test_neutral_message_is_not_a_crisis():
    result = detect_crisis("I had a pretty good day today, went for a walk.")
    assert result.is_crisis is False


def test_direct_keyword_is_flagged():
    result = detect_crisis("I just want to die honestly")
    assert result.is_crisis is True
    assert "want to die" in result.matched_patterns


def test_detection_is_case_insensitive():
    result = detect_crisis("I feel SUICIDAL right now")
    assert result.is_crisis is True


def test_regex_pattern_match():
    result = detect_crisis("I can't take it anymore, everything is too much")
    assert result.is_crisis is True
