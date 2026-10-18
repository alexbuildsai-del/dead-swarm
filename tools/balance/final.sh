#!/bin/bash
# Final verification matrix (~714 runs). final.sh TAG
tag=${1:-final}; export DS_OUT=${DS_OUT:-build/bal}; B="node tools/balance/batch.js --skill 0.5 --workers 2 --seed 50000"; ALL6=rook,juno,tomas,ines,mira,silas; MAPS=suburbs,hospital,quarantine
run() { $B "$@" > /dev/null 2>&1; }
run --profs fresh --diffs normal --maps suburbs --survs rook,juno --n 60 --out results/${tag}_fresh.jsonl
run --profs mid --diffs normal --maps $MAPS --survs $ALL6 --n 10 --out results/${tag}_midn.jsonl
run --profs mid --diffs hard --maps $MAPS --survs $ALL6 --n 6 --out results/${tag}_midh.jsonl
run --profs mid --diffs nightmare --maps $MAPS --survs $ALL6 --n 3 --out results/${tag}_midnm.jsonl
run --profs late --diffs normal --maps $MAPS --survs $ALL6 --n 3 --out results/${tag}_laten.jsonl
run --profs late --diffs hard --maps $MAPS --survs $ALL6 --n 5 --out results/${tag}_lateh.jsonl
run --profs late --diffs nightmare --maps $MAPS --survs $ALL6 --n 6 --out results/${tag}_latenm.jsonl
cat results/${tag}_fresh.jsonl results/${tag}_midn.jsonl results/${tag}_midh.jsonl results/${tag}_midnm.jsonl results/${tag}_laten.jsonl results/${tag}_lateh.jsonl results/${tag}_latenm.jsonl > results/${tag}_all.jsonl
echo FINALDONE > results/${tag}_done.txt
