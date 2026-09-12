import { servicenowFrontEndPlugins, rollup, glob } from '@servicenow/isomorphic-rollup'

/**
 * Builds the React client (src/client) into static content before the Fluent build runs.
 *
 * Every .html file under src/client is an entry point; the UI Page Fluent record imports the same
 * HTML file, so the page and the bundle can never drift apart.
 */
export default async ({ rootDir, config, fs, path, logger, registerExplicitId }) => {
    const clientDir = path.join(rootDir, config.clientDir)

    // Compile styles.css into a TypeScript module so the stylesheet travels INSIDE the bundle.
    //
    // Importing the CSS directly makes rollup hoist it into a standalone asset that the installer
    // does not package, so the runtime fetch for it returns HTTP 500 and every page renders
    // unstyled. Inlining removes that request, and therefore that failure, completely.
    const cssPath = path.join(clientDir, 'styles.css')
    const generatedPath = path.join(clientDir, 'lib', 'styles.generated.ts')

    if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf8')
        // Escape only what would terminate or interpolate the template literal.
        const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
        const module = [
            '// GENERATED FROM src/client/styles.css BY now.prebuild.mjs - DO NOT EDIT.',
            '// Edit styles.css instead; this file is rewritten on every build.',
            `export const STYLES = \`${escaped}\``,
            '',
        ].join('\n')

        const existing = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : null
        if (existing !== module) {
            fs.writeFileSync(generatedPath, module)
            logger.info(`Inlined styles.css into styles.generated.ts (${css.length} bytes)`)
        }
    } else {
        logger.warn(`No styles.css found at ${cssPath}`)
    }

    const htmlFilePattern = path.join(clientDir, '**', '*.html')
    const htmlFiles = await glob(htmlFilePattern, { fs })

    if (!htmlFiles.length) {
        logger.warn(`No HTML files found in ${clientDir}, skipping UI build.`)
        return
    }

    const staticContentDir = path.join(rootDir, config.staticContent.buildDir)
    fs.rmSync(staticContentDir, { recursive: true, force: true })

    const rollupBundle = await rollup({
        fs,
        input: htmlFilePattern,
        plugins: [
            servicenowFrontEndPlugins({
                scope: config.scope,
                rootDir: clientDir,
                projectRootDir: rootDir,
                registerExplicitId,
                editableSourceCodeOnInstance: config.packageSourceCodeOnInstance,
            }),
        ],
    })

    const rollupOutput = await rollupBundle.write({
        dir: staticContentDir,
        sourcemap: true,
    })

    rollupOutput.output.forEach((file) => {
        if (file.type === 'asset') {
            logger.info(`Bundled asset: ${file.fileName} (${file.source.length} bytes)`)
        } else if (file.type === 'chunk') {
            logger.info(`Bundled chunk: ${file.fileName} (${file.code.length} bytes)`)
        }
    })
}
