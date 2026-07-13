/**
 * @zakkster/lite-gradient — Zero-GC Procedural Gradient Generator
 *
 * N-stop OKLCH gradients with perceptually uniform interpolation.
 * Outputs: canvas CanvasGradient, CSS gradient strings, or sampled color arrays.
 *
 * Features:
 * - OKLCH interpolation (perceptually uniform, no gray dead zones)
 * - N-stop gradients with automatic spacing or custom stops
 * - Linear + radial canvas gradient generation
 * - CSS linear-gradient() string generation
 * - Color sampling: caller-owned output target (zero-GC)
 * - Palette extraction: N evenly spaced colors
 *
 * Depends on: @zakkster/lite-color (lerpOklch, toCssOklch)
 *             @zakkster/lite-lerp  (clamp)
 */

import { lerpOklchTo, toCssOklch } from '@zakkster/lite-color';
import { clamp } from '@zakkster/lite-lerp';

/**
 * A gradient defined by OKLCH color stops.
 *
 * Usage:
 *   const g = new Gradient([
 *       { l: 0.3, c: 0.15, h: 270 },
 *       { l: 0.6, c: 0.25, h: 330 },
 *       { l: 0.9, c: 0.12, h: 60  },
 *   ]);
 *
 *   // Sample a color (caller owns the output — zero GC)
 *   const out = { l: 0, c: 0, h: 0 };
 *   g.at(0.5, out);
 *   ctx.fillStyle = toCssOklch(out);
 *
 *   // Or use the CSS convenience (allocates a string, fine for setup)
 *   ctx.fillStyle = g.css(0.5);
 *
 *   // Generate canvas gradient
 *   const grad = g.toLinear(ctx, 0, 0, 800, 0);
 *   ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 200);
 *
 *   // Extract a palette
 *   const palette = g.palette(8); // 8 CSS strings
 */
export class Gradient {
    /**
     * @param {Array<{l: number, c: number, h: number, stop?: number}>} stops
     *   OKLCH color stops. Optional `stop` field (0–1) for custom positioning.
     *   If omitted, stops are evenly distributed. In `closed` mode the default
     *   spacing is `i / n` instead of `i / (n − 1)` — the wrap segment
     *   (last → first) gets equal width to every other segment.
     * @param {object} [opts]
     * @param {boolean} [opts.closed=false]
     *   Treat the gradient as cyclic. Enables:
     *     - Period spacing on defaults (`i / n`);
     *     - Period wrap on `at(t)`: `t = t − Math.floor(t)` replaces the clamp,
     *       so animation phase can be a raw accumulating float;
     *     - Wrap segment interpolation `[lastPos, firstPos + 1]`;
     *     - Period spacing on `palette` / `sampleArray` samples (no duplicated
     *       endpoint);
     *     - CSS emitters append the first color again at 100% so linear-gradient
     *       and radial-gradient close visually.
     *   Open-mode behavior (default) is unchanged, byte-for-byte, from v1.1.0.
     */
    constructor(stops, opts) {
        if (!stops || stops.length < 2) {
            throw new Error('Gradient requires at least 2 stops');
        }
        this.closed = opts != null && opts.closed === true;

        // Default spacing depends on closed:
        //   open   → i / (n − 1)   endpoints at 0 and 1
        //   closed → i / n         period spacing; wrap covers [(n−1)/n, 1]
        const n = stops.length;
        const denom = this.closed ? n : (n - 1);
        this.stops = stops.map((s, i) => ({
            l: s.l,
            c: s.c,
            h: s.h,
            pos: s.stop !== undefined ? s.stop : i / denom,
        }));

        // Sort by position
        this.stops.sort((a, b) => a.pos - b.pos);

        // Internal scratch for CSS methods (not exposed as return value)
        this._scratch = { l: 0, c: 0, h: 0 };
    }

