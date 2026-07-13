import { describe, it, expect } from 'vitest';
import { Gradient, gradientSunset, gradientFire } from './Gradient.js';

describe('Gradient', () => {
    const g = new Gradient([
        { l: 0.2, c: 0.1, h: 200 },
        { l: 0.8, c: 0.3, h: 50 },
    ]);

    it('requires at least 2 stops', () => {
        expect(() => new Gradient([{ l: 0, c: 0, h: 0 }])).toThrow();
    });
    it('at() writes to caller-owned output', () => {
        const out = { l: 0, c: 0, h: 0 };
        const result = g.at(0.5, out);
        expect(result).toBe(out);
        expect(out.l).toBeGreaterThan(0);
    });
    it('at(0) returns first stop', () => {
        const out = { l: 0, c: 0, h: 0 };
        g.at(0, out);
        expect(out.l).toBeCloseTo(0.2, 1);
    });
    it('at(1) returns last stop', () => {
        const out = { l: 0, c: 0, h: 0 };
        g.at(1, out);
        expect(out.l).toBeCloseTo(0.8, 1);
    });
    it('two samples dont share references', () => {
        const a = { l: 0, c: 0, h: 0 };
        const b = { l: 0, c: 0, h: 0 };
        g.at(0, a);
        g.at(1, b);
        expect(a.l).not.toBeCloseTo(b.l, 1);
    });
    it('css() returns oklch string', () => {
        const s = g.css(0.5);
        expect(s).toContain('oklch');
    });
    it('palette() returns correct count', () => {
        expect(g.palette(5)).toHaveLength(5);
    });
    it('sampleArray fills typed array', () => {
        const out = new Float32Array(9); // 3 samples × 3 floats
        g.sampleArray(out, 3);
        expect(out[0]).toBeGreaterThan(0); // l of first
        expect(out[6]).toBeGreaterThan(0); // l of third
    });
    it('presets are valid gradients', () => {
        const out = { l: 0, c: 0, h: 0 };
        gradientSunset.at(0.5, out);
        expect(out.l).toBeGreaterThan(0);
        gradientFire.at(0.5, out);
        expect(out.l).toBeGreaterThan(0);
    });

    it('destroy nulls stops and scratch', () => {
        const g = new Gradient([
            { l: 0.2, c: 0.1, h: 200 },
            { l: 0.8, c: 0.3, h: 50 },
        ]);
        g.destroy();
        expect(g.stops).toBeNull();
        expect(g._scratch).toBeNull();
    });
});

// -- monochromeGradient (v1.1.0) --

import { monochromeGradient, gradientMonoWarm, gradientMonoCool } from './Gradient.js';

