import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../core/store'
import { useChapterWeight } from '../core/TransitionController'

// Earth with improved atmosphere and Fresnel rim
export function Earth({ weight = 1 }) {
  const earthRef = useRef()
  const cloudsRef = useRef()
  const atmosphereRef = useRef()

  useFrame((state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.08
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.1
    }
  })

  // Earth surface shader with improved lighting
  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        lightDir: { value: new THREE.Vector3(1, 0.3, 0.8).normalize() },
        opacity: { value: 1 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

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
          for (int i = 0; i < 6; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          float continent = fbm(vUv * vec2(10.0, 5.0));
          continent = smoothstep(0.35, 0.55, continent);

          // Ocean with depth
          vec3 oceanDeep = vec3(0.02, 0.08, 0.25);
          vec3 oceanShallow = vec3(0.05, 0.2, 0.45);
          vec3 ocean = mix(oceanDeep, oceanShallow, fbm(vUv * 20.0) * 0.5);

          // Land with varied terrain
          float latitude = abs(vUv.y - 0.5) * 2.0;
          vec3 forest = vec3(0.08, 0.35, 0.12);
          vec3 desert = vec3(0.55, 0.45, 0.28);
          vec3 tundra = vec3(0.4, 0.42, 0.38);

          vec3 land = mix(forest, desert, smoothstep(0.2, 0.5, latitude));
          land = mix(land, tundra, smoothstep(0.6, 0.8, latitude));

          // Ice caps
          float pole = smoothstep(0.82, 0.92, latitude);
          land = mix(land, vec3(0.92, 0.94, 0.96), pole);

          vec3 color = mix(ocean, land, continent);

          // Lighting with terminator softness
          float diff = dot(vNormal, lightDir);
          float terminator = smoothstep(-0.1, 0.3, diff);

          // Night side glow (city lights hint)
          vec3 nightColor = color * 0.03 + vec3(0.02, 0.015, 0.005) * (1.0 - continent) * 0.5;

          color = mix(nightColor, color * (0.25 + terminator * 0.75), smoothstep(-0.05, 0.1, diff));

          // Specular on ocean
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 halfDir = normalize(lightDir + viewDir);
          float spec = pow(max(dot(vNormal, halfDir), 0.0), 40.0);
          color += vec3(1.0, 0.95, 0.9) * spec * (1.0 - continent) * 0.3 * terminator;

          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true
    })
  }, [])

  // Atmosphere with Fresnel rim
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
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
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          fresnel = pow(fresnel, 3.0);

          vec3 atmosphereColor = mix(
            vec3(0.4, 0.7, 1.0),
            vec3(0.1, 0.3, 0.8),
            fresnel
          );

          float alpha = fresnel * 0.7 * opacity;
          gl_FragColor = vec4(atmosphereColor, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  // Update material opacity based on weight
  useFrame(() => {
    if (earthMaterial.uniforms) {
      earthMaterial.uniforms.opacity.value = weight
    }
    if (atmosphereMaterial.uniforms) {
      atmosphereMaterial.uniforms.opacity.value = weight
    }
  })

  return (
    <group visible={weight > 0.001}>
      {/* Earth surface */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[50, 64, 64]} />
        <primitive object={earthMaterial} />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[51, 48, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2 * weight}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere rim */}
      <mesh ref={atmosphereRef} scale={1.15}>
        <sphereGeometry args={[50, 48, 48]} />
        <primitive object={atmosphereMaterial} />
      </mesh>
    </group>
  )
}

// Background Sun - visible during liftoff
export function BackgroundSun({ weight = 1 }) {
  const materialRef = useRef()

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

          vec3 innerColor = vec3(1.0, 0.95, 0.8);
          vec3 outerColor = vec3(1.0, 0.6, 0.2);
          vec3 color = mix(innerColor, outerColor, fresnel);

          float alpha = fresnel * 0.5 * opacity;
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

  const sunRadius = 80 // Larger than Earth (radius 50)

  return (
    <group position={[400, 120, -300]} visible={weight > 0.001}>
      {/* Sun core */}
      <mesh>
        <sphereGeometry args={[sunRadius, 48, 48]} />
        <meshBasicMaterial color="#fff8e0" transparent opacity={weight} />
      </mesh>

      {/* Inner glow */}
      <mesh scale={1.05}>
        <sphereGeometry args={[sunRadius, 32, 32]} />
        <meshBasicMaterial
          color="#ffdd66"
          transparent
          opacity={0.4 * weight}
        />
      </mesh>

      {/* Corona */}
      <mesh scale={1.4}>
        <sphereGeometry args={[sunRadius, 32, 32]} />
        <primitive object={coronaMaterial} />
      </mesh>

      {/* Point light from sun */}
      <pointLight
        intensity={2 * weight}
        distance={2000}
        decay={1.5}
        color="#fff5e0"
      />
    </group>
  )
}

// Moon for added realism
export function Moon({ weight = 1 }) {
  const moonRef = useRef()

  useFrame((state, delta) => {
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <mesh
      ref={moonRef}
      position={[180, 30, -100]}
      visible={weight > 0.001}
    >
      <sphereGeometry args={[13, 32, 32]} />
      <meshStandardMaterial
        color="#aaaaaa"
        roughness={0.9}
        metalness={0}
        transparent
        opacity={weight}
      />
    </mesh>
  )
}

// Main Chapter 1 scene
export function Chapter1_Liftoff() {
  const weight = useChapterWeight(1)

  // Weight-only gating - no currentChapter dependency
  if (weight < 0.001) return null

  return (
    <group visible={weight > 0.001}>
      <Earth weight={weight} />
      <Moon weight={weight} />
      <BackgroundSun weight={weight} />

      {/* Fill light */}
      <ambientLight intensity={0.15 * weight} color="#6080a0" />
    </group>
  )
}

export default Chapter1_Liftoff
