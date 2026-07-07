"""Date-aware journal retrieval for the chat companion.

When a user asks the chatbot about a specific time period — e.g.
"what happened in July 2024?", "remember what I wrote on 2025-03-05",
"tell me about March of 2025" — we parse the date reference(s) out of their
message and pull the matching journal entries from MongoDB so the LLM can
answer grounded in what they actually wrote, instead of only the last 10 entries.

Pure stdlib (re / datetime / calendar) — no extra dependencies.
"""

import re
import calendar
from datetime import datetime, timezone, timedelta

MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sept": 9, "sep": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

# Full month names first so the engine prefers "january" over "jan", etc.
_MONTH_NAMES = (
    "january|february|march|april|may|june|july|august|september|october|november|december"
    "|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec"
)

# Words that signal the user is trying to recall the past (used to gate the
# broad "whole year" match so a stray 4-digit number doesn't trigger retrieval).
_RECALL_HINT = re.compile(
    r"\b(remember|recall|happened|wrote|written|journal|entr|back in|that time|"
    r"what did|tell me about|looking back|reflect|last (month|year)|this (month|year))\b",
    re.I,
)

# --- Date reference patterns ---
# "5th July 2024", "5 of July, 2024"
_DMY = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_MONTH_NAMES})\.?,?\s+(\d{{4}})\b", re.I)
# "July 5, 2024", "July 5th 2024"
_MDY = re.compile(rf"\b({_MONTH_NAMES})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})\b", re.I)
# ISO "2025-03-05"
_ISO = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
# "July 2024", "July of 2024", "in July, 2024"
_MY = re.compile(rf"\b({_MONTH_NAMES})\.?\s+(?:of\s+)?(\d{{4}})\b", re.I)
# Bare year "2024"
_YEAR = re.compile(r"\b(19|20)\d{2}\b")

MAX_RANGES = 4          # don't let one message fan out into too many queries
PER_RANGE_LIMIT = 40    # cap entries pulled per period
SNIPPET_LEN = 600       # cap each entry's text to keep the prompt bounded


def _utc(year, month, day):
    return datetime(year, month, day, tzinfo=timezone.utc)


def _month_range(year, month):
    start = _utc(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = _utc(year, month, last_day) + timedelta(days=1)  # exclusive upper bound
    return start, end


def _day_range(year, month, day):
    start = _utc(year, month, day)
    return start, start + timedelta(days=1)


def _relative_ranges(text, now=None):
    """Handle 'this/last month' and 'this/last year' relative to today."""
    now = now or datetime.now(timezone.utc)
    low = text.lower()
    out = []
    if re.search(r"\bthis month\b", low):
        start, end = _month_range(now.year, now.month)
        out.append((start.strftime("%B %Y"), start, end))
    if re.search(r"\blast month\b", low):
        y, m = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
        start, end = _month_range(y, m)
        out.append((start.strftime("%B %Y"), start, end))
    if re.search(r"\bthis year\b", low):
        out.append((str(now.year), _utc(now.year, 1, 1), _utc(now.year + 1, 1, 1)))
    if re.search(r"\blast year\b", low):
        out.append((str(now.year - 1), _utc(now.year - 1, 1, 1), _utc(now.year, 1, 1)))
    return out


def parse_date_ranges(text):
    """Return a list of (label, start_utc, end_utc) for date references in `text`.

    Ranges are half-open [start, end). Specific days win over month/year, and a
    bare year is only honored when the message reads like a memory request.
    """
    ranges = []
    seen = set()
    consumed = []  # char spans already claimed by a more specific match

    def _overlaps(s, e):
        return any(not (e <= cs or s >= ce) for cs, ce in consumed)

    def _add(label, start, end, span=None):
        key = (start, end)
        if key not in seen:
            seen.add(key)
            ranges.append((label, start, end))
        if span:
            consumed.append(span)

    # 1) Specific days (highest precedence)
    for m in _DMY.finditer(text):
        try:
            start, end = _day_range(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
            _add(start.strftime("%b %d, %Y"), start, end, m.span())
        except (ValueError, KeyError):
            pass
    for m in _MDY.finditer(text):
        try:
            start, end = _day_range(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
            _add(start.strftime("%b %d, %Y"), start, end, m.span())
        except (ValueError, KeyError):
            pass
    for m in _ISO.finditer(text):
        try:
            start, end = _day_range(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            _add(start.strftime("%b %d, %Y"), start, end, m.span())
        except ValueError:
            pass

    # 2) Whole month + year (skip if inside an already-matched specific date)
    for m in _MY.finditer(text):
        if _overlaps(*m.span()):
            continue
        try:
            start, end = _month_range(int(m.group(2)), MONTHS[m.group(1).lower()])
            _add(start.strftime("%B %Y"), start, end, m.span())
        except (ValueError, KeyError):
            pass

    # 3) Relative phrases like "last month" / "this year"
    for label, start, end in _relative_ranges(text):
        _add(label, start, end)

    # 4) Bare year — only if nothing more specific matched and it reads like recall
    if not ranges and _RECALL_HINT.search(text):
        for m in _YEAR.finditer(text):
            year = int(m.group(0))
            _add(str(year), _utc(year, 1, 1), _utc(year + 1, 1, 1), m.span())

    return ranges[:MAX_RANGES]


def _sentiment_label(score):
    if score >= 0.3:
        return "Positive"
    if score <= -0.3:
        return "Negative"
    return "Neutral"


async def retrieve_journals_context(db, user_id, text):
    """Build an LLM context block of journal entries for date(s) named in `text`.

    Returns a formatted string, or None if the message names no date period.
    """
    ranges = parse_date_ranges(text)
    if not ranges:
        return None

    blocks = []
    for label, start, end in ranges:
        cursor = (
            db.journal_entries.find(
                {"user_id": user_id, "timestamp": {"$gte": start, "$lt": end}}
            )
            .sort("timestamp", 1)
            .limit(PER_RANGE_LIMIT)
        )
        entries = []
        async for j in cursor:
            entries.append(j)

        if not entries:
            blocks.append(f'Requested period "{label}": No journal entries were found for this time.')
            continue

        lines = [f'Requested period "{label}" - {len(entries)} journal entr'
                 f'{"y" if len(entries) == 1 else "ies"} found:']
        for j in entries:
            date_str = j["timestamp"].strftime("%b %d, %Y")
            body = j.get("text", "")
            if len(body) > SNIPPET_LEN:
                body = body[:SNIPPET_LEN].rstrip() + "..."
            lines.append(f'  * {date_str} [{_sentiment_label(j.get("sentiment_score", 0.0))}]: "{body}"')
        blocks.append("\n".join(lines))

    header = (
        "[RETRIEVED JOURNAL ENTRIES FOR A REQUESTED TIME PERIOD]\n"
        "The user asked about a specific date or month. Answer their question using ONLY the "
        "journal entries below as the source of what happened during that period - summarize, "
        "recall, and reflect on them warmly. If a period shows no entries, gently tell the user "
        "there's nothing recorded from that time. Never invent or assume entries that aren't listed."
    )
    return header + "\n" + "\n\n".join(blocks)
