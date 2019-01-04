import typescript from "rollup-plugin-typescript2";
import {terser} from "rollup-plugin-terser";

export default [
    {
        input: 'src/browser/Main.ts',
        output: {
            file: 'index.js',
            format: 'cjs'
        },
        plugins: [
            //terser(),
            typescript({
                target: "ES5",
                tsconfigOverride: { compilerOptions: { module: "es2015" } }
            })
        ],
    },
]