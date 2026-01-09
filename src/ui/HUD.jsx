import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore, CHAPTERS, formatScale } from '../core/store'
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

// Animated text transition component
function AnimatedText({ text, className, delay = 0 }) {
  const [displayed, setDisplayed] = useState(text)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (text !== displayed) {
      setIsTransitioning(true)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setDisplayed(text)
        setIsTransitioning(false)
      }, 300 + delay)
    }
    return () => clearTimeout(timeoutRef.current)
  }, [text, delay])

  return (
    <span className={`${className} ${isTransitioning ? 'text-transitioning' : 'text-visible'}`}>
      {displayed}
    </span>
  )
}

// Chapter title with smooth transitions
function ChapterTitle({ chapter, chapterNumber, isVisible }) {
  const [prevChapter, setPrevChapter] = useState(chapter)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (chapter !== prevChapter) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setPrevChapter(chapter)
        setIsAnimating(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [chapter, prevChapter])

  if (!isVisible) return null

  return (
    <div className={`chapter-title ${isAnimating ? 'chapter-title--animating' : ''}`}>
      <span className="chapter-number">Chapter {chapterNumber}</span>
      <span className="chapter-name">{prevChapter?.name}</span>
    </div>
  )
}

// Progress indicator with smooth fill
function ProgressBar({ totalProgress, currentChapter, isVisible }) {
  const smoothProgress = useSmoothValue(totalProgress, 0.08)

  // Move useMemo BEFORE any early return to keep hooks order consistent
  const markers = useMemo(() => {
    const totalDuration = CHAPTERS.reduce((sum, c) => sum + c.duration, 0)
    return CHAPTERS.map((ch, i) => ({
      id: ch.id,
      name: ch.name,
      position: CHAPTERS.slice(0, i).reduce((sum, c) => sum + c.duration, 0) / totalDuration
    }))
  }, [])

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
      <div className="chapter-markers">
        {markers.map((marker) => (
          <div
            key={marker.id}
            className={`chapter-marker ${currentChapter > marker.id ? 'completed' : ''} ${currentChapter === marker.id ? 'active' : ''}`}
            style={{ left: `${marker.position * 100}%` }}
            title={marker.name}
          />
        ))}
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


// Playback controls
function Controls({ isPlaying, isEndCard, onPlayPause, onReset, onSkip }) {
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
      {!isEndCard && (
        <button
          className="control-btn skip"
          onClick={onSkip}
          aria-label="Skip chapter"
        >
          Skip →
        </button>
      )}
    </div>
  )
}

export function HUD() {
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const totalProgress = useStore((s) => s.totalProgress)
  const narrativeText = useStore((s) => s.narrativeText)
  const currentScale = useStore((s) => s.currentScale)
  const isPlaying = useStore((s) => s.isPlaying)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const skipChapter = useStore((s) => s.skipChapter)
  const reset = useStore((s) => s.reset)

  const chapter = CHAPTERS[currentChapter - 1]

  // Chapter 10 (End Card) uses minimal HUD - hide sci-fi overlays
  const isEndCard = currentChapter === 10
  const showSciFiElements = !isEndCard

  // Fade HUD elements based on chapter transitions
  const [hudOpacity, setHudOpacity] = useState(1)

  useEffect(() => {
    // Slightly fade during rapid chapter changes
    setHudOpacity(0.85)
    const timer = setTimeout(() => setHudOpacity(1), 300)
    return () => clearTimeout(timer)
  }, [currentChapter])

  return (
    <div
      className={`hud ${isEndCard ? 'hud--minimal' : ''}`}
      style={{ '--hud-opacity': hudOpacity }}
    >
      {/* Chapter title - hidden on end card */}
      <ChapterTitle
        chapter={chapter}
        chapterNumber={currentChapter}
        isVisible={showSciFiElements}
      />

      {/* Progress bar - hidden on end card */}
      <ProgressBar
        totalProgress={totalProgress}
        currentChapter={currentChapter}
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
        onSkip={skipChapter}
      />
    </div>
  )
}

export default HUD
