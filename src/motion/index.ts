/**
 * The motion vocabulary of the public site. Pages compose from here and never
 * import GSAP directly — see `@/motion/gsap` for the one place it is configured.
 *
 * Core layer (app shell):
 *   SmoothScrollProvider, useLenis, Cursor, Preloader, PageTransition, Grain,
 *   ScrollProgress, HeroCanvas
 * Primitives (composed inside pages):
 *   TextReveal, Reveal, Stagger, Magnetic, TiltCard, Marquee, Counter, Parallax,
 *   ScrambleText, StickyStack, HorizontalScroll, SectionNumber
 * Coordination helpers:
 *   onIntroDone, armAfterIntro, INTRO_DONE_EVENT
 */

/* -- core -------------------------------------------------------------- */
export { SmoothScrollProvider, useLenis } from './SmoothScrollProvider'
export { Cursor } from './Cursor'
export { Preloader, INTRO_DONE_EVENT } from './Preloader'
export { PageTransition } from './PageTransition'
export { Grain } from './Grain'
export { ScrollProgress } from './ScrollProgress'
export { HeroCanvas } from './HeroCanvas'

/* -- primitives -------------------------------------------------------- */
export { TextReveal, onIntroDone, armAfterIntro } from './TextReveal'
export type { TextRevealProps, TextRevealType, RevealTrigger, ArmOptions } from './TextReveal'

export { Reveal } from './Reveal'
export type { RevealProps, RevealClip } from './Reveal'

export { Stagger } from './Stagger'
export type { StaggerProps } from './Stagger'

export { Magnetic } from './Magnetic'
export type { MagneticProps } from './Magnetic'

export { TiltCard } from './TiltCard'
export type { TiltCardProps } from './TiltCard'

export { Marquee } from './Marquee'
export type { MarqueeProps } from './Marquee'

export { Counter } from './Counter'
export type { CounterProps } from './Counter'

export { Parallax } from './Parallax'
export type { ParallaxProps } from './Parallax'

export { ScrambleText } from './ScrambleText'
export type { ScrambleTextProps } from './ScrambleText'

export { StickyStack } from './StickyStack'
export type { StickyStackProps } from './StickyStack'

export { HorizontalScroll } from './HorizontalScroll'
export type { HorizontalScrollProps } from './HorizontalScroll'

export { SectionNumber } from './SectionNumber'
export type { SectionNumberProps } from './SectionNumber'
