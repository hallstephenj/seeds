import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// White matter ball - the exterior we're zooming into
export function WhiteMatterBall({ visible, weight = 1, progress = 0 }) {
  const materialRef = useRef()

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

          vec3 innerColor = vec3(1.0, 1.0, 1.0);
          vec3 outerColor = vec3(0.9, 0.92, 0.98);
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
    if (glowMaterial.uniforms) {
      glowMaterial.uniforms.time.value = state.clock.elapsedTime
      glowMaterial.uniforms.opacity.value = visible ? weight : 0
    }
  })

  if (!visible) return null

  // Scale up as we approach (gives sense of zooming in)
  const scale = 1 + progress * 3

  return (
    <group scale={scale} visible={weight > 0.001}>
      {/* Solid white core */}
      <mesh>
        <sphereGeometry args={[40, 48, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={weight * 0.9} />
      </mesh>

      {/* Inner glow layer */}
      <mesh scale={1.05}>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial
          color="#eeeeff"
          transparent
          opacity={0.4 * weight}
        />
      </mesh>

      {/* Outer corona glow */}
      <mesh scale={1.3}>
        <sphereGeometry args={[40, 32, 32]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Point light */}
      <pointLight
        intensity={1.5 * weight}
        distance={500}
        decay={2}
        color="#ffffff"
      />
    </group>
  )
}

// Single molecule component (water-like H2O structure)
function Molecule({ position, rotation, scale = 1, weight = 1 }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Central oxygen (red) */}
      <mesh>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshStandardMaterial
          color="#ee4444"
          roughness={0.3}
          emissive="#ee4444"
          emissiveIntensity={0.15}
          transparent
          opacity={weight}
        />
      </mesh>

      {/* Hydrogen 1 (white/blue) */}
      <mesh position={[3.5, 2, 0]}>
        <sphereGeometry args={[1.8, 12, 12]} />
        <meshStandardMaterial
          color="#aaccff"
          roughness={0.3}
          emissive="#aaccff"
          emissiveIntensity={0.1}
          transparent
          opacity={weight}
        />
      </mesh>

      {/* Bond 1 */}
      <mesh position={[1.75, 1, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.4, 0.4, 4, 8]} />
        <meshStandardMaterial color="#888888" transparent opacity={weight * 0.7} />
      </mesh>

      {/* Hydrogen 2 (white/blue) */}
      <mesh position={[-3.5, 2, 0]}>
        <sphereGeometry args={[1.8, 12, 12]} />
        <meshStandardMaterial
          color="#aaccff"
          roughness={0.3}
          emissive="#aaccff"
          emissiveIntensity={0.1}
          transparent
          opacity={weight}
        />
      </mesh>

      {/* Bond 2 */}
      <mesh position={[-1.75, 1, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.4, 0.4, 4, 8]} />
        <meshStandardMaterial color="#888888" transparent opacity={weight * 0.7} />
      </mesh>
    </group>
  )
}

// Floating molecules inside matter
export function FloatingMolecules({ visible, weight = 1 }) {
  const groupRef = useRef()

  const molecules = useMemo(() => {
    const data = []
    const count = 25

    for (let i = 0; i < count; i++) {
      data.push({
        position: [
          (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 80
        ],
        rotation: [
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ],
        scale: 0.8 + Math.random() * 0.8,
        speed: 0.2 + Math.random() * 0.3
      })
    }

    return data
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05
      // Gentle floating motion for each molecule
      groupRef.current.children.forEach((mol, i) => {
        const t = state.clock.elapsedTime * molecules[i].speed
        mol.position.y += Math.sin(t + i) * 0.02
      })
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} visible={weight > 0.001}>
      {molecules.map((mol, i) => (
        <Molecule
          key={i}
          position={mol.position}
          rotation={mol.rotation}
          scale={mol.scale}
          weight={weight}
        />
      ))}
    </group>
  )
}

// Atomic view with nucleus and electrons
export function AtomicView({ visible, weight = 1 }) {
  const atomRef = useRef()
  const electronRef = useRef()

  const nucleusMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
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
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          float noise = fract(sin(dot(vPosition * 12.0, vec3(12.9898, 78.233, 45.164))) * 43758.5453);

          vec3 protonColor = vec3(1.0, 0.35, 0.35);
          vec3 neutronColor = vec3(0.75, 0.75, 0.75);

          vec3 color = mix(protonColor, neutronColor, step(0.5, noise));

          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, lightDir), 0.0);
          color *= 0.45 + diff * 0.55;

          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true
    })
  }, [])

  useFrame((state) => {
    if (nucleusMaterial.uniforms) {
      nucleusMaterial.uniforms.time.value = state.clock.elapsedTime
      nucleusMaterial.uniforms.opacity.value = visible ? weight : 0
    }
    if (electronRef.current) {
      electronRef.current.rotation.y += 0.04
      electronRef.current.rotation.x += 0.025
    }
  })

  if (!visible) return null

  const atomRadius = 45
  const nucleusRadius = 4.5

  return (
    <group ref={atomRef} visible={weight > 0.001}>
      {/* Nucleus */}
      <mesh>
        <sphereGeometry args={[nucleusRadius, 32, 32]} />
        <primitive object={nucleusMaterial} />
      </mesh>

      {/* Electron probability cloud */}
      <mesh ref={electronRef}>
        <sphereGeometry args={[atomRadius, 64, 64]} />
        <meshBasicMaterial
          color="#4a9eff"
          transparent
          opacity={0.08 * weight}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Orbital paths */}
      {[1, 1.5, 2].map((r, i) => (
        <mesh key={i} rotation={[Math.PI * 0.3 * i, Math.PI * 0.2 * i, 0]}>
          <torusGeometry args={[atomRadius * r * 0.75, 0.4, 8, 64]} />
          <meshBasicMaterial
            color="#66aaff"
            transparent
            opacity={0.25 * weight}
          />
        </mesh>
      ))}

      {/* Orbiting electrons */}
      <ElectronParticles radius={atomRadius} weight={weight} />
    </group>
  )
}

