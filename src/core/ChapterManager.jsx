import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore, CHAPTERS, NARRATIVE } from './store'

// Manages chapter progression and narrative timing
export function ChapterManager() {
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const isPlaying = useStore((s) => s.isPlaying)
  const setChapterProgress = useStore((s) => s.setChapterProgress)
  const setNarrativeText = useStore((s) => s.setNarrativeText)
  const nextChapter = useStore((s) => s.nextChapter)

  const chapterStartTime = useRef(0)
  const lastNarrativeIndex = useRef(-1)

  // Reset when chapter changes
  useEffect(() => {
    chapterStartTime.current = 0
    lastNarrativeIndex.current = -1
    // Clear narrative text to prevent lingering text from previous chapter
    setNarrativeText('')
  }, [currentChapter, setNarrativeText])

  useFrame((state, delta) => {
    if (!isPlaying) return

    const chapter = CHAPTERS[currentChapter - 1]
    if (!chapter) return

    // Update elapsed time
    chapterStartTime.current += delta

    // Calculate progress (0 to 1)
    const progress = Math.min(chapterStartTime.current / chapter.duration, 1)
    setChapterProgress(progress)

    // Update narrative text based on timing
    const narrativeEntries = NARRATIVE[currentChapter] || []
    const elapsedSeconds = chapterStartTime.current

    // Find the most recent narrative entry
    let currentNarrativeIndex = -1
    for (let i = narrativeEntries.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= narrativeEntries[i].time) {
        currentNarrativeIndex = i
        break
      }
    }

    // Update text if changed
    if (currentNarrativeIndex !== lastNarrativeIndex.current) {
      lastNarrativeIndex.current = currentNarrativeIndex
      if (currentNarrativeIndex >= 0) {
        setNarrativeText(narrativeEntries[currentNarrativeIndex].text)
      }
    }

    // Auto-advance to next chapter
    if (progress >= 1) {
      if (currentChapter < CHAPTERS.length) {
        chapterStartTime.current = 0
        nextChapter()
      }
    }
  })

  return null
}

export default ChapterManager
