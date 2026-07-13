# Changelog

All notable changes to `@zakkster/lite-gradient` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-07-13

The **closed release**. Cyclic gradients for hue wheels, angle-driven
palette rotations, seamless tiling — the shape everyone hand-rolls with
`t % 1` and a duplicate first-color-at-100% gets promoted to a first-class
constructor option. Backward-compatible additive-only: open-mode output
is byte-identical to v1.1.0.

### Added — `closed: true` constructor option

`new Gradient(stops, { closed: true })` turns the gradient into a cyclic
one. The changes cascade through the whole surface:

- **Default spacing.** Auto-positioned stops space at `i / n` (period),
  not `i / (n − 1)` (endpoint-inclusive). A 3-stop closed gradient anchors
  at `0`, `1/3`, `2/3`; the wrap segment covers `[2/3, 1]` and closes back
  to the first stop. Custom `stop` positions are still honoured — the
  wrap segment then spans `[lastPos, firstPos + 1]`.
- **`at(t, out)`.** `t = t − Math.floor(t)` replaces the open-mode clamp.
  Animation loops now drive hue wheels with a raw accumulating phase, no
  manual mod bookkeeping. Negative `t` wraps too (`Math.floor(-0.25) === -1`
  → `-0.25 → 0.75`).
- **Wrap-segment interpolation.** When `t` lands in the wrap span (either
  side of the boundary), the sampler interpolates `stops[n-1] → stops[0]`
  via `lerpOklchTo` — same short-arc hue semantics as any other segment.
- **`palette(count)` / `sampleArray(out, count)`.** Sample at `i / count`
  (period spacing, no duplicated endpoint). Pass `count === n` to get
  your original stops back verbatim.
- **`toCssLinear` / `toCssRadial`.** Same period spacing during sampling,
  then an explicit closing stop at `100%` with the first color — so
  `linear-gradient` / `radial-gradient` output visually closes when
  used as a repeating tile.
- **`toLinear` / `toRadial` (Canvas).** Same treatment — closing
  `addColorStop(1, ...)` with the first color. `CanvasGradient` doesn't
  reveal its stop list, so the emitter is symmetric with the CSS one.

### Added — `readonly closed: boolean` field on Gradient instances

Consumers (e.g. `@zakkster/lite-gradient-studio`'s `formatCssConic`) can
branch on the closed flag without re-plumbing the constructor argument.

### Guarantees

- **Open-mode paths untouched.** `new Gradient(stops)` — no opts — walks
  the same code paths as v1.1.0. All 27 pre-existing tests pass unmodified.
- **Zero-GC preserved on the hot path.** `at(t, out)` still writes into
  the caller's output object; the wrap-segment branch adds a single
  subtract-and-compare, no allocations.
- **No new dependencies.** `lite-color` and `lite-lerp` peers unchanged.

### Notes

- 16 new tests (43 total). Coverage includes: period-spacing defaults,
  `at(1) === at(0)` identity, raw-accumulating-phase sampling, negative
  `t` wrap, wrap-segment midpoint, custom-position closed gradients,
  wrap-boundary continuity (circular-distance metric), palette /
  sampleArray period spacing, and closing-stop emission on both CSS
  emitters. Open-mode regression test asserts the old clamp behaviour
  at `t = 2` and `t = -1`.
- The typings gain a `GradientOptions` interface, `readonly closed` /
  `readonly stops` fields on the class, and the extended constructor
  signature. Existing single-argument usage remains type-compatible.
- `at()` on a closed gradient with `NaN` phase is undefined behaviour —
  `Math.floor(NaN) === NaN`, so the wrap arithmetic propagates. Guard
  at the caller if animation could go non-finite.


### Fixed (pre-release, against the 1.2.0 release candidate)

- **`at()` in closed mode could return a hue of 360.** The period wrap is
  `t = t - Math.floor(t)`, and that expression does **not** always land in
  `[0, 1)`: for any tiny negative `t` (magnitude below `Number.EPSILON / 2`,
  about 1.1e-16), `t - (-1)` rounds to exactly `1.0` in float64. `t = 1.0` then
  falls into the wrap segment at `localT === 1`, which returns the correct
  *colour* but expresses its hue as **360** rather than 0 — outside the canonical
  `[0, 360)` range, and enough to break any consumer that divides by 360, indexes
  on the hue, or bins it into a histogram.

  An accumulating animation phase decrementing through zero produces exactly this
  input, and `at()` documents negative `t` as a valid position. The closed branch
  now folds `t >= 1` back to 0. The open path is untouched: it still clamps, and
  remains byte-identical to v1.1.0 — verified over 3001 samples spanning `t < 0`
  and `t > 1`, plus `palette`, `sampleArray` and every emitter.

  Same root cause as the out-of-bounds index fixed in `@zakkster/lite-color-lerp`
  v1.1.0's `sampleColorLUTWrapped`. The two packages share the wrap expression,
  and shared the bug — the difference is that `Gradient` *interpolates* at the
  bad value (so it degraded to a non-canonical hue) while the LUT sampler
  *indexes* with it (so it returned `undefined`).

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
