import { watch } from "node:fs";
import { buildPosts, SOURCES } from "./build.js";
import { createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";
import EventEmitter from "node:events";
import { readFile } from "node:fs/promises";

const HTML_HEADER = { 'Content-Type': 'text/html' };
const PNG_HEADER = { 'Content-Type': 'image/png' };
const EVENT_STREAM_HEADER = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache"
};

type Serve = {
    contents: string | Buffer,
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

    let pathToResponse: { [url: string]: Serve | undefined } = {};
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
        const files = await buildPosts();
        const indexPage = addClientHotreloadListener(files.find(f => f.path === "index.html")!.contents! as string);

        pathToResponse = { "/": { contents: indexPage, headers: HTML_HEADER } };
        files.forEach(({ contents, path }) => {
            if (path.endsWith(".html")) {
                contents = addClientHotreloadListener(contents as string);
            }
            pathToResponse[`/${path}`] = { contents, headers: fileHeader(path) };
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
            const toServe = pathToResponse[req.url];
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

function fileHeader(path: string): OutgoingHttpHeaders {
    if (path.endsWith(".html")) {
        return HTML_HEADER;
    }
    if (path.endsWith(".png")) {
        return PNG_HEADER;
    }
    throw new Error(`unknown extension for file ${path}`);
}

function addClientHotreloadListener(html: string): string {
    const SCRIPT = `<script>new EventSource("/hotreload").onmessage = () => window.location.reload()</script>`;
    const headInx = html.indexOf("<head>");
    if (headInx !== -1) {
        return `${html.substring(0, headInx)}${SCRIPT}${html.substring(headInx)}`;
    }
    let htmlInx = html.indexOf("<html>");
    const HEAD_SCRIPT = `<head>${SCRIPT}</head>`;
    return htmlInx === -1 ? `${html}${HEAD_SCRIPT}` : `${html.substring(0, htmlInx)}${HEAD_SCRIPT}${html.substring(htmlInx)}`;
}