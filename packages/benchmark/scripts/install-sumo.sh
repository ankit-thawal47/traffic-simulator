#!/bin/sh
# Install SUMO at the pinned version into a tool environment outside the repo.
# Nothing is installed system-wide and the repo's dependencies are not touched.
#
#   sh packages/benchmark/scripts/install-sumo.sh
#
# Needs `uv` (https://docs.astral.sh/uv/). The environment goes to
# $SUMO_ENV, or ~/.cache/traffic-simulator/sumo-<version> when that is unset.
set -eu

SUMO_VERSION=1.28.0
SUMO_ENV="${SUMO_ENV:-$HOME/.cache/traffic-simulator/sumo-$SUMO_VERSION}"

# The macOS wheel of eclipse-sumo is built for Apple silicon only, so on such a
# machine ask for an arm64 Python even when uv itself runs under Rosetta.
PYTHON=3.12
if [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  PYTHON=cpython-3.12-macos-aarch64-none
fi

mkdir -p "$(dirname "$SUMO_ENV")"
uv venv --python "$PYTHON" "$SUMO_ENV"
uv pip install --python "$SUMO_ENV/bin/python" \
  "eclipse-sumo==$SUMO_VERSION" "libsumo==$SUMO_VERSION" "traci==$SUMO_VERSION"
"$SUMO_ENV/bin/sumo" --version | head -2
echo "SUMO $SUMO_VERSION installed in $SUMO_ENV"
