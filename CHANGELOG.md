# Changelog

All notable changes to `@zakkster/lite-gradient` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-07-03

### Added — Monochrome

Tone-on-tone gradients from a single base OKLCH color — the
client-work-friendly variant that dodges the "AI can generate any random
gradient" problem for full multi-hue gradients. Designers who're
constrained to a brand palette can now produce brand-consistent
backgrounds, subtle-depth surfaces, and editorial layouts from one
input color.

- **`monochromeGradient(base, opts?)`** — factory returning a `Gradient`
  instance. Options: `mode` (`'tinted'` | `'grayscale'`, default
  `'tinted'`), `range` (`[lo, hi]` with `0 <= lo < hi <= 1`, default
  `[0, 1]`), `stops` (integer ≥ 2, default 2). Chroma and hue are held
  constant across all stops; only L varies across `range`.
- **`gradientMonoWarm`** — warm sepia preset (photography/editorial
  classic). Base ≈ `{ l: 0.5, c: 0.055, h: 60 }`, range `[0.18, 0.96]`.
- **`gradientMonoCool`** — cool blue-grey preset (client-safe neutral).
  Base ≈ `{ l: 0.5, c: 0.04, h: 245 }`, range `[0.15, 0.96]`.
- Type declarations: `MonoMode`, `MonochromeGradientOptions`, plus
  factory + preset signatures in `Gradient.d.ts`.

### Complements `@zakkster/lite-hueforge` v1.1.0

The Hueforge library got `monochromeScale(base, opts)` in v1.1.0
returning discrete Radix-style step arrays (12 steps at named positions
`50, 100, ..., 1000`). This library's `monochromeGradient` is the
continuous companion — a smooth `Gradient` ready for canvas/CSS emission.
Use `monochromeScale` for design-system tokens, `monochromeGradient`
for actual rendered surfaces.

### Design notes

- **`stops` defaults to 2.** OKLCH interpolation is smooth, so 2 stops
  (endpoints only) produce visually identical continuous output to any
  higher stop count. Higher `stops` are useful for anchored positioning
  during export sampling (e.g. `stops: 11` for Zone-System-style
  positions, `stops: 12` for Radix-style position anchors).
- **No `curve` option.** For a continuous gradient the interpolation
  is already smooth in perceptual (OKLCH L) space; a curve on the L axis
  doesn't add rendering value. If you want non-linear L placement, use
  `monochromeScale(base, { curve })` from lite-hueforge and pass the
  resulting stops directly to `new Gradient(...)`.
- **Validation is strict.** Invalid inputs throw with descriptive
  messages rather than silently falling back — a zero-span range
  (`[0.5, 0.5]`), inverted range (`[0.8, 0.2]`), or out-of-bounds range
  (`[-0.1, 0.9]`) is almost certainly a bug.
- **Isolation.** The base color is not mutated. Each call allocates a
  fresh stops array bounded by `stops` count. Presets are pre-built at
  module load, not per-use.

### Tests

17 new tests added (10 baseline → 27 total). Coverage:
`monochromeGradient` defaults, both modes, custom range, custom stops
count, sampling correctness, validation for every throw path, base
non-mutation, and the two presets.

### Non-breaking

Additive only. No existing API surface changed. Existing consumers
continue to work identically at `1.1.0`.

## [1.0.4] and prior

See git history.
