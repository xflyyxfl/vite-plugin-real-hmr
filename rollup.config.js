export default {
    input: 'index.js',
    output: [
        {
            file: 'dist/index.common.js',
            format: 'cjs',
        },
        {
            file: 'dist/index.esm.js',
            format: 'es',
        },
    ]
  };