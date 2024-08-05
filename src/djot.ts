import * as djot from "@djot/djot";

export function parseDjot(raw: string): { content: string, title?: string } {
    const ast = djot.parse(raw);
    const renderer = new djot.HTMLRenderer({
        overrides: sidenoteOverrides(),
    });
    let title: string | null = null;
    const content = renderer.render(ast);
    return title ? { content, title } : { content };

    function sidenoteOverrides(): djot.Visitor<djot.HTMLRenderer, string> {
        let sidenoteBodyIndex = 0;
        let sidenoteRefIndex = 0;

        const transform = (node: djot.AstNode, context: djot.HTMLRenderer): string | undefined => {
            if (node.tag === "link") {
                if (node.destination?.startsWith("http")) {
                    node.attributes ??= {};
                    node.attributes.target = "_blank";
                    node.attributes.rel = "noopener noreferrer";
                }
            }
            if (node.tag === "heading" && node.level === 1 && title === null) {
                title = context.renderChildren(node);
            }
            if (node.attributes && node.attributes["refnote"]) {
                const inx = sidenoteRefIndex++;
                delete node.attributes["refnote"];
                return `${context.renderAstNodeDefault(node)}<a class="noteref" href="#note-${inx}" id="note-${inx}-ref"><span class="note-label">${inx}</span></a>`;
            } else if (node.attributes && node.attributes["note"]) {
                delete node.attributes["note"];
                const inx = sidenoteBodyIndex++;
                return `<div class="inline_note"><aside class="note" id="note-${inx}"><span class="note-label">${inx}</span>${context.renderAstNodeDefault(node)}</aside></div>`;
            }
            return context.renderAstNodeDefault(node);
        };

        return new Proxy({}, { get: (_target, _name) => transform });
    }
}