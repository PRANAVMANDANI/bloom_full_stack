"""Crisis detection via keyword and pattern matching."""

import re
from typing import NamedTuple


class CrisisResult(NamedTuple):
    is_crisis: bool
    matched_patterns: list[str]


# Crisis-related keywords and phrases (case-insensitive)
CRISIS_KEYWORDS = [
    "want to die",
    "want to kill myself",
    "suicidal",
    "suicide",
    "end my life",
    "end it all",
    "no reason to live",
    "better off dead",
    "can't go on",
    "self harm",
    "self-harm",
    "cutting myself",
    "hurt myself",
    "overdose",
    "kill myself",
    "don't want to be alive",
    "not worth living",
    "plan to end",
    "goodbye letter",
    "final goodbye",
    "no way out",
    "hopeless",
]

# Regex patterns for more nuanced detection
CRISIS_PATTERNS = [
    r"\b(i\s+want\s+to\s+die)\b",
    r"\b(thinking\s+about\s+suicide)\b",
    r"\b(planning\s+to\s+end)\b",
    r"\b(going\s+to\s+kill\s+my\s*self)\b",
    r"\b(i\s+can'?t\s+take\s+it\s+anymore)\b",
    r"\b(no\s+point\s+in\s+living)\b",
]

CRISIS_RESOURCES = (
    "🆘 **If you're in crisis, please reach out now:**\n\n"
    "• **Tele MANAS**: Call **14416** (India's national 24/7 mental health helpline)\n"
    "• **KIRAN Helpline**: Call **1800-599-0019** (India's mental health support)\n\n"
    "You are not alone. These services are free, confidential, and available 24/7. "
    "A real person is ready to listen right now. 💙"
)


def detect_crisis(text: str) -> CrisisResult:
    """
    Check if the given text contains crisis-related language.

    Returns a CrisisResult with is_crisis flag and matched patterns.
    """
    if not text:
        return CrisisResult(is_crisis=False, matched_patterns=[])

    text_lower = text.lower().strip()
    matched = []

    # Check keywords
    for keyword in CRISIS_KEYWORDS:
        if keyword in text_lower:
            matched.append(keyword)

    # Check regex patterns
    for pattern in CRISIS_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            pattern_match = re.search(pattern, text_lower, re.IGNORECASE)
            if pattern_match:
                matched.append(pattern_match.group(0))

    # Deduplicate
    matched = list(set(matched))

    return CrisisResult(is_crisis=len(matched) > 0, matched_patterns=matched)
