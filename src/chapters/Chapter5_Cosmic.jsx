import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Galaxy field with safe buffer pattern
export function GalaxyField({ count = 40000, radius = 500, weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      // Filament clustering
      const clusterFactor = Math.sin(theta * 3) * Math.sin(phi * 4) * 0.3

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * (1 + clusterFactor)
      positions[i * 3 + 1] = r * Math.cos(phi) * (1 + clusterFactor * 0.5)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * (1 + clusterFactor)

      const type = Math.random()
      if (type < 0.3) {
        // Elliptical (yellow-gold)
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.88
        colors[i * 3 + 2] = 0.65
      } else if (type < 0.7) {
        // Spiral (blue-white)
        colors[i * 3] = 0.75
        colors[i * 3 + 1] = 0.88
        colors[i * 3 + 2] = 1.0
      } else {
        // Irregular
        colors[i * 3] = 0.9
        colors[i * 3 + 1] = 0.85
        colors[i * 3 + 2] = 0.95
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count, radius])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.75 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={1.3}
        sizeAttenuation
        transparent
        opacity={0.75 * weight}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Cosmic web filaments with safe buffer pattern
export function CosmicFilaments({ count = 250, radius = 400, weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const nodes = []
    const nodeCount = 120

    for (let i = 0; i < nodeCount; i++) {
      const r = radius * Math.cbrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      nodes.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      ))
    }

    const segments = []
    const maxDist = radius * 0.35

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].distanceTo(nodes[j])
        if (dist < maxDist && segments.length < count) {
          segments.push({ from: nodes[i], to: nodes[j], dist })
        }
      }
    }

    const positions = new Float32Array(segments.length * 6)
    const colors = new Float32Array(segments.length * 6)

    segments.forEach((seg, i) => {
      positions[i * 6] = seg.from.x
      positions[i * 6 + 1] = seg.from.y
      positions[i * 6 + 2] = seg.from.z
      positions[i * 6 + 3] = seg.to.x
      positions[i * 6 + 4] = seg.to.y
      positions[i * 6 + 5] = seg.to.z

      const brightness = 0.25 + (1 - seg.dist / maxDist) * 0.35
      colors[i * 6] = 0.35 * brightness
      colors[i * 6 + 1] = 0.4 * brightness
      colors[i * 6 + 2] = 0.9 * brightness
      colors[i * 6 + 3] = 0.35 * brightness
      colors[i * 6 + 4] = 0.4 * brightness
      colors[i * 6 + 5] = 0.9 * brightness
    })

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count, radius])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.35 * weight
    }
  })

  return (
    <lineSegments geometry={geometry} visible={weight > 0.001}>
      <lineBasicMaterial
        ref={materialRef}
        vertexColors
        transparent
        opacity={0.35 * weight}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

// Galaxy clusters
export function GalaxyClusters({ weight = 1 }) {
  const clusters = useMemo(() => [
    { name: 'Local Group', position: [0, 0, 0], size: 18 },
    { name: 'Virgo', position: [130, 25, 55], size: 45 },
    { name: 'Coma', position: [-110, 45, -90], size: 40 },
    { name: 'Perseus', position: [90, -35, 110], size: 35 }
  ], [])

  return (
    <group visible={weight > 0.001}>
      {clusters.map((cluster) => (
        <group key={cluster.name} position={cluster.position}>
          <mesh>
            <sphereGeometry args={[cluster.size, 32, 32]} />
            <meshBasicMaterial
              color="#ffcc88"
              transparent
              opacity={0.15 * weight}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <ClusterParticles count={400} size={cluster.size} weight={weight} />
        </group>
      ))}
    </group>
  )
}

function ClusterParticles({ count, size, weight }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const u = Math.random()
      const v = Math.random()
      const r = size * Math.sqrt(-2 * Math.log(u)) * 0.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = Math.min(r, size) * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.min(r, size) * Math.cos(phi)
      positions[i * 3 + 2] = Math.min(r, size) * Math.sin(phi) * Math.sin(theta)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count, size])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.7 * weight
    }
  })

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        color="#ffffd8"
        size={0.8}
        sizeAttenuation
        transparent
        opacity={0.7 * weight}
      />
    </points>
  )
}

// CMB background
export function CMBBackground({ weight = 1 }) {
  const materialRef = useRef()

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 1 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec2 vUv;

        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          float n = noise(vUv * 80.0);
          n += noise(vUv * 160.0) * 0.5;
          n += noise(vUv * 320.0) * 0.25;
          n = n / 1.75;

          vec3 cold = vec3(0.08, 0.08, 0.22);
          vec3 hot = vec3(0.22, 0.08, 0.08);
          vec3 color = mix(cold, hot, n);

          gl_FragColor = vec4(color, 0.12 * opacity);
        }
      `,
      side: THREE.BackSide,
      transparent: true
    })
  }, [])

  useFrame(() => {
    if (material.uniforms) {
      material.uniforms.opacity.value = weight
    }
  })

  return (
    <mesh visible={weight > 0.001}>
      <sphereGeometry args={[950, 64, 64]} />
      <primitive object={material} ref={materialRef} />
    </mesh>
  )
}

// Main Chapter 5 scene
export function Chapter5_Cosmic() {
  const currentChapter = useStore((s) => s.currentChapter)
  const weight = useChapterWeight(5)

  if (currentChapter < 4 || currentChapter > 6) return null

  return (
    <group visible={weight > 0.001}>
      <GalaxyField count={35000} radius={550} weight={weight} />
      <CosmicFilaments count={200} radius={450} weight={weight} />
      <GalaxyClusters weight={weight} />
      <CMBBackground weight={weight} />

      <ambientLight intensity={0.015 * weight} color="#8090b0" />
    </group>
  )
}

export default Chapter5_Cosmic
