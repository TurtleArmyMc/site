import { argv, exit } from "node:process";
import { buildPosts } from "./build.js";
import { serveSite } from "./serve.js";

async function main() {
    const args = argv.slice(2);
    if (args) {
        switch (args[0]) {
            case "build":
                await buildPosts();
                return;
            case "serve":
                await serveSite(args.slice(1));
            return;
        }
    }
    console.error(`Invalid args "${args}"`);
    exit(1);
}

await main();
