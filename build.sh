#!/bin/sh
# Rebuild app.js from the plan logic + UI sources (only needed when editing)
cd "$(dirname "$0")"
{ echo "/* Gym Plan - generated from src/; edit src/ and rerun build.sh */"; echo "(function(){"; cat build/logic.js src/head.js src/ui.js; echo "})();"; } > app.js