describe('monochromeGradient', () => {
    const base = { l: 0.5, c: 0.15, h: 260 };

    it('returns a Gradient instance', () => {
        expect(monochromeGradient(base)).toBeInstanceOf(Gradient);
    });

    it('default stops=2 (endpoints only)', () => {
        expect(monochromeGradient(base).stops).toHaveLength(2);
    });

    it('default mode=tinted retains base chroma and hue', () => {
        const g = monochromeGradient(base);
        for (const s of g.stops) {
            expect(s.c).toBeCloseTo(0.15, 5);
            expect(s.h).toBeCloseTo(260, 5);
        }
    });

    it('default range=[0, 1]: first stop L=0, last L=1', () => {
        const g = monochromeGradient(base);
        expect(g.stops[0].l).toBe(0);
        expect(g.stops[g.stops.length - 1].l).toBe(1);
    });

    it('grayscale mode forces c=0 on every stop', () => {
        const g = monochromeGradient(base, { mode: 'grayscale' });
        for (const s of g.stops) expect(s.c).toBe(0);
    });

    it('grayscale mode preserves hue field (harmless with c=0)', () => {
        const g = monochromeGradient(base, { mode: 'grayscale' });
        for (const s of g.stops) expect(s.h).toBe(260);
    });

    it('custom range endpoints are respected', () => {
        const g = monochromeGradient(base, { range: [0.15, 0.9] });
        expect(g.stops[0].l).toBeCloseTo(0.15, 5);
        expect(g.stops[g.stops.length - 1].l).toBeCloseTo(0.9, 5);
    });

    it('custom stops count is respected', () => {
        expect(monochromeGradient(base, { stops: 11 }).stops).toHaveLength(11);
        expect(monochromeGradient(base, { stops: 3 }).stops).toHaveLength(3);
    });

    it('stops>2 places intermediate L values evenly across range', () => {
        const g = monochromeGradient(base, { stops: 5, range: [0, 1] });
        // Expected L values: 0, 0.25, 0.5, 0.75, 1
        const ls = g.stops.map(s => s.l);
        [0, 0.25, 0.5, 0.75, 1].forEach((expected, i) => {
            expect(ls[i]).toBeCloseTo(expected, 10);
        });
    });

    it('sampled at t=0.5 falls in the middle of the L range', () => {
        const g = monochromeGradient(base, { range: [0.2, 0.8] });
        const out = { l: 0, c: 0, h: 0 };
        g.at(0.5, out);
        expect(out.l).toBeCloseTo(0.5, 2); // 0.2 + (0.8-0.2)*0.5 = 0.5
    });

    it('throws on missing/malformed base', () => {
        expect(() => monochromeGradient(null)).toThrow(/base/);
        expect(() => monochromeGradient({})).toThrow(/base/);
        expect(() => monochromeGradient({ l: 0.5, c: 'x', h: 0 })).toThrow(/base/);
    });

    it('throws on unknown mode', () => {
        expect(() => monochromeGradient(base, { mode: 'oops' })).toThrow(/mode/);
    });

    it('throws on invalid range shape or values', () => {
        expect(() => monochromeGradient(base, { range: [0.5, 0.5] })).toThrow(/range/);
        expect(() => monochromeGradient(base, { range: [0.8, 0.2] })).toThrow(/range/);
        expect(() => monochromeGradient(base, { range: [-0.1, 0.9] })).toThrow(/range/);
        expect(() => monochromeGradient(base, { range: [0.1, 1.5] })).toThrow(/range/);
        expect(() => monochromeGradient(base, { range: [0.5] })).toThrow(/range/);
    });

    it('throws on stops < 2 or non-integer', () => {
        expect(() => monochromeGradient(base, { stops: 1 })).toThrow(/stops/);
        expect(() => monochromeGradient(base, { stops: 0 })).toThrow(/stops/);
        expect(() => monochromeGradient(base, { stops: 2.5 })).toThrow(/stops/);
    });

    it('does not mutate the input base', () => {
        const b = { l: 0.5, c: 0.15, h: 260 };
        monochromeGradient(b, { mode: 'grayscale' });
        expect(b.l).toBe(0.5);
        expect(b.c).toBe(0.15);
        expect(b.h).toBe(260);
    });

    it('gradientMonoWarm and gradientMonoCool are valid Gradient instances', () => {
        const out = { l: 0, c: 0, h: 0 };
        gradientMonoWarm.at(0.5, out);
        expect(out.l).toBeGreaterThan(0);
        expect(out.c).toBeGreaterThan(0); // tinted
        gradientMonoCool.at(0.5, out);
        expect(out.l).toBeGreaterThan(0);
        expect(out.c).toBeGreaterThan(0);
    });

    it('warm preset has a warm hue (near h=60), cool preset has a cool hue (near h=245)', () => {
        const out = { l: 0, c: 0, h: 0 };
        gradientMonoWarm.at(0.5, out);
        expect(out.h).toBeCloseTo(60, 0);
        gradientMonoCool.at(0.5, out);
        expect(out.h).toBeCloseTo(245, 0);
    });
});

