import { useState, type ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { WIDTHS, type Layout, type PanelWidth } from '../lib/layout'

export interface PanelDef {
    id: string
    title: string
    hint?: string
    /** Width a user who has never edited their layout gets. */
    defaultWidth: PanelWidth
    render: () => ReactNode
}

interface Props {
    panels: PanelDef[]
    layout: Layout
    editing: boolean
    onMove: (id: string, direction: -1 | 1) => void
    onDrop: (fromId: string, toId: string) => void
    onWidth: (id: string, width: PanelWidth) => void
    onHide: (id: string, hidden: boolean) => void
}

/**
 * Renders the panels in the user's order and widths, with edit affordances when editing.
 *
 * Two ways to reorder, on purpose: drag for pointer users, and explicit move buttons for keyboard
 * and screen-reader users. Drag-and-drop alone is a well-known accessibility failure, and the
 * buttons cost almost nothing.
 */
export function PanelHost({ panels, layout, editing, onMove, onDrop, onWidth, onHide }: Props) {
    const [dragging, setDragging] = useState<string | null>(null)
    const [over, setOver] = useState<string | null>(null)

    const byId = new Map(panels.map((panel) => [panel.id, panel]))
    const visible = layout.filter((state) => !state.hidden || editing)

    return (
        <div className="grid grid--layout">
            {visible.map((state, index) => {
                const panel = byId.get(state.id)
                if (!panel) return null

                return (
                    <section
                        key={state.id}
                        className="panel"
                        data-width={state.width}
                        data-hidden={String(state.hidden)}
                        data-dragging={String(dragging === state.id)}
                        data-over={String(over === state.id && dragging !== state.id)}
                        draggable={editing}
                        onDragStart={(event) => {
                            setDragging(state.id)
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', state.id)
                        }}
                        onDragOver={(event) => {
                            if (!editing || !dragging) return
                            event.preventDefault()
                            setOver(state.id)
                        }}
                        onDragLeave={() => setOver((current) => (current === state.id ? null : current))}
                        onDrop={(event) => {
                            event.preventDefault()
                            const fromId = event.dataTransfer.getData('text/plain') || dragging
                            if (fromId) onDrop(fromId, state.id)
                            setDragging(null)
                            setOver(null)
                        }}
                        onDragEnd={() => {
                            setDragging(null)
                            setOver(null)
                        }}
                    >
                        <div className="panel__head">
                            <h2 className="panel__title">{panel.title}</h2>
                            {panel.hint && !editing ? <span className="footnote">{panel.hint}</span> : null}
                        </div>

                        {editing ? (
                            <div className="panel__tools" role="group" aria-label={`Layout for ${panel.title}`}>
                                <Button
                                    className="react-aria-Button tool"
                                    isDisabled={index === 0}
                                    onPress={() => onMove(state.id, -1)}
                                    aria-label={`Move ${panel.title} earlier`}
                                >
                                    ←
                                </Button>
                                <Button
                                    className="react-aria-Button tool"
                                    isDisabled={index === visible.length - 1}
                                    onPress={() => onMove(state.id, 1)}
                                    aria-label={`Move ${panel.title} later`}
                                >
                                    →
                                </Button>

                                <span className="tool__group" role="group" aria-label={`Width of ${panel.title}`}>
                                    {WIDTHS.map((width) => (
                                        <Button
                                            key={width.value}
                                            className="react-aria-Button tool"
                                            data-active={String(state.width === width.value)}
                                            onPress={() => onWidth(state.id, width.value)}
                                            aria-label={`Set ${panel.title} to ${width.label} width`}
                                            aria-pressed={state.width === width.value}
                                        >
                                            {width.label}
                                        </Button>
                                    ))}
                                </span>

                                <Button
                                    className="react-aria-Button tool"
                                    onPress={() => onHide(state.id, !state.hidden)}
                                    aria-label={state.hidden ? `Show ${panel.title}` : `Hide ${panel.title}`}
                                >
                                    {state.hidden ? 'Show' : 'Hide'}
                                </Button>
                            </div>
                        ) : null}

                        {state.hidden ? <p className="chart-empty">Hidden</p> : panel.render()}
                    </section>
                )
            })}
        </div>
    )
}
