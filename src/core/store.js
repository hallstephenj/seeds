import { create } from 'zustand'

// Scale contexts for the 37 orders of magnitude
export const SCALE_CONTEXTS = {
  HUMAN: { range: [1e-2, 1e4], baseUnit: 'meters', label: 'm' },
  PLANETARY: { range: [1e4, 1e9], baseUnit: 'kilometers', label: 'km' },
  SOLAR: { range: [1e9, 1e14], baseUnit: 'AU', label: 'AU' },
  INTERSTELLAR: { range: [1e14, 1e18], baseUnit: 'light-years', label: 'ly' },
  GALACTIC: { range: [1e18, 1e22], baseUnit: 'kiloparsecs', label: 'kpc' },
  COSMIC: { range: [1e22, 1e27], baseUnit: 'megaparsecs', label: 'Mpc' },
  MOLECULAR: { range: [1e-7, 1e-2], baseUnit: 'micrometers', label: 'μm' },
  ATOMIC: { range: [1e-12, 1e-7], baseUnit: 'angstroms', label: 'Å' }
}

// Chapter definitions (durations in seconds)
export const CHAPTERS = [
  { id: 1, name: 'Liftoff', duration: 4, scaleStart: 1, scaleEnd: 1e7 },
  { id: 2, name: 'Solar System', duration: 6, scaleStart: 1e7, scaleEnd: 1e13 },
  { id: 3, name: 'Interstellar', duration: 6, scaleStart: 1e13, scaleEnd: 1e17 },
  { id: 4, name: 'Galactic', duration: 6, scaleStart: 1e17, scaleEnd: 1e21 },
  { id: 5, name: 'Intergalactic', duration: 7.5, scaleStart: 1e21, scaleEnd: 1e27 },
  { id: 6, name: 'The Selection', duration: 5, scaleStart: 1e27, scaleEnd: 1e27 },
  { id: 7, name: 'Descent', duration: 7.5, scaleStart: 1e27, scaleEnd: 1e3 },
  { id: 8, name: 'Into Matter', duration: 8, scaleStart: 1e3, scaleEnd: 1e-10 },
  { id: 9, name: 'The Reveal', duration: 8, scaleStart: 1e-10, scaleEnd: 1e-10 },
  { id: 10, name: 'Seed Phrase End Card', duration: 6, scaleStart: 1e-10, scaleEnd: 1e-10 }
]

// Narrative script
export const NARRATIVE = {
  1: [
    { time: 0, text: "You lift off from Earth..." }
  ],
  2: [
    { time: 0, text: "Past the Moon and planets..." }
  ],
  3: [
    { time: 0, text: "Until the Sun is a pinprick." }
  ],
  4: [
    { time: 0, text: "The Milky Way shrinks to a smear..." }
  ],
  5: [
    { time: 0, text: "Then fades into the cosmic web." }
  ],
  6: [
    { time: 0, text: "Now, at random:" },
    { time: 2, text: "You choose one atom." }
  ],
  7: [
    { time: 0, text: "You pick a random planet..." }
  ],
  8: [
    { time: 0, text: "... falling into its world of stone." },
    { time: 3, text: "Through molecules..." }
  ],
  9: [
    { time: 0, text: "Until that single atom fills the frame." },
    { time: 3, text: "This is why your bitcoin is secure." }
  ],
  10: [
    { time: 0, text: "Because this atom is impossible to find." },
    { time: 3, text: "Unguessable. Yours alone." }
  ]
}

// Main application store
export const useStore = create((set, get) => ({
  // Journey state
  currentChapter: 1,
  chapterProgress: 0,
  totalProgress: 0,
  isPlaying: true,
  isTransitioning: false,

  // Scale state
  currentScale: 1, // meters
  scaleContext: 'HUMAN',

  // Camera state
  cameraPosition: [0, 2, 10],
  cameraTarget: [0, 0, 0],

  // UI state
  showHUD: true,
  narrativeText: '',
  distanceTraveled: 0,

  // Selection state (for chapter 6)
  selectedAtomPosition: null,

  // Actions
  setChapter: (chapter) => set({ currentChapter: chapter, chapterProgress: 0 }),

  setChapterProgress: (progress) => {
    const { currentChapter } = get()
    set({ chapterProgress: progress })

    // Calculate total progress
    const chaptersBefore = CHAPTERS.slice(0, currentChapter - 1)
    const totalDurationBefore = chaptersBefore.reduce((sum, ch) => sum + ch.duration, 0)
    const currentDuration = CHAPTERS[currentChapter - 1].duration
    const totalDuration = CHAPTERS.reduce((sum, ch) => sum + ch.duration, 0)

    const totalProgress = (totalDurationBefore + progress * currentDuration) / totalDuration
    set({ totalProgress })
  },

  setScale: (scale) => {
    // Determine appropriate scale context
    let context = 'HUMAN'
    for (const [name, ctx] of Object.entries(SCALE_CONTEXTS)) {
      if (scale >= ctx.range[0] && scale <= ctx.range[1]) {
        context = name
        break
      }
    }
    set({ currentScale: scale, scaleContext: context })
  },

  setNarrativeText: (text) => set({ narrativeText: text }),

  setDistanceTraveled: (distance) => set({ distanceTraveled: distance }),

  setCameraState: (position, target) => set({
    cameraPosition: position,
    cameraTarget: target
  }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

  nextChapter: () => {
    const { currentChapter } = get()
    if (currentChapter < CHAPTERS.length) {
      set({
        isTransitioning: true,
        currentChapter: currentChapter + 1,
        chapterProgress: 0
      })
      setTimeout(() => set({ isTransitioning: false }), 1000)
    }
  },

  skipToEnd: () => set({ currentChapter: 10, chapterProgress: 0 }),

  skipChapter: () => {
    const { currentChapter } = get()
    if (currentChapter < CHAPTERS.length) {
      set({
        currentChapter: currentChapter + 1,
        chapterProgress: 0
      })
    }
  },

  reset: () => set({
    currentChapter: 1,
    chapterProgress: 0,
    totalProgress: 0,
    isPlaying: true,
    currentScale: 1,
    scaleContext: 'HUMAN',
    narrativeText: '',
    distanceTraveled: 0
  })
}))

// Helper to format distance with appropriate units
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`
  } else if (meters < 1e6) {
    return `${(meters / 1000).toFixed(1)} km`
  } else if (meters < 1.496e11) {
    return `${(meters / 1e6).toFixed(0)} km`
  } else if (meters < 9.461e15) {
    return `${(meters / 1.496e11).toFixed(2)} AU`
  } else if (meters < 3.086e19) {
    return `${(meters / 9.461e15).toFixed(1)} light-years`
  } else if (meters < 3.086e22) {
    return `${(meters / 3.086e19).toFixed(0)} kpc`
  } else {
    return `${(meters / 3.086e22).toFixed(1)} Mpc`
  }
}

// Helper to format scale
export function formatScale(meters) {
  const exp = Math.floor(Math.log10(Math.abs(meters)))
  if (exp >= 0 && exp <= 3) {
    return `${meters.toFixed(0)} m`
  }
  return `10^${exp} m`
}
