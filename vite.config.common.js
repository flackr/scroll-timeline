export function buildConfig(source, filename) {
    return {
        build: {
            sourcemap: true,
            emptyOutDir: false,
            lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: source,
            name: 'ScrollTimeline',
            // the proper extensions will be added
            fileName: (format, entryAlias) => `${filename}${format=='iife'?'':'-' + format}.js`,
            formats: ['iife'],
            },
            minify: 'terser',
            terserOptions: {
            keep_classnames: /^((View|Scroll)Timeline)|CSS.*$/
            },
            rollupOptions: {
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                },
            },
            }
        }
    };
}