    /**
     * Sample the gradient at position t into a caller-owned output object.
     * ZERO-GC: The caller allocates and owns the { l, c, h } object.
     * No intermediate objects are created.
     *
     * @param {number} t Position 0–1 (open mode: clamped; closed mode: wrapped
     *   via `t − Math.floor(t)`, so any float is valid).
     * @param {{ l: number, c: number, h: number }} out Pre-allocated output
     * @returns {{ l: number, c: number, h: number }} Same `out` reference
     */
    at(t, out) {
        const stops = this.stops;
        const n = stops.length;

        if (this.closed) {
            // Period wrap — replaces the open-mode clamp. `at(1.5)` and
            // `at(0.5)` yield the same color. Negative `t` wraps too:
            // Math.floor(-0.25) = -1, so t becomes 0.75.
            t = t - Math.floor(t);
            // ...but `t - Math.floor(t)` is NOT guaranteed to land in [0, 1).
            // For any tiny negative t (|t| < ~1.1e-16), `t - (-1)` rounds to
            // exactly 1.0 in float64. That falls into the wrap segment at
            // localT === 1, which returns the right colour but expresses its hue
            // as 360 rather than 0 — outside the canonical [0, 360) range, and
            // enough to break any consumer that divides by 360 or indexes on it.
            // An accumulating phase drifting a hair below zero is a documented
            // input here, so fold 1.0 back to 0. NaN is left alone: it falls
            // through the segment loop and returns `out` untouched, as before.
            if (t >= 1) t = 0;

            const first = stops[0];
            const last = stops[n - 1];

            // Wrap segment spans [lastPos, firstPos + 1]. Two cases: t
            // above lastPos (folded straight in), or t below firstPos
            // (folded with +1 phase adjustment).
            if (t >= last.pos) {
                const span = (first.pos + 1) - last.pos;
                const localT = span > 0 ? (t - last.pos) / span : 0;
                lerpOklchTo(last, first, localT, out);
                return out;
            }
            if (t < first.pos) {
                const span = (first.pos + 1) - last.pos;
                const localT = span > 0 ? (t + 1 - last.pos) / span : 0;
                lerpOklchTo(last, first, localT, out);
                return out;
            }
            // t is in [firstPos, lastPos) — fall through to normal segment
            // lookup below.
        } else {
            t = clamp(t, 0, 1);

            if (t <= stops[0].pos) {
                out.l = stops[0].l; out.c = stops[0].c; out.h = stops[0].h;
                return out;
            }

            const last = stops[n - 1];
            if (t >= last.pos) {
                out.l = last.l; out.c = last.c; out.h = last.h;
                return out;
            }
        }

        for (let i = 0; i < n - 1; i++) {
            if (t >= stops[i].pos && t <= stops[i + 1].pos) {
                const range = stops[i + 1].pos - stops[i].pos;
                const localT = range > 0 ? (t - stops[i].pos) / range : 0;
                // Zero-GC: writes directly into `out`, no intermediate object
                lerpOklchTo(stops[i], stops[i + 1], localT, out);
                return out;
            }
        }

        return out;
    }

    /**
     * Sample as CSS oklch() string.
     * Note: allocates a string — use for setup, not per-frame hot paths.
     * For hot paths, use at(t, out) + toCssOklch(out).
     * @param {number} t Position 0–1
     * @returns {string}
     */
    css(t) {
        return toCssOklch(this.at(t, this._scratch));
    }

