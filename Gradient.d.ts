interface OklchColor { l: number; c: number; h: number; }
interface GradientStop extends OklchColor { stop?: number; }
export declare class Gradient {
    constructor(stops: GradientStop[]);
    at(t: number, out: OklchColor): OklchColor;
    css(t: number): string;
    palette(count: number): string[];
    sampleArray(out: Float32Array, count: number): Float32Array;
    toLinear(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, resolution?: number): CanvasGradient;
    toRadial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, resolution?: number): CanvasGradient;
    toCssLinear(angle?: number, resolution?: number): string;
    toCssRadial(resolution?: number): string;
    destroy(): void;
}
export declare const gradientSunset: Gradient;
export declare const gradientOcean: Gradient;
export declare const gradientFire: Gradient;
export declare const gradientNeon: Gradient;
export declare const gradientGrey: Gradient;

// -- Monochrome (v1.1.0) --

export type MonoMode = 'tinted' | 'grayscale';

export interface MonochromeGradientOptions {
    /**
     * Chroma handling.
     * - `'tinted'` (default): retain base color's chroma/hue at every stop.
     * - `'grayscale'`: force chroma to 0 for pure achromatic tones.
     */
    mode?: MonoMode;
    /** L-axis endpoints [lo, hi], must satisfy `0 <= lo < hi <= 1`. Default `[0, 1]`. */
    range?: readonly [number, number];
    /**
     * Number of stops in the resulting gradient. Integer >= 2. Default 2
     * (endpoints only — smooth OKLCH interpolation produces a visually
     * identical continuous ramp regardless of stop count). Higher counts
     * are useful for anchored stop positioning during export sampling.
     */
    stops?: number;
}

/**
 * Build a monochromatic gradient from a single base OKLCH color.
 * Chroma and hue are held constant; only lightness varies across `range`.
 */
export declare function monochromeGradient(
    base: OklchColor,
    opts?: MonochromeGradientOptions
): Gradient;

/** Warm sepia monochrome preset. */
export declare const gradientMonoWarm: Gradient;

/** Cool blue-grey monochrome preset. */
export declare const gradientMonoCool: Gradient;

export default Gradient;
