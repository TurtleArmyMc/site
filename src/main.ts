import * as djot from "@djot/djot";
import { readFile } from "fs/promises";

async function main() {
    const buf = await readFile("contents/test.dj");
    const str = buf.toString();
    console.log(str);
    console.log();
    const ast = djot.parse(str);
    const rendered = djot.renderHTML(ast);
    console.log(rendered);
}

await main();