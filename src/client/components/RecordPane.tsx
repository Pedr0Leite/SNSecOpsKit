import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Label, TextArea, TextField, Input } from 'react-aria-components'
import { recordUrl } from '../lib/api'
import {
    editableFields,
    fetchChoices,
    fetchRecord,
    saveRecord,
    type ChoiceOption,
    type FieldSpec,
    type RecordData,
} from '../lib/records'
import type { WorkRow } from '../lib/types'

interface Props {
    row: WorkRow
    currentUserId: string
    onClose: () => void
    onSaved: () => void
}

export function RecordPane({ row, currentUserId, onClose, onSaved }: Props) {
    const [record, setRecord] = useState<RecordData | null>(null)
    const [choices, setChoices] = useState<Record<string, ChoiceOption[]>>({})
    const [edits, setEdits] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    const fields = useMemo(() => editableFields(row.table), [row.table])

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        setEdits({})
        setSaved(false)

        fetchRecord(row.table, row.sys_id, controller.signal)
            .then((data) => {
                setRecord(data)
                return Promise.all(
                    fields
                        .filter((field) => field.type === 'choice')
                        .map((field) =>
                            fetchChoices(row.table, field.name, controller.signal).then(
                                (options) => [field.name, options] as const
                            )
                        )
                )
            })
            .then((pairs) => {
                if (pairs) setChoices(Object.fromEntries(pairs))
            })
            .catch((cause: Error) => {
                if (cause.name !== 'AbortError') setError(cause.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [row.table, row.sys_id, fields])

    const setField = useCallback((name: string, value: string) => {
        setEdits((current) => ({ ...current, [name]: value }))
        setSaved(false)
    }, [])

    const valueOf = useCallback(
        (name: string): string => {
            if (name in edits) return edits[name]
            return record?.[name]?.value ?? ''
        },
        [edits, record]
    )

    const displayOf = useCallback(
        (name: string): string => record?.[name]?.display_value || '—',
        [record]
    )

    const dirty = Object.keys(edits).length > 0

    const save = useCallback(async () => {
        setSaving(true)
        setError(null)
        try {
            const updated = await saveRecord(row.table, row.sys_id, edits)
            setRecord(updated)
            setEdits({})
            setSaved(true)
            onSaved()
        } catch (cause) {
            setError((cause as Error).message)
        } finally {
            setSaving(false)
        }
    }, [edits, onSaved, row.sys_id, row.table])

    const assignToMe = useCallback(() => setField('assigned_to', currentUserId), [currentUserId, setField])

    return (
        <aside className="pane" aria-label={`Record ${row.number ?? ''}`}>
            <header className="pane__head">
                <div className="pane__ident">
                    <span className="row__sev" style={{ ['--sev' as string]: `var(--sev-${row.severity})` }}>
                        {row.severity.toUpperCase()}
                    </span>
                    <span className="mono">{row.number || '—'}</span>
                </div>

                <div className="pane__actions">
                    <Button
                        className="react-aria-Button"
                        onPress={() => window.open(recordUrl(row.table, row.sys_id), '_blank', 'noopener')}
                    >
                        Open record
                    </Button>
                    <Button className="react-aria-Button pane__close" onPress={onClose} aria-label="Close record">
                        ✕
                    </Button>
                </div>
            </header>

            {loading ? (
                <div className="pane__body">
                    <div className="skeleton" />
                    <div className="skeleton" />
                    <div className="skeleton" />
                </div>
            ) : (
                <div className="pane__body">
                    {error ? (
                        <div className="state state--error" role="alert">
                            {error}
                        </div>
                    ) : null}

                    {fields.map((field) => (
                        <FieldRow
                            key={field.name}
                            field={field}
                            value={valueOf(field.name)}
                            display={displayOf(field.name)}
                            options={choices[field.name] || []}
                            onChange={setField}
                        />
                    ))}
                </div>
            )}

            <footer className="pane__foot">
                {row.table.startsWith('sn_si_') && record?.assigned_to?.value !== currentUserId ? (
                    <Button className="react-aria-Button" onPress={assignToMe}>
                        Assign to me
                    </Button>
                ) : null}

                <span className="topbar__spacer" />

                {saved && !dirty ? <span className="footnote">Saved</span> : null}

                <Button className="react-aria-Button btn--primary" isDisabled={!dirty || saving} onPress={save}>
                    {saving ? 'Saving…' : 'Save changes'}
                </Button>
            </footer>
        </aside>
    )
}

function FieldRow({
    field,
    value,
    display,
    options,
    onChange,
}: {
    field: FieldSpec
    value: string
    display: string
    options: ChoiceOption[]
    onChange: (name: string, value: string) => void
}) {
    if (field.type === 'readonly') {
        return (
            <div className="field">
                <span className="field__label">{field.label}</span>
                <span className="field__static">{display}</span>
            </div>
        )
    }

    if (field.type === 'choice') {
        // A native select: it is keyboard- and screen-reader-correct everywhere, and a custom
        // listbox would add weight here without adding anything a user notices.
        return (
            <div className="field">
                <label className="field__label" htmlFor={`f-${field.name}`}>
                    {field.label}
                </label>
                <select
                    id={`f-${field.name}`}
                    className="field__input"
                    value={value}
                    onChange={(event) => onChange(field.name, event.target.value)}
                >
                    {options.length === 0 ? <option value={value}>{display}</option> : null}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        )
    }

    if (field.type === 'textarea') {
        return (
            <TextField className="field" value={value} onChange={(next) => onChange(field.name, next)}>
                <Label className="field__label">{field.label}</Label>
                <TextArea className="field__input" rows={3} />
            </TextField>
        )
    }

    return (
        <TextField className="field" value={value} onChange={(next) => onChange(field.name, next)}>
            <Label className="field__label">{field.label}</Label>
            <Input className="field__input" />
        </TextField>
    )
}
