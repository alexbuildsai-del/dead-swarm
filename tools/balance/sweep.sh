#!/bin/bash
# usage: sweep.sh NAME 'JSON' [batch args...]
name=$1; tune=$2; shift 2
DS_TUNE="$tune" node tools/balance/batch.js "$@" --out results/sw_$name.jsonl > results/sw_$name.txt 2>&1
echo "== $name $tune" >> results/sweep_summary.txt
grep -E "^(fresh|mid|late) (normal|hard|nightmare) +n=" results/sw_$name.txt | head -4 >> results/sweep_summary.txt
grep -E "killed by|avg level" results/sw_$name.txt >> results/sweep_summary.txt