describe('Gradient — closed mode (v1.2.0)', () => {
    // A three-color hue-wheel: red → green → blue → (wrap back to red).
    // Chroma and L held constant so we can reason about hue interpolation
    // directly.
    const wheel = () => new Gradient([
        { l: 0.5, c: 0.15, h: 0 },
        { l: 0.5, c: 0.15, h: 120 },
        { l: 0.5, c: 0.15, h: 240 },
    ], { closed: true });

    it('closed flag is stored on the instance', () => {
        expect(wheel().closed).toBe(true);
        expect(new Gradient([{ l: 0.5, c: 0, h: 0 }, { l: 0.6, c: 0, h: 0 }]).closed).toBe(false);
    });

    it('default spacing is i/n (period), not i/(n-1)', () => {
        const g = wheel();
        expect(g.stops[0].pos).toBeCloseTo(0);
        expect(g.stops[1].pos).toBeCloseTo(1 / 3);
        expect(g.stops[2].pos).toBeCloseTo(2 / 3);
        // Last stop is NOT at 1 in closed default spacing.
        expect(g.stops[2].pos).toBeLessThan(1);
    });

    it('at(1) === at(0) exactly (period wrap)', () => {
        const g = wheel();
        const a = { l: 0, c: 0, h: 0 };
        const b = { l: 0, c: 0, h: 0 };
        g.at(0, a);
        g.at(1, b);
        expect(b.l).toBeCloseTo(a.l);
        expect(b.c).toBeCloseTo(a.c);
        expect(b.h).toBeCloseTo(a.h);
    });

    it('at() accepts raw accumulating phase (no manual mod required)', () => {
        const g = wheel();
        const a = { l: 0, c: 0, h: 0 };
        const b = { l: 0, c: 0, h: 0 };
        g.at(0.25, a);
        g.at(7.25, b);           // seven full periods later
        expect(b.l).toBeCloseTo(a.l);
        expect(b.h).toBeCloseTo(a.h);
    });

    it('at() wraps negative phase correctly', () => {
        const g = wheel();
        const a = { l: 0, c: 0, h: 0 };
        const b = { l: 0, c: 0, h: 0 };
        g.at(0.25, a);
        g.at(-0.75, b);          // -0.75 mod 1 === 0.25
        expect(b.h).toBeCloseTo(a.h);
    });

    it('at() interpolates through the wrap segment (last → first)', () => {
        const g = wheel();
        const out = { l: 0, c: 0, h: 0 };
        // The wrap segment covers t ∈ [2/3, 1] and interpolates 240° → 0°.
        // Midway at t = 5/6 should land on the short-arc midpoint 300°.
        g.at(5 / 6, out);
        expect(out.h).toBeCloseTo(300, 0);
    });

    it('at() at stop positions returns the stop color', () => {
        const g = wheel();
        const out = { l: 0, c: 0, h: 0 };
        g.at(0, out);       expect(out.h).toBeCloseTo(0);
        g.at(1 / 3, out);   expect(out.h).toBeCloseTo(120);
        g.at(2 / 3, out);   expect(out.h).toBeCloseTo(240);
    });

    it('open mode produces byte-identical output to v1.1.0 (no regression)', () => {
        // Same stops, no opts.
        const g = new Gradient([
            { l: 0.2, c: 0.1, h: 200 },
            { l: 0.8, c: 0.3, h: 50 },
        ]);
        const out = { l: 0, c: 0, h: 0 };
        g.at(0, out);
        expect(out.l).toBeCloseTo(0.2);
        g.at(1, out);
        expect(out.l).toBeCloseTo(0.8);
        // at(2) should clamp to 1 in open mode, giving the last stop.
        g.at(2, out);
        expect(out.l).toBeCloseTo(0.8);
        // at(-1) should clamp to 0 in open mode.
        g.at(-1, out);
        expect(out.l).toBeCloseTo(0.2);
    });

    it('palette() uses period spacing (no duplicated endpoint) when closed', () => {
        const g = wheel();
        const pal = g.palette(3);
        expect(pal).toHaveLength(3);
        // In open mode with 3 samples: t = 0, 0.5, 1. Last would ≈ 240°.
        // In closed mode with 3 samples: t = 0, 1/3, 2/3. Should give 0°, 120°, 240°.
        // Cheap check: parse hue values from oklch() strings.
        // CSS syntax is space-separated: `oklch(0.5 0.15 240)`.
        const hueOf = (s) => {
            const m = s.match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([-\d.]+)/);
            return m ? Number(m[1]) : NaN;
        };
        expect(hueOf(pal[0])).toBeCloseTo(0, 0);
        expect(hueOf(pal[1])).toBeCloseTo(120, 0);
        expect(hueOf(pal[2])).toBeCloseTo(240, 0);
    });

    it('sampleArray() uses period spacing when closed', () => {
        const g = wheel();
        const buf = new Float32Array(3 * 3);
        g.sampleArray(buf, 3);
        expect(buf[2]).toBeCloseTo(0, 0);         // h0 = 0
        expect(buf[5]).toBeCloseTo(120, 0);       // h1 = 120
        expect(buf[8]).toBeCloseTo(240, 0);       // h2 = 240
    });

    it('toCssLinear appends a closing stop at 100% (first color repeated)', () => {
        const g = wheel();
        const css = g.toCssLinear(90, 4);
        // Should end with a "…100.0%)" segment.
        expect(css).toMatch(/100\.0%\)$/);
        // Count stops — 4 sampled + 1 closing = 5 comma-separated color stops.
        // The angle sits before the first comma, so total commas === stops - 1 + 1 = stops.
        const commas = (css.match(/,/g) || []).length;
        expect(commas).toBe(5);
    });

    it('toCssLinear (open mode) does NOT append a closing stop', () => {
        const g = new Gradient([
            { l: 0.2, c: 0.1, h: 200 },
            { l: 0.8, c: 0.3, h: 50 },
        ]);
        const css = g.toCssLinear(90, 4);
        // Should end at 100% because open-mode default spacing puts the last
        // stop at exactly 1.0 — but there should NOT be a duplicate.
        const commas = (css.match(/,/g) || []).length;
        expect(commas).toBe(4);   // 4 stops → 4 commas (1 for angle + 3 between stops)
    });

    it('toCssRadial appends a closing stop at 100% when closed', () => {
        const g = wheel();
        const css = g.toCssRadial(4);
        expect(css).toMatch(/100\.0%\)$/);
    });

    it('accepts custom stop positions in closed mode; honors them for wrap', () => {
        // Custom positions with the first at 0.1 and last at 0.7 — wrap
        // segment covers [0.7, 1.1] (span 0.4).
        const g = new Gradient([
            { l: 0.5, c: 0.1, h: 0,   stop: 0.1 },
            { l: 0.5, c: 0.1, h: 180, stop: 0.7 },
        ], { closed: true });
        const out = { l: 0, c: 0, h: 0 };
        // Midway through the wrap segment: t = 0.9, span 0.4, localT = 0.5.
        // Interpolates last (h=180) → first (h=0) — shortest arc goes 180→360 or
        // 180→0 (both are the same arc length 180°); the OKLCH implementation
        // takes one branch consistently; either way midway is around 90° or 270°.
        g.at(0.9, out);
        // Just assert the wrap actually engages (result isn't a stop color).
        expect(Math.abs(out.h - 0) > 5 && Math.abs(out.h - 180) > 5).toBe(true);
    });

    it('at() matches interior segment on both sides of a stop (continuity)', () => {
        const g = wheel();
        const before = { l: 0, c: 0, h: 0 };
        const after = { l: 0, c: 0, h: 0 };
        // Sample just below and just above stop 1 (at t=1/3, h=120°).
        g.at(1 / 3 - 1e-6, before);
        g.at(1 / 3 + 1e-6, after);
        expect(before.h).toBeCloseTo(after.h, 2);
        expect(before.l).toBeCloseTo(after.l, 4);
    });

    it('at() matches wrap-in and wrap-out on both sides of the wrap boundary', () => {
        const g = wheel();
        const before = { l: 0, c: 0, h: 0 };
        const after = { l: 0, c: 0, h: 0 };
        // Sample just below and just above t = 1 (== 0 after wrap).
        g.at(1 - 1e-6, before);
        g.at(0 + 1e-6, after);
        // Hue continuity across the wrap boundary must be measured with a
        // circular-distance metric — the wrap-in side reads e.g. 359.999°
        // and the wrap-out side reads 0.001° for the SAME point on the
        // hue wheel. Straight numerical toBeCloseTo would incorrectly
        // flag them as far apart.
        const dHue = Math.min(
            Math.abs(before.h - after.h),
            360 - Math.abs(before.h - after.h),
        );
        expect(dHue).toBeLessThan(0.01);
        expect(before.l).toBeCloseTo(after.l, 4);
    });
});

