import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { djotToHtml } from "./djot.js";
import { basename } from "path";

export type PostInfo = {
    slug: string,
    url: string,
    file: string,
    contents: string,
};

export type ReadCache = { [file: string]: Promise<string> };

export const SOURCES = ["posts", "templates"];

// File is relative to /dist
export async function buildPosts(): Promise<PostInfo[]> {
    const [post_files, _] = await Promise.all([readdir("posts"), rm("dist", { recursive: true, force: true })]);
    await mkdir("dist/posts", { recursive: true });
    const templatesCache = {};
    return await Promise.all(post_files.map(f => compilePost(f, templatesCache)));
}

export async function renderWithTemplate(templateFile: string, content: string, templatesCache: ReadCache = {}): Promise<string> {
    let template = templatesCache[templateFile];
    if (!template) {
        template = readFile(`templates/${templateFile}`, { encoding: "utf8" });
        templatesCache[templateFile] = template;
    }
    return (await template).replace("<!-- content -->", content);
}

// Returns the post slug
async function compilePost(filename: string, templatesCache?: ReadCache): Promise<PostInfo> {
    const raw = await readFile(`posts/${filename}`, { encoding: "utf8" });
    const name = basename(filename, ".dj");
    const html = await renderWithTemplate("post.html", djotToHtml(raw), templatesCache);
    const file = `dist/posts/${name}.html`;
    await writeFile(file, html);
    return { slug: name, url: `/posts/${name}`, file, contents: html };
}