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

// Sample a chapter's camera path at a given local progress
function samplePath(chapterId, localProgress) {
  const path = CAMERA_PATHS[chapterId]
  if (!path) return null

  const t = easeOutQuart(localProgress)
  const p0 = path.points[0]
  const p1 = path.points[1]

  return {
    pos: [
      p0.pos[0] + (p1.pos[0] - p0.pos[0]) * t,
      p0.pos[1] + (p1.pos[1] - p0.pos[1]) * t,
      p0.pos[2] + (p1.pos[2] - p0.pos[2]) * t,
    ],
    target: [
      p0.target[0] + (p1.target[0] - p0.target[0]) * t,
      p0.target[1] + (p1.target[1] - p0.target[1]) * t,
      p0.target[2] + (p1.target[2] - p0.target[2]) * t,
    ],
    fov: p0.fov + (p1.fov - p0.fov) * t,
    damping: path.damping,
    microMotion: path.microMotion,
  }
}

export function CinematicCamera() {
  const { camera } = useThree()
  const chapterWeights = useStore((s) => s.chapterWeights)
  const chapterLocalProgress = useStore((s) => s.chapterLocalProgress)
  const isPlaying = useStore((s) => s.isPlaying)

  // Smooth state
  const smoothPos = useRef(new THREE.Vector3(0, 5, 80))
  const smoothTarget = useRef(new THREE.Vector3(0, 0, 0))
  const smoothFov = useRef(60)
  const noiseOffset = useRef({ x: Math.random() * 1000, y: Math.random() * 1000 })

  // Target values for damping
  const targetPos = useRef(new THREE.Vector3())
  const targetTarget = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    // Sample each chapter's camera path and blend based on weights
    let blendedPos = [0, 0, 0]
    let blendedTarget = [0, 0, 0]
    let blendedFov = 0
    let blendedDamping = 0
    let blendedMicroMotion = 0
    let totalWeight = 0

    for (const chapter of CHAPTERS) {
      const weight = chapterWeights[chapter.id] || 0
      if (weight < 0.001) continue

      const localProgress = chapterLocalProgress[chapter.id] || 0
      const sample = samplePath(chapter.id, localProgress)
      if (!sample) continue

      blendedPos[0] += sample.pos[0] * weight
      blendedPos[1] += sample.pos[1] * weight
      blendedPos[2] += sample.pos[2] * weight

      blendedTarget[0] += sample.target[0] * weight
      blendedTarget[1] += sample.target[1] * weight
      blendedTarget[2] += sample.target[2] * weight

      blendedFov += sample.fov * weight
      blendedDamping += sample.damping * weight
      blendedMicroMotion += sample.microMotion * weight

      totalWeight += weight
    }

    // Normalize by total weight
    if (totalWeight > 0) {
      blendedPos[0] /= totalWeight
      blendedPos[1] /= totalWeight
      blendedPos[2] /= totalWeight

      blendedTarget[0] /= totalWeight
      blendedTarget[1] /= totalWeight
      blendedTarget[2] /= totalWeight

      blendedFov /= totalWeight
      blendedDamping /= totalWeight
      blendedMicroMotion /= totalWeight
    } else {
      // Fallback to chapter 1 start if no weights
      blendedPos = [0, 5, 80]
      blendedTarget = [0, 0, 0]
      blendedFov = 60
      blendedDamping = 3
      blendedMicroMotion = 0.15
    }

    targetPos.current.set(blendedPos[0], blendedPos[1], blendedPos[2])
    targetTarget.current.set(blendedTarget[0], blendedTarget[1], blendedTarget[2])

    // Add subtle micro-motion (procedural noise) to blended target
    if (blendedMicroMotion > 0 && isPlaying) {
      const time = state.clock.elapsedTime
      const noiseScale = 0.5
      const noiseX = Math.sin(time * noiseScale + noiseOffset.current.x) * blendedMicroMotion
      const noiseY = Math.cos(time * noiseScale * 1.3 + noiseOffset.current.y) * blendedMicroMotion * 0.7
      const noiseZ = Math.sin(time * noiseScale * 0.8 + noiseOffset.current.x * 0.5) * blendedMicroMotion * 0.5

      targetPos.current.x += noiseX
      targetPos.current.y += noiseY
      targetPos.current.z += noiseZ
    }

    // Apply damping for smooth, heavy camera feel
    const dampingFactor = Math.max(1, Math.min(5, blendedDamping)) // Clamp to sane range
    const dt = Math.min(delta, 0.1) // Cap delta to prevent jumps

    dampVector3(smoothPos.current, targetPos.current, dampingFactor, dt)
    dampVector3(smoothTarget.current, targetTarget.current, dampingFactor * 1.5, dt)
    smoothFov.current = damp(smoothFov.current, blendedFov, dampingFactor * 2, dt)

    // Apply to camera
    camera.position.copy(smoothPos.current)
    camera.lookAt(smoothTarget.current)
    camera.fov = smoothFov.current
    camera.updateProjectionMatrix()
  })

  return null
}

export default CinematicCamera
