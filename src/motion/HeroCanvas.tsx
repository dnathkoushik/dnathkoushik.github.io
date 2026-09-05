import { useEffect, useRef, useState } from 'react'
import { gsap, isDesktop, motionOK } from '@/motion/gsap'
import { cn } from '@/lib/cn'

/**
 * The hero's living background: a WebGL2 fragment shader that pushes simplex
 * fbm noise through two nested domain warps and paints the result in the two
 * accents over the page canvas. The pointer bends the field toward itself with
 * a heavily lerped weight, so it feels like mass rather than a spotlight.
 *
 * Restraint is built into the shader: the brightest the field is allowed to get
 * is a 35% wash in dark mode (25% in light, whitened), and a vignette returns
 * every edge to the page colour, so type set on top stays legible and the
 * section blends into its neighbours.
 *
 * Output is premultiplied alpha, composited by the browser onto whatever sits
 * behind — normally bg-canvas.
 *
 * Fallbacks, in order: no WebGL2, reduced motion, or a context we cannot create
 * → two soft radial gradients in the same tokens. No libraries, no console.
 */

type RGB = [number, number, number]

interface Palette {
  accent: RGB
  accent2: RGB
  canvas: RGB
  /** 1 when the light theme is active, else 0. */
  light: number
}

const FALLBACK_ACCENT: RGB = [0x4f / 255, 0x6b / 255, 0xed / 255]
const FALLBACK_ACCENT_2: RGB = [0xb0 / 255, 0x5c / 255, 0xe6 / 255]
const FALLBACK_CANVAS_DARK: RGB = [0x16 / 255, 0x18 / 255, 0x1d / 255]
const FALLBACK_CANVAS_LIGHT: RGB = [0xf9 / 255, 0xfa / 255, 0xfc / 255]

/** Highest device-pixel ratio we will ever render at. */
const MAX_DPR = 1.5
/**
 * The field has no hard edges, so rendering below device resolution and letting
 * the browser upscale is indistinguishable — and roughly halves the fill cost.
 */
const RENDER_SCALE = 0.75
/** Per-frame pointer lerp. Low on purpose: the field should feel heavy. */
const POINTER_LERP = 0.06

const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseWeight;
uniform vec3 u_accent;
uniform vec3 u_accent2;
uniform vec3 u_canvas;
uniform float u_light;

