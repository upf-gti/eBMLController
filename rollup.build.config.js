import terser from '@rollup/plugin-terser';

export default [
    {
        input: "rollup.build.index.js",
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
        input: "src/extensions/SigmlToBML.js",
        output: [
            {
                file: 'build/extensions/SigmlToBML.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra',
            },
            {
                file: 'build/extensions/SigmlToBML.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra',
                plugins: [terser()]
            }
        ]
    }
];