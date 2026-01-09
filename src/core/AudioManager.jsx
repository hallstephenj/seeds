/**
 * AudioManager.jsx
 * Generative ambient space music using Web Audio API
 * Somber, sophisticated drone that evolves with the animation
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStore, TOTAL_DURATION } from './store'

// Audio configuration
const AUDIO_CONFIG = {
  masterVolume: 0.35,
  fadeInDuration: 3,      // seconds
  fadeOutDuration: 4,     // seconds at end

  // Drone oscillators (Hz) - somber minor chord voicing
  baseFrequencies: [55, 82.5, 110, 165], // A1, E2, A2, E3

  // Detuning for richness (cents)
  detuneRange: 8,

  // Filter settings
  filterFreq: 800,
  filterQ: 0.7,

  // LFO for subtle movement
  lfoRate: 0.03,          // Very slow
  lfoDepth: 0.15,

  // Sub bass
  subFreq: 36.7,          // D1
  subVolume: 0.4,
}

class AmbientSoundscape {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.oscillators = []
    this.gains = []
    this.filters = []
    this.lfo = null
    this.isPlaying = false
    this.isMuted = false
  }

  async init() {
    if (this.ctx) return

    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    // Master gain
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.ctx.destination)

    // Create reverb-like effect using delays
    const delayNode = this.ctx.createDelay(1)
    delayNode.delayTime.value = 0.3
    const feedbackGain = this.ctx.createGain()
    feedbackGain.gain.value = 0.3
    const reverbFilter = this.ctx.createBiquadFilter()
    reverbFilter.type = 'lowpass'
    reverbFilter.frequency.value = 2000

    delayNode.connect(feedbackGain)
    feedbackGain.connect(reverbFilter)
    reverbFilter.connect(delayNode)
    delayNode.connect(this.masterGain)

    // Dry/wet mix
    const dryGain = this.ctx.createGain()
    dryGain.gain.value = 0.7
    dryGain.connect(this.masterGain)

    const wetGain = this.ctx.createGain()
    wetGain.gain.value = 0.5
    wetGain.connect(delayNode)

    // LFO for subtle modulation
    this.lfo = this.ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = AUDIO_CONFIG.lfoRate
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = AUDIO_CONFIG.lfoDepth
    this.lfo.connect(lfoGain)

    // Create drone oscillators
    AUDIO_CONFIG.baseFrequencies.forEach((freq, i) => {
      // Main oscillator
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.detune.value = (Math.random() - 0.5) * AUDIO_CONFIG.detuneRange

      // Gain for this voice
      const gain = this.ctx.createGain()
      gain.gain.value = 0.15 - (i * 0.02) // Higher voices slightly quieter

      // Filter
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = AUDIO_CONFIG.filterFreq + (i * 200)
      filter.Q.value = AUDIO_CONFIG.filterQ

      // LFO modulates filter slightly
      lfoGain.connect(filter.detune)

      // Connect
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(dryGain)
      gain.connect(wetGain)

      this.oscillators.push(osc)
      this.gains.push(gain)
      this.filters.push(filter)

      // Add a slightly detuned copy for richness
      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq
      osc2.detune.value = AUDIO_CONFIG.detuneRange + (Math.random() * 4)

      const gain2 = this.ctx.createGain()
      gain2.gain.value = 0.08

      osc2.connect(filter)
      this.oscillators.push(osc2)
      this.gains.push(gain2)
    })

    // Sub bass
    const subOsc = this.ctx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = AUDIO_CONFIG.subFreq

    const subGain = this.ctx.createGain()
    subGain.gain.value = AUDIO_CONFIG.subVolume * 0.15

    const subFilter = this.ctx.createBiquadFilter()
    subFilter.type = 'lowpass'
    subFilter.frequency.value = 120

    subOsc.connect(subFilter)
    subFilter.connect(subGain)
    subGain.connect(dryGain)

    this.oscillators.push(subOsc)
    this.gains.push(subGain)

    // Noise layer for texture (very subtle)
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5
    }

    this.noiseSource = this.ctx.createBufferSource()
    this.noiseSource.buffer = noiseBuffer
    this.noiseSource.loop = true

    const noiseGain = this.ctx.createGain()
    noiseGain.gain.value = 0.008

    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 400
    noiseFilter.Q.value = 0.5

    this.noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(dryGain)
  }

  async start() {
    if (this.isPlaying) return

    await this.init()

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    // Start all oscillators
    const now = this.ctx.currentTime
    this.oscillators.forEach(osc => {
      try { osc.start(now) } catch (e) { /* already started */ }
    })
    this.lfo.start(now)
    try { this.noiseSource.start(now) } catch (e) { /* already started */ }

    this.isPlaying = true

    // Fade in
    if (!this.isMuted) {
      this.masterGain.gain.setValueAtTime(0, now)
      this.masterGain.gain.linearRampToValueAtTime(
        AUDIO_CONFIG.masterVolume,
        now + AUDIO_CONFIG.fadeInDuration
      )
    }
  }

  setVolume(volume, fadeTime = 0.5) {
    if (!this.masterGain) return
    const now = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(
      this.isMuted ? 0 : volume * AUDIO_CONFIG.masterVolume,
      now + fadeTime
    )
  }

  mute() {
    this.isMuted = true
    this.setVolume(0, 0.3)
  }

  unmute() {
    this.isMuted = false
    this.setVolume(1, 0.5)
  }

  toggleMute() {
    if (this.isMuted) {
      this.unmute()
    } else {
      this.mute()
    }
    return this.isMuted
  }

  // Evolve the soundscape based on animation progress
  evolve(progress) {
    if (!this.ctx || !this.isPlaying) return

    // Gradually open filter as we zoom out, close as we zoom in
    const filterMod = progress < 0.5
      ? 600 + (progress * 2 * 800)  // Opening up (0-50%)
      : 1400 - ((progress - 0.5) * 2 * 600) // Closing down (50-100%)

    this.filters.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(
        filterMod + (i * 100),
        this.ctx.currentTime,
        0.5
      )
    })

    // Fade out near the end
    if (progress > 0.9) {
      const fadeProgress = (progress - 0.9) / 0.1
      this.setVolume(1 - fadeProgress, 0.1)
    }
  }

  stop() {
    if (!this.ctx) return

    const now = this.ctx.currentTime
    this.masterGain.gain.linearRampToValueAtTime(0, now + 1)

    setTimeout(() => {
      this.oscillators.forEach(osc => {
        try { osc.stop() } catch (e) {}
      })
      this.isPlaying = false
    }, 1000)
  }
}

