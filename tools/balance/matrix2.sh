#!/bin/bash
# targeted matrix. matrix2.sh TAG
tag=$1; B="node tools/balance/batch.js --skill 0.5 --workers 2"; ALL6=rook,juno,tomas,ines,mira,silas; MAPS=suburbs,hospital,quarantine
$B --profs fresh --diffs normal --maps suburbs --survs rook,juno --n 20 --out results/${tag}_fresh.jsonl > /dev/null 2>&1
$B --profs mid --diffs normal,hard --maps $MAPS --survs $ALL6 --n 2 --out results/${tag}_mid.jsonl > /dev/null 2>&1
$B --profs mid,late --diffs nightmare --maps $MAPS --survs $ALL6 --n 1 --out results/${tag}_late.jsonl > /dev/null 2>&1
cat results/${tag}_fresh.jsonl results/${tag}_mid.jsonl results/${tag}_late.jsonl > results/${tag}_all.jsonl
node tools/balance/batch.js --report results/${tag}_all.jsonl > results/${tag}_report.txt; echo MATRIXDONE >> results/${tag}_report.txt
