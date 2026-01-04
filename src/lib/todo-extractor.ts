import type { Note } from '@/store';

export interface ExtractedTodo {
  noteId: string;
  noteTitle: string;
  text: string;
  checked: boolean;
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
 * Recursively find all task list items (nodes with 'checked' property)
 */
function findTodoNodes(
  nodes: any[],
  noteId: string,
  noteTitle: string,
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
          text,
          checked: node.checked,
          path: currentPath,
        });
      }
    }

    // Recursively search children
    if (Array.isArray(node.children)) {
      todos.push(...findTodoNodes(node.children, noteId, noteTitle, currentPath));
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

  return findTodoNodes(note.richContent, note.id, note.title);
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
    count += todos.filter(t => !t.checked).length;
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
