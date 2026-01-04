import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import type { Note } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import {
  extractAllTodos,
  updateTodoInNote,
  type TodosByNote,
  type ExtractedTodo,
} from '@/lib/todo-extractor';

interface TodoAggregateViewProps {
  notes: Note[];
  onUpdateNote: (noteId: string, updates: Partial<Note>) => void;
  onOpenNoteInNewWindow: (note: Note) => void;
}

export function TodoAggregateView({
  notes,
  onUpdateNote,
  onOpenNoteInNewWindow,
}: TodoAggregateViewProps) {
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);

  // Extract and group todos
  const todosByNote = useMemo(() => extractAllTodos(notes), [notes]);

  // Separate into uncompleted and completed groups
  const { uncompletedGroups, completedGroups, uncompletedCount, completedCount } = useMemo(() => {
    const uncompleted: TodosByNote[] = [];
    const completed: TodosByNote[] = [];
    let uncompletedTotal = 0;
    let completedTotal = 0;

    for (const group of todosByNote) {
      const uncompletedTodos = group.todos.filter(t => !t.checked);
      const completedTodos = group.todos.filter(t => t.checked);

      if (uncompletedTodos.length > 0) {
        uncompleted.push({ ...group, todos: uncompletedTodos });
        uncompletedTotal += uncompletedTodos.length;
      }

      if (completedTodos.length > 0) {
        completed.push({ ...group, todos: completedTodos });
        completedTotal += completedTodos.length;
      }
    }

    return {
      uncompletedGroups: uncompleted,
      completedGroups: completed,
      uncompletedCount: uncompletedTotal,
      completedCount: completedTotal,
    };
  }, [todosByNote]);

  // Handle todo toggle
  const handleToggle = useCallback(
    (todo: ExtractedTodo) => {
      const note = notes.find(n => n.id === todo.noteId);
      if (!note || !note.richContent) return;

      const updatedRichContent = updateTodoInNote(
        note.richContent,
        todo.path,
        !todo.checked
      );

      onUpdateNote(note.id, { richContent: updatedRichContent });
    },
    [notes, onUpdateNote]
  );

  // Handle note click (open in new window)
  const handleNoteClick = useCallback(
    (noteId: string) => {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        onOpenNoteInNewWindow(note);
      }
    },
    [notes, onOpenNoteInNewWindow]
  );

  // Render a single todo item
  const renderTodoItem = (todo: ExtractedTodo) => (
    <div
      key={`${todo.noteId}-${todo.path.join('-')}`}
      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors group"
    >
      <Checkbox
        checked={todo.checked}
        onCheckedChange={() => handleToggle(todo)}
        className="mt-0.5 flex-shrink-0"
      />
      <span
        className={`flex-1 text-sm cursor-pointer ${
          todo.checked ? 'text-muted-foreground line-through' : 'text-foreground'
        }`}
        onClick={() => handleNoteClick(todo.noteId)}
      >
        {todo.text}
      </span>
      <button
        type="button"
        onClick={() => handleNoteClick(todo.noteId)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-all cursor-pointer border-none bg-transparent"
        title="在新窗口打开"
      >
        <ExternalLink size={14} className="text-muted-foreground" />
      </button>
    </div>
  );

  // Render a note group
  const renderNoteGroup = (group: TodosByNote) => (
    <div key={group.noteId} className="mb-4">
      <button
        type="button"
        onClick={() => handleNoteClick(group.noteId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent w-full text-left"
      >
        <FileText size={14} />
        <span className="truncate flex-1">{group.noteTitle}</span>
        <span className="text-xs opacity-60">
          {new Date(group.noteTime).toLocaleDateString()}
        </span>
      </button>
      <div className="ml-2 border-l-2 border-border/50 pl-2">
        {group.todos.map(renderTodoItem)}
      </div>
    </div>
  );

  // Empty state
  if (todosByNote.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">暂无任务</h3>
        <p className="text-sm text-muted-foreground max-w-[240px]">
          在笔记中使用 [ ] 创建任务列表，任务会自动聚合到这里
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Uncompleted todos */}
      {uncompletedGroups.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-3">
            <span className="text-sm font-semibold text-foreground">待完成</span>
            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
              {uncompletedCount}
            </span>
          </div>
          {uncompletedGroups.map(renderNoteGroup)}
        </div>
      )}

      {/* Completed todos (collapsible) */}
      {completedGroups.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
            className="flex items-center gap-2 mb-3 px-3 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent w-full"
          >
            <span>已完成</span>
            <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
              {completedCount}
            </span>
            <span className="flex-1" />
            {isCompletedCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isCompletedCollapsed && completedGroups.map(renderNoteGroup)}
        </div>
      )}
    </div>
  );
}
