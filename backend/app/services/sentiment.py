"""VADER sentiment analysis for journal entries."""

import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Download VADER lexicon on first import
try:
    nltk.data.find("sentiment/vader_lexicon.zip")
except LookupError:
    nltk.download("vader_lexicon", quiet=True)

_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> float:
    """
    Analyze sentiment of text using VADER.

    Returns compound score between -1 (most negative) and 1 (most positive).
    """
    if not text or not text.strip():
        return 0.0

    scores = _analyzer.polarity_scores(text)
    return round(scores["compound"], 4)
