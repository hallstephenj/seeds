import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Brief 3D scene that morphs the atom before HTML overlay takes over
// Timeline: 0-25% = atom morph, 25%+ = HTML overlay (handled by EndCardOverlay.jsx)

const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Information particle that emerges from matter
function InformationParticle({ delay = 0, weight = 1 }) {
  const ref = useRef()
  const startTime = useRef(null)

  useFrame((state) => {
    if (!ref.current) return
    const time = state.clock.elapsedTime

    if (startTime.current === null) {
      startTime.current = time
    }

    const elapsed = time - startTime.current - delay
    if (elapsed < 0) {
      ref.current.visible = false
      return
    }

    ref.current.visible = weight > 0.001
    const t = Math.min(1, elapsed * 0.8)
    const eased = easeInOutCubic(t)

    // Float upward and fade
    ref.current.position.y = eased * 3
    ref.current.material.opacity = (1 - eased * 0.7) * weight
    ref.current.scale.setScalar(0.5 + eased * 0.5)
  })

  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <octahedronGeometry args={[0.08, 0]} />
      <meshBasicMaterial
        color="#88ccff"
        transparent
        opacity={weight}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Collapsing atom with energy burst - "matter becomes information"
function MorphingAtom({ progress, weight = 1 }) {
  const atomRef = useRef()
  const particlesMaterialRef = useRef()

  // Atom only visible during first ~30% then fades
  const atomOpacity = progress < 0.2 ? 1 : Math.max(0, 1 - (progress - 0.2) / 0.15)
  const morphProgress = Math.min(1, progress / 0.25)
  const effectiveOpacity = atomOpacity * weight

  // Particle burst geometry - safe buffer pattern
  const particleData = useMemo(() => {
    const count = 80
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const directions = []

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0

      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      directions.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        speed: 0.5 + Math.random() * 1.5
      })
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry: geo, directions, count }
  }, [])

  // Nucleus material with energy effect
  const nucleusMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        morphProgress: { value: 0 },
        opacity: { value: 1 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normal;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float morphProgress;
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          float energy = sin(vPosition.x * 10.0 + time * 5.0) *
                        sin(vPosition.y * 10.0 + time * 4.0) *
                        sin(vPosition.z * 10.0 + time * 6.0);
          energy = energy * 0.5 + 0.5;

          vec3 baseColor = vec3(0.2, 0.4, 1.0);
          vec3 hotColor = vec3(1.0, 1.0, 1.0);

          vec3 color = mix(baseColor, hotColor, morphProgress * 0.8 + energy * 0.2);

          // Fresnel glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          color += fresnel * vec3(0.3, 0.5, 1.0);

          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    })
  }, [])

  useFrame((state) => {
    if (effectiveOpacity <= 0.001) return // Skip animation when invisible

    const time = state.clock.elapsedTime

    // Update nucleus
    if (nucleusMaterial.uniforms) {
      nucleusMaterial.uniforms.time.value = time
      nucleusMaterial.uniforms.morphProgress.value = morphProgress
      nucleusMaterial.uniforms.opacity.value = effectiveOpacity
    }

    // Atom collapse animation
    if (atomRef.current) {
      const collapse = easeInOutCubic(morphProgress)
      atomRef.current.scale.set(
        1 + collapse * 2,
        Math.max(0.01, 1 - collapse * 0.95),
        1 + collapse * 2
      )
      atomRef.current.rotation.y += 0.01 + morphProgress * 0.05
    }

    // Particle burst - update positions directly
    if (morphProgress > 0.1 && particleData.geometry) {
      const pos = particleData.geometry.attributes.position.array
      const burstProgress = Math.max(0, (morphProgress - 0.1) / 0.9)

      for (let i = 0; i < particleData.count; i++) {
        const d = particleData.directions[i]
        const dist = burstProgress * d.speed * 2
        pos[i * 3] = d.x * dist
        pos[i * 3 + 1] = d.y * dist
        pos[i * 3 + 2] = d.z * dist
      }
      particleData.geometry.attributes.position.needsUpdate = true
    }

    // Update particle material opacity
    if (particlesMaterialRef.current) {
      particlesMaterialRef.current.opacity = effectiveOpacity * 0.8
    }
  })

  // Use visibility instead of early return to avoid hooks issues
  return (
    <group visible={effectiveOpacity > 0.001}>
      {/* Atom core */}
      <group ref={atomRef}>
        <mesh>
          <sphereGeometry args={[0.3, 32, 32]} />
          <primitive object={nucleusMaterial} />
        </mesh>

        {/* Orbital rings - dissolving into data */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2 + i * 0.4, i * 0.3, 0]}>
            <torusGeometry args={[0.5 + i * 0.15, 0.01, 16, 64]} />
            <meshBasicMaterial
              color="#4a9eff"
              transparent
              opacity={effectiveOpacity * 0.4 * (1 - morphProgress)}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}

        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial
            color="#4a9eff"
            transparent
            opacity={effectiveOpacity * 0.15}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* Particle burst - safe buffer pattern */}
      <points geometry={particleData.geometry}>
        <pointsMaterial
          ref={particlesMaterialRef}
          size={0.03}
          color="#4a9eff"
          transparent
          opacity={effectiveOpacity * 0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Information particles emerging from matter */}
      {morphProgress > 0.15 && (
        <group>
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((delay, i) => (
            <InformationParticle key={i} delay={delay} weight={weight * (1 - morphProgress)} />
          ))}
        </group>
      )}
    </group>
  )
}

