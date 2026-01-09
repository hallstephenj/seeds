/**
 * CinematicPost.jsx
 * Professional filmic finishing pass for premium, institutional aesthetic
 *
 * Applies subtle color grading, controlled bloom, film grain, and optional vignette
 * All tuning values centralized in GRADE_CONFIG for easy iteration
 */

import { useRef, useMemo, forwardRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
  SMAA,
} from '@react-three/postprocessing'
import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

// ============================================
// CINEMATIC GRADE PROFILE
// Premium, restrained, institutional cinematography
// All tuning values centralized for easy iteration
// ============================================
export const GRADE_CONFIG = {
  // === Color Grading ===
  exposure: 0.94,           // Slightly reduced - avoid digital harshness (0.92-0.98)
  contrast: 1.04,           // Very subtle - midtone clarity, not crunch (1.0-1.08)
  saturation: 0.82,         // Significantly reduced - neutral slate palette (0.78-0.88)

  // === Lift/Gamma/Gain (shadow/mid/highlight control) ===
  lift: 0.025,              // Lifted shadows - never crushed blacks (0.02-0.04)
  gamma: 0.98,              // Slightly lifted midtones for smoothness (0.95-1.02)
  gain: 0.92,               // Compressed highlights - smooth rolloff (0.88-0.95)

  // === Highlight Rolloff (soft knee) ===
  highlightRolloff: 0.75,   // Earlier rolloff for gentler highlights (0.7-0.85)
  highlightSoftness: 0.45,  // Softer knee - filmic compression (0.3-0.6)

  // === Split Toning (barely perceptible) ===
  splitToneEnabled: true,
  shadowTint: { r: 0.98, g: 0.99, b: 1.01 },   // Very slightly cool shadows
  highlightTint: { r: 1.01, g: 1.005, b: 0.99 }, // Very slightly warm highlights
  splitToneBalance: 0.45,   // Bias toward shadows
  splitToneStrength: 0.08,  // Barely there (0.05-0.12)

  // === Blue/Purple Desaturation (reduces neon/gaming look) ===
  bluePurpleDesat: 0.7,     // Extra desaturation on blue/purple hues (0.6-0.85)

  // === Bloom (subtle halation on brightest cores only) ===
  bloom: {
    enabled: true,
    intensity: 0.08,        // Very low - halation not glow (0.05-0.12)
    threshold: 0.96,        // Very high - only hottest highlights (0.94-0.98)
    smoothing: 0.25,        // Tighter falloff (0.15-0.35)
    radius: 0.4,            // Smaller radius - subtle spread (0.3-0.5)
  },

  // === Film Grain (texture, not noise) ===
  noise: {
    enabled: true,
    opacity: 0.018,         // Felt not seen (0.015-0.025)
    blendFunction: BlendFunction.SOFT_LIGHT, // Gentler blend than overlay
  },

  // === Vignette (OFF by default - too "gamey") ===
  vignette: {
    enabled: false,         // Disabled - vignette reads as game FX
    darkness: 0.12,         // If enabled, extremely subtle
    offset: 0.25,           // Wide offset if enabled
  },

  // === Chromatic Aberration (OFF - gamey tell) ===
  chromaticAberration: {
    enabled: false,
    offset: 0.0,
  },

  // === Camera Micro-Motion Scale (applied in CinematicCamera) ===
  microMotionScale: 0.35,   // Global multiplier to reduce all microMotion (0.25-0.5)

  // === Grade Blend (for A/B comparison) ===
  gradeBlend: 1.0,          // 0 = bypass, 1 = full grade
}


// ============================================
// CUSTOM FILMIC GRADE EFFECT
// Shader-based color grading with lift/gamma/gain,
// highlight rolloff, and split toning
// ============================================

