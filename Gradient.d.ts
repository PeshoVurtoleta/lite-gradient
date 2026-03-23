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
export default Gradient;
