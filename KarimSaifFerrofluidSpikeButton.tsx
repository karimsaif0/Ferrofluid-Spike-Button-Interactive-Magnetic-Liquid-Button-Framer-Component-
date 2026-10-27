/**
 * Made with 💛 by Karim Saif
 * @framerIntrinsicWidth 900
 * @framerIntrinsicHeight 520
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
"use client"

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type SpikeStyle = "organic" | "sharp" | "soft" | "wild"
type CursorStyle = "magnet" | "ring" | "native"

interface Props {
    label: string
    font: React.CSSProperties
    background: string
    liquidColor: string
    highlightColor: string
    accentColor: string
    textColor: string
    buttonHeight: number
    buttonPadding: number
    spikeCount: number
    spikeLength: number
    spikeWidth: number
    spikePreset: SpikeStyle
    magneticRadius: number
    magneticStrength: number
    spring: number
    damping: number
    waveSpeed: number
    gloss: number
    reflection: number
    shadow: number
    cursorEnabled: boolean
    cursorStyle: CursorStyle
    cursorSize: number
    cursorColor: string
    autoplay: boolean
    autoplaySpeed: number
    autoplayDelay: number
    pressScale: number
    showParticles: boolean
    particleCount: number
    paused: boolean
    onClick?: () => void
    style?: React.CSSProperties
}

type Point = { x: number; y: number; nx: number; ny: number }
type Spike = { length: number; velocity: number; variation: number; phase: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number }

const TAU = Math.PI * 2
const W = 400
const H = 100
const R = 50
const STRAIGHT = W - H
const PERIMETER = STRAIGHT * 2 + TAU * R
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 78.233) * 43758.5453
    return v - Math.floor(v)
}
const smoothstep = (a: number, b: number, v: number) => {
    const t = clamp((v - a) / Math.max(b - a, 0.00001), 0, 1)
    return t * t * (3 - 2 * t)
}

function perimeterPoint(fraction: number): Point {
    let d = (((fraction % 1) + 1) % 1) * PERIMETER
    if (d < STRAIGHT) return { x: R + d, y: 0, nx: 0, ny: -1 }
    d -= STRAIGHT
    if (d < Math.PI * R) {
        const a = -Math.PI / 2 + d / R
        return { x: W - R + Math.cos(a) * R, y: R + Math.sin(a) * R, nx: Math.cos(a), ny: Math.sin(a) }
    }
    d -= Math.PI * R
    if (d < STRAIGHT) return { x: W - R - d, y: H, nx: 0, ny: 1 }
    d -= STRAIGHT
    const a = Math.PI / 2 + d / R
    return { x: R + Math.cos(a) * R, y: R + Math.sin(a) * R, nx: Math.cos(a), ny: Math.sin(a) }
}

function spikePath(root: Point, length: number, width: number, bend: number) {
    const tx = -root.ny
    const ty = root.nx
    const ax = root.x + tx * width
    const ay = root.y + ty * width
    const bx = root.x - tx * width
    const by = root.y - ty * width
    const tipX = root.x + root.nx * length + tx * bend
    const tipY = root.y + root.ny * length + ty * bend
    return `M ${ax} ${ay} C ${ax + root.nx * length * 0.32} ${ay + root.ny * length * 0.32} ${tipX - root.nx * length * 0.2} ${tipY - root.ny * length * 0.2} ${tipX} ${tipY} C ${tipX - root.nx * length * 0.2} ${tipY - root.ny * length * 0.2} ${bx + root.nx * length * 0.32} ${by + root.ny * length * 0.32} ${bx} ${by} Z`
}

const defaults: Props = {
    label: "MAGNETIZE",
    font: { fontFamily: "Inter", fontSize: 22, fontWeight: 700, lineHeight: 1 },
    background: "#EDEEF0",
    liquidColor: "#07080B",
    highlightColor: "#FFFFFF",
    accentColor: "#AEB9D8",
    textColor: "#FFFFFF",
    buttonHeight: 96,
    buttonPadding: 64,
    spikeCount: 72,
    spikeLength: 66,
    spikeWidth: 7,
    spikePreset: "organic",
    magneticRadius: 260,
    magneticStrength: 1,
    spring: 20,
    damping: 0.78,
    waveSpeed: 1,
    gloss: 1,
    reflection: 1,
    shadow: 0.35,
    cursorEnabled: true,
    cursorStyle: "magnet",
    cursorSize: 1,
    cursorColor: "#FFFFFF",
    autoplay: true,
    autoplaySpeed: 1,
    autoplayDelay: 1800,
    pressScale: 0.94,
    showParticles: true,
    particleCount: 12,
    paused: false,
}

export default function KarimSaifFerrofluidSpikeButton(input: Props) {
    const p = { ...defaults, ...input }
    const staticRenderer = useIsStaticRenderer()
    const [reducedMotion, setReducedMotion] = React.useState(false)
    const stageRef = React.useRef<HTMLDivElement>(null)
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    const cursorRef = React.useRef<HTMLDivElement>(null)
    const glowRef = React.useRef<SVGCircleElement>(null)
    const spikeRefs = React.useRef<(SVGPathElement | null)[]>([])
    const shadowRefs = React.useRef<(SVGPathElement | null)[]>([])
    const particleRefs = React.useRef<(SVGCircleElement | null)[]>([])
    const pointer = React.useRef({ x: W / 2, y: H / 2, active: false, type: "mouse", id: -1, changed: 0 })
    const wake = React.useRef<() => void>(() => {})
    const resetMotion = React.useRef<() => void>(() => {})
    const id = React.useId().replace(/[^a-zA-Z0-9]/g, "")
    const still = staticRenderer || reducedMotion || p.paused
    const count = clamp(Math.round(p.spikeCount), 12, 180)
    const maxParticles = clamp(Math.round(p.particleCount), 0, 60)
    const buttonHeight = clamp(p.buttonHeight, 24, 240)
    const spikeLength = clamp(p.spikeLength, 0, 200)
    const font: React.CSSProperties = { fontFamily: "Inter", fontSize: 22, fontWeight: 700, lineHeight: 1, ...p.font }

    const spikes = React.useMemo(
        () => Array.from({ length: count }, (_, i) => ({
            length: 0, velocity: 0, variation: 0.7 + hash(i + 91) * 0.6, phase: hash(i + 13) * TAU,
        })), [count]
    )
    const roots = React.useMemo(() => spikes.map((_, i) => perimeterPoint(i / count)), [spikes, count])
    const widthFactor = p.spikePreset === "soft" ? 1.5 : p.spikePreset === "sharp" ? 0.7 : 1
    const initialPaths = React.useMemo(
        () => spikes.map((spike, i) => spikePath(
            roots[i], spikeLength * spike.variation * 0.23,
            p.spikeWidth * spike.variation * widthFactor, 0
        )), [spikes, roots, spikeLength, p.spikeWidth, widthFactor]
    )

    React.useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReducedMotion(media.matches)
        update()
        media.addEventListener?.("change", update)
        return () => media.removeEventListener?.("change", update)
    }, [])

    const hideCursor = React.useCallback(() => {
        if (cursorRef.current) cursorRef.current.style.opacity = "0"
    }, [])

    const release = React.useCallback(() => {
        if (buttonRef.current) buttonRef.current.style.transform = "scale(1)"
        wake.current()
    }, [])

    const move = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (still) return
        const button = buttonRef.current
        const stage = stageRef.current
        if (!button || !stage) return
        const rect = button.getBoundingClientRect()
        const stageRect = stage.getBoundingClientRect()
        pointer.current.x = (event.clientX - rect.left) * W / Math.max(1, rect.width)
        pointer.current.y = (event.clientY - rect.top) * H / Math.max(1, rect.height)
        pointer.current.active = true
        pointer.current.type = event.pointerType
        pointer.current.changed = performance.now()
        if (cursorRef.current) {
            cursorRef.current.style.left = `${event.clientX - stageRect.left}px`
            cursorRef.current.style.top = `${event.clientY - stageRect.top}px`
            cursorRef.current.style.opacity = p.cursorEnabled && p.cursorStyle !== "native" && event.pointerType !== "touch" ? "1" : "0"
        }
        wake.current()
    }, [still, p.cursorEnabled, p.cursorStyle])

    const leave = React.useCallback(() => {
        pointer.current.active = false
        pointer.current.changed = performance.now()
        hideCursor()
        wake.current()
    }, [hideCursor])

    React.useEffect(() => {
        if (still) {
            hideCursor()
            release()
            return
        }
        const stage = stageRef.current
        if (!stage || !buttonRef.current) return
        let alive = true
        let visible = !document.hidden
        let inView = true
        let raf = 0
        let timer: ReturnType<typeof setTimeout> | null = null
        let previous = 0
        let phase = 0
        let activity = 0
        let autoElapsed = 0
        let autoComplete = false
        let lastInteraction = performance.now()
        let particleClock = 0
        const localSpikes: Spike[] = spikes.map(s => ({ ...s, length: spikeLength * s.variation * 0.23 }))
        const particles: Particle[] = Array.from({ length: maxParticles }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 1 }))
        const follow = { x: W / 2, y: H / 2 }
        const clearTimer = () => { if (timer !== null) { clearTimeout(timer); timer = null } }
        const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; previous = 0; clearTimer() }
        const schedule = (ms: number) => {
            clearTimer()
            if (!alive || !visible || !inView) return
            timer = setTimeout(() => { timer = null; start() }, Math.max(16, ms))
        }
        const start = () => {
            if (!alive || !visible || !inView || raf) return
            clearTimer()
            previous = 0
            raf = requestAnimationFrame(tick)
        }
        const tick = (now: number) => {
            raf = 0
            if (!alive || !visible || !inView) return
            const dt = previous ? clamp((now - previous) / 1000, 0, 0.033) : 0.016
            previous = now
            const state = pointer.current
            if (state.changed > lastInteraction) {
                lastInteraction = state.changed
                autoElapsed = 0
                autoComplete = false
            }
            const idle = now - lastInteraction
            const eligible = p.autoplay && !state.active && !autoComplete && idle >= p.autoplayDelay
            if (eligible) autoElapsed += dt
            if (autoElapsed >= 7) { autoElapsed = 0; autoComplete = true }
            const autoActive = eligible && !autoComplete
            let targetX = state.x
            let targetY = state.y
            if (autoActive) {
                const t = autoElapsed * p.autoplaySpeed
                targetX = W / 2 + Math.cos(t) * 180
                targetY = H / 2 + Math.sin(t * 1.3) * 125
            }
            if (state.active || autoActive) {
                const alpha = 1 - Math.exp(-dt * 22)
                follow.x = lerp(follow.x, targetX, alpha)
                follow.y = lerp(follow.y, targetY, alpha)
            }
            const nearestX = clamp(follow.x, R, W - R)
            const distance = Math.max(0, Math.hypot(follow.x - nearestX, follow.y - H / 2) - R)
            const targetActivity = state.active || autoActive
                ? 1 - smoothstep(0, Math.max(1, p.magneticRadius), distance) : 0
            activity = lerp(activity, targetActivity, 1 - Math.exp(-dt * 12))
            const stiffness = clamp(p.spring, 1, 80)
            const dampingRate = -Math.log(clamp(p.damping, 0.1, 0.99)) * 60
            const presetFactor = p.spikePreset === "sharp" ? 1.15 : p.spikePreset === "soft" ? 0.75 : p.spikePreset === "wild" ? 1.35 : 1
            let moving = false
            for (let i = 0; i < localSpikes.length; i++) {
                const spike = localSpikes[i]
                const root = roots[i]
                const dx = follow.x - root.x
                const dy = follow.y - root.y
                const dist = Math.hypot(dx, dy) || 1
                const alignment = Math.pow(
                    Math.max(0, (dx * root.nx + dy * root.ny) / dist),
                    p.spikePreset === "sharp" ? 5 : 3
                )
                const target = clamp(
                    spikeLength * spike.variation * (0.23 + alignment * activity * p.magneticStrength * presetFactor),
                    0, spikeLength * 1.5
                )
                const omega = Math.sqrt(stiffness) * 3
                const dampingFactor = Math.exp(-dampingRate * dt)
                const acceleration = (target - spike.length) * omega * omega
                spike.velocity = (spike.velocity + acceleration * dt) * dampingFactor
                spike.length = clamp(spike.length + spike.velocity * dt, 0, spikeLength * 1.5)
                if (Math.abs(spike.length - target) < 0.025 && Math.abs(spike.velocity) < 0.05) {
                    spike.length = target
                    spike.velocity = 0
                }
                const bend = Math.sin(spike.phase + phase * p.waveSpeed * 2)
                    * spike.length * (p.spikePreset === "wild" ? 0.14 : 0.04) * activity
                const path = spikePath(root, spike.length, p.spikeWidth * spike.variation * widthFactor, bend)
                spikeRefs.current[i]?.setAttribute("d", path)
                shadowRefs.current[i]?.setAttribute("d", path)
                if (Math.abs(spike.length - target) > 0.025 || Math.abs(spike.velocity) > 0.05) moving = true
            }
            if (activity > 0.01) phase += dt
            glowRef.current?.setAttribute("cx", String(follow.x))
            glowRef.current?.setAttribute("cy", String(follow.y))
            glowRef.current?.setAttribute("opacity", String(clamp(activity * p.gloss, 0, 1)))
            particleClock -= dt
            if (p.showParticles && activity > 0.7 && particleClock <= 0) {
                const free = particles.find(item => item.life <= 0)
                if (free) {
                    const angle = Math.random() * TAU
                    const speed = 25 + Math.random() * 65
                    free.x = follow.x
                    free.y = follow.y
                    free.vx = Math.cos(angle) * speed
                    free.vy = Math.sin(angle) * speed
                    free.life = 0.55
                    free.size = 1 + Math.random() * 2
                }
                particleClock = 0.15
            }
            let particlesMoving = false
            particles.forEach((particle, i) => {
                const el = particleRefs.current[i]
                if (!el) return
                if (particle.life <= 0) { el.setAttribute("opacity", "0"); return }
                particlesMoving = true
                particle.life -= dt
                particle.x += particle.vx * dt
                particle.y += particle.vy * dt
                particle.vy += 45 * dt
                el.setAttribute("cx", String(particle.x))
                el.setAttribute("cy", String(particle.y))
                el.setAttribute("r", String(particle.size))
                el.setAttribute("opacity", String(clamp(particle.life / 0.55, 0, 1)))
            })
            const following = (state.active || autoActive) &&
                (Math.abs(follow.x - targetX) > 0.1 || Math.abs(follow.y - targetY) > 0.1)
            if (moving || following || particlesMoving || autoActive ||
                Math.abs(activity - targetActivity) > 0.002) {
                raf = requestAnimationFrame(tick)
                return
            }
            if (p.autoplay && !autoComplete && !state.active) schedule(p.autoplayDelay - idle)
        }
        const reset = () => { autoElapsed = 0; autoComplete = false; lastInteraction = performance.now(); previous = 0 }
        wake.current = start
        resetMotion.current = reset
        const onVisibility = () => {
            visible = !document.hidden
            if (visible) { reset(); start() } else stop()
        }
        const observer = typeof IntersectionObserver === "undefined"
            ? null
            : new IntersectionObserver(([entry]) => {
                inView = !!entry?.isIntersecting
                if (inView) { reset(); start() } else stop()
            }, { threshold: 0.01 })
        observer?.observe(stage)
        document.addEventListener("visibilitychange", onVisibility)
        start()
        return () => {
            alive = false
            stop()
            wake.current = () => {}
            resetMotion.current = () => {}
            observer?.disconnect()
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [
        still, spikes, roots, maxParticles, spikeLength, p.spikeWidth, widthFactor,
        p.spikePreset, p.magneticRadius, p.magneticStrength, p.spring, p.damping,
        p.waveSpeed, p.gloss, p.autoplay, p.autoplaySpeed, p.autoplayDelay, p.showParticles,
    ])

    const metalId = `${id}-metal`
    const shineId = `${id}-shine`
    const glowId = `${id}-glow`
    const shadowId = `${id}-shadow`
    const clipId = `${id}-clip`
    const customCursor = !still && p.cursorEnabled && p.cursorStyle !== "native"
    const edgeSpace = Math.ceil(Math.max(16, spikeLength * 1.6 + p.spikeWidth * 2))

    return (
        <div
            ref={stageRef}
            onPointerMove={move}
            onPointerLeave={leave}
            style={{
                position: "relative", width: "100%", height: "100%", minWidth: 1, minHeight: 1,
                boxSizing: "border-box", padding: edgeSpace, display: "flex",
                alignItems: "center", justifyContent: "center", isolation: "isolate",
                overflow: "hidden", background: p.background, touchAction: "pan-y", ...p.style,
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                onClick={p.onClick}
                onPointerDown={event => {
                    if (still) return
                    pointer.current.id = event.pointerId
                    pointer.current.changed = performance.now()
                    if (event.pointerType !== "touch") event.currentTarget.setPointerCapture(event.pointerId)
                    event.currentTarget.style.transform = `scale(${clamp(p.pressScale, 0.7, 1)})`
                    resetMotion.current()
                    wake.current()
                }}
                onPointerUp={event => { if (pointer.current.id === event.pointerId) pointer.current.id = -1; release() }}
                onPointerCancel={() => { pointer.current.id = -1; pointer.current.active = false; release(); hideCursor() }}
                onLostPointerCapture={() => { pointer.current.id = -1; release() }}
                onKeyDown={event => {
                    if (!still && !event.repeat && (event.key === " " || event.key === "Enter"))
                        event.currentTarget.style.transform = `scale(${clamp(p.pressScale, 0.7, 1)})`
                }}
                onKeyUp={event => { if (event.key === " " || event.key === "Enter") release() }}
                onBlur={release}
                style={{
                    position: "relative", zIndex: 1, display: "inline-flex",
                    alignItems: "center", justifyContent: "center", boxSizing: "border-box",
                    width: "max-content", maxWidth: "100%", minWidth: 0,
                    height: buttonHeight, maxHeight: "100%",
                    padding: `0 ${clamp(p.buttonPadding, 8, 180)}px`,
                    border: 0, borderRadius: 9999, background: "transparent",
                    color: p.textColor, cursor: "pointer", outlineOffset: 5,
                    transformOrigin: "center", transition: still ? "none" : "transform 160ms ease-out",
                    WebkitTapHighlightColor: "transparent", ...font,
                }}
            >
                <svg
                    aria-hidden="true"
                    viewBox={`0 0 ${W} ${H}`}
                    preserveAspectRatio="none"
                    style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        overflow: "visible", pointerEvents: "none",
                    }}
                >
                    <defs>
                        <linearGradient id={metalId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={p.highlightColor} stopOpacity={clamp(p.gloss * 0.38, 0, 1)} />
                            <stop offset="18%" stopColor={p.liquidColor} />
                            <stop offset="72%" stopColor={p.liquidColor} />
                            <stop offset="100%" stopColor="#000000" />
                        </linearGradient>
                        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={p.highlightColor} stopOpacity={clamp(p.reflection * 0.65, 0, 1)} />
                            <stop offset="100%" stopColor={p.highlightColor} stopOpacity="0" />
                        </linearGradient>
                        <radialGradient id={glowId}>
                            <stop offset="0%" stopColor={p.accentColor} stopOpacity="0.5" />
                            <stop offset="100%" stopColor={p.accentColor} stopOpacity="0" />
                        </radialGradient>
                        <filter id={shadowId} x="-100%" y="-200%" width="300%" height="500%">
                            <feGaussianBlur stdDeviation="8" />
                        </filter>
                        <clipPath id={clipId}><rect width={W} height={H} rx={R} /></clipPath>
                    </defs>
                    <g fill="#000000" opacity={clamp(p.shadow * 0.55, 0, 1)} transform="translate(0 8)" filter={`url(#${shadowId})`}>
                        <rect width={W} height={H} rx={R} />
                        {initialPaths.map((path, i) =>
                            <path key={i} ref={el => { shadowRefs.current[i] = el }} d={path} />
                        )}
                    </g>
                    <g fill={`url(#${metalId})`}>
                        <rect width={W} height={H} rx={R} />
                        {initialPaths.map((path, i) =>
                            <path key={i} ref={el => { spikeRefs.current[i] = el }} d={path}
                                stroke={p.highlightColor} strokeOpacity={clamp(p.gloss * 0.1, 0, 0.35)}
                                strokeWidth="0.65" />
                        )}
                    </g>
                    <g clipPath={`url(#${clipId})`}>
                        <rect width={W} height={H} fill={`url(#${shineId})`} opacity="0.6" />
                        <ellipse cx={W / 2} cy={H * 0.16} rx={W * 0.43} ry={H * 0.13}
                            fill={`url(#${shineId})`} opacity={clamp(p.gloss, 0, 1)} />
                        <circle ref={glowRef} cx={W / 2} cy={H / 2} r={W * 0.55}
                            fill={`url(#${glowId})`} opacity="0" />
                    </g>
                    {p.showParticles && Array.from({ length: maxParticles }, (_, i) => (
                        <circle key={i} ref={el => { particleRefs.current[i] = el }}
                            cx="0" cy="0" r="1" fill={p.accentColor} opacity="0" />
                    ))}
                </svg>
                <span style={{
                    position: "relative", zIndex: 2, display: "block", maxWidth: "100%",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,.65)",
                }}>
                    {p.label}
                </span>
            </button>
            {customCursor && (
                <div ref={cursorRef} aria-hidden="true" style={{
                    position: "absolute", left: 0, top: 0, zIndex: 5,
                    width: 0, height: 0, opacity: 0, pointerEvents: "none",
                    transform: `scale(${p.cursorSize})`, transformOrigin: "center",
                }}>
                    {p.cursorStyle === "ring" ? (
                        <div style={{
                            position: "absolute", left: -12, top: -12, width: 24, height: 24,
                            boxSizing: "border-box", border: `2px solid ${p.cursorColor}`, borderRadius: "50%",
                        }} />
                    ) : (
                        <svg width="32" height="32" viewBox="-16 -16 32 32"
                            style={{ position: "absolute", left: -16, top: -16, overflow: "visible" }}>
                            <path d="M -11 0 A 11 11 0 0 1 11 0 M -11 0 V 7 M 11 0 V 7"
                                fill="none" stroke={p.cursorColor} strokeWidth="2" strokeLinecap="round" />
                            <rect x="-14" y="5" width="6" height="5" fill="#FF4A59" />
                            <rect x="8" y="5" width="6" height="5" fill="#4D8EFF" />
                        </svg>
                    )}
                </div>
            )}
        </div>
    )
}

KarimSaifFerrofluidSpikeButton.defaultProps = defaults

addPropertyControls(KarimSaifFerrofluidSpikeButton, {
    label: { type: ControlType.String, title: "Button Text", description: "Text displayed inside the ferrofluid button." },
    font: { type: ControlType.Font, title: "Typography", description: "Customize font family, size, weight, and spacing.", controls: "extended" },
    background: { type: ControlType.Color, title: "Background", description: "Background color of the component frame." },
    liquidColor: { type: ControlType.Color, title: "Ferrofluid", description: "Main color of the liquid metal and spikes." },
    highlightColor: { type: ControlType.Color, title: "Highlights", description: "Color of metallic reflections and spike edges." },
    accentColor: { type: ControlType.Color, title: "Accent", description: "Color of magnetic lighting and droplets." },
    textColor: { type: ControlType.Color, title: "Text Color", description: "Color of the button label." },
    buttonHeight: { type: ControlType.Number, title: "Button Height", description: "Height of the liquid capsule.", min: 24, max: 240, step: 1, unit: "px" },
    buttonPadding: { type: ControlType.Number, title: "Side Padding", description: "Horizontal space around the button label.", min: 8, max: 180, step: 1, unit: "px" },
    spikeCount: { type: ControlType.Number, title: "Spike Count", description: "Number of magnetic spikes around the button.", min: 12, max: 180, step: 1 },
    spikeLength: { type: ControlType.Number, title: "Spike Length", description: "Maximum magnetic spike length.", min: 5, max: 200, step: 1, unit: "px" },
    spikeWidth: { type: ControlType.Number, title: "Spike Width", description: "Thickness of the spike roots.", min: 1, max: 24, step: 0.5, unit: "px" },
    spikePreset: {
        type: ControlType.Enum, title: "Spike Style", description: "Choose the magnetic spike appearance.",
        options: ["organic", "sharp", "soft", "wild"], optionTitles: ["Organic", "Sharp", "Soft", "Wild"],
    },
    magneticRadius: { type: ControlType.Number, title: "Magnet Radius", description: "Distance over which the pointer attracts spikes.", min: 20, max: 800, step: 5, unit: "px" },
    magneticStrength: { type: ControlType.Number, title: "Magnet Power", description: "Strength of magnetic spike growth.", min: 0, max: 3, step: 0.05 },
    spring: { type: ControlType.Number, title: "Spring", description: "Responsiveness of magnetic spike motion.", min: 1, max: 80, step: 1 },
    damping: { type: ControlType.Number, title: "Damping", description: "Controls how quickly the spikes settle.", min: 0.1, max: 0.99, step: 0.01 },
    waveSpeed: { type: ControlType.Number, title: "Wave Speed", description: "Speed of organic spike bending during interaction.", min: 0, max: 5, step: 0.1 },
    gloss: { type: ControlType.Number, title: "Gloss", description: "Intensity of glossy metallic highlights.", min: 0, max: 2, step: 0.05 },
    reflection: { type: ControlType.Number, title: "Reflection", description: "Strength of liquid surface reflections.", min: 0, max: 2, step: 0.05 },
    shadow: { type: ControlType.Number, title: "Shadow", description: "Intensity of the animated ferrofluid shadow.", min: 0, max: 1, step: 0.05 },
    cursorEnabled: { type: ControlType.Boolean, title: "Custom Cursor", description: "Enable or disable the custom magnetic cursor.", enabledTitle: "On", disabledTitle: "Off" },
    cursorStyle: {
        type: ControlType.Enum, title: "Cursor Style", description: "Choose the magnet, ring, or native cursor.",
        options: ["magnet", "ring", "native"], optionTitles: ["Magnet", "Ring", "Native"],
        hidden: (p: Props) => !p.cursorEnabled,
    },
    cursorSize: { type: ControlType.Number, title: "Cursor Size", description: "Scale of the custom cursor.", min: 0.5, max: 3, step: 0.05, hidden: (p: Props) => !p.cursorEnabled || p.cursorStyle === "native" },
    cursorColor: { type: ControlType.Color, title: "Cursor Color", description: "Primary color of the custom cursor.", hidden: (p: Props) => !p.cursorEnabled || p.cursorStyle === "native" },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", description: "Automatically animate magnetic spikes after inactivity.", enabledTitle: "On", disabledTitle: "Off" },
    autoplaySpeed: { type: ControlType.Number, title: "Auto Speed", description: "Speed of automatic magnetic movement.", min: 0.1, max: 4, step: 0.1, hidden: (p: Props) => !p.autoplay },
    autoplayDelay: { type: ControlType.Number, title: "Auto Delay", description: "Delay in milliseconds before autoplay begins.", min: 0, max: 10000, step: 100, unit: "ms", hidden: (p: Props) => !p.autoplay },
    pressScale: { type: ControlType.Number, title: "Press Scale", description: "Compression of the entire button when pressed.", min: 0.7, max: 1, step: 0.01 },
    showParticles: { type: ControlType.Boolean, title: "Particles", description: "Enable floating magnetic droplets.", enabledTitle: "On", disabledTitle: "Off" },
    particleCount: { type: ControlType.Number, title: "Particle Limit", description: "Maximum number of magnetic droplets.", min: 0, max: 60, step: 1, hidden: (p: Props) => !p.showParticles },
    paused: { type: ControlType.Boolean, title: "Pause Motion", description: "Disable animation and display the static ferrofluid button.", enabledTitle: "Paused", disabledTitle: "Playing" },
    onClick: { type: ControlType.EventHandler, title: "Click Action", description: "Connect the button to a Framer interaction or action." },
})
