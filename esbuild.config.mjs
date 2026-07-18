import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { execSync } from "child_process";

const prod = process.argv[2] === "production";

const cssConcatPlugin = {
  name: "css-concat",
  setup(build) {
    build.onEnd(() => {
      try {
        execSync("cat styles/*.css > styles.css");
        console.log("  CSS: concatenated styles/*.css → styles.css");
      } catch (e) {
        console.error("  CSS concat failed:", e.message);
      }
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  plugins: [cssConcatPlugin],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
