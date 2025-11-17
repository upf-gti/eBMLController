import terser from '@rollup/plugin-terser';

export default [
    {
        input: "src/index.controllers.js",
        output: [
            {
                file: 'build/CharacterController.module.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit.'
            },
            {
                file: 'build/CharacterController.module.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit.',
                plugins: [terser()]
            }
        ]
    },
    {
        input: "build/extensions/SigmlToBML.js",
        output: [
            {
                file: 'build/extensions/SigmlToBML.min.js',
                format: 'esm',
                plugins: [terser()]
            }
        ]
    }
];