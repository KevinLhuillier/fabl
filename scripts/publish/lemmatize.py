"""Tokenize + lemmatize English text with spaCy.

Protocol (JSON over stdio, UTF-8):
  stdin : ["line one", "line two", ...]
  stdout: [[{"text", "ws", "lemma", "pos", "dep", "head"}, ...], ...]   (one token list per input line)

`ws` is the whitespace following the token, so "".join(t.text + t.ws) == input line.
`dep` / `head` come from the dependency parser (`head` = index of the head token in
the line): they reveal phrasal verbs, e.g. "up" is the `prt` of "picked" in
"She picked it up".
Called once per story by scripts/publish/src/lemmatize.ts.
"""

import json
import sys

import spacy


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")

    lines = json.load(sys.stdin)
    nlp = spacy.load("en_core_web_sm", disable=["ner"])

    # Lemmas and POS without the parser: with it, the attribute ruler retags some
    # words ("as" ADP → SCONJ), which would no longer match their translations.
    with nlp.select_pipes(disable=["parser"]):
        tagged = list(nlp.pipe(lines))
    # Same tokenizer, so the parsed tokens line up one to one.
    parsed = nlp.pipe(lines)

    result = []
    for doc, deps in zip(tagged, parsed):
        result.append(
            [
                {
                    "text": t.text,
                    "ws": t.whitespace_,
                    "lemma": t.lemma_,
                    "pos": t.pos_,
                    "dep": d.dep_,
                    "head": d.head.i,
                }
                for t, d in zip(doc, deps)
            ]
        )

    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
