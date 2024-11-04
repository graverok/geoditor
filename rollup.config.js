import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
import typescript from "rollup-plugin-typescript";
import { uglify } from "rollup-plugin-uglify";
import { dts } from "rollup-plugin-dts";
import pkg from "./package.json";

export default [
  {
    input: "src/index.ts",
    output: {
      name: "geoditor",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [
      resolve(),
      commonjs(),
      babel({
        exclude: ["node_modules/**"],
      }),
      typescript(),
      uglify(),
    ],
  },
  {
    input: "src/index.ts",
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
  {
    input: "src/index.ts",
    output: [{ file: pkg.types, format: "es" }],
    plugins: [dts()],
  },
];
