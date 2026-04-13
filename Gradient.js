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
     *   If omitted, stops are evenly distributed.
     */
    constructor(stops) {
        if (!stops || stops.length < 2) {
            throw new Error('Gradient requires at least 2 stops');
        }

        this.stops = stops.map((s, i) => ({
            l: s.l,
            c: s.c,
            h: s.h,
            pos: s.stop !== undefined ? s.stop : i / (stops.length - 1),
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
     * @param {number} t Position 0–1
     * @param {{ l: number, c: number, h: number }} out Pre-allocated output
     * @returns {{ l: number, c: number, h: number }} Same `out` reference
     */
    at(t, out) {
        t = clamp(t, 0, 1);
        const stops = this.stops;

        if (t <= stops[0].pos) {
            out.l = stops[0].l; out.c = stops[0].c; out.h = stops[0].h;
            return out;
        }

        const last = stops[stops.length - 1];
        if (t >= last.pos) {
            out.l = last.l; out.c = last.c; out.h = last.h;
            return out;
        }

        for (let i = 0; i < stops.length - 1; i++) {
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
     * @param {number} count
     * @returns {string[]}
     */
    palette(count) {
        const colors = [];
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
     * @param {Float32Array} out  Pre-allocated, length >= count * 3
     * @param {number} count      Number of samples
     * @returns {Float32Array} Same `out` reference
     */
    sampleArray(out, count) {
        const tmp = this._scratch;
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
        for (let i = 0; i < resolution; i++) {
            const t = i / (resolution - 1);
            grad.addColorStop(t, this.css(t));
        }
        return grad;
    }

    /**
     * Create a Canvas2D radial gradient.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx  Center X
     * @param {number} cy  Center Y
     * @param {number} r   Radius
     * @param {number} [resolution=16]
     * @returns {CanvasGradient}
     */
    toRadial(ctx, cx, cy, r, resolution = 16) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        for (let i = 0; i < resolution; i++) {
            const t = i / (resolution - 1);
            grad.addColorStop(t, this.css(t));
        }
        return grad;
    }

    /**
     * Generate a CSS linear-gradient() string.
     * @param {number}  [angle=90]       Angle in degrees (90 = left-to-right)
     * @param {number}  [resolution=8]   Number of sampled stops
     * @returns {string}
     */
    toCssLinear(angle = 90, resolution = 8) {
        const stops = [];
        for (let i = 0; i < resolution; i++) {
            const t = i / (resolution - 1);
            stops.push(`${this.css(t)} ${(t * 100).toFixed(1)}%`);
        }
        return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
    }

    /**
     * Generate a CSS radial-gradient() string.
     * @param {number} [resolution=8]
     * @returns {string}
     */
    toCssRadial(resolution = 8) {
        const stops = [];
        for (let i = 0; i < resolution; i++) {
            const t = i / (resolution - 1);
            stops.push(`${this.css(t)} ${(t * 100).toFixed(1)}%`);
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

export default Gradient;