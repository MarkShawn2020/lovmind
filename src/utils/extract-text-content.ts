import type {Value} from "platejs";
import {HASHTAG_KEY, type THashtagElement} from "@/components/editor/plugins/hashtag-base-kit.tsx";

export const extractTextContent = (value: Value): { text: string; tags: string[] } => {
    const listCounters = new Map<string, number>();
    const tags = new Set<string>();

    const extractNodeText = (node: any, context?: { prevListType?: string; prevIndent?: number }): string => {
        if (typeof node.text === 'string') {
            let text = node.text;
            if (node.bold) text = `**${text}**`;
            if (node.italic) text = `*${text}*`;
            if (node.code) text = `\`${text}\``;
            if (node.strikethrough) text = `~~${text}~~`;
            return text;
        }

        if (node.children && Array.isArray(node.children)) {
            if (node.type === HASHTAG_KEY) {
                const hashtagElement = node as THashtagElement;
                tags.add(hashtagElement.value);
                return `#${hashtagElement.value}`;
            }

            const childText = node.children.map((child: any) => extractNodeText(child, context)).join('');

            if (node.listStyleType) {
                const indent = node.indent || 0;
                const indentStr = '  '.repeat(indent);

                if (node.listStyleType === 'decimal') {
                    const counterKey = `${indent}-decimal`;

                    if (context?.prevListType !== 'decimal' || context?.prevIndent !== indent) {
                        listCounters.set(counterKey, 1);
                    } else {
                        const current = listCounters.get(counterKey) || 1;
                        listCounters.set(counterKey, current + 1);
                    }

                    const number = listCounters.get(counterKey) || 1;
                    return `${indentStr}${number}. ${childText}`;
                } else {
                    return `${indentStr}- ${childText}`;
                }
            }

            if (node.type === 'h1') return `# ${childText}`;
            if (node.type === 'h2') return `## ${childText}`;
            if (node.type === 'h3') return `### ${childText}`;
            if (node.type === 'h4') return `#### ${childText}`;
            if (node.type === 'h5') return `##### ${childText}`;
            if (node.type === 'h6') return `###### ${childText}`;

            if (node.type === 'blockquote') return `> ${childText}`;
            if (node.type === 'code_block') return `\`\`\`\n${childText}\n\`\`\``;

            if (node.type === 'img') {
                const url = node.url || '';
                const name = node.name || 'image';
                return `![${name}](${url})`;
            }

            return childText;
        }

        return '';
    };

    const results: string[] = [];
    let prevNode: any = null;

    for (const node of value) {
        const context = prevNode?.listStyleType ? {
            prevListType: prevNode.listStyleType,
            prevIndent: prevNode.indent || 0
        } : undefined;

        const text = extractNodeText(node, context);
        if (text.length > 0) {
            results.push(text);
        }

        prevNode = node;
    }

    return {
        text: results.join('\n'),
        tags: Array.from(tags),
    };
};