    /**
     * Generate N evenly spaced CSS color strings.
     * Allocates an array — intended for setup, not per-frame use.
     * In closed mode, uses period spacing (`i / count`) with no duplicated
     * endpoint — the last color is at `(count-1)/count`, wrap segment implied.
     * @param {number} count
     * @returns {string[]}
     */
    palette(count) {
        const colors = [];
        if (this.closed) {
            for (let i = 0; i < count; i++) {
                colors.push(this.css(i / count));
            }
            return colors;
        }
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            colors.push(this.css(t));
        }
        return colors;
    }

    /**
     * Sample N colors into a pre-allocated Float32Array for LUT generation.
     * Layout: [l0, c0, h0, l1, c1, h1, ...] — 3 floats per sample.
     * ZERO-GC: caller owns the output array.
     *
     * In closed mode, uses period spacing (`i / count`) — sample 0 and the
     * would-be sample at index `count` are the same color; omitting the
     * duplicate is the point.
     *
     * @param {Float32Array} out  Pre-allocated, length >= count * 3
     * @param {number} count      Number of samples
     * @returns {Float32Array} Same `out` reference
     */
    sampleArray(out, count) {
        const tmp = this._scratch;
        if (this.closed) {
            for (let i = 0; i < count; i++) {
                this.at(i / count, tmp);
                const o = i * 3;
                out[o] = tmp.l;
                out[o + 1] = tmp.c;
                out[o + 2] = tmp.h;
            }
            return out;
        }
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            this.at(t, tmp);
            const o = i * 3;
            out[o] = tmp.l;
            out[o + 1] = tmp.c;
            out[o + 2] = tmp.h;
        }
        return out;
    }

    /**
     * Create a Canvas2D linear gradient with N color stops.
     * In closed mode the sampled positions are period-spaced (`i / resolution`)
     * and an explicit closing stop is added at t=1 with the first color so
     * `drawImage`-style tiling butts perfectly.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x0  Start X
     * @param {number} y0  Start Y
     * @param {number} x1  End X
     * @param {number} y1  End Y
     * @param {number} [resolution=16] Number of sampled stops
     * @returns {CanvasGradient}
     */
    toLinear(ctx, x0, y0, x1, y1, resolution = 16) {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        const denom = this.closed ? resolution : (resolution - 1);
        for (let i = 0; i < resolution; i++) {
            const t = i / denom;
            grad.addColorStop(t, this.css(t));
        }
        if (this.closed) {
            grad.addColorStop(1, this.css(0));
        }
        return grad;
    }

    /**
     * Create a Canvas2D radial gradient.
     * In closed mode: period spacing + explicit closing stop at r=1 with
     * the first color (see `toLinear`).
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx  Center X
     * @param {number} cy  Center Y
     * @param {number} r   Radius
     * @param {number} [resolution=16]
     * @returns {CanvasGradient}
     */
    toRadial(ctx, cx, cy, r, resolution = 16) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const denom = this.closed ? resolution : (resolution - 1);
        for (let i = 0; i < resolution; i++) {
            const t = i / denom;
            grad.addColorStop(t, this.css(t));
        }
        if (this.closed) {
            grad.addColorStop(1, this.css(0));
        }
        return grad;
    }

    /**
     * Generate a CSS linear-gradient() string.
     * In closed mode: period spacing + first color again at 100% so the
     * CSS output closes visually.
     * @param {number}  [angle=90]       Angle in degrees (90 = left-to-right)
     * @param {number}  [resolution=8]   Number of sampled stops
     * @returns {string}
     */
    toCssLinear(angle = 90, resolution = 8) {
        const stops = [];
        const denom = this.closed ? resolution : (resolution - 1);
        for (let i = 0; i < resolution; i++) {
            const t = i / denom;
            stops.push(`${this.css(t)} ${(t * 100).toFixed(1)}%`);
        }
        if (this.closed) {
            stops.push(`${this.css(0)} 100.0%`);
        }
        return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
    }

    /**
     * Generate a CSS radial-gradient() string.
     * In closed mode: period spacing + closing stop at 100% (see `toCssLinear`).
     * @param {number} [resolution=8]
     * @returns {string}
     */
    toCssRadial(resolution = 8) {
        const stops = [];
        const denom = this.closed ? resolution : (resolution - 1);
        for (let i = 0; i < resolution; i++) {
            const t = i / denom;
            stops.push(`${this.css(t)} ${(t * 100).toFixed(1)}%`);
        }
        if (this.closed) {
            stops.push(`${this.css(0)} 100.0%`);
        }
        return `radial-gradient(circle, ${stops.join(', ')})`;
    }

    /** Release internal references. Safe for GC. */
    destroy() {
        this.stops = null;
        this._scratch = null;
    }
}

// ── Preset gradients ──

/** Sunset: deep purple → magenta → warm gold */
export const gradientSunset = new Gradient([
    { l: 0.3, c: 0.15, h: 270 },
    { l: 0.55, c: 0.25, h: 330 },
    { l: 0.85, c: 0.15, h: 60 },
]);

/** Ocean: deep teal → cyan → white foam */
export const gradientOcean = new Gradient([
    { l: 0.25, c: 0.12, h: 220 },
    { l: 0.5, c: 0.18, h: 195 },
    { l: 0.9, c: 0.04, h: 190 },
]);

/** Fire: black → red → orange → yellow → white */
export const gradientFire = new Gradient([
    { l: 0.1, c: 0.01, h: 0 },
    { l: 0.4, c: 0.25, h: 25 },
    { l: 0.65, c: 0.24, h: 50 },
    { l: 0.85, c: 0.18, h: 85 },
    { l: 0.97, c: 0.02, h: 90 },
]);

/** Neon: electric blue → magenta → hot pink */
export const gradientNeon = new Gradient([
    { l: 0.5, c: 0.25, h: 250 },
    { l: 0.6, c: 0.3, h: 310 },
    { l: 0.7, c: 0.25, h: 350 },
]);

/** Greyscale: black → white (perceptually uniform in OKLCH) */
export const gradientGrey = new Gradient([
    { l: 0.0, c: 0, h: 0 },
    { l: 1.0, c: 0, h: 0 },
]);

// ── Monochrome (v1.1.0) ──

