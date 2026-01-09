import { useState, useEffect } from 'react'
import { useStore, TOTAL_DURATION, CHAPTERS } from '../core/store'
import logoImage from '/logo.png'
import './EndCardOverlay.css'

// Single paper sheet component
const SeedPhraseSheet = ({ side, delay = 0 }) => {
  const words = Array.from({ length: 12 }, (_, i) => i + 1 + (side === 'right' ? 12 : 0))

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

export function EndCardOverlay() {
  const globalTime = useStore((s) => s.globalTime)
  const [visible, setVisible] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)

  // Find chapter 10 start time
  const chapter10 = CHAPTERS.find(c => c.id === 10)
  const ch10Start = chapter10?.start || (TOTAL_DURATION - 4)

  // Show overlay when we're ~66% into chapter 10 (let "Because that atom..." linger)
  const showTime = ch10Start + (chapter10?.duration || 4) * 0.66

  useEffect(() => {
    if (globalTime >= showTime) {
      setVisible(true)
      // Stagger content appearance
      setTimeout(() => setContentVisible(true), 300)
    } else {
      setVisible(false)
      setContentVisible(false)
    }
  }, [globalTime, showTime])

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
