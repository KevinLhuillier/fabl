"""Align a page's voice-over with its words (faster-whisper word timestamps).

Protocol (JSON over stdio, UTF-8):
  stdin : {"audio": "<url or path>", "words": ["The", "oak", ...], "model": "small.en"}
  stdout: {"timings": [[start_ms, end_ms] | null, ...], "matched": <0..1>}
          (one entry per input word, in order)

Whisper transcribes the audio with a timestamp per recognized word; both texts are
reduced to letters/digits and matched character by character (difflib), so
tokenization differences ("didn't" vs "did" + "n't") don't matter. Words the
recognizer missed are interpolated between their neighbours.
The page text is given to Whisper as a prompt (spelling of names); when that
throws the transcription off (low match), the page is transcribed again
without it and the better of the two alignments is kept.
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


def fetch(audio: str) -> str:
    if not audio.startswith(("http://", "https://")):
        return audio
    fd, path = tempfile.mkstemp(suffix=".mp3")
    with os.fdopen(fd, "wb") as f, urllib.request.urlopen(audio) as r:
        f.write(r.read())
    return path


# Below this share of matched characters, the prompt-free transcription is tried too.
RETRY_BELOW = 0.9


def transcribe(model: WhisperModel, path: str, prompt: str | None):
    # The page text as prompt steers the spelling of names (Rowan, Bram…).
    segments, _ = model.transcribe(
        path, language="en", word_timestamps=True, initial_prompt=prompt[:800] if prompt else None
    )
    return [w for s in segments for w in (s.words or [])]


def align(words: list[str], heard) -> tuple[list, float]:
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

    # Unmatched words: fill the gap between the previous and the next matched word.
    for i in range(len(words)):
        if starts[i] is not None:
            continue
        prev_end = next((ends[j] for j in range(i - 1, -1, -1) if ends[j] is not None), None)
        next_start = next((starts[j] for j in range(i + 1, len(words)) if starts[j] is not None), None)
        if prev_end is not None and next_start is not None:
            starts[i], ends[i] = prev_end, max(prev_end, next_start)

    timings = [
        [round(s * 1000), round(e * 1000)] if s is not None and e is not None else None
        for s, e in zip(starts, ends)
    ]
    return timings, matched_chars / max(1, len(text_chars))


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    req = json.load(sys.stdin)
    words: list[str] = req["words"]

    model = WhisperModel(req.get("model", "small.en"), device="cpu", compute_type="int8")
    path = fetch(req["audio"])
    try:
        timings, matched = align(words, transcribe(model, path, " ".join(words)))
        if matched < RETRY_BELOW:
            retry = align(words, transcribe(model, path, None))
            if retry[1] > matched:
                timings, matched = retry
    finally:
        if path != req["audio"]:
            os.remove(path)

    json.dump({"timings": timings, "matched": matched}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
