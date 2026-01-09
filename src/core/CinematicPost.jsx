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
// CINEMATIC GRADE CONFIG
// All tuning values in one place for easy iteration
// ============================================
export const GRADE_CONFIG = {
  // Color grading
  exposure: 0.97,           // Slight exposure reduction (0.95-1.0)
  contrast: 1.08,           // Subtle contrast boost (1.0-1.15)
  saturation: 0.88,         // Reduced saturation, especially neon (0.85-0.95)

  // Lift/Gamma/Gain (shadow/mid/highlight control)
  lift: 0.02,               // Lifted shadows - avoid crushed blacks (0.0-0.05)
  gamma: 1.0,               // Midtone adjustment (0.9-1.1)
  gain: 0.96,               // Highlight control - tighter rolloff (0.92-1.0)

  // Highlight rolloff (soft knee to prevent harsh clipping)
  highlightRolloff: 0.85,   // Where rolloff begins (0.8-0.95)
  highlightSoftness: 0.3,   // How soft the knee is (0.1-0.5)

  // Split toning (very subtle)
  splitToneEnabled: true,
  shadowTint: { r: 0.97, g: 0.98, b: 1.02 },   // Slightly cool shadows
  highlightTint: { r: 1.02, g: 1.01, b: 0.98 }, // Slightly warm highlights
  splitToneBalance: 0.5,    // Where shadows end and highlights begin
  splitToneStrength: 0.15,  // Overall strength (0.0-0.3)

  // Bloom (halation, not glow)
  bloom: {
    enabled: true,
    intensity: 0.15,        // Low intensity - halation not glow (0.1-0.3)
    threshold: 0.92,        // High threshold - only brightest cores (0.85-0.95)
    smoothing: 0.4,         // Smooth falloff (0.2-0.6)
    radius: 0.6,            // Moderate radius (0.4-0.8)
  },

  // Film grain
  noise: {
    enabled: true,
    opacity: 0.025,         // Very subtle (0.02-0.06)
    blendFunction: BlendFunction.OVERLAY,
  },

  // Vignette (extremely subtle or off)
  vignette: {
    enabled: true,
    darkness: 0.18,         // Very subtle (0.15-0.25)
    offset: 0.15,           // How far from center (0.1-0.2)
  },

  // Grade blend (for A/B comparison)
  gradeBlend: 1.0,          // 0 = off, 1 = full effect
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
uniform float gradeBlend;

// Attempt to adjust for film grain animation over time
uniform float time;

// Attempt to decode luminance
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Attempt to implement soft highlight rolloff using smoothstep
vec3 highlightRolloffCurve(vec3 color, float threshold, float softness) {
  float lum = getLuminance(color);
  // Create soft knee compression for highlights
  float compressed = lum < threshold
    ? lum
    : threshold + (1.0 - threshold) * (1.0 - exp(-(lum - threshold) / softness));

  // Apply compression ratio to color
  float ratio = lum > 0.001 ? compressed / lum : 1.0;
  return color * ratio;
}

// Attempt to implement lift/gamma/gain color correction
vec3 liftGammaGain(vec3 color, float liftVal, float gammaVal, float gainVal) {
  // Lift raises the shadows
  vec3 lifted = color + vec3(liftVal) * (1.0 - color);

  // Gamma adjusts midtones
  vec3 gammad = pow(lifted, vec3(1.0 / gammaVal));

  // Gain scales the highlights
  vec3 gained = gammad * gainVal;

  return gained;
}

// Attempt to implement split toning
vec3 splitTone(vec3 color, vec3 shadows, vec3 highlights, float balance, float strength) {
  float lum = getLuminance(color);

  // Smooth transition between shadow and highlight toning
  float shadowWeight = smoothstep(balance + 0.2, balance - 0.2, lum);
  float highlightWeight = smoothstep(balance - 0.2, balance + 0.2, lum);

  vec3 tint = mix(vec3(1.0), shadows, shadowWeight * strength) *
              mix(vec3(1.0), highlights, highlightWeight * strength);

  return color * tint;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb;
  vec3 original = color;

  // 1. Exposure
  color *= exposure;

  // 2. Contrast (around middle gray)
  color = (color - 0.5) * contrast + 0.5;

  // 3. Lift/Gamma/Gain
  color = liftGammaGain(color, lift, gamma, gain);

  // 4. Highlight rolloff (soft knee)
  color = highlightRolloffCurve(color, highlightRolloff, highlightSoftness);

  // 5. Saturation
  float lum = getLuminance(color);
  color = mix(vec3(lum), color, saturation);

  // 6. Split toning (optional)
  if (splitToneEnabled) {
    color = splitTone(color, shadowTint, highlightTint, splitToneBalance, splitToneStrength);
  }

  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);

  // Blend with original for A/B comparison
  color = mix(original, color, gradeBlend);

  outputColor = vec4(color, inputColor.a);
}
`

// Custom Effect class for the filmic grade
class FilmicGradeEffect extends Effect {
  constructor({
    exposure = 0.97,
    contrast = 1.08,
    saturation = 0.88,
    lift = 0.02,
    gamma = 1.0,
    gain = 0.96,
    highlightRolloff = 0.85,
    highlightSoftness = 0.3,
    splitToneEnabled = true,
    shadowTint = { r: 0.97, g: 0.98, b: 1.02 },
    highlightTint = { r: 1.02, g: 1.01, b: 0.98 },
    splitToneBalance = 0.5,
    splitToneStrength = 0.15,
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