/**
 * Build a monochromatic gradient from a single base OKLCH color.
 *
 * Chroma and hue are held constant across all stops; only lightness varies
 * across `range`. This is the client-work-friendly cousin of full multi-hue
 * gradients — designers can generate a tone-on-tone background from a brand
 * color and drop it in without worrying about hue drift.
 *
 * Pairs with `@zakkster/lite-hueforge`'s `monochromeScale(base, opts)`:
 * that one returns discrete Radix-style step arrays; this returns a
 * continuous `Gradient` ready for canvas/CSS emission.
 *
 * @param {{ l: number, c: number, h: number }} base
 *   OKLCH base color. `c` and `h` are held constant across the gradient.
 * @param {Object} [opts]
 * @param {'tinted' | 'grayscale'} [opts.mode='tinted']
 *   `'tinted'` retains the base color's chroma/hue at every stop.
 *   `'grayscale'` forces chroma to 0 for pure achromatic tones.
 * @param {[number, number]} [opts.range=[0, 1]]
 *   L-axis endpoints. Must satisfy `0 <= lo < hi <= 1`.
 * @param {number} [opts.stops=2]
 *   Number of stops in the returned gradient (integer >= 2). Since OKLCH
 *   interpolation is smooth, 2 stops (endpoints) produce a visually
 *   identical continuous gradient to any higher stop count. Use higher
 *   counts (e.g. 11 for Zone-System-style stop placement, or 12 for
 *   Radix-style scale positions) when you want anchor stops at specific
 *   fractional positions for downstream export sampling.
 * @returns {Gradient}
 *
 * @throws {TypeError}  On invalid `mode`, `range` shape, or missing base fields.
 * @throws {RangeError} On invalid `range` values or non-integer/small `stops`.
 *
 * @example
 * // Warm tone-on-tone for a card background
 * const g = monochromeGradient({ l: 0.5, c: 0.05, h: 55 });
 * ctx.fillStyle = g.toLinear(ctx, 0, 0, 800, 600);
 * ctx.fillRect(0, 0, 800, 600);
 *
 * @example
 * // Grayscale ramp with a clamped range (printable-detail safe zone)
 * const g = monochromeGradient(
 *     { l: 0.5, c: 0, h: 0 },
 *     { mode: 'grayscale', range: [0.05, 0.95] }
 * );
 */
export function monochromeGradient(base, opts) {
    if (base == null || typeof base !== 'object' ||
        typeof base.l !== 'number' || typeof base.c !== 'number' ||
        typeof base.h !== 'number') {
        throw new TypeError(
            'monochromeGradient: base must be { l, c, h } with numeric fields'
        );
    }

    const o = opts || {};
    const mode = o.mode == null ? 'tinted' : o.mode;
    const range = o.range == null ? [0, 1] : o.range;
    const stops = o.stops == null ? 2 : o.stops;

    if (mode !== 'tinted' && mode !== 'grayscale') {
        throw new TypeError(
            'monochromeGradient: mode must be "tinted" or "grayscale", got ' + mode
        );
    }
    if (!Array.isArray(range) || range.length !== 2) {
        throw new TypeError(
            'monochromeGradient: range must be a two-element [lo, hi] array'
        );
    }
    const lo = range[0];
    const hi = range[1];
    if (typeof lo !== 'number' || typeof hi !== 'number' ||
        !(lo >= 0 && hi <= 1 && lo < hi)) {
        throw new RangeError(
            'monochromeGradient: range must satisfy 0 <= lo < hi <= 1, got [' +
            lo + ', ' + hi + ']'
        );
    }
    if (typeof stops !== 'number' || !Number.isInteger(stops) || stops < 2) {
        throw new RangeError(
            'monochromeGradient: stops must be an integer >= 2, got ' + stops
        );
    }

    const c = mode === 'grayscale' ? 0 : base.c;
    const h = base.h;
    const span = hi - lo;
    const denom = stops - 1;

    const gradientStops = new Array(stops);
    for (let i = 0; i < stops; i++) {
        const t = i / denom;
        gradientStops[i] = { l: lo + span * t, c, h };
    }
    return new Gradient(gradientStops);
}

/** Warm sepia monochrome — cream to deep umber. Photography/editorial classic. */
export const gradientMonoWarm = monochromeGradient(
    { l: 0.5, c: 0.055, h: 60 },
    { range: [0.18, 0.96] }
);

/** Cool blue-grey monochrome — editorial neutral, client-safe. */
export const gradientMonoCool = monochromeGradient(
    { l: 0.5, c: 0.04, h: 245 },
    { range: [0.15, 0.96] }
);

export default Gradient;