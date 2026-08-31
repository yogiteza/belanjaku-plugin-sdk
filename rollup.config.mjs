import { readFileSync } from 'node:fs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default {
  input: 'src/index.ts',
  // No runtime dependencies today, but declare this so adding one later
  // doesn't accidentally get bundled into consumer code.
  external: [],
  output: [
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __SDK_VERSION__: JSON.stringify(pkg.version),
      },
    }),
    typescript({
      // tsconfig.build.json is tsconfig.json + `exclude: ["src/__tests__"]`,
      // so declaration output doesn't include test files — `npm run
      // typecheck` still uses the base tsconfig.json and covers tests too.
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      // Emit declarations only once, on the first output — avoids the
      // second output pass stomping the same .d.ts files.
      outputToFilesystem: true,
    }),
  ],
};
