import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore, CHAPTERS, NARRATIVE_CUES, TOTAL_DURATION } from './store'

// Transition timing configuration
const BLEND_WINDOW = 0.18 // 18% overlap at chapter boundaries
const FADE_CURVE = (t) => t * t * (3 - 2 * t) // smoothstep

// Clamp helper
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// Compute local progress for a chapter given global time
function getLocalProgress(chapter, globalTime) {
  if (globalTime < chapter.start) return 0
  if (globalTime >= chapter.end) return 1
  return (globalTime - chapter.start) / chapter.duration
}

// Compute weight for a single chapter based on its local progress
// Weight ramps in during first BLEND_WINDOW, stays at 1, ramps out during last BLEND_WINDOW
function computeChapterWeight(localProgress) {
  const bw = BLEND_WINDOW

  // Fade in: 0 at start, 1 at bw
  const fadeIn = localProgress < bw
    ? FADE_CURVE(localProgress / bw)
    : 1

  // Fade out: 1 until (1-bw), then 0 at 1
  const fadeOut = localProgress > (1 - bw)
    ? FADE_CURVE((1 - localProgress) / bw)
    : 1

  return fadeIn * fadeOut
}

// Compute all chapter weights for a given global time
export function computeAllWeights(globalTime) {
  const weights = {}
  const localProgresses = {}
  let sumWeights = 0

  for (const chapter of CHAPTERS) {
    const localProgress = getLocalProgress(chapter, globalTime)
    localProgresses[chapter.id] = localProgress

    // Only compute weight if chapter is active (localProgress in (0, 1))
    if (localProgress > 0 && localProgress < 1) {
      const weight = computeChapterWeight(localProgress)
      weights[chapter.id] = weight
      sumWeights += weight
    } else if (localProgress >= 1) {
      // Fully past this chapter
      weights[chapter.id] = 0
    } else {
      // Not yet reached this chapter
      weights[chapter.id] = 0
    }
  }

  // Handle edge case at very start (chapter 1 should be visible)
  if (globalTime < CHAPTERS[0].duration * BLEND_WINDOW) {
    weights[1] = Math.max(weights[1] || 0, FADE_CURVE(globalTime / (CHAPTERS[0].duration * BLEND_WINDOW)))
    sumWeights = weights[1]
  }

  // Handle edge case at very end (chapter 10 should stay visible)
  if (globalTime >= CHAPTERS[9].start) {
    const ch10Progress = getLocalProgress(CHAPTERS[9], globalTime)
    // Keep chapter 10 at full weight once we're in it, fade in at start
    const fadeIn = ch10Progress < BLEND_WINDOW
      ? FADE_CURVE(ch10Progress / BLEND_WINDOW)
      : 1
    weights[10] = fadeIn
    sumWeights = weights[10]
  }

  // Normalize weights if sum > 0 (prevents brightness fluctuations)
  if (sumWeights > 0) {
    for (const id in weights) {
      weights[id] /= sumWeights
    }
  }

  return { weights, localProgresses }
}

// Hook to get current chapter weight (reads from store)
export function useChapterWeight(chapterId) {
  const weights = useStore((s) => s.chapterWeights)
  return weights[chapterId] || 0
}

// Hook to get local progress for a chapter
export function useChapterLocalProgress(chapterId) {
  const localProgresses = useStore((s) => s.chapterLocalProgress)
  return localProgresses[chapterId] || 0
}

// Manages global timeline progression and narrative timing
export function TransitionController() {
  const globalTime = useStore((s) => s.globalTime)
  const isPlaying = useStore((s) => s.isPlaying)
  const advanceTime = useStore((s) => s.advanceTime)
  const setChapterWeights = useStore((s) => s.setChapterWeights)
  const setChapterLocalProgress = useStore((s) => s.setChapterLocalProgress)
  const setNarrativeText = useStore((s) => s.setNarrativeText)
  const setScale = useStore((s) => s.setScale)

  const lastNarrativeIndex = useRef(-1)
  const prevNarrativeText = useRef('')

  useFrame((state, delta) => {
    // Cap delta to prevent jumps on tab focus
    const cappedDelta = Math.min(delta, 0.1)

    // Advance global time if playing
    if (isPlaying) {
      advanceTime(cappedDelta)
    }

    // Get current global time (may have just been updated)
    const currentTime = useStore.getState().globalTime

    // Compute all chapter weights and local progresses
    const { weights, localProgresses } = computeAllWeights(currentTime)
    setChapterWeights(weights)
    setChapterLocalProgress(localProgresses)

    // Compute blended scale (in log space for smooth transitions)
    let blendedLogScale = 0
    let totalWeight = 0

    for (const chapter of CHAPTERS) {
      const weight = weights[chapter.id] || 0
      if (weight > 0.001) {
        const localProgress = localProgresses[chapter.id] || 0
        const logStart = Math.log10(chapter.scaleStart)
        const logEnd = Math.log10(chapter.scaleEnd)
        const logScale = logStart + (logEnd - logStart) * localProgress
        blendedLogScale += logScale * weight
        totalWeight += weight
      }
    }

    if (totalWeight > 0) {
      blendedLogScale /= totalWeight
      const scale = Math.pow(10, blendedLogScale)
      setScale(scale)
    }

    // Handle narrative cues based on absolute time
    let currentNarrativeIndex = -1
    for (let i = NARRATIVE_CUES.length - 1; i >= 0; i--) {
      if (currentTime >= NARRATIVE_CUES[i].time) {
        currentNarrativeIndex = i
        break
      }
    }

    if (currentNarrativeIndex !== lastNarrativeIndex.current) {
      lastNarrativeIndex.current = currentNarrativeIndex
      const newText = currentNarrativeIndex >= 0 ? NARRATIVE_CUES[currentNarrativeIndex].text : ''

      if (newText !== prevNarrativeText.current) {
        prevNarrativeText.current = newText
        setNarrativeText(newText)
      }
    }

    // Clear narrative near the very end
    if (currentTime > TOTAL_DURATION - 1) {
      if (prevNarrativeText.current !== '') {
        prevNarrativeText.current = ''
        setNarrativeText('')
      }
    }
  })

  return null
}

export default TransitionController
