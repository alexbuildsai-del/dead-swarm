#!/bin/bash
# sweep2.sh TAG 'DS_TUNE json'  → fresh normal (rook,juno ×20) + mid normal (all ×3 maps ×2) + mid hard (×1)
tag=$1; export DS_TUNE="$2"; export DS_OUT=${DS_OUT:-build/bal}; B="node tools/balance/batch.js --skill 0.5 --workers 2"; ALL6=rook,juno,tomas,ines,mira,silas; MAPS=suburbs,hospital,quarantine
$B --profs fresh --diffs normal --maps suburbs --survs rook,juno --n 20 --out results/${tag}_fresh.jsonl > /dev/null 2>&1
$B --profs mid --diffs normal --maps $MAPS --survs $ALL6 --n 2 --out results/${tag}_mid.jsonl > /dev/null 2>&1
$B --profs mid --diffs hard --maps $MAPS --survs $ALL6 --n 1 --out results/${tag}_midh.jsonl > /dev/null 2>&1
cat results/${tag}_fresh.jsonl results/${tag}_mid.jsonl results/${tag}_midh.jsonl > results/${tag}_all.jsonl
echo "$2" > results/${tag}_tune.txt; echo SWEEPDONE >> results/${tag}_tune.txt
