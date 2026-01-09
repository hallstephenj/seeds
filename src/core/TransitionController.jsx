import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore, CHAPTERS, NARRATIVE } from './store'

// Transition timing configuration
const BLEND_WINDOW = 0.18 // 18% overlap at chapter boundaries
const FADE_CURVE = (t) => t * t * (3 - 2 * t) // smoothstep

// Computes blend weights for all chapters
// Crossfade only happens at END of current chapter (fade out current, fade in next)
// No "fade in" at start - new chapter immediately at full weight to avoid discontinuity
export function computeChapterWeights(currentChapter, chapterProgress) {
  const weights = {}

  for (let i = 1; i <= CHAPTERS.length; i++) {
    let weight = 0

    if (i === currentChapter) {
      // Current chapter: full weight, only fade out at the end
      if (chapterProgress > 1 - BLEND_WINDOW && currentChapter < CHAPTERS.length) {
        // Fading out to next chapter
        weight = FADE_CURVE((1 - chapterProgress) / BLEND_WINDOW)
      } else {
        // Full weight throughout (including start)
        weight = 1
      }
    } else if (i === currentChapter + 1 && chapterProgress > 1 - BLEND_WINDOW) {
      // Next chapter fading in at end of current
      weight = FADE_CURVE((chapterProgress - (1 - BLEND_WINDOW)) / BLEND_WINDOW)
    }
    // Previous chapter: weight = 0 (no lingering fade-out at start of new chapter)

    weights[i] = Math.max(0, Math.min(1, weight))
  }

  return weights
}

// Hook to get current chapter weight
export function useChapterWeight(chapterId) {
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)

  const weights = computeChapterWeights(currentChapter, chapterProgress)
  return weights[chapterId] || 0
}

// Manages chapter progression and narrative timing with smooth transitions
export function TransitionController() {
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const isPlaying = useStore((s) => s.isPlaying)
  const setChapterProgress = useStore((s) => s.setChapterProgress)
  const setNarrativeText = useStore((s) => s.setNarrativeText)
  const nextChapter = useStore((s) => s.nextChapter)

  const chapterStartTime = useRef(0)
  const lastNarrativeIndex = useRef(-1)
  const prevNarrativeText = useRef('')

  // Reset on chapter change
  useEffect(() => {
    chapterStartTime.current = 0
    lastNarrativeIndex.current = -1
  }, [currentChapter])

  useFrame((state, delta) => {
    if (!isPlaying) return

    const chapter = CHAPTERS[currentChapter - 1]
    if (!chapter) return

    chapterStartTime.current += delta
    const progress = Math.min(chapterStartTime.current / chapter.duration, 1)
    setChapterProgress(progress)

    // Narrative text with fade timing
    const narrativeEntries = NARRATIVE[currentChapter] || []
    const elapsedSeconds = chapterStartTime.current

    let currentNarrativeIndex = -1
    for (let i = narrativeEntries.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= narrativeEntries[i].time) {
        currentNarrativeIndex = i
        break
      }
    }

    if (currentNarrativeIndex !== lastNarrativeIndex.current) {
      lastNarrativeIndex.current = currentNarrativeIndex
      const newText = currentNarrativeIndex >= 0 ? narrativeEntries[currentNarrativeIndex].text : ''

      if (newText !== prevNarrativeText.current) {
        prevNarrativeText.current = newText
        setNarrativeText(newText)
      }
    }

    // Clear narrative at chapter boundaries for clean transitions
    if (progress > 0.95 && narrativeEntries.length > 0) {
      const lastEntry = narrativeEntries[narrativeEntries.length - 1]
      if (elapsedSeconds > lastEntry.time + 2) {
        setNarrativeText('')
      }
    }

    // Auto-advance
    if (progress >= 1 && currentChapter < CHAPTERS.length) {
      chapterStartTime.current = 0
      nextChapter()
    }
  })

  return null
}

export default TransitionController
