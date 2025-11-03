import pkg from "./package.json" with { type: "json" };

const externalDependencies = Object.keys(pkg.dependencies || {});

const external = (id) => externalDependencies.some(
    (dep) => id === dep || id.startsWith(`${dep}/`)
);

export default {
    input: "index.js",
    external,
    output: {
        file: "dist/dagify.bundle.js",
        format: "esm",
        sourcemap: true
    }
};
