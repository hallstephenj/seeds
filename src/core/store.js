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
const CHAPTER_DEFS = [
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

// Compute chapter start times and total duration
export const TOTAL_DURATION = CHAPTER_DEFS.reduce((sum, ch) => sum + ch.duration, 0) // 64s

// Add start/end times to each chapter
let cumulative = 0
export const CHAPTERS = CHAPTER_DEFS.map(ch => {
  const start = cumulative
  cumulative += ch.duration
  return { ...ch, start, end: cumulative }
})

// Narrative script - absolute times (computed from chapter starts)
// Ch1@0, Ch2@4, Ch3@10, Ch4@16, Ch5@22, Ch6@29.5, Ch7@34.5, Ch8@42, Ch9@50, Ch10@58
export const NARRATIVE_CUES = [
  { time: 0, text: "You lift off from Earth..." },
  { time: 4, text: "Past the Moon and planets..." },
  { time: 10, text: "Until the Sun is a pinprick." },
  { time: 16, text: "The Milky Way shrinks to a smear..." },
  { time: 22, text: "Then fades into the cosmic web." },
  { time: 29.5, text: "Now, at random:" },
  { time: 31.5, text: "You choose one planet." },
  { time: 34.5, text: "Slowly, it pulls you..." },
  { time: 42, text: "...into its world of lifeless mass." },
  { time: 45, text: "Through molecules..." },
  { time: 50, text: "Until that single atom fills the frame." },
  { time: 55, text: "This is why bitcoin's security works." },
  { time: 58, text: "Because that atom is impossible to find." },
  { time: 62, text: "Unguessable. Yours alone." }
]

// Legacy format for compatibility (if needed)
export const NARRATIVE = {
  1: [{ time: 0, text: "You lift off from Earth..." }],
  2: [{ time: 0, text: "Past the Moon and planets..." }],
  3: [{ time: 0, text: "Until the Sun is a pinprick." }],
  4: [{ time: 0, text: "The Milky Way shrinks to a smear..." }],
  5: [{ time: 0, text: "Then fades into the cosmic web." }],
  6: [{ time: 0, text: "Now, at random:" }, { time: 2, text: "You choose one planet." }],
  7: [{ time: 0, text: "Slowly, it pulls you..." }],
  8: [{ time: 0, text: "...into its world of lifeless mass." }, { time: 3, text: "Through molecules..." }],
  9: [{ time: 0, text: "Until that single atom fills the frame." }, { time: 5, text: "This is why bitcoin's security works." }],
  10: [{ time: 0, text: "Because that atom is impossible to find." }, { time: 4, text: "Unguessable. Yours alone." }]
}

// Main application store - global timeline driven
export const useStore = create((set, get) => ({
  // Global timeline state (single source of truth)
  globalTime: 0, // seconds (0..TOTAL_DURATION)
  isPlaying: true,

  // Derived values (updated by TransitionController each frame)
  totalProgress: 0, // 0..1
  chapterWeights: {}, // { [chapterId]: weight }
  chapterLocalProgress: {}, // { [chapterId]: localProgress }

  // Scale state
  currentScale: 1, // meters
  scaleContext: 'HUMAN',

  // UI state
  narrativeText: '',

  // Actions
  setGlobalTime: (time) => {
    const clamped = Math.max(0, Math.min(time, TOTAL_DURATION))
    set({
      globalTime: clamped,
      totalProgress: clamped / TOTAL_DURATION
    })
  },

  setTotalProgress: (progress) => {
    const clamped = Math.max(0, Math.min(progress, 1))
    set({
      totalProgress: clamped,
      globalTime: clamped * TOTAL_DURATION
    })
  },

  advanceTime: (delta) => {
    const { globalTime, isPlaying } = get()
    if (!isPlaying) return
    const newTime = Math.min(globalTime + delta, TOTAL_DURATION)
    set({
      globalTime: newTime,
      totalProgress: newTime / TOTAL_DURATION
    })
  },

  setChapterWeights: (weights) => set({ chapterWeights: weights }),

  setChapterLocalProgress: (progress) => set({ chapterLocalProgress: progress }),

  setScale: (scale) => {
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

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // Skip to a specific chapter start time
  skipToChapter: (chapterId) => {
    const chapter = CHAPTERS.find(c => c.id === chapterId)
    if (chapter) {
      set({
        globalTime: chapter.start,
        totalProgress: chapter.start / TOTAL_DURATION
      })
    }
  },

  skipToEnd: () => set({
    globalTime: CHAPTERS[9].start,
    totalProgress: CHAPTERS[9].start / TOTAL_DURATION
  }),

  reset: () => set({
    globalTime: 0,
    totalProgress: 0,
    isPlaying: true,
    currentScale: 1,
    scaleContext: 'HUMAN',
    narrativeText: '',
    chapterWeights: {},
    chapterLocalProgress: {}
  })
}))

// Helper to get current chapter (for UI/debug - derived from weights)
export function getCurrentChapter(weights) {
  let maxWeight = 0
  let maxChapter = 1
  for (const [id, weight] of Object.entries(weights)) {
    if (weight > maxWeight) {
      maxWeight = weight
      maxChapter = parseInt(id)
    }
  }
  return maxChapter
}

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

// Helper to format scale with meaningful units across all scales
export function formatScale(meters) {
  // Guard against invalid values
  if (!meters || !isFinite(meters) || meters <= 0) {
    return '—'
  }

  const abs = Math.abs(meters)

  // Subatomic scales (< 1 nanometer)
  if (abs < 1e-9) {
    const picometers = abs * 1e12
    if (picometers < 1) {
      const femtometers = abs * 1e15
      return `${femtometers.toFixed(1)} fm`
    }
    return `${picometers.toFixed(1)} pm`
  }

  // Nanometer scale
  if (abs < 1e-6) {
    const nanometers = abs * 1e9
    return `${nanometers.toFixed(1)} nm`
  }

  // Micrometer scale
  if (abs < 1e-3) {
    const micrometers = abs * 1e6
    return `${micrometers.toFixed(1)} μm`
  }

  // Millimeter scale
  if (abs < 1) {
    const millimeters = abs * 1e3
    return `${millimeters.toFixed(1)} mm`
  }

  // Meter scale
  if (abs < 1000) {
    return `${abs.toFixed(1)} m`
  }

  // Kilometer scale (up to ~1 AU)
  if (abs < 1.496e11) {
    const km = abs / 1000
    if (km < 1e6) {
      return `${km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`
    }
    return `${(km / 1e6).toFixed(1)}M km`
  }

  // AU scale (up to ~1 light-year)
  if (abs < 9.461e15) {
    const au = abs / 1.496e11
    return `${au.toFixed(2)} AU`
  }

  // Light-year scale (up to ~1 kiloparsec)
  if (abs < 3.086e19) {
    const ly = abs / 9.461e15
    if (ly < 1000) {
      return `${ly.toFixed(1)} ly`
    }
    return `${(ly / 1000).toFixed(2)}k ly`
  }

  // Kiloparsec scale (up to ~1 megaparsec)
  if (abs < 3.086e22) {
    const kpc = abs / 3.086e19
    return `${kpc.toFixed(1)} kpc`
  }

  // Megaparsec scale (up to ~1 gigaparsec)
  if (abs < 3.086e25) {
    const mpc = abs / 3.086e22
    return `${mpc.toFixed(1)} Mpc`
  }

  // Gigaparsec scale (cosmic web / observable universe)
  const gpc = abs / 3.086e25
  return `${gpc.toFixed(2)} Gpc`
}
