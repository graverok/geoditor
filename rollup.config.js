import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
import typescript from "rollup-plugin-typescript";
import { uglify } from "rollup-plugin-uglify";
import pkg from "./package.json";

export default [
  {
    input: "src/main.ts",
    output: {
      name: "geomeditor",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [
      resolve(), // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      babel({
        exclude: ["node_modules/**"],
      }),
      typescript(),
      // uglify(),
    ],
  },
  {
    input: "src/main.ts",
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    plugins: [
      babel({
        exclude: ["node_modules/**"],
      }),
      typescript(),
      uglify(),
    ],
  },
  // {
  //   input: "src/types.ts",
  //   output: [{ file: "dist/geometry-editor.d.ts", format: "es" }],
  //   plugins: [dts()],
  // },
];
