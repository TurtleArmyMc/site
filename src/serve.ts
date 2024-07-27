import { buildPosts, renderWithTemplate } from "./build.js";
import { createServer, IncomingMessage, OutgoingHttpHeader, OutgoingHttpHeaders, ServerResponse } from "node:http";

const HTML_HEADER = { 'Content-Type': 'text/html' };

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

    const posts = await buildPosts();
    const postLinks = posts.map(({ slug, url }) => `<a href="${url}">${slug}</a>`);
    const indexPage = await renderWithTemplate("post.html", postLinks.join("\n"));

    const siteFiles: { [url: string]: Serve | undefined } = { "/": { contents: indexPage, headers: HTML_HEADER } };
    posts.forEach(({ url, contents }) => siteFiles[url] = { contents, headers: HTML_HEADER });

    function onRequest(req: IncomingMessage, res: ServerResponse) {
        if (req.url) {
            const toServe = siteFiles[req.url];
            if (toServe) {
                res.writeHead(200, toServe.headers);
                res.end(toServe.contents);
                return;
            }
        }
        res.writeHead(404, { "Content-Type": "text" });
        res.end("not found");
    }

    const server = createServer(onRequest);
    console.log(`listening on http://localhost:${port}`);
    server.listen(port);
}
