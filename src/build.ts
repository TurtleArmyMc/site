import { readdir, readFile, writeFile, rm, mkdir, lstat } from "node:fs/promises";
import { djotToHtml } from "./djot.js";
import { relative } from "node:path";

export type PostInfo = {
    path: string,
    contents: string,
};

export type ReadCache = { [file: string]: Promise<string> };

export const SOURCES = ["contents", "templates"];

// File is relative to /dist
export async function buildPosts(): Promise<PostInfo[]> {
    const [contents, _] = await Promise.all([readdir("contents", { recursive: true, withFileTypes: true }), rm("dist", { recursive: true, force: true })]);
    const relativePaths = contents.map(p => { return { path: relative("contents", `${p.parentPath}/${p.name}`), isDir: p.isDirectory() }; });
    const files = relativePaths.filter(f => !f.isDir).map(f  => f.path);
    const dirs = relativePaths.filter(f => f.isDir).map(f => f.path);
    await mkdir("dist");
    await Promise.all(dirs.map(d => mkdir(`dist/${d}`, { recursive: true })));
    const templatesCache = {};
    return await Promise.all(files.map(f => compileFile(f, templatesCache)));
}

export async function renderWithTemplate(templateFile: string, content: string, templatesCache: ReadCache = {}): Promise<string> {
    let template = templatesCache[templateFile];
    if (!template) {
        template = readFile(`templates/${templateFile}`, { encoding: "utf8" });
        templatesCache[templateFile] = template;
    }
    return (await template).replace("<!-- content -->", content);
}

async function compileFile(filepath: string, templatesCache?: ReadCache): Promise<PostInfo> {
    // TODO
    // <time datetime="YY-MM-DD">Month DD</time>

    const raw = await readFile(`contents/${filepath}`, { encoding: "utf8" });
    const html = await renderWithTemplate("post.html", djotToHtml(raw), templatesCache);
    const path = filepath.replace(".dj", ".html");
    await writeFile(`dist/${path}`, html);
    return { path, contents: html };
}