const filmicGradeShader = /* glsl */`
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float lift;
uniform float gamma;
uniform float gain;
uniform float highlightRolloff;
uniform float highlightSoftness;
uniform bool splitToneEnabled;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float splitToneBalance;
uniform float splitToneStrength;
uniform float bluePurpleDesat;
uniform float gradeBlend;
uniform float time;

// Rec. 709 luminance
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// RGB to HSL (for selective color work)
vec3 rgbToHsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float s = 0.0;
  float h = 0.0;

  if (maxC != minC) {
    float d = maxC - minC;
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

// Soft highlight rolloff with exponential knee
vec3 highlightRolloffCurve(vec3 color, float threshold, float softness) {
  float lum = getLuminance(color);
  float compressed = lum < threshold
    ? lum
    : threshold + (1.0 - threshold) * (1.0 - exp(-(lum - threshold) / softness));
  float ratio = lum > 0.001 ? compressed / lum : 1.0;
  return color * ratio;
}

// Lift/Gamma/Gain color correction
vec3 liftGammaGain(vec3 color, float liftVal, float gammaVal, float gainVal) {
  vec3 lifted = color + vec3(liftVal) * (1.0 - color);
  vec3 gammad = pow(max(lifted, vec3(0.0)), vec3(1.0 / gammaVal));
  return gammad * gainVal;
}

// Split toning
vec3 splitTone(vec3 color, vec3 shadows, vec3 highlights, float balance, float strength) {
  float lum = getLuminance(color);
  float shadowWeight = smoothstep(balance + 0.2, balance - 0.2, lum);
  float highlightWeight = smoothstep(balance - 0.2, balance + 0.2, lum);
  vec3 tint = mix(vec3(1.0), shadows, shadowWeight * strength) *
              mix(vec3(1.0), highlights, highlightWeight * strength);
  return color * tint;
}

// Selective blue/purple desaturation (reduces neon/gaming look)
vec3 desaturateBluePurple(vec3 color, float amount) {
  vec3 hsl = rgbToHsl(color);
  float hue = hsl.x;

  // Blue is around 0.55-0.72, purple around 0.72-0.85 in HSL
  // Create a weight that peaks in blue-purple range
  float bluePurpleWeight = smoothstep(0.5, 0.6, hue) * smoothstep(0.9, 0.75, hue);

  // Reduce saturation for blue-purple hues
  float desatAmount = mix(1.0, amount, bluePurpleWeight * hsl.y);
  float lum = getLuminance(color);
  return mix(vec3(lum), color, desatAmount);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb;
  vec3 original = color;

  // 1. Exposure (slight reduction for controlled highlights)
  color *= exposure;

  // 2. Contrast (gentle, around middle gray)
  color = (color - 0.5) * contrast + 0.5;

  // 3. Lift/Gamma/Gain
  color = liftGammaGain(color, lift, gamma, gain);

  // 4. Highlight rolloff (soft knee - filmic compression)
  color = highlightRolloffCurve(color, highlightRolloff, highlightSoftness);

  // 5. Global saturation reduction
  float lum = getLuminance(color);
  color = mix(vec3(lum), color, saturation);

  // 6. Selective blue/purple desaturation (kills neon look)
  color = desaturateBluePurple(color, bluePurpleDesat);

  // 7. Split toning (barely perceptible warm/cool)
  if (splitToneEnabled) {
    color = splitTone(color, shadowTint, highlightTint, splitToneBalance, splitToneStrength);
  }

  // Clamp and blend
  color = clamp(color, 0.0, 1.0);
  color = mix(original, color, gradeBlend);

  outputColor = vec4(color, inputColor.a);
}
`

