import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// The revealed atom - clean, glowing, the payoff
export function RevealAtom({ weight = 1 }) {
  const atomRef = useRef()
  const glowRef = useRef()
  const atomRadius = 0.3

  const glowMaterial = useMemo(() => {
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
          fresnel = pow(fresnel, 2.5);

          vec3 innerColor = vec3(0.4, 0.7, 1.0);
          vec3 outerColor = vec3(0.2, 0.5, 0.9);
          vec3 color = mix(innerColor, outerColor, fresnel);

          float pulse = 0.85 + sin(time * 1.5) * 0.15;
          float alpha = fresnel * 0.6 * opacity * pulse;

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
    if (atomRef.current) {
      atomRef.current.rotation.y += 0.008
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.06
      atomRef.current.scale.setScalar(pulse)
    }
    if (glowMaterial.uniforms) {
      glowMaterial.uniforms.time.value = state.clock.elapsedTime
      glowMaterial.uniforms.opacity.value = weight
    }
  })

  return (
    <group ref={atomRef} visible={weight > 0.001}>
      {/* Bright nucleus core */}
      <mesh>
        <sphereGeometry args={[atomRadius * 0.25, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={weight} />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[atomRadius * 0.45, 32, 32]} />
        <meshBasicMaterial
          color="#5599ff"
          transparent
          opacity={0.75 * weight}
        />
      </mesh>

      {/* Electron cloud */}
      <mesh>
        <sphereGeometry args={[atomRadius, 32, 32]} />
        <meshBasicMaterial
          color="#4a9eff"
          transparent
          opacity={0.25 * weight}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef} scale={1.6}>
        <sphereGeometry args={[atomRadius, 48, 48]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Orbit rings */}
      {[0.7, 1.0, 1.3].map((r, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.35, i * 0.55, 0]}>
          <torusGeometry args={[atomRadius * r, atomRadius * 0.018, 8, 64]} />
          <meshBasicMaterial
            color="#66aaff"
            transparent
            opacity={0.35 * weight}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

// Ambient particles around the atom
export function RevealParticles({ weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 400
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 15 + Math.random() * 70
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.5 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        size={1.2}
        color="#6699cc"
        transparent
        opacity={0.5 * weight}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

// Background stars
export function RevealBackground({ weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 1500
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 400
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      const brightness = 0.15 + Math.random() * 0.25
      colors[i * 3] = brightness
      colors[i * 3 + 1] = brightness
      colors[i * 3 + 2] = brightness + Math.random() * 0.15
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.4 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={0.8}
        transparent
        opacity={0.4 * weight}
        sizeAttenuation={false}
      />
    </points>
  )
}

// Main Chapter 9 scene
export function Chapter9_Reveal() {
  const currentChapter = useStore((s) => s.currentChapter)
  const weight = useChapterWeight(9)

  if (currentChapter < 9 || currentChapter > 10) return null

  return (
    <group visible={weight > 0.001}>
      <RevealBackground weight={weight} />
      <RevealAtom weight={weight} />
      <RevealParticles weight={weight} />

      <ambientLight intensity={0.08 * weight} />
      <pointLight position={[0, 0, 80]} intensity={0.4 * weight} color="#4a9eff" />
    </group>
  )
}

export default Chapter9_Reveal
