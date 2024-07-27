import * as djot from "@djot/djot";

export function djotToHtml(raw: string): string {
    const ast = djot.parse(raw);
    const renderer = new djot.HTMLRenderer({
        overrides: sidenoteOverrides(),
    });
    return renderer.render(ast);
}

function sidenoteOverrides(): djot.Visitor<djot.HTMLRenderer, string> {
    let sidenoteBodyIndex = 0;
    let sidenoteRefIndex = 0;

    const transform = (node: djot.AstNode, context: djot.HTMLRenderer): string | undefined => {
        if (node.attributes && node.attributes["refnote"]) {
            const inx = sidenoteRefIndex++;
            delete node.attributes["refnote"];
            return `${context.renderAstNodeDefault(node)}<a class="noteref" href="#note-${inx}" id="note-${inx}-ref">${inx}</a>`;
        } else if (node.attributes && node.attributes["note"]) {
            delete node.attributes["note"];
            const inx = sidenoteBodyIndex++;
            return `<div class="inline_note"><div class="note" id="note-${inx}">${inx} ${context.renderAstNodeDefault(node)}</div></div>`;
        }
        return context.renderAstNodeDefault(node);
    };

    return new Proxy({}, { get: (_target, _name) => transform });
}