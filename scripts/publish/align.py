"""Align a page's voice-over with its words (faster-whisper word timestamps).

Protocol (JSON over stdio, UTF-8):
  stdin : {"audio": "<url or path>", "words": ["The", "oak", ...], "model": "small.en"}
  stdout: {"timings": [[start_ms, end_ms] | null, ...], "matched": <0..1>}
          (one entry per input word, in order)

Whisper transcribes the audio with a timestamp per recognized word; both texts are
reduced to letters/digits and matched character by character (difflib), so
tokenization differences ("didn't" vs "did" + "n't") don't matter. Words the
recognizer missed (or gave no real timing) are spread over the gap between their neighbours.
The page is transcribed twice, with the page text as prompt (spelling of names) and without
(the prompt can make Whisper invent words); the more trustworthy alignment is kept.
Called by scripts/publish/src/align.ts.
"""

import difflib
import json
import os
import sys
import tempfile
import urllib.request

from faster_whisper import WhisperModel


def normalize(text: str) -> str:
    return "".join(c for c in text.lower() if c.isalnum())


# Seconds without progress before a download is given up (a stalled connection otherwise
# hangs forever); the run stops and can be restarted, aligned pages are skipped.
FETCH_TIMEOUT = 60


def fetch(audio: str) -> str:
    if not audio.startswith(("http://", "https://")):
        return audio
    fd, path = tempfile.mkstemp(suffix=".mp3")
    try:
        with os.fdopen(fd, "wb") as f, urllib.request.urlopen(audio, timeout=FETCH_TIMEOUT) as r:
            f.write(r.read())
    except BaseException:
        os.remove(path)
        raise
    return path


# A word never lasts longer than this (or 0.3 s per letter): beyond, its match is spurious.
MAX_WORD_SECONDS = 1.5
# Shorter than this, a word has no real duration (Whisper glitch).
MIN_WORD_SECONDS = 0.04


def transcribe(model: WhisperModel, path: str, prompt: str | None):
    # The page text as prompt steers the spelling of names (Rowan, Bram…).
    segments, _ = model.transcribe(
        path, language="en", word_timestamps=True, initial_prompt=prompt[:800] if prompt else None
    )
    return [w for s in segments for w in (s.words or [])]


def align(words: list[str], heard) -> tuple[list, float, int]:
    """Timings per word, share of matched characters, and number of words that had to be
    placed by interpolation (a measure of how much the transcription can be trusted)."""
    # Character streams: page text (char -> word index) and transcript (char -> time).
    text_chars, text_owner = [], []
    for i, w in enumerate(words):
        for c in normalize(w):
            text_chars.append(c)
            text_owner.append(i)
    heard_chars, heard_times = [], []
    for w in heard:
        n = normalize(w.word)
        for k, c in enumerate(n):
            heard_chars.append(c)
            span = w.end - w.start
            heard_times.append((w.start + span * k / len(n), w.start + span * (k + 1) / len(n)))

    starts: list[float | None] = [None] * len(words)
    ends: list[float | None] = [None] * len(words)
    matcher = difflib.SequenceMatcher(None, text_chars, heard_chars, autojunk=False)
    matched_chars = 0
    for a, b, size in matcher.get_matching_blocks():
        matched_chars += size
        for k in range(size):
            i = text_owner[a + k]
            s, e = heard_times[b + k]
            starts[i] = s if starts[i] is None else min(starts[i], s)
            ends[i] = e if ends[i] is None else max(ends[i], e)

    # A word whose letters were picked from several heard words (far apart in time) is not
    # a real match: drop it, it is placed again with its neighbours below.
    for i, w in enumerate(words):
        if starts[i] is not None and ends[i] - starts[i] > max(MAX_WORD_SECONDS, 0.3 * len(normalize(w))):
            starts[i] = ends[i] = None
    # Likewise a cluster of words Whisper gave (almost) no duration: they cannot all be
    # spoken at the same instant. A single short word is kept (its start is right).
    tiny = [s is not None and e - s < MIN_WORD_SECONDS for s, e in zip(starts, ends)]
    for i in range(len(words)):
        if tiny[i] and ((i > 0 and tiny[i - 1]) or (i + 1 < len(words) and tiny[i + 1])):
            starts[i] = ends[i] = None

    interpolated = sum(1 for s in starts if s is None)

    # Unmatched words (missed by Whisper, or dropped above): spread each run of them over the gap
    # between the previous and the next matched word, in proportion to their length. Giving the
    # whole gap to the first one would make the highlight jump over the others.
    i = 0
    while i < len(words):
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < len(words) and starts[j] is None:
            j += 1
        gap_start = ends[i - 1] if i > 0 else None
        gap_end = starts[j] if j < len(words) else None
        if gap_start is not None and gap_end is not None:
            gap_end = max(gap_start, gap_end)
            weights = [max(1, len(normalize(words[k]))) for k in range(i, j)]
            total = sum(weights)
            at = gap_start
            for k, weight in zip(range(i, j), weights):
                starts[k] = at
                at += (gap_end - gap_start) * weight / total
                ends[k] = at
        i = j

    timings = [
        [round(s * 1000), round(e * 1000)] if s is not None and e is not None else None
        for s, e in zip(starts, ends)
    ]
    return timings, matched_chars / max(1, len(text_chars)), interpolated


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    req = json.load(sys.stdin)
    words: list[str] = req["words"]

    model = WhisperModel(req.get("model", "small.en"), device="cpu", compute_type="int8")
    path = fetch(req["audio"])
    try:
        # Both transcriptions, keep the better one: the prompt helps with names but can make
        # Whisper invent words ("the door" for "the bookshop. A tram bell rang…") with no real
        # timing, which the prompt-free transcription often gets right. Fewest words placed by
        # interpolation wins, then the highest match.
        with_prompt = align(words, transcribe(model, path, " ".join(words)))
        without = align(words, transcribe(model, path, None))
        timings, matched, _ = min((with_prompt, without), key=lambda r: (r[2], -r[1]))
    finally:
        if path != req["audio"]:
            os.remove(path)

    json.dump({"timings": timings, "matched": matched}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
