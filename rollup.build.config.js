import terser from '@rollup/plugin-terser';

export default [
    {
        input: "src/index.controllers.js",
        output: [
            {
                file: 'build/eBMLController.module.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @gerardllorach @carolinadcf'
            },
            {
                file: 'build/eBMLController.module.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @gerardllorach @carolinadcf',
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
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra',
                plugins: [terser()]
            }
        ]
    }
];