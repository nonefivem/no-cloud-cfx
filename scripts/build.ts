import { build, type BuildConfig, type BunPlugin } from "bun";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { parseArgs } from "util";

// Parse CLI arguments
const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    minify: {
      type: "boolean",
      default: true
    },
    sourcemap: {
      type: "string",
      default: "none"
    },
    watch: {
      type: "boolean",
      short: "w",
      default: false
    }
  },
  strict: false,
  allowPositionals: true
});

const ROOT_DIR = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT_DIR, "src");
const DIST_DIR = join(ROOT_DIR, "dist");

/**
 * Plugin to resolve @common path alias
 */
const pathAliasPlugin: BunPlugin = {
  name: "path-alias",
  setup(build) {
    build.onResolve({ filter: /^@common$/ }, () => {
      return { path: join(SRC_DIR, "common/index.ts") };
    });

    build.onResolve({ filter: /^@\/.*$/ }, args => {
      const path = args.path.replace(/^@\//, "");
      // Determine if client or server based on importer
      const isServer = args.importer.includes("/server/");
      const baseDir = isServer ? "server" : "client";
      return { path: join(SRC_DIR, baseDir, path + ".ts") };
    });
  }
};

const sourcemapValue =
  args.sourcemap === "none"
    ? "none"
    : args.sourcemap === "inline"
      ? "inline"
      : "external";

const sharedConfig: Partial<BuildConfig> = {
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: false,
    keepNames: false
  },
  sourcemap: sourcemapValue,
  plugins: [pathAliasPlugin]
};

async function buildClient() {
  console.log("Building client...");

  const result = await build({
    ...sharedConfig,
    entrypoints: [join(SRC_DIR, "client/index.ts")],
    outdir: DIST_DIR,
    naming: "client.js",
    target: "node",
    format: "cjs"
  });

  if (!result.success) {
    console.error("Client build failed:", result.logs);
    process.exit(1);
  }

  console.log("✓ Client built: dist/client.js");
}

async function buildServer() {
  console.log("Building server...");

  const result = await build({
    ...sharedConfig,
    entrypoints: [join(SRC_DIR, "server/index.ts")],
    outdir: DIST_DIR,
    naming: "server.js",
    target: "node",
    format: "cjs"
  });

  if (!result.success) {
    console.error("Server build failed:", result.logs);
    process.exit(1);
  }

  console.log("✓ Server built: dist/server.js");
}

async function buildWeb() {
  console.log("Building web...");

  const webDistDir = join(DIST_DIR, "web");
  await mkdir(webDistDir, { recursive: true });

  // Build JavaScript
  const result = await build({
    ...sharedConfig,
    entrypoints: [join(SRC_DIR, "web/app.ts")],
    outdir: webDistDir,
    naming: "index.js",
    target: "browser",
    format: "esm"
  });

  if (!result.success) {
    console.error("Web build failed:", result.logs);
    process.exit(1);
  }

  // Copy HTML
  const htmlContent = await readFile(join(SRC_DIR, "web/index.html"), "utf-8");
  await writeFile(join(webDistDir, "index.html"), htmlContent);

  // Copy CSS
  const cssContent = await readFile(join(SRC_DIR, "web/styles.css"), "utf-8");
  await writeFile(join(webDistDir, "index.css"), cssContent);

  console.log("✓ Web built: dist/web/index.js, dist/web/index.html, dist/web/index.css");
}

async function copyFxManifest() {
  console.log("Copying fxmanifest.lua...");

  const manifestContent = await readFile(join(ROOT_DIR, "fxmanifest.lua"), "utf-8");
  await writeFile(join(DIST_DIR, "fxmanifest.lua"), manifestContent);

  console.log("✓ Copied: dist/fxmanifest.lua");
}

async function copyLuaLibraries() {
  console.log("Copying Lua libraries...");

  const luaSrcDir = join(ROOT_DIR, "lua");
  const luaDistDir = join(DIST_DIR, "lua");

  await mkdir(luaDistDir, { recursive: true });

  const luaFiles = ["client.lua", "server.lua"];

  for (const file of luaFiles) {
    const content = await readFile(join(luaSrcDir, file), "utf-8");
    await writeFile(join(luaDistDir, file), content);
    console.log(`✓ Copied: dist/lua/${file}`);
  }
}

async function main() {
  console.log("Starting build...");
  console.log(`Options: minify=${args.minify}, sourcemap=${args.sourcemap}\n`);

  await mkdir(DIST_DIR, { recursive: true });

  await Promise.all([buildClient(), buildServer(), buildWeb()]);
  await Promise.all([copyLuaLibraries(), copyFxManifest()]);

  console.log("\n✓ Build complete!");
}

main().catch(error => {
  console.error("Build failed:", error);
  process.exit(1);
});
