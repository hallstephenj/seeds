import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, CHAPTERS, TOTAL_DURATION } from './store'

// Unified starfield that persists across chapters with varying density/intensity
export function UnifiedStarfield() {
  const globalTime = useStore((s) => s.globalTime)
  const chapterWeights = useStore((s) => s.chapterWeights)
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 8000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Distribute in a large sphere
      const r = 600 + Math.random() * 600
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Color temperature variation - desaturated, neutral palette
      // Reduced color variation for premium, restrained look
      const temp = Math.random()
      const brightness = 0.55 + Math.random() * 0.45  // Slightly tighter range
      if (temp < 0.25) {
        // Cool white stars (very slight blue tint)
        colors[i * 3] = brightness * 0.96
        colors[i * 3 + 1] = brightness * 0.98
        colors[i * 3 + 2] = brightness
      } else if (temp < 0.75) {
        // Neutral white stars (majority)
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness
        colors[i * 3 + 2] = brightness
      } else {
        // Warm white stars (very subtle warmth)
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness * 0.97
        colors[i * 3 + 2] = brightness * 0.92
      }

      // Size variation
      sizes[i] = 0.5 + Math.random() * 1.5
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [])

  // Compute opacity based on weighted chapter contributions
  useFrame(() => {
    if (!materialRef.current) return

    // Chapters 1-6: full starfield, Chapter 7: fade out, Chapters 8+: very dim
    const w1to6 = (chapterWeights[1] || 0) + (chapterWeights[2] || 0) + (chapterWeights[3] || 0) +
                  (chapterWeights[4] || 0) + (chapterWeights[5] || 0) + (chapterWeights[6] || 0)
    const w7 = chapterWeights[7] || 0
    const w8plus = (chapterWeights[8] || 0) + (chapterWeights[9] || 0) + (chapterWeights[10] || 0)

    // Gentle fade in at start
    const totalProgress = globalTime / TOTAL_DURATION
    const fadeInMult = totalProgress < 0.02 ? totalProgress / 0.02 : 1

    let opacity = Math.min(1, w1to6) * 0.75 + w7 * 0.25 + w8plus * 0.04  // Reduced overall
    opacity *= fadeInMult

    materialRef.current.opacity = Math.max(0, Math.min(0.75, opacity))
  })

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={1.0}             // Reduced from 1.2
        sizeAttenuation={false}
        transparent
        opacity={0.75}         // Reduced from 0.9
        depthWrite={false}
      />
    </points>
  )
}

// Subtle space dust / nebula fog layer for depth
export function SpaceDust() {
  const chapterWeights = useStore((s) => s.chapterWeights)
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 2000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 200 + Math.random() * 800
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Neutral slate - no purple/blue tint, very desaturated
      const brightness = 0.06 + Math.random() * 0.08  // Reduced brightness
      colors[i * 3] = brightness * 0.95     // Near neutral
      colors[i * 3 + 1] = brightness * 0.96
      colors[i * 3 + 2] = brightness * 0.97 // Barely cooler
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame(() => {
    if (!materialRef.current) return

    // Dust visible chapters 2-7, weighted blend
    const w2to6 = (chapterWeights[2] || 0) + (chapterWeights[3] || 0) + (chapterWeights[4] || 0) +
                  (chapterWeights[5] || 0) + (chapterWeights[6] || 0)
    const w7 = chapterWeights[7] || 0

    // Further reduced opacity for premium restrained look
    const opacity = Math.min(1, w2to6) * 0.15 + w7 * 0.06  // Reduced from 0.25/0.1
    materialRef.current.opacity = Math.max(0, opacity)
  })

  // Compute visibility based on any relevant chapter having weight
  const hasWeight = (chapterWeights[2] || 0) + (chapterWeights[3] || 0) + (chapterWeights[4] || 0) +
                    (chapterWeights[5] || 0) + (chapterWeights[6] || 0) + (chapterWeights[7] || 0) > 0.001

  return (
    <points geometry={geometry} visible={hasWeight}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={5}              // Reduced from 6
        sizeAttenuation
        transparent
        opacity={0.15}        // Reduced from 0.25
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Parallax dust layer for movement depth cue
export function ParallaxDust() {
  const chapterWeights = useStore((s) => s.chapterWeights)
  const groupRef = useRef()
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 500
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 400
      positions[i * 3 + 1] = (Math.random() - 0.5) * 400
      positions[i * 3 + 2] = (Math.random() - 0.5) * 400
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!groupRef.current || !materialRef.current) return

    // Subtle rotation for parallax effect
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.01
    groupRef.current.rotation.x = state.clock.elapsedTime * 0.005

    // Weighted opacity for chapters 3-6 (further reduced)
    const w3to6 = (chapterWeights[3] || 0) + (chapterWeights[4] || 0) +
                  (chapterWeights[5] || 0) + (chapterWeights[6] || 0)
    const opacity = Math.min(1, w3to6) * 0.07  // Reduced from 0.12
    materialRef.current.opacity = Math.max(0, opacity)
  })

  // Compute visibility based on any relevant chapter having weight
  const hasWeight = (chapterWeights[3] || 0) + (chapterWeights[4] || 0) +
                    (chapterWeights[5] || 0) + (chapterWeights[6] || 0) + (chapterWeights[7] || 0) > 0.001

  return (
    <group ref={groupRef} visible={hasWeight}>
      <points geometry={geometry}>
        <pointsMaterial
          ref={materialRef}
          color="#8a8f96"       // More neutral gray (was #7a8899 - too blue)
          size={1.2}           // Reduced from 1.5
          sizeAttenuation
          transparent
          opacity={0.07}       // Reduced from 0.12
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

// Main environment wrapper
export function SpaceEnvironment() {
  return (
    <>
      <UnifiedStarfield />
      <SpaceDust />
      <ParallaxDust />
    </>
  )
}

export default SpaceEnvironment