// Smooth fade to black as we transition to HTML
function FadeOverlay({ progress, weight = 1 }) {
  const materialRef = useRef()
  const opacity = progress > 0.15 ? Math.min(1, (progress - 0.15) / 0.15) : 0
  const effectiveOpacity = opacity * weight

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = effectiveOpacity
    }
  })

  return (
    <mesh position={[0, 0, 1]} visible={effectiveOpacity > 0.001}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#0a0a0c"
        transparent
        opacity={effectiveOpacity}
        depthTest={false}
      />
    </mesh>
  )
}

// Digital grid background - represents "information"
function InformationGrid({ weight = 1 }) {
  const materialRef = useRef()

  const gridMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0 }
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
        uniform float opacity;
        varying vec2 vUv;

        void main() {
          vec2 grid = abs(fract(vUv * 40.0 - 0.5) - 0.5);
          float line = min(grid.x, grid.y);
          float gridAlpha = 1.0 - smoothstep(0.0, 0.02, line);

          // Pulse effect
          float pulse = sin(time * 2.0 + vUv.x * 10.0) * 0.5 + 0.5;
          gridAlpha *= 0.1 + pulse * 0.1;

          vec3 color = vec3(0.2, 0.5, 1.0);
          gl_FragColor = vec4(color, gridAlpha * opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  }, [])

  useFrame((state) => {
    if (gridMaterial.uniforms) {
      gridMaterial.uniforms.time.value = state.clock.elapsedTime
      gridMaterial.uniforms.opacity.value = weight * 0.3
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} visible={weight > 0.001}>
      <planeGeometry args={[20, 20]} />
      <primitive object={gridMaterial} ref={materialRef} />
    </mesh>
  )
}

// Main Chapter 10 component - brief 3D before HTML takes over
export function Chapter10_SeedPhraseEndCard() {
  const weight = useChapterWeight(10)
  const localProgress = useStore((s) => s.chapterLocalProgress[10] || 0)

  // Weight-only gating
  if (weight < 0.001) return null

  // Use local progress for internal animation timing
  const show3D = localProgress < 0.4
  const gridWeight = localProgress > 0.1 ? Math.min(1, (localProgress - 0.1) / 0.2) : 0

  return (
    <group visible={weight > 0.001}>
      <MorphingAtom progress={localProgress} weight={show3D ? weight : 0} />
      <FadeOverlay progress={localProgress} weight={weight} />
      <InformationGrid weight={weight * gridWeight * (1 - localProgress)} />

      {/* Ambient lighting for the transition */}
      <ambientLight intensity={0.2 * weight} />
      <pointLight position={[0, 2, 5]} intensity={0.3 * weight} color="#4a9eff" />
    </group>
  )
}

export default Chapter10_SeedPhraseEndCard
