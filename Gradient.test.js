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
