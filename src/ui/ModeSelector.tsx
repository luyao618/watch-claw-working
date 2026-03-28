/**
 * ModeSelector — Pixel-art style mode toggle buttons.
 * Three modes: Monitor (default), Game, Desktop Pet.
 *
 * On mobile: only Monitor mode is shown with larger touch targets (44px min).
 */

import { useState } from 'react'

export type AppMode = 'monitor' | 'game' | 'pet'

interface ModeSelectorProps {
  currentMode: AppMode
  onModeChange: (mode: AppMode) => void
  isMobile?: boolean
}

interface ModeButton {
  mode: AppMode
  label: string
}

const MODES: ModeButton[] = [
  { mode: 'monitor', label: 'Monitor Mode' },
  { mode: 'game', label: 'Game Mode' },
  { mode: 'pet', label: 'Pet Mode' },
]

// Fixed width so all buttons are the same size
const BUTTON_WIDTH = 88
const BUTTON_WIDTH_MOBILE = 110

export default function ModeSelector({
  currentMode,
  onModeChange,
  isMobile = false,
}: ModeSelectorProps) {
  const [hovered, setHovered] = useState<AppMode | null>(null)

  // On mobile, only show Monitor mode (the only mode that makes sense
  // for a remote viewer without local file system).
  const visibleModes = isMobile
    ? MODES.filter((m) => m.mode === 'monitor')
    : MODES

  const buttonWidth = isMobile ? BUTTON_WIDTH_MOBILE : BUTTON_WIDTH

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: isMobile ? '4px 6px' : '3px 6px',
        opacity: 0.7,
      }}
    >
      {visibleModes.map(({ mode, label }) => {
        const isActive = currentMode === mode
        const isHovered = hovered === mode && !isActive

        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            onMouseEnter={() => setHovered(mode)}
            onMouseLeave={() => setHovered(null)}
            style={{
              // Fixed width for uniform buttons
              width: buttonWidth,
              // Mobile: ensure 44px minimum touch target
              minHeight: isMobile ? '44px' : undefined,
              // Pixel-art button base
              fontFamily: '"Press Start 2P", "Courier New", monospace',
              fontSize: isMobile ? '7px' : '6px',
              lineHeight: 1,
              padding: isMobile ? '8px 0' : '4px 0',
              cursor: 'pointer',
              border: '1px solid',
              borderRadius: '0px',
              transition: 'none',
              imageRendering: 'pixelated',
              // Subdued colors — blend with dark game background
              backgroundColor: isActive
                ? 'rgba(60, 120, 200, 0.5)'
                : isHovered
                  ? 'rgba(50, 50, 80, 0.6)'
                  : 'rgba(30, 30, 50, 0.5)',
              color: isActive ? '#b0c8e8' : '#707088',
              borderColor: isActive
                ? 'rgba(90, 150, 220, 0.5)'
                : isHovered
                  ? 'rgba(80, 80, 110, 0.5)'
                  : 'rgba(50, 50, 70, 0.4)',
              // Subtle pixel-art 3D inset
              boxShadow: isActive
                ? 'inset -1px -1px 0px rgba(30, 70, 140, 0.5), inset 1px 1px 0px rgba(120, 180, 255, 0.3)'
                : 'none',
              outline: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
