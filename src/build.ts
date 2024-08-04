import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { djotToHtml } from "./djot.js";
import { relative } from "node:path";

export type FileInfo = {
    path: string,
    contents: string | Buffer,
};

export type ReadCache = { [file: string]: Promise<string> };

export const SOURCES = ["contents", "templates", "static"];

// File is relative to /dist
export async function buildPosts(): Promise<FileInfo[]> {
    const [contentPaths, staticPaths, _] = await Promise.all([
        directoryFiles("contents"),
        directoryFiles("static"),
        rm("dist", { recursive: true, force: true }),
    ]);
    const dirs = [...new Set([...contentPaths.dirpaths, staticPaths.dirpaths])];
    await Promise.all(dirs.map(d => mkdir(`dist/${d}`, { recursive: true })));
    const templatesCache = {};
    const contentFiles = contentPaths.filepaths.map(f => compileFile(f, templatesCache));
    const staticFiles = staticPaths.filepaths.map(path => {
        return readFile(`static/${path}`).then((contents) => { return { path, contents } });
    });
    const allFiles = [...contentFiles, ...staticFiles];
    const writeDistPromise = Promise.all(allFiles.map((infoPromise) => {
        return infoPromise.then(({ path, contents }) => writeFile(`dist/${path}`, contents).then((_) => { return { path, contents }; }));
    }));
    return await writeDistPromise;
}

export async function renderWithTemplate(templateFile: string, content: string, templatesCache: ReadCache = {}): Promise<string> {
    let template = templatesCache[templateFile];
    if (!template) {
        template = readFile(`templates/${templateFile}`, { encoding: "utf8" });
        templatesCache[templateFile] = template;
    }
    return (await template).replace("<!-- content -->", content);
}

function directoryFiles(dirpath: string): Promise<{ filepaths: string[], dirpaths: string[] }> {
    return readdir(dirpath, { recursive: true, withFileTypes: true })
        .then((paths) => {
            const filepaths = paths.filter(p => p.isFile()).map(p => relative(dirpath, `${p.parentPath}/${p.name}`));
            const dirpaths = paths.filter(p => p.isDirectory()).map(p => relative(dirpath, `${p.parentPath}/${p.name}`));
            return { filepaths, dirpaths };
        });
}

async function compileFile(filepath: string, templatesCache?: ReadCache): Promise<FileInfo> {
    // TODO
    // <time datetime="YY-MM-DD">Month DD</time>

    const raw = await readFile(`contents/${filepath}`, { encoding: "utf8" });
    const html = await renderWithTemplate("post.html", djotToHtml(raw), templatesCache);
    const path = filepath.replace(".dj", ".html");
    return { path, contents: html };
}