// ---------------------------------------------------------------------------
// Float-domain gate for closed-mode at().
//
// The period wrap is `t = t - Math.floor(t)`, and that expression is NOT
// guaranteed to land in [0, 1). For any tiny negative t (|t| below
// Number.EPSILON / 2 ~= 1.1e-16), `t - (-1)` rounds to exactly 1.0 in float64.
// t = 1.0 then falls into the wrap segment at localT === 1, which returns the
// right COLOUR but expresses its hue as 360 rather than 0 — outside the
// canonical [0, 360) range, and enough to break any consumer that divides by
// 360, indexes on the hue, or round-trips through a hue histogram.
//
// An accumulating animation phase decrementing through zero produces exactly
// this input, and `at()` documents negative t as valid. Same root cause as the
// out-of-bounds index in lite-color-lerp's sampleColorLUTWrapped.
// ---------------------------------------------------------------------------
describe('Gradient closed mode — float domain', () => {
    const wheel = new Gradient([
        { l: 0.65, c: 0.2, h: 0 },
        { l: 0.65, c: 0.2, h: 120 },
        { l: 0.65, c: 0.2, h: 240 },
    ], { closed: true });
    const out = { l: 0, c: 0, h: 0 };

    it('t - Math.floor(t) really does round to exactly 1.0 (the premise)', () => {
        expect(-1e-17 - Math.floor(-1e-17)).toBe(1);
        expect(-Number.MIN_VALUE - Math.floor(-Number.MIN_VALUE)).toBe(1);
        expect(-1e-16 - Math.floor(-1e-16)).toBeLessThan(1);
    });

    it('a tiny negative phase returns a canonical hue, not 360', () => {
        for (const t of [-1e-17, -1e-20, -Number.MIN_VALUE]) {
            wheel.at(t, out);
            expect(out.h, `t = ${t}`).toBeGreaterThanOrEqual(0);
            expect(out.h, `t = ${t}`).toBeLessThan(360);
        }
    });

    it('a tiny negative phase yields the same colour as at(0)', () => {
        const zero = { l: 0, c: 0, h: 0 };
        wheel.at(0, zero);
        wheel.at(-1e-17, out);
        expect(out.l).toBeCloseTo(zero.l, 10);
        expect(out.c).toBeCloseTo(zero.c, 10);
        expect(out.h).toBeCloseTo(zero.h, 10);
    });

    it('hue stays inside [0, 360) across a full sweep, including negative t', () => {
        for (let i = -3000; i <= 3000; i++) {
            const t = i / 1000;
            wheel.at(t, out);
            expect(out.h, `t = ${t}`).toBeGreaterThanOrEqual(0);
            expect(out.h, `t = ${t}`).toBeLessThan(360);
            expect(Number.isFinite(out.l), `t = ${t}`).toBe(true);
        }
    });

    it('the seam is no worse than any interior step (circular metric)', () => {
        const circ = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
        const h = (t) => { wheel.at(t, out); return out.h; };
        const EPS = 1e-4;
        let maxInterior = 0;
        for (let i = 0; i < 2000; i++) {
            maxInterior = Math.max(maxInterior, circ(h(i / 2000), h(i / 2000 + EPS)));
        }
        const seam = circ(h(1 - EPS / 2), h(EPS / 2));
        expect(seam).toBeLessThanOrEqual(maxInterior + 1e-9);
    });

    it('open mode is untouched by the closed guard', () => {
        const open = new Gradient([
            { l: 0.2, c: 0.1, h: 200 },
            { l: 0.8, c: 0.15, h: 60 },
        ]);
        const a = { l: 0, c: 0, h: 0 }, b = { l: 0, c: 0, h: 0 };
        open.at(-1e-17, a);
        open.at(0, b);
        expect(a).toEqual(b);          // still clamped, as before
        open.at(2, a);
        open.at(1, b);
        expect(a).toEqual(b);
    });
});
