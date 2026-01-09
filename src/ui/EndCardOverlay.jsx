import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore, TOTAL_DURATION, CHAPTERS } from '../core/store'
import logoImage from '/logo.png'
import './EndCardOverlay.css'

// Single paper sheet component
const SeedPhraseSheet = ({ side, delay = 0 }) => {
  const words = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => i + 1 + (side === 'right' ? 12 : 0)),
    [side]
  )

  return (
    <div className={`seed-sheet seed-sheet--${side}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="seed-sheet__inner">
        {words.map((num) => (
          <div key={num} className="seed-word">
            <span className="seed-word__number">{num}.</span>
            <span className="seed-word__line"></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Compute showTime once at module level (CHAPTERS is static)
const chapter10 = CHAPTERS.find(c => c.id === 10)
const SHOW_TIME = (chapter10?.start || (TOTAL_DURATION - 4)) + (chapter10?.duration || 4) * 0.66

export function EndCardOverlay() {
  const globalTime = useStore((s) => s.globalTime)
  const [contentVisible, setContentVisible] = useState(false)
  const timeoutRef = useRef(null)

  // Simple visibility check - no state needed
  const visible = globalTime >= SHOW_TIME

  useEffect(() => {
    if (visible && !contentVisible) {
      // Stagger content appearance
      timeoutRef.current = setTimeout(() => setContentVisible(true), 300)
    } else if (!visible && contentVisible) {
      setContentVisible(false)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [visible, contentVisible])

  if (!visible) return null

  const handleCTAClick = () => {
    window.open('https://unchained.com/consultation', '_blank')
  }

  return (
    <div className={`end-card-overlay ${contentVisible ? 'end-card-overlay--visible' : ''}`}>
      {/* Gradient background */}
      <div className="end-card-bg" />

      {/* Main content */}
      <div className="end-card-content">
        {/* Logo */}
        <div className="end-card-logo">
          <img src={logoImage} alt="Logo" className="logo-img" />
        </div>

        {/* Tagline */}
        <p className="end-card-tagline">Your keys. Your bitcoin.</p>

        {/* Seed phrase sheets */}
        <div className="seed-sheets-container">
          <SeedPhraseSheet side="left" delay={200} />
          <SeedPhraseSheet side="right" delay={350} />
        </div>

        {/* Stats / Trust indicators */}
        <div className="end-card-stats">
          <div className="stat">
            <span className="stat__value">2048</span>
            <span className="stat__label">BIP-39 Words</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat__value">256-bit</span>
            <span className="stat__label">Entropy</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat__value">5.4×10<sup>80</sup></span>
            <span className="stat__label">Combinations</span>
          </div>
        </div>

        {/* CTA Button */}
        <button className="end-card-cta" onClick={handleCTAClick}>
          <span>Book a consultation</span>
          <svg className="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        {/* Footer note */}
        <p className="end-card-footer">
          Secure your bitcoin with institutional-grade custody
        </p>
      </div>
    </div>
  )
}

export default EndCardOverlay
