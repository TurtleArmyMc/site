import { mkdir, readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { djotToHtml } from "./djot.js";

async function main() {
    const template = (await readFile("templates/post.html")).toString();
    const dj = (await readFile("posts/cheatsheet.dj")).toString();
    const rendered = djotToHtml(dj);
    const html = template.replace("<!-- content -->", rendered);
    await mkdir("dist/", { recursive: true });
    await writeFile("dist/cheatsheet.html", html);
}

await main();
