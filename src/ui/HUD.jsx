import { useState, useEffect, useRef } from 'react'
import { useStore, TOTAL_DURATION, formatScale } from '../core/store'
import './HUD.css'

// Smooth value interpolation hook - prevents flickering
function useSmoothValue(value, smoothingFactor = 0.1) {
  const smoothedRef = useRef(value)
  const [smoothed, setSmoothed] = useState(value)

  useEffect(() => {
    let animationFrame
    const animate = () => {
      const diff = value - smoothedRef.current
      if (Math.abs(diff) > 0.001) {
        smoothedRef.current += diff * smoothingFactor
        setSmoothed(smoothedRef.current)
        animationFrame = requestAnimationFrame(animate)
      } else {
        smoothedRef.current = value
        setSmoothed(value)
      }
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, smoothingFactor])

  return smoothed
}


// Seamless progress indicator - no chapter markers
function ProgressBar({ totalProgress, isVisible }) {
  const smoothProgress = useSmoothValue(totalProgress, 0.08)

  if (!isVisible) return null

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${smoothProgress * 100}%` }}
        />
        <div className="progress-glow" style={{ left: `${smoothProgress * 100}%` }} />
      </div>
    </div>
  )
}

// Narrative text with fade transitions
function NarrativeDisplay({ text, isCentered }) {
  const [displayedText, setDisplayedText] = useState(text)
  const [opacity, setOpacity] = useState(1)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (text !== displayedText) {
      // Fade out
      setOpacity(0)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setDisplayedText(text)
        // Fade in
        setTimeout(() => setOpacity(1), 50)
      }, 400)
    }
    return () => clearTimeout(timeoutRef.current)
  }, [text, displayedText])

  return (
    <div className={`narrative-container ${isCentered ? 'narrative-container--centered' : ''}`}>
      <p className="narrative-text" style={{ opacity }}>
        {displayedText}
      </p>
    </div>
  )
}

// Scale indicator with smoothed values
function ScaleDisplay({ scale, isVisible }) {
  const smoothScale = useSmoothValue(scale, 0.05)

  if (!isVisible) return null

  return (
    <div className="scale-indicator">
      <span className="scale-label">Scale</span>
      <span className="scale-value">{formatScale(smoothScale)}</span>
    </div>
  )
}


// Playback controls - simplified without skip
function Controls({ isPlaying, isEndCard, onPlayPause, onReset }) {
  return (
    <div className={`controls ${isEndCard ? 'controls--minimal' : ''}`}>
      <button
        className="control-btn"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        className="control-btn"
        onClick={onReset}
        aria-label="Reset"
      >
        ⏮
      </button>
    </div>
  )
}

export function HUD() {
  const globalTime = useStore((s) => s.globalTime)
  const totalProgress = useStore((s) => s.totalProgress)
  const narrativeText = useStore((s) => s.narrativeText)
  const currentScale = useStore((s) => s.currentScale)
  const isPlaying = useStore((s) => s.isPlaying)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const reset = useStore((s) => s.reset)

  // End card phase starts when we're near the end
  const isEndCard = globalTime >= TOTAL_DURATION * 0.92
  const showSciFiElements = !isEndCard

  return (
    <div className={`hud ${isEndCard ? 'hud--minimal' : ''}`}>
      {/* Seamless progress bar - no chapter markers */}
      <ProgressBar
        totalProgress={totalProgress}
        isVisible={showSciFiElements}
      />

      {/* Narrative text - shown on end card but styled differently */}
      <NarrativeDisplay
        text={narrativeText}
        isCentered={isEndCard}
      />

      {/* Scale indicator - hidden on end card */}
      <ScaleDisplay scale={currentScale} isVisible={showSciFiElements} />

      {/* Controls - minimal on end card */}
      <Controls
        isPlaying={isPlaying}
        isEndCard={isEndCard}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onReset={reset}
      />
    </div>
  )
}

export default HUD
