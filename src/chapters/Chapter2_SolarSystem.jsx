import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Normalized planet data
const PLANETS = [
  { name: 'Mercury', distance: 45, radius: 1.5, color: '#8c8c8c', orbitSpeed: 4.15 },
  { name: 'Venus', distance: 75, radius: 3, color: '#e6c89c', orbitSpeed: 1.62 },
  { name: 'Earth', distance: 105, radius: 3.5, color: '#6b93d6', orbitSpeed: 1.0 },
  { name: 'Mars', distance: 145, radius: 2, color: '#c1440e', orbitSpeed: 0.53 },
  { name: 'Jupiter', distance: 230, radius: 14, color: '#d8ca9d', orbitSpeed: 0.084 },
  { name: 'Saturn', distance: 320, radius: 11, color: '#f4d59e', orbitSpeed: 0.034, hasRings: true },
  { name: 'Uranus', distance: 400, radius: 6, color: '#d1e7e7', orbitSpeed: 0.012 },
  { name: 'Neptune', distance: 470, radius: 5.5, color: '#5b5ddf', orbitSpeed: 0.006 }
]

// Sun with corona shader
export function Sun({ weight = 1 }) {
  const materialRef = useRef()
  const sunRadius = 28

  const coronaMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 1 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          fresnel = pow(fresnel, 2.0);

          vec3 innerColor = vec3(1.0, 0.9, 0.6);
          vec3 outerColor = vec3(1.0, 0.5, 0.1);
          vec3 color = mix(innerColor, outerColor, fresnel);

          float alpha = fresnel * 0.6 * opacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  useFrame((state) => {
    if (coronaMaterial.uniforms) {
      coronaMaterial.uniforms.time.value = state.clock.elapsedTime
      coronaMaterial.uniforms.opacity.value = weight
    }
  })

  return (
    <group visible={weight > 0.001}>
      {/* Sun core */}
      <mesh>
        <sphereGeometry args={[sunRadius, 64, 64]} />
        <meshBasicMaterial color="#fff0d0" transparent opacity={weight} />
      </mesh>

      {/* Hot inner layer */}
      <mesh scale={1.02}>
        <sphereGeometry args={[sunRadius, 48, 48]} />
        <meshBasicMaterial
          color="#ffcc44"
          transparent
          opacity={0.5 * weight}
        />
      </mesh>

      {/* Corona */}
      <mesh ref={materialRef} scale={1.5}>
        <sphereGeometry args={[sunRadius, 48, 48]} />
        <primitive object={coronaMaterial} />
      </mesh>

      {/* Point light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={3 * weight}
        distance={1200}
        decay={1.5}
        color="#fff5e0"
      />
    </group>
  )
}

// Orbit ring with proper geometry
function OrbitRing({ distance, weight = 1 }) {
  const geometry = useMemo(() => {
    const points = []
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2
      points.push(new THREE.Vector3(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      ))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [distance])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#ffffff" opacity={0.15 * weight} transparent />
    </line>
  )
}

// Planet with improved materials
export function Planet({ name, distance, radius, color, orbitSpeed, hasRings, weight = 1 }) {
  const planetRef = useRef()

  useFrame((state) => {
    if (planetRef.current) {
      const angle = state.clock.elapsedTime * orbitSpeed * 0.08
      planetRef.current.position.x = Math.cos(angle) * distance
      planetRef.current.position.z = Math.sin(angle) * distance
      planetRef.current.rotation.y += 0.008
    }
  })

  return (
    <group visible={weight > 0.001}>
      <OrbitRing distance={distance} weight={weight} />

      <mesh ref={planetRef} position={[distance, 0, 0]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.05}
          transparent
          opacity={weight}
        />

        {hasRings && (
          <mesh rotation={[Math.PI / 2.5, 0, 0]}>
            <ringGeometry args={[radius * 1.4, radius * 2.2, 64]} />
            <meshStandardMaterial
              color="#d4be98"
              side={THREE.DoubleSide}
              transparent
              opacity={0.6 * weight}
              roughness={0.8}
            />
          </mesh>
        )}
      </mesh>
    </group>
  )
}

// Asteroid belt with instancing
export function AsteroidBelt({ count = 2000, weight = 1 }) {
  const meshRef = useRef()

  const instancedMesh = useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    const material = new THREE.MeshStandardMaterial({
      color: '#888888',
      roughness: 0.9,
      metalness: 0.1,
      transparent: true
    })
    const mesh = new THREE.InstancedMesh(geometry, material, count)

    const innerRadius = 175
    const outerRadius = 210
    const dummy = new THREE.Object3D()

    for (let i = 0; i < count; i++) {
      const r = innerRadius + Math.random() * (outerRadius - innerRadius)
      const theta = Math.random() * Math.PI * 2
      const height = (Math.random() - 0.5) * 12

      dummy.position.set(
        Math.cos(theta) * r,
        height,
        Math.sin(theta) * r
      )
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
      dummy.scale.setScalar(0.2 + Math.random() * 0.6)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    return mesh
  }, [count])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.material.opacity = weight
    }
  })

  return <primitive ref={meshRef} object={instancedMesh} visible={weight > 0.001} />
}

// Main Chapter 2 scene
export function Chapter2_SolarSystem() {
  const currentChapter = useStore((s) => s.currentChapter)
  const chapterProgress = useStore((s) => s.chapterProgress)
  const weight = useChapterWeight(2)

  // Show during chapters 2-4 (Sun fades out in chapter 4)
  if (currentChapter < 2 || currentChapter > 4) return null

  // Planets fade with chapter 2 weight, but Sun stays visible through chapter 3
  // and fades out during chapter 4
  let sunWeight = weight
  let sunScale = 1
  if (currentChapter === 3) {
    // Full brightness, gradually shrink from 1 to 0.2 during chapter 3
    sunWeight = 1
    sunScale = 1 - chapterProgress * 0.8  // 1 → 0.2
  } else if (currentChapter === 4) {
    // Tiny and fading out during first half of chapter 4
    sunWeight = Math.max(0, 1 - chapterProgress * 2)
    sunScale = 0.1
  }

  return (
    <group visible={weight > 0.001 || sunWeight > 0.001}>
      <group scale={sunScale}>
        <Sun weight={sunWeight} />
      </group>

      {PLANETS.map((planet) => (
        <Planet key={planet.name} {...planet} weight={weight} />
      ))}

      <AsteroidBelt count={1200} weight={weight} />

      <ambientLight intensity={0.12 * Math.max(weight, sunWeight)} color="#b4c4e0" />
    </group>
  )
}

export default Chapter2_SolarSystem