// Custom Effect class for the filmic grade
class FilmicGradeEffect extends Effect {
  constructor({
    exposure = 0.94,
    contrast = 1.04,
    saturation = 0.82,
    lift = 0.025,
    gamma = 0.98,
    gain = 0.92,
    highlightRolloff = 0.75,
    highlightSoftness = 0.45,
    splitToneEnabled = true,
    shadowTint = { r: 0.98, g: 0.99, b: 1.01 },
    highlightTint = { r: 1.01, g: 1.005, b: 0.99 },
    splitToneBalance = 0.45,
    splitToneStrength = 0.08,
    bluePurpleDesat = 0.7,
    gradeBlend = 1.0,
  } = {}) {
    super('FilmicGradeEffect', filmicGradeShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['exposure', new Uniform(exposure)],
        ['contrast', new Uniform(contrast)],
        ['saturation', new Uniform(saturation)],
        ['lift', new Uniform(lift)],
        ['gamma', new Uniform(gamma)],
        ['gain', new Uniform(gain)],
        ['highlightRolloff', new Uniform(highlightRolloff)],
        ['highlightSoftness', new Uniform(highlightSoftness)],
        ['splitToneEnabled', new Uniform(splitToneEnabled)],
        ['shadowTint', new Uniform([shadowTint.r, shadowTint.g, shadowTint.b])],
        ['highlightTint', new Uniform([highlightTint.r, highlightTint.g, highlightTint.b])],
        ['splitToneBalance', new Uniform(splitToneBalance)],
        ['splitToneStrength', new Uniform(splitToneStrength)],
        ['bluePurpleDesat', new Uniform(bluePurpleDesat)],
        ['gradeBlend', new Uniform(gradeBlend)],
        ['time', new Uniform(0)],
      ]),
    })
  }

  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('time').value += deltaTime
  }
}

// React wrapper for the custom effect
const FilmicGrade = forwardRef(function FilmicGrade(props, ref) {
  const effect = useMemo(() => new FilmicGradeEffect(props), [])
  return <primitive ref={ref} object={effect} dispose={null} />
})


// ============================================
// MAIN CINEMATIC POST COMPONENT
// ============================================
export function CinematicPost() {
  const noiseRef = useRef()

  // Animate noise slightly over time for film texture feel
  useFrame((state) => {
    if (noiseRef.current) {
      // Subtle seed variation - not shimmering, just texture
      const seed = Math.floor(state.clock.elapsedTime * 8) * 0.1
      // The Noise effect doesn't expose seed directly, but the time-based
      // rendering naturally creates variation
    }
  })

  return (
    <EffectComposer multisampling={0}>
      {/* Anti-aliasing */}
      <SMAA />

      {/* Custom filmic color grade */}
      <FilmicGrade
        exposure={GRADE_CONFIG.exposure}
        contrast={GRADE_CONFIG.contrast}
        saturation={GRADE_CONFIG.saturation}
        lift={GRADE_CONFIG.lift}
        gamma={GRADE_CONFIG.gamma}
        gain={GRADE_CONFIG.gain}
        highlightRolloff={GRADE_CONFIG.highlightRolloff}
        highlightSoftness={GRADE_CONFIG.highlightSoftness}
        splitToneEnabled={GRADE_CONFIG.splitToneEnabled}
        shadowTint={GRADE_CONFIG.shadowTint}
        highlightTint={GRADE_CONFIG.highlightTint}
        splitToneBalance={GRADE_CONFIG.splitToneBalance}
        splitToneStrength={GRADE_CONFIG.splitToneStrength}
        bluePurpleDesat={GRADE_CONFIG.bluePurpleDesat}
        gradeBlend={GRADE_CONFIG.gradeBlend}
      />

      {/* Bloom - high threshold, low intensity for halation effect */}
      {GRADE_CONFIG.bloom.enabled && (
        <Bloom
          intensity={GRADE_CONFIG.bloom.intensity}
          luminanceThreshold={GRADE_CONFIG.bloom.threshold}
          luminanceSmoothing={GRADE_CONFIG.bloom.smoothing}
          radius={GRADE_CONFIG.bloom.radius}
          mipmapBlur
        />
      )}

      {/* Film grain - very subtle texture */}
      {GRADE_CONFIG.noise.enabled && (
        <Noise
          ref={noiseRef}
          opacity={GRADE_CONFIG.noise.opacity}
          blendFunction={GRADE_CONFIG.noise.blendFunction}
        />
      )}

      {/* Vignette - extremely subtle */}
      {GRADE_CONFIG.vignette.enabled && (
        <Vignette
          darkness={GRADE_CONFIG.vignette.darkness}
          offset={GRADE_CONFIG.vignette.offset}
        />
      )}
    </EffectComposer>
  )
}

export default CinematicPost