out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Four octaves, each rotated so the lattice never lines up with the last.
float fbm(vec2 p) {
  const mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * snoise(p);
    p = rot * p * 2.0 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return sum;
}

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 1.3;
  float t = u_time * 0.045;

  // The pointer as a soft pull on the domain itself.
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0) * 1.3;
  vec2 d = p - m;
  float pull = exp(-dot(d, d) * 2.5) * u_mouseWeight;
  p -= d * pull * 0.35;

  // Two nested warps, then the field that is actually painted.
  vec2 q = vec2(
    fbm(p + vec2(0.0, t * 0.9)),
    fbm(p + vec2(5.2, 1.3) - vec2(t * 0.6, 0.0))
  );
  vec2 r = vec2(
    fbm(p + 1.7 * q + vec2(1.7, 9.2) + vec2(0.0, t * 0.5)),
    fbm(p + 1.7 * q + vec2(8.3, 2.8) + vec2(t * 0.35, 0.0))
  );
  float f = fbm(p + 1.5 * r);

  // A hair of dither in the field breaks up 8-bit banding in the dark gradients.
  float field = clamp(0.5 + 0.55 * f + (hash12(gl_FragCoord.xy) - 0.5) * 0.012, 0.0, 1.0);
  float glow = smoothstep(0.38, 0.92, field);
  float pocket = 1.0 - smoothstep(0.12, 0.55, field);
  float blend = clamp(0.5 + 0.5 * (r.x - r.y) + 0.25 * q.y, 0.0, 1.0);

  // Fade every edge back into the page.
  vec2 vc = (uv - 0.5) * vec2(1.0, 1.3);
  float vignette = 1.0 - smoothstep(0.28, 0.86, length(vc));

  vec3 tint = mix(u_accent, u_accent2, blend);
  tint = mix(tint, vec3(1.0), 0.35 * u_light);
  vec3 deep = mix(u_canvas, vec3(u_light), 0.6);

  float glowA = glow * vignette * mix(0.35, 0.25, u_light);
  float pocketA = pocket * vignette * mix(0.22, 0.10, u_light);

  // Two premultiplied layers, glow over pocket, composited later onto the page.
  vec3 rgb = deep * pocketA * (1.0 - glowA) + tint * glowA;
  float alpha = pocketA * (1.0 - glowA) + glowA;
  fragColor = vec4(rgb, alpha);
}
`

interface Program {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  u: {
    res: WebGLUniformLocation | null
    time: WebGLUniformLocation | null
    mouse: WebGLUniformLocation | null
    mouseWeight: WebGLUniformLocation | null
    accent: WebGLUniformLocation | null
    accent2: WebGLUniformLocation | null
    canvas: WebGLUniformLocation | null
    light: WebGLUniformLocation | null
  }
}

function supportsShader(): boolean {
  return typeof window !== 'undefined' && 'WebGL2RenderingContext' in window && motionOK()
}

/* ------------------------------------------------------------------------ *
 * Token colours → RGB. The tokens are oklch() strings; the only reliable
 * converter in a browser is a 2D canvas, and only browsers that have one get
 * asked. Everyone else gets the hard-coded palette.
 * ------------------------------------------------------------------------ */

let probe: CanvasRenderingContext2D | null | undefined

function getProbe(): CanvasRenderingContext2D | null {
  if (probe !== undefined) return probe
  probe = null
  if (typeof window === 'undefined' || !('CanvasRenderingContext2D' in window)) return probe
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext('2d', { willReadFrequently: true })
  } catch {
    probe = null
  }
  return probe
}

function cssToRgb(css: string, fallback: RGB): RGB {
  const value = css.trim()
  const ctx = getProbe()
  if (!ctx || !value) return fallback
  try {
    // An unparseable colour leaves fillStyle untouched, so a sentinel tells us.
    ctx.fillStyle = '#010203'
    ctx.fillStyle = value
    if (ctx.fillStyle === '#010203') return fallback
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillRect(0, 0, 1, 1)
    const data = ctx.getImageData(0, 0, 1, 1).data
    return [data[0] / 255, data[1] / 255, data[2] / 255]
  } catch {
    return fallback
  }
}

function readPalette(): Palette {
  const root = document.documentElement
  const dark = root.classList.contains('dark')
  const style = getComputedStyle(root)
  const read = (name: string, fallback: RGB) => cssToRgb(style.getPropertyValue(name), fallback)
  return {
    accent: read('--color-accent', FALLBACK_ACCENT),
    accent2: read('--color-accent-2', FALLBACK_ACCENT_2),
    canvas: read('--color-canvas', dark ? FALLBACK_CANVAS_DARK : FALLBACK_CANVAS_LIGHT),
    light: dark ? 0 : 1,
  }
}

/* ------------------------------------------------------------------------ *
 * GL plumbing
 * ------------------------------------------------------------------------ */

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function buildProgram(gl: WebGL2RenderingContext): Program | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE)
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex)
    if (fragment) gl.deleteShader(fragment)
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    return null
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  // Shaders are owned by the program once linked; flag them for release now.
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    gl.deleteProgram(program)
    return null
  }

  const vao = gl.createVertexArray()
  if (!vao) {
    gl.deleteProgram(program)
    return null
  }

  return {
    program,
    vao,
    u: {
      res: gl.getUniformLocation(program, 'u_res'),
      time: gl.getUniformLocation(program, 'u_time'),
      mouse: gl.getUniformLocation(program, 'u_mouse'),
      mouseWeight: gl.getUniformLocation(program, 'u_mouseWeight'),
      accent: gl.getUniformLocation(program, 'u_accent'),
      accent2: gl.getUniformLocation(program, 'u_accent2'),
      canvas: gl.getUniformLocation(program, 'u_canvas'),
      light: gl.getUniformLocation(program, 'u_light'),
    },
  }
}

function destroyProgram(gl: WebGL2RenderingContext, built: Program | null) {
  if (!built) return
  gl.deleteVertexArray(built.vao)
  gl.deleteProgram(built.program)
}

/* ------------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------------ */

export function HeroCanvas({ className }: { className?: string }) {
  const [shader, setShader] = useState<boolean>(supportsShader)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!shader) return
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    // Both branches below assign it, so no initialiser (the lint rightly calls one dead).
    let gl: WebGL2RenderingContext | null
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      })
    } catch {
      gl = null
    }
    if (!gl) {
      setShader(false)
      return
    }
    const ctx: WebGL2RenderingContext = gl

    let built = buildProgram(ctx)
    if (!built) {
      setShader(false)
      return
    }

    const desktop = isDesktop()
    const state = {
      width: 1,
      height: 1,
      lost: false,
      visible: true,
      paletteDirty: true,
      palette: readPalette(),
      // Start a little off-centre so the field has a bias before the pointer arrives.
      mouseX: 0.62,
      mouseY: 0.55,
      targetX: 0.62,
      targetY: 0.55,
      weight: 0,
      targetWeight: 0,
      start: -1,
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width || wrap.clientWidth || 1))
      const h = Math.max(1, Math.round(rect.height || wrap.clientHeight || 1))
      const dpr = desktop ? Math.min(window.devicePixelRatio || 1, MAX_DPR) : 1
      const scale = dpr * RENDER_SCALE
      state.width = Math.max(1, Math.round(w * scale))
      state.height = Math.max(1, Math.round(h * scale))
      if (canvas.width !== state.width || canvas.height !== state.height) {
        canvas.width = state.width
        canvas.height = state.height
      }
      ctx.viewport(0, 0, state.width, state.height)
    }

    const render = (time: number) => {
      if (state.lost || !built || !state.visible || document.hidden) return
      if (state.start < 0) state.start = time

      state.mouseX += (state.targetX - state.mouseX) * POINTER_LERP
      state.mouseY += (state.targetY - state.mouseY) * POINTER_LERP
      state.weight += (state.targetWeight - state.weight) * POINTER_LERP

      ctx.useProgram(built.program)
      ctx.bindVertexArray(built.vao)

      if (state.paletteDirty) {
        const { accent, accent2, canvas: page, light } = state.palette
        ctx.uniform3f(built.u.accent, accent[0], accent[1], accent[2])
        ctx.uniform3f(built.u.accent2, accent2[0], accent2[1], accent2[2])
        ctx.uniform3f(built.u.canvas, page[0], page[1], page[2])
        ctx.uniform1f(built.u.light, light)
        state.paletteDirty = false
      }
      ctx.uniform2f(built.u.res, state.width, state.height)
      ctx.uniform1f(built.u.time, time - state.start)
      ctx.uniform2f(built.u.mouse, state.mouseX, state.mouseY)
      ctx.uniform1f(built.u.mouseWeight, desktop ? state.weight : 0)

      ctx.drawArrays(ctx.TRIANGLES, 0, 3)
    }

    // Pointer, desktop only: phones have no hover and the uniform would just
    // sit at its default.
    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      state.targetX = (event.clientX - rect.left) / rect.width
      state.targetY = 1 - (event.clientY - rect.top) / rect.height
      state.targetWeight = 1
    }
    const onPointerLeave = () => {
      state.targetWeight = 0
    }

    const applyPalette = () => {
      state.palette = readPalette()
      state.paletteDirty = true
    }

    // Chrome composites a canvas whose context has been lost as OPAQUE WHITE —
    // straight over the hero text. So on loss the canvas is hidden at once (the
    // page background shows through, which is what "no shader" should look
    // like) and the browser gets a few seconds to hand the context back. If it
    // does not, we switch to the CSS gradient fallback for good.
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    const onContextLost = (event: Event) => {
      event.preventDefault()
      state.lost = true
      built = null
      canvas.style.visibility = 'hidden'
      if (fallbackTimer) clearTimeout(fallbackTimer)
      fallbackTimer = setTimeout(() => setShader(false), 3000)
    }
    const onContextRestored = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
      built = buildProgram(ctx)
      if (!built) {
        setShader(false)
        return
      }
      state.lost = false
      state.paletteDirty = true
      canvas.style.visibility = ''
      resize()
    }

    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    if (desktop) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
    }

    // `typeof` rather than `in window`: the DOM lib declares these observers as
    // always present, so the negative branch of an `in` check types `window`
    // as never. At runtime they are genuinely optional (jsdom, old Safari).
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(wrap)
    } else {
      window.addEventListener('resize', resize)
    }

    let intersection: IntersectionObserver | null = null
    if (typeof IntersectionObserver === 'function') {
      intersection = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1]
        if (entry) state.visible = entry.isIntersecting
      })
      intersection.observe(wrap)
    }

    let themeObserver: MutationObserver | null = null
    if (typeof MutationObserver === 'function') {
      themeObserver = new MutationObserver(applyPalette)
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    resize()
    gsap.ticker.add(render)

    return () => {
      gsap.ticker.remove(render)
      resizeObserver?.disconnect()
      intersection?.disconnect()
      themeObserver?.disconnect()
      if (!resizeObserver) window.removeEventListener('resize', resize)
      if (desktop) {
        window.removeEventListener('pointermove', onPointerMove)
        document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      }
      // Detach before releasing the context so our own handler does not run.
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (fallbackTimer) clearTimeout(fallbackTimer)
      destroyProgram(ctx, built)
      built = null
      // Deliberately NOT calling WEBGL_lose_context.loseContext() here. A canvas
      // hands back the same context object to every getContext() call, so if
      // this effect re-runs on the same element (React StrictMode in dev, HMR)
      // the next mount would inherit a dead context — and Chrome composites a
      // lost-context canvas as opaque white, over the hero text. Releasing the
      // program and VAO is the cleanup that matters; the context goes with the
      // element.
    }
  }, [shader])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {shader ? (
        <canvas ref={canvasRef} className="block size-full" style={{ willChange: 'transform' }} />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(60% 55% at 18% 22%, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 70%), ' +
              'radial-gradient(55% 50% at 82% 78%, color-mix(in oklab, var(--color-accent-2) 14%, transparent), transparent 70%)',
          }}
        />
      )}
    </div>
  )
}
