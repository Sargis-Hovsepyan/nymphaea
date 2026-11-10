// Where the pictures go: choose K paragraphs that are vivid (salience) and fall at scene changes
// (boundary bonus) while keeping the gaps between pictures even, by dynamic programming:
//   maximise  Σ salience(p) − λ · Σ ((gap − G) / G)²     over p1 < … < pK, gaps in words
// with at least `minGap` paragraphs between pictures. O(n · K · w), deterministic. Pure.

export interface Cand {
  /** Block index. */ i: number;
  /** Words from the start up to and including this block. */ cw: number;
  /** 0..1 (and a little more at a boundary). */ sal: number;
}

const NEG = -1e18;

export function placeK(cands: Cand[], total: number, K: number, opts: { minGap?: number; lambda?: number } = {}): number[] {
  const minGap = opts.minGap ?? 2, lam = opts.lambda ?? 2.2, n = cands.length;
  K = Math.min(K, n);
  if (K <= 0 || !n || total <= 0) return [];
  const G = total / K;
  const pen = (gap: number, ideal: number) => { const d = (gap - ideal) / G; return lam * d * d; };
  for (let loose = 0; loose < 2; loose++) {
    const lo = loose ? 0 : 0.3 * G, hi = loose ? Infinity : 2.4 * G;
    const dp: Float64Array[] = [], from: Int32Array[] = [];
    for (let k = 0; k < K; k++) { dp.push(new Float64Array(n).fill(NEG)); from.push(new Int32Array(n).fill(-1)); }
    for (let j = 0; j < n; j++) dp[0][j] = cands[j].sal - pen(cands[j].cw, 0.6 * G);
    for (let k = 1; k < K; k++) {
      for (let j = 0; j < n; j++) {
        let best = NEG, arg = -1;
        for (let q = j - 1; q >= 0; q--) {
          const gap = cands[j].cw - cands[q].cw;
          if (gap > hi) break;
          if (gap < lo || cands[j].i - cands[q].i < minGap || dp[k - 1][q] <= NEG) continue;
          const v = dp[k - 1][q] - pen(gap, G);
          if (v > best) { best = v; arg = q; }
        }
        if (arg >= 0) { dp[k][j] = best + cands[j].sal; from[k][j] = arg; }
      }
    }
    let end = -1, bv = NEG;
    for (let j = 0; j < n; j++) {
      if (dp[K - 1][j] <= NEG) continue;
      const v = dp[K - 1][j] - pen(total - cands[j].cw, 0.4 * G);
      if (v > bv) { bv = v; end = j; }
    }
    if (end < 0) continue;
    const out: number[] = [];
    for (let k = K - 1, j = end; k >= 0 && j >= 0; j = from[k][j], k--) out.push(cands[j].i);
    return out.reverse();
  }
  // Too few paragraphs for K pictures with the gap rule: try one fewer.
  return K > 1 ? placeK(cands, total, K - 1, opts) : [];
}
