import { watch } from "node:fs";
import { buildPosts, renderWithTemplate, SOURCES } from "./build.js";
import { createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";
import EventEmitter from "node:events";

const HTML_HEADER = { 'Content-Type': 'text/html' };
const EVENT_STREAM_HEADER = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache"
};

type Serve = {
    contents: string,
    headers: OutgoingHttpHeaders,
};

export async function serveSite(args: string[]) {
    let port = 3000;
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--port":
                port = +args[++i];
                break;
            default:
                throw new Error(`invalid arg ${args[i]}`);
        }
    }

    let reloadEvent: EventEmitter = new EventEmitter()

    let siteFiles: { [url: string]: Serve | undefined } = {};
    await rebuild(true);

    SOURCES.forEach(
        sourceDir => watch(
            sourceDir,
            { recursive: true, persistent: false },
            async () => await rebuild(),
        ),
    );

    const server = createServer(onRequest);
    console.log(`listening on http://localhost:${port}`);
    server.listen(port);

    async function rebuild(quiet: boolean = false) {
        const posts = await buildPosts();
        const postLinks = posts.map(({ slug, url }) => `<a href="${url}">${slug}</a>`);
        const indexPage = await renderWithTemplate("post.html", postLinks.join("\n"));

        siteFiles = { "/": { contents: indexPage, headers: HTML_HEADER } };
        posts.forEach(({ url, contents, file }) => {
            if (file.endsWith(".html")) {
                contents += `<head><script>new EventSource("/hotreload").onmessage = () => window.location.reload()</script></head>`;
            }
            siteFiles[url] = { contents, headers: HTML_HEADER };
        });

        if (!quiet) {
            console.log("Built site");
        }
        reloadEvent.emit("reload");
    }

    function onRequest(req: IncomingMessage, res: ServerResponse) {
        if (req.url) {
            if (req.url === "/hotreload") {
                res.writeHead(200, EVENT_STREAM_HEADER);
                reloadEvent.once("reload", () => res.end("data: reload\n\n"));
                return;
            }
            const toServe = siteFiles[req.url];
            if (toServe) {
                res.writeHead(200, toServe.headers);
                res.end(toServe.contents);
                console.log(`\t200\t${req.method}\t${req.url}`);
                return;
            }
        }
        res.writeHead(404, { "Content-Type": "text" });
        res.end("not found");
        console.log(`\t404\t${req.method}\t${req.url}`);
    }
}
