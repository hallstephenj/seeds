import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import * as THREE from 'three'

import { useStore } from './core/store'
import { CinematicCamera } from './core/CinematicCamera'
import { TransitionController } from './core/TransitionController'
import { SpaceEnvironment } from './core/SpaceEnvironment'
import { CinematicPost } from './core/CinematicPost'
import { HUD } from './ui/HUD'
import { EndCardOverlay } from './ui/EndCardOverlay'

// Chapter components
import { Chapter1_Liftoff } from './chapters/Chapter1_Liftoff'
import { Chapter2_SolarSystem } from './chapters/Chapter2_SolarSystem'
import { Chapter3_Interstellar } from './chapters/Chapter3_Interstellar'
import { Chapter4_Galaxy } from './chapters/Chapter4_Galaxy'
import { Chapter5_Cosmic } from './chapters/Chapter5_Cosmic'
import { Chapter6_Selection } from './chapters/Chapter6_Selection'
import { Chapter7_Descent } from './chapters/Chapter7_Descent'
import { Chapter8_Matter } from './chapters/Chapter8_Matter'
import { Chapter9_Reveal } from './chapters/Chapter9_Reveal'
import { Chapter10_SeedPhraseEndCard } from './chapters/Chapter10_SeedPhraseEndCard'

import './App.css'

// Scene containing all chapters with unified environment
function Scene() {
  return (
    <>
      {/* Core systems */}
      <CinematicCamera />
      <TransitionController />

      {/* Unified space environment - persists across chapters with fading */}
      <SpaceEnvironment />

      {/* Global lighting - subtle and cinematic */}
      <ambientLight intensity={0.08} color="#b4c4e0" />

      {/* All chapter scenes - self-manage visibility via weight */}
      <Chapter1_Liftoff />
      <Chapter2_SolarSystem />
      <Chapter3_Interstellar />
      <Chapter4_Galaxy />
      <Chapter5_Cosmic />
      <Chapter6_Selection />
      <Chapter7_Descent />
      <Chapter8_Matter />
      <Chapter9_Reveal />
      <Chapter10_SeedPhraseEndCard />

      {/* Cinematic post-processing */}
      <CinematicPost />

      <Preload all />
    </>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <planeGeometry args={[0.1, 0.1]} />
      <meshBasicMaterial color="#111" transparent opacity={0} />
    </mesh>
  )
}

function App() {
  return (
    <div className="app">
      <Canvas
        camera={{
          fov: 60,
          near: 0.01,
          far: 3000,
          position: [0, 5, 80]
        }}
        gl={{
          antialias: false, // Using SMAA instead
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          // Cinematic color management
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.shadowMap.enabled = false // Shadows only where needed
          gl.setClearColor('#030308', 1)
        }}
        dpr={[1, 2]}
        flat={false}
      >
        <color attach="background" args={['#030308']} />
        <fog attach="fog" args={['#030308', 800, 1800]} />

        <Suspense fallback={<LoadingFallback />}>
          <Scene />
        </Suspense>
      </Canvas>

      <HUD />
      <EndCardOverlay />
    </div>
  )
}

export default App
