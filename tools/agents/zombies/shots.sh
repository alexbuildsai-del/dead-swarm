#!/bin/bash
# Screenshot sweep for zombie-agent visuals. Usage: DS_OUT=build/zombies tools/agents/zombies/shots.sh [name]
cd "${DS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
O=/tmp/deadswarm/zombies; mkdir -p $O
shot() { python3 tools/shot.py "$2" $O/$1.png ${3:-4} 844 390 ${4:-1}; }
case "${1:-all}" in
  types|all)
    shot t_brute "run=suburbs&spawn=brute:6,gasbag:6&god=1&quiet=1&t=1" 5 2
    shot t_ranged "run=suburbs&spawn=lobber:6,bilesniper:4&god=1&quiet=1&t=1" 5 2
    shot t_lurker "run=suburbs&spawn=lurker:6,leaper:6&god=1&quiet=1&t=1" 4 3
    shot t_mower "run=suburbs&spawn=mower:4,jogger:10,riot:6,howler:3&god=1&quiet=1&t=1" 4 2
    shot t_hosp "run=hospital&spawn=gurney:8,orderly:5&god=1&quiet=1&t=1" 4 3
    shot t_quar "run=quarantine&spawn=glowback:10,hazmat:6,broodmother:2&god=1&quiet=1&t=1" 4 2 ;;&
  elites|all) shot e_affix "run=suburbs&zelite=bull:hasted,brute:armored,shambler:regenerating,lobber:splitting,riot:frenzied,howler:irradiated&god=1&quiet=1" 3 2 ;;&
  events|all)
    for e in encirclement stampede tide siren elitehunt; do shot ev_$e "run=suburbs&zev=$e&god=1&quiet=1&t=6" 2 3; done ;;&
  bosses|all)
    for b in postman:suburbs blockcaptain:suburbs abomination:suburbs nightnurse:hospital orderlyking:hospital surgeon:hospital deconunit:quarantine sporehulk:quarantine hivequeen:quarantine; do
      id=${b%%:*}; m=${b##*:}; shot b_$id "run=$m&boss=$id&god=1&quiet=1&t=5" 4 4
    done ;;
esac
