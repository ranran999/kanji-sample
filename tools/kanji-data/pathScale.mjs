// Rescales an SVG path `d` string by (sx, sy). Works for both absolute and
// relative commands: under a pure linear axis-scale (no rotation/skew,
// which is all we need since KanjiVG's viewBox is square and our target
// space is also square), a relative displacement scales exactly the same
// way an absolute coordinate does, so every numeric parameter can be
// scaled in place purely based on which command type it belongs to --
// no need to track absolute position at all.

// Number of (x,y)-style *pairs* per command, and which single-axis type
// non-paired params are, keyed by uppercase command letter.
const PAIR_COUNTS = { M: 1, L: 1, T: 1 };
const QUAD_COUNTS = { S: 2, Q: 2 }; // (x1,y1) or (x2,y2) then (x,y) -- both pairs
const SEXT_COUNTS = { C: 3 }; // (x1,y1)(x2,y2)(x,y) -- three pairs
const ARC_ARITY = 7; // rx,ry,xrot,laf,sf,x,y

function tokenize(d) {
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) {
    if (m[1]) tokens.push({ cmd: m[1] });
    else tokens.push({ num: parseFloat(m[2]) });
  }
  return tokens;
}

export function scalePath(d, sx, sy) {
  const tokens = tokenize(d);
  let out = '';
  let i = 0;
  let curCmd = null;

  let firstOfRun = true;
  while (i < tokens.length) {
    if (tokens[i].cmd) {
      curCmd = tokens[i].cmd;
      i++;
      firstOfRun = true;
    }
    // Per the SVG spec, extra coordinate pairs after the first following an
    // M/m (moveto) are implicit L/l (lineto), not additional moveto calls.
    let effectiveCmd = curCmd;
    if (!firstOfRun && (curCmd === 'M' || curCmd === 'm')) {
      effectiveCmd = curCmd === 'M' ? 'L' : 'l';
    }
    firstOfRun = false;
    curCmd = effectiveCmd;
    const upper = effectiveCmd.toUpperCase();
    out += effectiveCmd;

    if (upper === 'Z') {
      // no params
      continue;
    }

    if (upper === 'H') {
      const x = tokens[i].num * sx;
      out += ' ' + round(x);
      i++;
    } else if (upper === 'V') {
      const y = tokens[i].num * sy;
      out += ' ' + round(y);
      i++;
    } else if (upper === 'A') {
      const rx = tokens[i].num * sx;
      const ry = tokens[i + 1].num * sy;
      const xrot = tokens[i + 2].num; // uniform scale: angle unaffected
      const laf = tokens[i + 3].num;
      const sf = tokens[i + 4].num;
      const x = tokens[i + 5].num * sx;
      const y = tokens[i + 6].num * sy;
      out += ` ${round(rx)} ${round(ry)} ${xrot} ${laf} ${sf} ${round(x)} ${round(y)}`;
      i += ARC_ARITY;
    } else if (PAIR_COUNTS[upper]) {
      const x = tokens[i].num * sx;
      const y = tokens[i + 1].num * sy;
      out += ` ${round(x)} ${round(y)}`;
      i += 2;
    } else if (QUAD_COUNTS[upper]) {
      const x1 = tokens[i].num * sx;
      const y1 = tokens[i + 1].num * sy;
      const x = tokens[i + 2].num * sx;
      const y = tokens[i + 3].num * sy;
      out += ` ${round(x1)} ${round(y1)}, ${round(x)} ${round(y)}`;
      i += 4;
    } else if (SEXT_COUNTS[upper]) {
      const x1 = tokens[i].num * sx;
      const y1 = tokens[i + 1].num * sy;
      const x2 = tokens[i + 2].num * sx;
      const y2 = tokens[i + 3].num * sy;
      const x = tokens[i + 4].num * sx;
      const y = tokens[i + 5].num * sy;
      out += ` ${round(x1)} ${round(y1)}, ${round(x2)} ${round(y2)}, ${round(x)} ${round(y)}`;
      i += 6;
    } else {
      throw new Error('Unhandled command: ' + curCmd);
    }
    out += ' ';
  }
  return out.trim().replace(/\s+/g, ' ');
}

function round(n) {
  return Math.round(n * 100) / 100;
}
