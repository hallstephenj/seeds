import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, CHAPTERS } from './store'

// Easing functions
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4)
const easeInOutQuint = (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

// Damping helper - critically damped spring approximation
function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

function dampVector3(current, target, lambda, dt) {
  current.x = damp(current.x, target.x, lambda, dt)
  current.y = damp(current.y, target.y, lambda, dt)
  current.z = damp(current.z, target.z, lambda, dt)
}

// Chapter camera configurations - single motion per chapter
const CAMERA_PATHS = {
  1: {
    points: [
      { pos: [0, 5, 80], target: [0, 0, 0], fov: 60 },
      { pos: [0, 80, 300], target: [0, 0, 0], fov: 55 },
    ],
    damping: 3,
    microMotion: 0.15,
  },
  2: {
    points: [
      { pos: [0, 80, 300], target: [0, 0, 0], fov: 55 },
      { pos: [0, 160, 500], target: [0, 0, 0], fov: 50 },
    ],
    damping: 2.5,
    microMotion: 0.1,
  },
  3: {
    points: [
      { pos: [0, 160, 500], target: [0, 0, 0], fov: 50 },
      { pos: [0, 280, 700], target: [0, 0, 0], fov: 45 },
    ],
    damping: 2,
    microMotion: 0.05,
  },
  4: {
    points: [
      { pos: [0, 280, 700], target: [0, 0, 0], fov: 45 },
      { pos: [0, 420, 850], target: [0, 0, 0], fov: 50 },
    ],
    damping: 1.8,
    microMotion: 0.02,
  },
  5: {
    points: [
      { pos: [0, 420, 850], target: [0, 0, 0], fov: 50 },
      { pos: [0, 530, 1050], target: [0, 0, 0], fov: 55 },
    ],
    damping: 1.5,
    microMotion: 0.01,
  },
  6: {
    points: [
      { pos: [0, 530, 1050], target: [0, 0, 0], fov: 55 },
      { pos: [0, 490, 950], target: [0, 0, 0], fov: 45 },
    ],
    damping: 1.2,
    microMotion: 0.005,
  },
  7: {
    points: [
      { pos: [0, 490, 950], target: [0, 0, 0], fov: 45 },
      { pos: [0, 30, 60], target: [0, 0, 0], fov: 55 },
    ],
    damping: 2.5,
    microMotion: 0.08,
  },
  8: {
    points: [
      { pos: [0, 30, 60], target: [0, 0, 0], fov: 55 },
      { pos: [0, 0.8, 3], target: [0, 0, 0], fov: 45 },
    ],
    damping: 3,
    microMotion: 0.2,
  },
  9: {
    points: [
      { pos: [0, 0.8, 3], target: [0, 0, 0], fov: 45 },
      { pos: [2, 0.8, 2], target: [0, 0, 0], fov: 40 },
    ],
    damping: 4,
    microMotion: 0.02,
  },
  10: {
    points: [
      { pos: [2, 0.8, 2], target: [0, 0, 0], fov: 40 },
      { pos: [0.3, 0.4, 1.5], target: [0, 0, 0], fov: 35 },
    ],
    damping: 5,
    microMotion: 0,
  },
}

// Interpolate along path points using Catmull-Rom-like smoothing
function getPathValue(points, t, key) {
  const n = points.length - 1
  const scaledT = t * n
  const i = Math.min(Math.floor(scaledT), n - 1)
  const localT = scaledT - i

  const eased = easeInOutQuint(localT)

  if (Array.isArray(points[i][key])) {
    return points[i][key].map((v, idx) =>
      v + (points[i + 1][key][idx] - v) * eased
    )
  }
  return points[i][key] + (points[i + 1][key] - points[i][key]) * eased
}

export function CinematicCamera() {
  const { camera } = useThree()
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const isPlaying = useStore((s) => s.isPlaying)
  const setScale = useStore((s) => s.setScale)
  const setDistanceTraveled = useStore((s) => s.setDistanceTraveled)

  // Smooth state
  const smoothPos = useRef(new THREE.Vector3(0, 5, 80))
  const smoothTarget = useRef(new THREE.Vector3(0, 0, 0))
  const smoothFov = useRef(60)
  const noiseOffset = useRef({ x: Math.random() * 1000, y: Math.random() * 1000 })

  // Target values for damping
  const targetPos = useRef(new THREE.Vector3())
  const targetTarget = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const path = CAMERA_PATHS[currentChapter] || CAMERA_PATHS[1]
    const t = easeOutQuart(chapterProgress)

    // Get interpolated values along path
    const pos = getPathValue(path.points, t, 'pos')
    const target = getPathValue(path.points, t, 'target')
    const fov = getPathValue(path.points, t, 'fov')

    targetPos.current.set(pos[0], pos[1], pos[2])
    targetTarget.current.set(target[0], target[1], target[2])

    // Add subtle micro-motion (procedural noise)
    if (path.microMotion > 0 && isPlaying) {
      const time = state.clock.elapsedTime
      const noiseScale = 0.5
      const noiseX = Math.sin(time * noiseScale + noiseOffset.current.x) * path.microMotion
      const noiseY = Math.cos(time * noiseScale * 1.3 + noiseOffset.current.y) * path.microMotion * 0.7
      const noiseZ = Math.sin(time * noiseScale * 0.8 + noiseOffset.current.x * 0.5) * path.microMotion * 0.5

      targetPos.current.x += noiseX
      targetPos.current.y += noiseY
      targetPos.current.z += noiseZ
    }

    // Apply damping for smooth, heavy camera feel
    const dampingFactor = path.damping
    const dt = Math.min(delta, 0.1) // Cap delta to prevent jumps

    dampVector3(smoothPos.current, targetPos.current, dampingFactor, dt)
    dampVector3(smoothTarget.current, targetTarget.current, dampingFactor * 1.5, dt)
    smoothFov.current = damp(smoothFov.current, fov, dampingFactor * 2, dt)

    // Apply to camera
    camera.position.copy(smoothPos.current)
    camera.lookAt(smoothTarget.current)
    camera.fov = smoothFov.current
    camera.updateProjectionMatrix()

    // Update scale display
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

export default CinematicCamera
