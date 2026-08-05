import { SerializedLexicalNode } from "lexical";

// TASK : create a securised and stantard method to manipulate json content.$

export function setIdState(content: SerializedLexicalNode, value: string): void {
    if (!content) {
        throw new Error('Content cannot be null or undefined');
    }
    if (!content.$) {
        content.$ = {};
    }
    content.$.id = value;
}

export function getIdState(content: SerializedLexicalNode): string {
    if (!content || !content.$) return '';
    return content.$.id?.toString() || '';
}

export function removeIdState(content: SerializedLexicalNode) {
    if (content.$) {
        delete content.$.id;
    }
}

export function setPositionState(content: SerializedLexicalNode | undefined | null, value: string): void {
    if (!content) {
        throw new Error('Content cannot be null or undefined');
    }
    if (!content.$) {
        content.$ = {};
    }
    content.$.position = value;
}

export function removePositionState(content: SerializedLexicalNode) {
    if (content.$) {
        delete content.$.position;
    }
}

export function getPositionState(content: SerializedLexicalNode): string | null {
    if (!content || !content.$) return null;
    return content.$.position?.toString() || null;
}

export function setNodeTypeState(content: SerializedLexicalNode | undefined | null, value: string): void {
    if (!content) {
        throw new Error('Content cannot be null or undefined');
    }
    if (!content.$) {
        content.$ = {};
    }
    content.$.node_type = value;
}

export function getNodeTypeState(content: SerializedLexicalNode): string | null {
    if (!content || !content.$) return null;
    return content.$.node_type?.toString() || null;
}

export function setUpdateTimeState(content: SerializedLexicalNode, value: number): void {
    if (!content) {
        throw new Error('Content cannot be null or undefined');
    }
    if (!content.$) {
        content.$ = {};
    }
    content.$.updateAt = String(value);
}

export function removeUpdateTimeState(content: SerializedLexicalNode) {
    if (content.$) {
        delete content.$.updateAt;
    }
}

export function getUpdateTimeState(content: SerializedLexicalNode): number {
    if (!content || !content.$) return 0;
    const ret = content.$.updateAt?.toString() || '';
    return Number(ret);
}
