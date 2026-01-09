import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Selection reticle - cinematic target lock
function SelectionReticle({ weight = 1 }) {
  const outerRef = useRef()
  const innerRef = useRef()
  const coreRef = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (outerRef.current) {
      outerRef.current.rotation.z = time * 0.3
      const scale = 1 + Math.sin(time * 2) * 0.08
      outerRef.current.scale.setScalar(scale)
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = -time * 0.5
    }
    if (coreRef.current) {
      const pulse = 0.8 + Math.sin(time * 3) * 0.2
      coreRef.current.scale.setScalar(pulse)
    }
  })

  const reticleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
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
        uniform float opacity;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          // Ring pattern
          float ring = smoothstep(0.48, 0.5, dist) - smoothstep(0.5, 0.52, dist);

          // Dashed pattern
          float angle = atan(center.y, center.x);
          float dash = step(0.5, fract((angle + time) * 4.0 / 3.14159));

          vec3 color = vec3(0.4, 0.6, 1.0);
          float alpha = ring * dash * opacity;

          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  }, [])

  useFrame((state) => {
    if (reticleMaterial.uniforms) {
      reticleMaterial.uniforms.time.value = state.clock.elapsedTime
      reticleMaterial.uniforms.opacity.value = weight
    }
  })

  return (
    <group visible={weight > 0.001}>
      {/* Outer rotating ring */}
      <group ref={outerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[45, 52, 64]} />
          <meshBasicMaterial
            color="#6699ff"
            transparent
            opacity={0.5 * weight}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Corner brackets */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 55,
              0,
              Math.sin(angle) * 55
            ]}
            rotation={[Math.PI / 2, 0, angle + Math.PI / 4]}
          >
            <planeGeometry args={[12, 3]} />
            <meshBasicMaterial
              color="#6699ff"
              transparent
              opacity={0.7 * weight}
            />
          </mesh>
        ))}
      </group>

      {/* Inner counter-rotating ring */}
      <group ref={innerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[18, 22, 32]} />
          <primitive object={reticleMaterial} />
        </mesh>
      </group>

      {/* Core glow */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial
          color="#eeeeff"
          transparent
          opacity={0.9 * weight}
        />
      </mesh>

      {/* Inner core */}
      <mesh>
        <sphereGeometry args={[2, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={weight} />
      </mesh>
    </group>
  )
}

// Dim background during selection
function SelectionBackground({ weight = 1 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 2000
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 300 + Math.random() * 500
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
      materialRef.current.opacity = 0.4 * weight
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        color="#8899bb"
        size={1.2}
        sizeAttenuation={false}
        transparent
        opacity={0.4 * weight}
      />
    </points>
  )
}

// Main Chapter 6 scene
export function Chapter6_Selection() {
  const currentChapter = useStore((s) => s.currentChapter)
  const weight = useChapterWeight(6)

  if (currentChapter < 6 || currentChapter > 7) return null

  return (
    <group visible={weight > 0.001}>
      <SelectionBackground weight={weight} />
      <SelectionReticle weight={weight} />

      <ambientLight intensity={0.08 * weight} color="#b0c0d0" />
    </group>
  )
}

export default Chapter6_Selection
