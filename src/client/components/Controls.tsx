import { Checkbox, CheckboxGroup, Label, Radio, RadioGroup, SearchField, Input } from 'react-aria-components'
import { SEVERITIES, type Scope, type Severity, type SourceKey } from '../lib/types'
import { THEMES, type Theme } from '../lib/useTheme'

const THEME_LABELS: Record<Theme, string> = {
    daylight: 'Daylight',
    night: 'Night',
    matrix: 'Matrix',
}

/** react-aria gives us the semantics; these render the visual mark. */
function Dot() {
    return <span className="radio__dot" aria-hidden="true" />
}

function Tick() {
    return (
        <span className="check__box" aria-hidden="true">
            <svg viewBox="0 0 12 12">
                <polyline points="2,6.5 4.8,9 10,3.5" />
            </svg>
        </span>
    )
}

export function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (next: Theme) => void }) {
    return (
        <RadioGroup
            className="themeswitch"
            value={theme}
            onChange={(value) => onChange(value as Theme)}
            aria-label="Colour theme"
        >
            {THEMES.map((name) => (
                <Radio key={name} value={name}>
                    {THEME_LABELS[name]}
                </Radio>
            ))}
        </RadioGroup>
    )
}

export function ScopePicker({ scope, onChange }: { scope: Scope; onChange: (next: Scope) => void }) {
    return (
        <div className="group">
            <RadioGroup value={scope} onChange={(value) => onChange(value as Scope)}>
                <Label className="group__label">Whose work</Label>
                <Radio value="me">
                    <Dot />
                    Assigned to me
                </Radio>
                <Radio value="team">
                    <Dot />
                    My team
                </Radio>
                <Radio value="all">
                    <Dot />
                    Everything
                </Radio>
            </RadioGroup>
        </div>
    )
}

export function SourcePicker({ sources, onChange }: { sources: SourceKey[]; onChange: (next: SourceKey[]) => void }) {
    return (
        <div className="group">
            <CheckboxGroup value={sources} onChange={(value) => onChange(value as SourceKey[])}>
                <Label className="group__label">Sources</Label>
                <Checkbox value="sir">
                    <Tick />
                    Security incidents and tasks
                </Checkbox>
                <Checkbox value="findings">
                    <Tick />
                    Vulnerability findings
                </Checkbox>
            </CheckboxGroup>
        </div>
    )
}

const SEVERITY_LABELS: Record<Severity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
}

export function SeverityPicker({
    severities,
    counts,
    onChange,
}: {
    severities: Severity[]
    counts: Record<Severity, number> | null
    onChange: (next: Severity[]) => void
}) {
    return (
        <div className="group">
            <CheckboxGroup value={severities} onChange={(value) => onChange(value as Severity[])}>
                <Label className="group__label">Severity</Label>
                {SEVERITIES.map((severity) => (
                    <Checkbox
                        key={severity}
                        value={severity}
                        className="react-aria-Checkbox sev-option"
                        style={{ ['--sev' as string]: `var(--sev-${severity})` }}
                    >
                        <Tick />
                        {SEVERITY_LABELS[severity]}
                        {counts ? <span className="footnote">&nbsp;{counts[severity]}</span> : null}
                    </Checkbox>
                ))}
            </CheckboxGroup>
        </div>
    )
}

export function SearchBox({ value, onChange }: { value: string; onChange: (next: string) => void }) {
    return (
        <div className="group">
            <SearchField value={value} onChange={onChange}>
                <Label className="group__label">Search</Label>
                <Input placeholder="Number, title, CI, assignee" />
            </SearchField>
        </div>
    )
}
