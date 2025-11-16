import type {Value} from "platejs";

export const createInitialValue = (text: string = ''): Value => {
    if (!text || typeof text !== 'string') {
        return [{type: 'p', children: [{text: ''}]}];
    }

    const lines = text.split('\n');
    return lines.map(line => ({
        type: 'p',
        children: [{text: line}],
    }));
};