interface OklchColor { l: number; c: number; h: number; }
interface GradientStop extends OklchColor { stop?: number; }

/**
 * Constructor options for {@link Gradient} (v1.2.0+).
 */
export interface GradientOptions {
    /**
     * Treat the gradient as cyclic. Enables:
     * - Period spacing on defaults (`i / n` instead of `i / (n − 1)`);
     * - Period wrap on `at(t)` (`t = t − Math.floor(t)`, then folded to 0 if it
     *   rounds to exactly 1.0, which it does for any tiny negative t), so any
     *   float — a raw accumulating animation phase, a negative — is a valid
     *   position and the returned hue always stays in `[0, 360)`;
     * - Wrap segment interpolation `[lastPos, firstPos + 1]`;
     * - Period spacing on `palette` / `sampleArray` samples (no duplicated
     *   endpoint);
     * - CSS emitters append the first color again at 100% so the emitted
     *   gradient closes visually.
     *
     * Open-mode behaviour (default) is unchanged, byte-for-byte, from v1.1.0.
     * @default false
     */
    closed?: boolean;
}

export declare class Gradient {
    /** Whether the gradient was constructed with `{ closed: true }`. */
    readonly closed: boolean;
    /** Sorted internal stops with resolved positions. */
    readonly stops: ReadonlyArray<OklchColor & { pos: number }>;

    constructor(stops: GradientStop[], opts?: GradientOptions);
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
