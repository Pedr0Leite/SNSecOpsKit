import { STYLES } from './styles.generated'

/**
 * Injects the stylesheet from a string compiled into the bundle.
 *
 * Why not `import './styles.css'`: with two HTML entry points, rollup hoists the shared CSS into a
 * standalone `styles.css` asset and the bundle fetches it at runtime by URL. That asset is not
 * packaged as a ux library asset on install, so the request returns HTTP 500 and the page renders
 * with no styles at all — which looks like a broken layout, not a missing file.
 *
 * Carrying the CSS as a string inside the bundle removes the failure mode entirely: there is no
 * second request to fail. `styles.css` remains the editable source; `styles.generated.ts` is
 * produced from it by now.prebuild.mjs before every build.
 */
const STYLE_ID = 'x-335329-secops-styles'

export function injectStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
        return
    }

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLES
    document.head.appendChild(style)
}
