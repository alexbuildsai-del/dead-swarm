#!/bin/bash
# full balance matrix used for the results tables. Usage: matrix.sh TAG SCALE (SCALE multiplies run counts)
tag=$1; k=${2:-1}; S=0.5
B="node tools/balance/batch.js --skill $S --workers 2"
ALL6=rook,juno,tomas,ines,mira,silas; MAPS=suburbs,hospital,quarantine
$B --profs fresh --diffs normal --maps suburbs --survs rook,juno --n $((30*k)) --out results/m_${tag}_fresh.jsonl > results/m_${tag}_fresh.txt 2>&1
$B --profs mid --diffs normal --maps $MAPS --survs $ALL6 --n $((4*k)) --out results/m_${tag}_midN.jsonl > results/m_${tag}_midN.txt 2>&1
$B --profs mid --diffs hard,nightmare --maps $MAPS --survs $ALL6 --n $((2*k)) --out results/m_${tag}_midHN.jsonl > results/m_${tag}_midHN.txt 2>&1
$B --profs late --diffs normal,hard,nightmare --maps $MAPS --survs $ALL6 --n $((2*k)) --out results/m_${tag}_late.jsonl > results/m_${tag}_late.txt 2>&1
cat results/m_${tag}_*.jsonl > results/m_${tag}_all.jsonl
node tools/balance/batch.js --report results/m_${tag}_all.jsonl > results/m_${tag}_report.txt
echo MATRIXDONE >> results/m_${tag}_report.txt
