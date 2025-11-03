import { test } from "brittle";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sleep } from "../helpers/sleep.js";

const shouldRun = process.env.BUNDLE_TEST === "1";
const bundlePath = resolve(process.cwd(), "dist/dagify.bundle.js");

if (!shouldRun) {
    test("rollup bundle test skipped", (t) => {
        t.comment("Set BUNDLE_TEST=1 to verify the rollup bundle.");
    });
} else {
    test("rollup bundle exports are usable", async (t) => {
        t.ok(existsSync(bundlePath), "Rollup output should exist before running bundle tests.");

        const bundleModule = await import(pathToFileURL(bundlePath).href);
        const { createNode, batch } = bundleModule;

        t.is(typeof createNode, "function", "createNode should be exported.");
        t.is(typeof batch, "function", "batch should be exported.");

        const store = createNode(0);
        let latest = store.value;
        const sub = store.subscribe((value) => {
            latest = value;
        });

        batch(() => {
            store.set(1);
            store.set(2);
        });

        await sleep(50);
        t.is(latest, 2, "Subscribers receive the latest batched update.");
        sub.unsubscribe();
    });
}
