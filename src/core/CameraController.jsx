import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, CHAPTERS } from './store'

// Easing functions
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Camera waypoints - single smooth movement per chapter
// Each chapter has just start and end positions
const CHAPTER_WAYPOINTS = {
  1: { // Liftoff - rise from surface to orbit
    start: { pos: [0, 5, 80], target: [0, 0, 0] },
    end: { pos: [0, 100, 350], target: [0, 0, 0] }
  },
  2: { // Solar System - zoom out through solar system
    start: { pos: [0, 100, 350], target: [0, 0, 0] },
    end: { pos: [0, 180, 550], target: [0, 0, 0] }
  },
  3: { // Interstellar - zoom out into interstellar space
    start: { pos: [0, 180, 550], target: [0, 0, 0] },
    end: { pos: [0, 300, 750], target: [0, 0, 0] }
  },
  4: { // Galactic - pull back to see galaxy
    start: { pos: [0, 300, 750], target: [0, 0, 0] },
    end: { pos: [0, 450, 900], target: [0, 0, 0] }
  },
  5: { // Cosmic - zoom out to see universe
    start: { pos: [0, 450, 900], target: [0, 0, 0] },
    end: { pos: [0, 550, 1100], target: [0, 0, 0] }
  },
  6: { // Selection - pause and select
    start: { pos: [0, 550, 1100], target: [0, 0, 0] },
    end: { pos: [0, 500, 1000], target: [0, 0, 0] }
  },
  7: { // Descent - zoom back in
    start: { pos: [0, 500, 1000], target: [0, 0, 0] },
    end: { pos: [0, 20, 50], target: [0, 0, 0] }
  },
  8: { // Into Matter - dive to atomic scale
    start: { pos: [0, 20, 50], target: [0, 0, 0] },
    end: { pos: [0, 0.5, 2], target: [0, 0, 0] }
  },
  9: { // Reveal - orbit the atom
    start: { pos: [0, 0.5, 2], target: [0, 0, 0] },
    end: { pos: [2, 1, 2], target: [0, 0, 0] }
  },
  10: { // End Card - settle into final view
    start: { pos: [2, 1, 2], target: [0, 0, 0] },
    end: { pos: [0.3, 0.5, 1.5], target: [0, 0, 0] }
  }
}

export function CameraController() {
  const { camera } = useThree()
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const isPlaying = useStore((s) => s.isPlaying)
  const setScale = useStore((s) => s.setScale)
  const setDistanceTraveled = useStore((s) => s.setDistanceTraveled)

  const posRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!isPlaying) return

    const waypoint = CHAPTER_WAYPOINTS[currentChapter] || CHAPTER_WAYPOINTS[1]
    const t = easeInOutCubic(chapterProgress)

    const { start, end } = waypoint

    // Single smooth interpolation from start to end
    posRef.current.set(
      start.pos[0] + (end.pos[0] - start.pos[0]) * t,
      start.pos[1] + (end.pos[1] - start.pos[1]) * t,
      start.pos[2] + (end.pos[2] - start.pos[2]) * t
    )

    targetRef.current.set(
      start.target[0] + (end.target[0] - start.target[0]) * t,
      start.target[1] + (end.target[1] - start.target[1]) * t,
      start.target[2] + (end.target[2] - start.target[2]) * t
    )

    // Update camera
    camera.position.copy(posRef.current)
    camera.lookAt(targetRef.current)

    // Update scale display (simulated based on chapter)
    const chapter = CHAPTERS[currentChapter - 1]
    if (chapter) {
      const logStart = Math.log10(chapter.scaleStart)
      const logEnd = Math.log10(chapter.scaleEnd)
      const currentLog = logStart + (logEnd - logStart) * t
      const scale = Math.pow(10, currentLog)
      setScale(scale)
      setDistanceTraveled(scale)
    }
  })

  return null
}

export default CameraController
