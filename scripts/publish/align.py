"""Align a page's voice-over with its words (faster-whisper word timestamps).

Protocol (JSON over stdio, UTF-8):
  stdin : {"audio": "<url or path>", "words": ["The", "oak", ...], "model": "small.en"}
  stdout: {"timings": [[start_ms, end_ms] | null, ...], "matched": <0..1>}
          (one entry per input word, in order)

Whisper transcribes the audio with a timestamp per recognized word; both texts are
reduced to letters/digits and matched character by character (difflib), so
tokenization differences ("didn't" vs "did" + "n't") don't matter. Words the
recognizer missed are interpolated between their neighbours.
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


def transcribe(path: str, model_name: str, prompt: str):
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    # The page text as prompt steers the spelling of names (Rowan, Bram…).
    segments, _ = model.transcribe(
        path, language="en", word_timestamps=True, initial_prompt=prompt[:800]
    )
    return [w for s in segments for w in (s.words or [])]


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    req = json.load(sys.stdin)
    words: list[str] = req["words"]

    path = fetch(req["audio"])
    try:
        heard = transcribe(path, req.get("model", "small.en"), " ".join(words))
    finally:
        if path != req["audio"]:
            os.remove(path)

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
    json.dump(
        {"timings": timings, "matched": matched_chars / max(1, len(text_chars))},
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