function ElectronParticles({ radius, weight }) {
  const electronsRef = useRef()
  const electronCount = 6

  const offsets = useMemo(() => {
    return Array.from({ length: electronCount }, () => ({
      phase: Math.random() * Math.PI * 2,
      speed: 1.8 + Math.random() * 1.5,
      tilt: Math.random() * Math.PI,
      orbitRadius: radius * (0.5 + Math.random() * 0.45)
    }))
  }, [radius])

  useFrame((state) => {
    if (electronsRef.current) {
      electronsRef.current.children.forEach((electron, i) => {
        const { phase, speed, tilt, orbitRadius } = offsets[i]
        const t = state.clock.elapsedTime * speed + phase

        electron.position.x = Math.cos(t) * orbitRadius
        electron.position.y = Math.sin(t) * Math.sin(tilt) * orbitRadius
        electron.position.z = Math.sin(t) * Math.cos(tilt) * orbitRadius
      })
    }
  })

  return (
    <group ref={electronsRef}>
      {Array.from({ length: electronCount }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1.8, 8, 8]} />
          <meshBasicMaterial
            color="#66ccff"
            transparent
            opacity={weight}
          />
        </mesh>
      ))}
    </group>
  )
}

// Background for matter chapter - transitions to white during molecules/atom
export function MatterBackground({ count = 800, weight = 1, progress = 0 }) {
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r = 280 + Math.random() * 180
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count])

  // Transition to white as we go deeper into matter
  const whiteAmount = Math.max(0, (progress - 0.2) / 0.6) // 0 at 20%, 1 at 80%
  const darkColor = new THREE.Color('#445566')
  const whiteColor = new THREE.Color('#ffffff')
  const currentColor = darkColor.clone().lerp(whiteColor, whiteAmount)

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.4 * weight
      materialRef.current.color = currentColor
    }
  })

  return (
    <points geometry={geometry} visible={weight > 0.001}>
      <pointsMaterial
        ref={materialRef}
        color={currentColor}
        size={0.8}
        sizeAttenuation={false}
        transparent
        opacity={0.4 * weight}
      />
    </points>
  )
}

// Main Chapter 8 scene
export function Chapter8_Matter() {
  const weight = useChapterWeight(8)
  const localProgress = useStore((s) => s.chapterLocalProgress[8] || 0)

  // Weight-only gating
  if (weight < 0.001) return null

  // Clear progression:
  // 0-25%: White matter ball (exterior, zooming in)
  // 20-80%: Floating molecules (inside the matter) - extended
  // 75-100%: Atom (zoom into a molecule to find the atom)
  const showWhiteMatter = localProgress < 0.25
  const showMolecules = localProgress >= 0.20 && localProgress < 0.80
  const showAtom = localProgress >= 0.75

  return (
    <group visible={weight > 0.001}>
      <MatterBackground count={700} weight={weight} progress={localProgress} />
      <WhiteMatterBall visible={showWhiteMatter} weight={weight} progress={localProgress} />
      <FloatingMolecules visible={showMolecules} weight={weight} />
      <AtomicView visible={showAtom} weight={weight} />

      <ambientLight intensity={0.25 * weight} />
      <directionalLight position={[1, 1, 1]} intensity={0.7 * weight} />
      <pointLight position={[0, 0, 0]} intensity={0.4 * weight} color="#4a9eff" />
    </group>
  )
}

export default Chapter8_Matter
