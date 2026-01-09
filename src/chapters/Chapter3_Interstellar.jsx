import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Cinematic interstellar starfield - safe buffer pattern
export function InterstellarStars({ count = 25000, radius = 800, weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = radius * (0.3 + Math.cbrt(Math.random()) * 0.7)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Spectral colors (OBAFGKM)
      const temp = Math.random()
      if (temp < 0.02) {
        // O/B blue-white (rare, bright)
        colors[i * 3] = 0.75
        colors[i * 3 + 1] = 0.85
        colors[i * 3 + 2] = 1.0
        sizes[i] = 2.5 + Math.random() * 1.5
      } else if (temp < 0.08) {
        // A white
        colors[i * 3] = 0.95
        colors[i * 3 + 1] = 0.95
        colors[i * 3 + 2] = 1.0
        sizes[i] = 1.8 + Math.random()
      } else if (temp < 0.25) {
        // F/G yellow-white
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.95
        colors[i * 3 + 2] = 0.85
        sizes[i] = 1.2 + Math.random() * 0.6
      } else if (temp < 0.55) {
        // K orange
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.8
        colors[i * 3 + 2] = 0.55
        sizes[i] = 0.8 + Math.random() * 0.5
      } else {
        // M red (most common)
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.65
        colors[i * 3 + 2] = 0.45
        sizes[i] = 0.5 + Math.random() * 0.4
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [count, radius])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.9 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={1.5}
        sizeAttenuation
        transparent
        opacity={0.9 * weight}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Nebula with procedural shader
export function Nebula({ position, color, scale = 80, weight = 1 }) {
  const materialRef = useRef()

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(color) },
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
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv);

          // Circular falloff
          float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
          falloff = falloff * falloff;

          vec2 pos = vUv * 5.0 + time * 0.015;
          float n = fbm(pos);
          n = smoothstep(0.25, 0.7, n);

          vec3 finalColor = color * (0.6 + n * 0.4);
          float alpha = n * falloff * 0.2 * opacity;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [color])

  useFrame((state) => {
    if (material.uniforms) {
      material.uniforms.time.value = state.clock.elapsedTime
      material.uniforms.opacity.value = weight
    }
  })

  return (
    <mesh position={position} visible={weight > 0.001}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} />
    </mesh>
  )
}

// Distant nebula backdrop
export function NebulaBackdrop({ weight = 1 }) {
  return (
    <group visible={weight > 0.001}>
      <Nebula position={[350, 120, -250]} color="#cc5588" scale={150} weight={weight} />
      <Nebula position={[-320, -100, 150]} color="#5588cc" scale={130} weight={weight} />
      <Nebula position={[280, 180, 250]} color="#8855cc" scale={110} weight={weight} />
      <Nebula position={[-250, 80, -350]} color="#55cc88" scale={100} weight={weight} />
    </group>
  )
}

// Main Chapter 3 scene
export function Chapter3_Interstellar() {
  const weight = useChapterWeight(3)

  // Weight-only gating
  if (weight < 0.001) return null

  return (
    <group visible={weight > 0.001}>
      <InterstellarStars count={20000} radius={900} weight={weight} />
      <NebulaBackdrop weight={weight} />

      <ambientLight intensity={0.03 * weight} color="#8090b0" />
    </group>
  )
}

export default Chapter3_Interstellar
