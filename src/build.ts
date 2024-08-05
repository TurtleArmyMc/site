import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { parseDjot } from "./djot.js";
import { basename, relative } from "node:path";

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

export async function renderWithTemplate(templateFile: string, props: { [key: string]: string }, templatesCache: ReadCache = {}): Promise<string> {
    let template = templatesCache[templateFile];
    if (!template) {
        template = readFile(`templates/${templateFile}`, { encoding: "utf8" }).then();
        templatesCache[templateFile] = template;
    }
    let html = await template;
    for (const prop of Object.keys(props)) {
        html = html.replaceAll(new RegExp(`<!--\\s*#prop\\s+${prop}\\s*-->`, "g"), props[prop]);
    }
    const RE_FIND_PROPS = /<!--\s*#prop\s+(\w+)\s*-->/g;
    const missingProps = Array.from(html.matchAll(RE_FIND_PROPS)).map(e => e[1]);
    if (missingProps.length) {
        throw new Error(`did not give props ${missingProps} for template ${templateFile}`)
    }
    return html;
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
    const props = parseDjot(raw);
    props.title ??= basename(filepath).replace(".dj", "");
    try {
        const html = await renderWithTemplate("post.html", props, templatesCache);
        const path = filepath.replace(".dj", ".html");
        return { path, contents: html };
    } catch (e) {
        console.error(`error rendering file ${filepath}`);
        throw e;
    }
}