// Singleton instance
let soundscape = null

export function useAudio() {
  const globalTime = useStore((s) => s.globalTime)
  const isPlaying = useStore((s) => s.isPlaying)
  const hasStartedRef = useRef(false)
  const isMutedRef = useRef(false)

  // Initialize soundscape
  useEffect(() => {
    if (!soundscape) {
      soundscape = new AmbientSoundscape()
    }
    return () => {
      // Don't destroy on unmount - keep playing
    }
  }, [])

  // Start audio on first user interaction (required by browsers)
  const startAudio = useCallback(async () => {
    if (!soundscape || hasStartedRef.current) return
    hasStartedRef.current = true
    await soundscape.start()
  }, [])

  // Evolve soundscape with animation
  useEffect(() => {
    if (soundscape && hasStartedRef.current) {
      const progress = globalTime / TOTAL_DURATION
      soundscape.evolve(progress)
    }
  }, [globalTime])

  // Pause/resume with animation
  useEffect(() => {
    if (!soundscape || !hasStartedRef.current) return

    if (isPlaying && !isMutedRef.current) {
      soundscape.unmute()
    } else if (!isPlaying) {
      soundscape.mute()
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    if (!soundscape) return false
    const muted = soundscape.toggleMute()
    isMutedRef.current = muted
    return muted
  }, [])

  const isMuted = useCallback(() => {
    return soundscape?.isMuted ?? false
  }, [])

  return { startAudio, toggleMute, isMuted }
}

export default useAudio
