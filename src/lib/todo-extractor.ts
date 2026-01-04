import type { Note } from '@/store';

export type TodoStatus = 'pending' | 'completed' | 'cancelled';

export interface ExtractedTodo {
  noteId: string;
  noteTitle: string;
  noteTime: string;
  text: string;
  checked: boolean;
  status: TodoStatus;
  memo?: string;
  path: number[]; // Path to the node in richContent for updates
}

export interface TodosByNote {
  noteId: string;
  noteTitle: string;
  noteTime: string;
  todos: ExtractedTodo[];
}

/**
 * Extract text from a Slate node recursively
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';

  // Text node
  if (typeof node.text === 'string') {
    return node.text;
  }

  // Element with children
  if (Array.isArray(node.children)) {
    return node.children.map(extractTextFromNode).join('');
  }

  return '';
}

/**
 * Derive status from node properties
 */
function deriveStatus(node: any): TodoStatus {
  if (node.todoStatus) return node.todoStatus as TodoStatus;
  return node.checked ? 'completed' : 'pending';
}

/**
 * Recursively find all task list items (nodes with 'checked' property)
 */
function findTodoNodes(
  nodes: any[],
  noteId: string,
  noteTitle: string,
  noteTime: string,
  path: number[] = []
): ExtractedTodo[] {
  const todos: ExtractedTodo[] = [];

  if (!Array.isArray(nodes)) return todos;

  nodes.forEach((node, index) => {
    const currentPath = [...path, index];

    // Check if this node is a task list item (has 'checked' property)
    if (typeof node.checked === 'boolean') {
      const text = extractTextFromNode(node).trim();
      if (text) {
        todos.push({
          noteId,
          noteTitle,
          noteTime,
          text,
          checked: node.checked,
          status: deriveStatus(node),
          memo: node.todoMemo,
          path: currentPath,
        });
      }
    }

    // Recursively search children
    if (Array.isArray(node.children)) {
      todos.push(...findTodoNodes(node.children, noteId, noteTitle, noteTime, currentPath));
    }
  });

  return todos;
}

/**
 * Extract all todos from a single note
 */
export function extractTodosFromNote(note: Note): ExtractedTodo[] {
  if (!note.richContent || !Array.isArray(note.richContent)) {
    return [];
  }

  return findTodoNodes(note.richContent, note.id, note.title, note.time);
}

/**
 * Extract and group todos from all notes
 */
export function extractAllTodos(notes: Note[]): TodosByNote[] {
  const result: TodosByNote[] = [];

  // Filter out archived notes and sort by time (newest first)
  const activeNotes = notes
    .filter(n => !n.archived)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  for (const note of activeNotes) {
    const todos = extractTodosFromNote(note);
    if (todos.length > 0) {
      result.push({
        noteId: note.id,
        noteTitle: note.title,
        noteTime: note.time,
        todos,
      });
    }
  }

  return result;
}

/**
 * Count uncompleted todos across all notes
 */
export function countUncompletedTodos(notes: Note[]): number {
  let count = 0;

  for (const note of notes) {
    if (note.archived) continue;
    const todos = extractTodosFromNote(note);
    count += todos.filter(t => t.status === 'pending').length;
  }

  return count;
}

/**
 * Update a todo's checked state in the note's richContent
 * Returns the updated richContent (immutable update)
 */
export function updateTodoInNote(
  richContent: any[],
  path: number[],
  checked: boolean
): any[] {
  if (!Array.isArray(richContent) || path.length === 0) {
    return richContent;
  }

  // Deep clone to avoid mutation
  const result = JSON.parse(JSON.stringify(richContent));

  // Navigate to the target node
  let current: any = { children: result };
  for (let i = 0; i < path.length - 1; i++) {
    if (!current.children || !Array.isArray(current.children)) {
      return richContent; // Path is invalid
    }
    current = current.children[path[i]];
  }

  // Update the target node
  const lastIndex = path[path.length - 1];
  if (current.children && current.children[lastIndex]) {
    current.children[lastIndex] = {
      ...current.children[lastIndex],
      checked,
    };
  }

  return result;
}

/**
 * Update a todo's status in the note's richContent
 */
export function updateTodoStatus(
  richContent: any[],
  path: number[],
  status: TodoStatus
): any[] {
  if (!Array.isArray(richContent) || path.length === 0) {
    return richContent;
  }

  const result = JSON.parse(JSON.stringify(richContent));
  let current: any = { children: result };

  for (let i = 0; i < path.length - 1; i++) {
    if (!current.children || !Array.isArray(current.children)) {
      return richContent;
    }
    current = current.children[path[i]];
  }

  const lastIndex = path[path.length - 1];
  if (current.children && current.children[lastIndex]) {
    current.children[lastIndex] = {
      ...current.children[lastIndex],
      checked: status === 'completed',
      todoStatus: status,
    };
  }

  return result;
}

/**
 * Update a todo's memo in the note's richContent
 */
export function updateTodoMemo(
  richContent: any[],
  path: number[],
  memo: string | undefined
): any[] {
  if (!Array.isArray(richContent) || path.length === 0) {
    return richContent;
  }

  const result = JSON.parse(JSON.stringify(richContent));
  let current: any = { children: result };

  for (let i = 0; i < path.length - 1; i++) {
    if (!current.children || !Array.isArray(current.children)) {
      return richContent;
    }
    current = current.children[path[i]];
  }

  const lastIndex = path[path.length - 1];
  if (current.children && current.children[lastIndex]) {
    const node = { ...current.children[lastIndex] };
    if (memo) {
      node.todoMemo = memo;
    } else {
      delete node.todoMemo;
    }
    current.children[lastIndex] = node;
  }

  return result;
}

/**
 * Delete a todo from the note's richContent
 */
export function deleteTodoFromNote(
  richContent: any[],
  path: number[]
): any[] {
  if (!Array.isArray(richContent) || path.length === 0) {
    return richContent;
  }

  const result = JSON.parse(JSON.stringify(richContent));
  let current: any = { children: result };

  for (let i = 0; i < path.length - 1; i++) {
    if (!current.children || !Array.isArray(current.children)) {
      return richContent;
    }
    current = current.children[path[i]];
  }

  const lastIndex = path[path.length - 1];
  if (current.children && Array.isArray(current.children)) {
    current.children.splice(lastIndex, 1);
  }

  return result;
}
