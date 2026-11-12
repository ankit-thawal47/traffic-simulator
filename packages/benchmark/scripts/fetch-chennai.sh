#!/bin/sh
# Download the Chennai Saidapet trajectory data (Kanagaraj, Asaithambi, Toledo and Lee,
# Transportation Research Record 2491, 2015), distributed by Tomer Toledo at the Technion,
# into data/external/chennai at the root of the repo. That folder is ignored by git:
# the files state no licence, so they are never committed.
#
#   sh packages/benchmark/scripts/fetch-chennai.sh
#
# Files already present are kept. SHA-256 sums of what was downloaded are written next to them.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
dest="${CHENNAI_DIR:-$here/../../../data/external/chennai}"
base="https://toledo.net.technion.ac.il/files/2014/10"
mkdir -p "$dest"
for name in ChennaiTrajectoryData2.45-3.00PM.xlsx ChennaiTrajectoryData3.00-3.15PM.xlsx TrajectoryDataDescription.pdf; do
  if [ -s "$dest/$name" ]; then
    echo "have $name"
  else
    echo "fetching $name"
    curl -fsSL -A "benchmark-data-fetch" -o "$dest/$name.part" "$base/$name"
    mv "$dest/$name.part" "$dest/$name"
  fi
done
(cd "$dest" && shasum -a 256 ./*.xlsx ./*.pdf > SHA256SUMS)
cat "$dest/SHA256SUMS"
echo "Chennai data in $dest"
