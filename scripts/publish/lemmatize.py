"""Tokenize + lemmatize English text with spaCy.

Protocol (JSON over stdio, UTF-8):
  stdin : ["line one", "line two", ...]
  stdout: [[{"text", "ws", "lemma", "pos"}, ...], ...]   (one token list per input line)

`ws` is the whitespace following the token, so "".join(t.text + t.ws) == input line.
Called once per story by scripts/publish/src/lemmatize.ts.
"""

import json
import sys

import spacy


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")

    lines = json.load(sys.stdin)
    # Parser and NER are not needed for lemmas/POS: disabling them is much faster.
    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

    result = []
    for doc in nlp.pipe(lines):
        result.append(
            [
                {"text": t.text, "ws": t.whitespace_, "lemma": t.lemma_, "pos": t.pos_}
                for t in doc
            ]
        )

    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
