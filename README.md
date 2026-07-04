# @zakkster/lite-gradient

[![npm version](https://img.shields.io/npm/v/@zakkster/lite-gradient.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/@zakkster/lite-gradient)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@zakkster/lite-gradient?style=for-the-badge)](https://bundlephobia.com/result?p=@zakkster/lite-gradient)
[![npm downloads](https://img.shields.io/npm/dm/@zakkster/lite-gradient?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-gradient)
[![npm total downloads](https://img.shields.io/npm/dt/@zakkster/lite-gradient?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-gradient)
![TypeScript](https://img.shields.io/badge/TypeScript-Types-informational)
![Dependencies](https://img.shields.io/badge/dependencies-2-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

## 🎬 Live Demo (Gradient)
https://cdpn.io/pen/debug/QwKqXKP

## 🌈 What is lite-gradient?

`@zakkster/lite-gradient` creates smooth, perceptually uniform gradients using OKLCH color space — the same space used by your browser's native CSS `oklch()`.

It gives you:

- 🌈 N-stop OKLCH gradients (no gray dead zones unlike HSL/RGB)
- 🎯 `at(t, out)` — caller-owned output (zero-GC in render loops)
- 📊 `sampleArray(out, count)` — fill a Float32Array LUT
- 🖼️ `toLinear()` / `toRadial()` — Canvas2D gradient objects
- 🎨 `toCssLinear()` / `toCssRadial()` — CSS gradient strings
- 🎨 `palette(count)` — extract N CSS color strings
- 🔥 5 presets: Sunset, Ocean, Fire, Neon, Grey
- 🪶 < 2 KB minified

Part of the [@zakkster/lite-*](https://www.npmjs.com/org/zakkster) ecosystem — micro-libraries built for deterministic, cache-friendly game development.

## 🚀 Install

```bash
npm i @zakkster/lite-gradient
```

## 🕹️ Quick Start

```javascript
import { Gradient, gradientFire } from '@zakkster/lite-gradient';

// Custom gradient
const g = new Gradient([
    { l: 0.3, c: 0.15, h: 270 },  // deep purple
    { l: 0.6, c: 0.25, h: 330 },  // magenta
    { l: 0.9, c: 0.12, h: 60 },   // warm gold
]);

// Zero-GC sampling (render loop safe)
const color = { l: 0, c: 0, h: 0 };
g.at(particle.life, color);
ctx.fillStyle = toCssOklch(color);

// Canvas gradient (setup)
ctx.fillStyle = g.toLinear(ctx, 0, 0, canvas.width, 0);
ctx.fillRect(0, 0, canvas.width, canvas.height);

// CSS background
element.style.background = gradientFire.toCssLinear(135);

// LUT for particle color ramp
const lut = new Float32Array(256 * 3);
g.sampleArray(lut, 256);
```

## 📊 Comparison

| Library | Size | Color Space | Zero-GC | Canvas | CSS | Install |
|---------|------|-------------|---------|--------|-----|---------|
| chroma.js | ~14 KB | LAB/LCH | No | No | No | `npm i chroma-js` |
| culori | ~10 KB | OKLCH | No | No | No | `npm i culori` |
| **lite-gradient** | **< 2 KB** | **OKLCH** | **Yes** | **Yes** | **Yes** | **`npm i @zakkster/lite-gradient`** |

## ⚙️ API

### `new Gradient(stops)`
- `stops`: `[{ l, c, h, stop? }]` — OKLCH colors with optional position (0–1)

### `.at(t, out)` — Sample into caller-owned `{ l, c, h }`. **Zero-GC.**
### `.css(t)` — Sample as CSS `oklch()` string (allocates — setup only)
### `.palette(count)` — Array of CSS color strings
### `.sampleArray(out, count)` — Fill Float32Array `[l,c,h,l,c,h,...]`
### `.toLinear(ctx, x0,y0,x1,y1, resolution?)` — Canvas2D linear gradient
### `.toRadial(ctx, cx,cy,r, resolution?)` — Canvas2D radial gradient
### `.toCssLinear(angle?, resolution?)` — CSS `linear-gradient()` string
### `.toCssRadial(resolution?)` — CSS `radial-gradient()` string

## 🎨 Monochrome (v1.1.0)

Tone-on-tone gradients from a single base OKLCH color. Chroma and hue held
constant across all stops; only lightness varies. The client-work-friendly
gradient — safe for brand backgrounds, subtle depth, editorial layouts.

### `monochromeGradient(base, opts?)` → `Gradient`

```js
import { monochromeGradient } from '@zakkster/lite-gradient';

// Warm tone-on-tone background
const brand = monochromeGradient({ l: 0.5, c: 0.08, h: 245 });
ctx.fillStyle = brand.toLinear(ctx, 0, 0, 800, 600);

// Grayscale with print-safe range clamp
const printSafe = monochromeGradient(
    { l: 0.5, c: 0, h: 0 },
    { mode: 'grayscale', range: [0.05, 0.95] }
);
```

**Options:**

| Option  | Type                              | Default    | Notes                                                                                             |
|---------|-----------------------------------|------------|---------------------------------------------------------------------------------------------------|
| `mode`  | `'tinted' \| 'grayscale'`         | `'tinted'` | `'tinted'` retains base c/h; `'grayscale'` forces c=0.                                            |
| `range` | `[number, number]`                | `[0, 1]`   | L-axis endpoints. Must satisfy `0 ≤ lo < hi ≤ 1`.                                                 |
| `stops` | `number` (integer ≥ 2)            | `2`        | Endpoints only by default. Higher counts anchor stop positions (useful for export sampling grid). |

Throws `TypeError` on invalid `base` or `mode`, `RangeError` on invalid `range` or `stops`.

Pairs with `@zakkster/lite-hueforge`'s `monochromeScale(base, opts)` — that returns
discrete Radix-style step arrays; `monochromeGradient` returns a continuous `Gradient`
ready for canvas/CSS emission.

### Presets

- **`gradientMonoWarm`** — warm sepia (photography/editorial classic)
- **`gradientMonoCool`** — cool blue-grey (client-safe neutral)

## 🧪 Benchmark

```
10,000 particle color lookups per frame:
  chroma.js:     Allocates Color object per sample
  lite-gradient:  at(t, out) mutates caller-owned object, zero allocation
```

## 📦 TypeScript

Full declarations included in `lite-gradient.d.ts`.

## 📚 LLM-Friendly Documentation

See `llms.txt` for AI-optimized metadata and usage examples.

## License

MIT
