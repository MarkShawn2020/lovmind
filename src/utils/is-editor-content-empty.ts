import type {Value} from "platejs";

export const isEditorContentEmpty = (richContent: Value | null | undefined): boolean => {
    if (!richContent) return true;
    if (!Array.isArray(richContent)) return false;

    // Empty editor = only one block + that block contains only empty text nodes + no other node types
    if (richContent.length === 0) return true;
    if (richContent.length > 1) return false;  // Multiple blocks = has content

    const singleNode = richContent[0];

    // Check node type: non-paragraph types = has content (e.g., image, heading, etc.)
    if (singleNode.type && singleNode.type !== 'p') return false;

    // Check children
    if (!singleNode.children || !Array.isArray(singleNode.children)) return true;

    // All children must be empty text nodes (no element nodes)
    return singleNode.children.every((child: any) => {
        // Element node (has type property) = has content
        if (child.type) return false;
        // Text node: check if empty
        if (typeof child.text === 'string') return !child.text.trim();
        // Other cases: treat as having content
        return false;
    });
};