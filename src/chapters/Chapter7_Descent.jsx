import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Warp streaks - speed lines converging on center
function WarpStreaks({ weight = 1 }) {
  const groupRef = useRef()
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 400
    const positions = new Float32Array(count * 6) // Line segments
    const colors = new Float32Array(count * 6)

    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 180
      const theta = Math.random() * Math.PI * 2
      const length = 20 + Math.random() * 60
      const z = Math.random() * 500 - 250

      const x = Math.cos(theta) * r
      const y = Math.sin(theta) * r

      // Start point (far)
      positions[i * 6] = x
      positions[i * 6 + 1] = y
      positions[i * 6 + 2] = z

      // End point (closer to center)
      const convergeFactor = 0.85
      positions[i * 6 + 3] = x * convergeFactor
      positions[i * 6 + 4] = y * convergeFactor
      positions[i * 6 + 5] = z + length

      // Blue-white gradient
      const brightness = 0.5 + Math.random() * 0.5
      colors[i * 6] = 0.4 * brightness
      colors[i * 6 + 1] = 0.7 * brightness
      colors[i * 6 + 2] = 1.0 * brightness
      colors[i * 6 + 3] = 0.8 * brightness
      colors[i * 6 + 4] = 0.9 * brightness
      colors[i * 6 + 5] = 1.0 * brightness
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.15
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.5 * weight
    }
  })

  return (
    <group ref={groupRef} visible={weight > 0.001}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          ref={materialRef}
          vertexColors
          transparent
          opacity={0.5 * weight}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  )
}

// Central target beacon
function DescentBeacon({ weight = 1 }) {
  const outerRef = useRef()
  const innerRef = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (outerRef.current) {
      outerRef.current.rotation.z = time * 0.4
    }
    if (innerRef.current) {
      const pulse = 0.9 + Math.sin(time * 4) * 0.15
      innerRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group visible={weight > 0.001}>
      {/* Outer ring */}
      <group ref={outerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[35, 42, 6]} />
          <meshBasicMaterial
            color="#6699ff"
            transparent
            opacity={0.5 * weight}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Inner pulsing core */}
      <group ref={innerRef}>
        <mesh>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.95 * weight}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[8, 16, 16]} />
          <meshBasicMaterial
            color="#eeeeff"
            transparent
            opacity={0.3 * weight}
          />
        </mesh>
      </group>
    </group>
  )
}

// Background stars (fading as we descend)
function DescentStars({ weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 2000
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 400 + Math.random() * 400
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.6 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        color="#aabbdd"
        size={1.2}
        sizeAttenuation={false}
        transparent
        opacity={0.6 * weight}
      />
    </points>
  )
}

// Main Chapter 7 scene
export function Chapter7_Descent() {
  const weight = useChapterWeight(7)

  // Weight-only gating
  if (weight < 0.001) return null

  return (
    <group visible={weight > 0.001}>
      <DescentStars weight={weight} />
      <WarpStreaks weight={weight} />
      <DescentBeacon weight={weight} />

      <ambientLight intensity={0.06 * weight} color="#8090b0" />
    </group>
  )
}

export default Chapter7_Descent
