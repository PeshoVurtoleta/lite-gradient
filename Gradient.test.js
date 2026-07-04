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
