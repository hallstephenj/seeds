import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

const GALAXY_RADIUS = 400
const GALAXY_THICKNESS = 25
const CORE_RADIUS = 55

// Spiral arm particles with safe buffer pattern
export function SpiralArms({ count = 80000, weight = 1 }) {
  const pointsRef = useRef()
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const numArms = 4
    const armSpread = 0.25

    for (let i = 0; i < count; i++) {
      const armIndex = i % numArms
      const t = (i / count) * 3.5

      const baseAngle = (armIndex / numArms) * Math.PI * 2
      const a = GALAXY_RADIUS * 0.08
      const b = 0.28
      const theta = t * Math.PI * 2 + baseAngle

      let r = a * Math.exp(b * t)
      r = Math.min(r, GALAXY_RADIUS)

      r += (Math.random() - 0.5) * r * armSpread
      const angleOffset = (Math.random() - 0.5) * armSpread

      const heightFactor = 1 - Math.pow(r / GALAXY_RADIUS, 0.5)
      const height = (Math.random() - 0.5) * GALAXY_THICKNESS * heightFactor

      positions[i * 3] = Math.cos(theta + angleOffset) * r
      positions[i * 3 + 1] = height
      positions[i * 3 + 2] = Math.sin(theta + angleOffset) * r

      // Colors: young blue stars in arms, older yellow between
      const inArm = Math.random() < 0.65
      const brightness = 0.7 + Math.random() * 0.3
      if (inArm) {
        colors[i * 3] = 0.7 * brightness
        colors[i * 3 + 1] = 0.85 * brightness
        colors[i * 3 + 2] = brightness
      } else {
        colors[i * 3] = brightness
        colors[i * 3 + 1] = 0.85 * brightness
        colors[i * 3 + 2] = 0.55 * brightness
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count])

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.015
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.75 * weight
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.75 * weight}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Galactic core with volumetric glow
export function GalacticCore({ weight = 1 }) {
  const coreRef = useRef()
  const materialRef = useRef()

  const coreMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 1 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        void main() {
          float dist = length(vPosition) / ${CORE_RADIUS.toFixed(1)};

          // Core glow gradient
          vec3 centerColor = vec3(1.0, 0.98, 0.92);
          vec3 midColor = vec3(1.0, 0.85, 0.6);
          vec3 edgeColor = vec3(1.0, 0.6, 0.25);

          vec3 color = mix(centerColor, midColor, smoothstep(0.0, 0.5, dist));
          color = mix(color, edgeColor, smoothstep(0.5, 1.0, dist));

          // Density falloff
          float alpha = smoothstep(1.0, 0.0, dist);
          alpha = alpha * alpha * 0.9;

          // Fresnel edge darkening for volume feel
          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          alpha *= (1.0 - fresnel * 0.3);

          gl_FragColor = vec4(color, alpha * opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  useFrame((state, delta) => {
    if (coreMaterial.uniforms) {
      coreMaterial.uniforms.time.value = state.clock.elapsedTime
      coreMaterial.uniforms.opacity.value = weight
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.008
    }
  })

  return (
    <mesh ref={coreRef} visible={weight > 0.001}>
      <sphereGeometry args={[CORE_RADIUS, 64, 64]} />
      <primitive object={coreMaterial} ref={materialRef} />
    </mesh>
  )
}

// Globular clusters in halo
export function GlobularClusters({ count = 35, weight = 1 }) {
  const clusters = useMemo(() => {
    return Array.from({ length: count }, () => {
      const r = GALAXY_RADIUS * (0.6 + Math.random() * 1.2)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      return {
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ],
        size: 2 + Math.random() * 2.5
      }
    })
  }, [count])

  return (
    <group visible={weight > 0.001}>
      {clusters.map((cluster, i) => (
        <mesh key={i} position={cluster.position}>
          <sphereGeometry args={[cluster.size, 8, 8]} />
          <meshBasicMaterial
            color="#ffffd8"
            transparent
            opacity={0.5 * weight}
          />
        </mesh>
      ))}
    </group>
  )
}

// Dust lanes (subtle dark regions)
export function DustLanes({ weight = 1 }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 5000
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const armIndex = i % 2
      const t = (i / count) * 2.5
      const baseAngle = (armIndex / 2) * Math.PI * 2 + Math.PI / 4

      const a = GALAXY_RADIUS * 0.1
      const b = 0.28
      const theta = t * Math.PI * 2 + baseAngle

      let r = a * Math.exp(b * t) - 5
      r = Math.max(20, Math.min(r, GALAXY_RADIUS * 0.9))
      r += (Math.random() - 0.5) * 15

      positions[i * 3] = Math.cos(theta) * r
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3
      positions[i * 3 + 2] = Math.sin(theta) * r
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        color="#221810"
        size={3}
        sizeAttenuation
        transparent
        opacity={0.15 * weight}
        depthWrite={false}
      />
    </points>
  )
}

// Main Chapter 4 scene
export function Chapter4_Galaxy() {
  const weight = useChapterWeight(4)

  // Weight-only gating
  if (weight < 0.001) return null

  return (
    <group visible={weight > 0.001}>
      {/* Offset galaxy so the sun (at origin) appears in the spiral arms */}
      <group position={[72, 0, 36]}>
        <GalacticCore weight={weight} />
        <SpiralArms count={70000} weight={weight} />
        <DustLanes weight={weight} />
        <GlobularClusters count={30} weight={weight} />
      </group>

      <ambientLight intensity={0.015 * weight} color="#a0b0c0" />
    </group>
  )
}

export default Chapter4_Galaxy
