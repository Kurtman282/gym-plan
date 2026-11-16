"use strict";
function toDrafts(s) {
  return { dl: String(s.dl), benchW: String(s.benchW), benchR: String(s.benchR), row1: String(s.row1), pull: String(s.pull), pace: fmtPace(s.pace), longBase: String(s.longBase), start: s.start };
}
WARM.long = ""; /* run card already includes the warm-up */
