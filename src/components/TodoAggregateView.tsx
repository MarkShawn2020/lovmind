import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, MoreHorizontal, Check, X, Clock, Trash2, MessageSquare } from 'lucide-react';
import type { Note } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  extractAllTodos,
  updateTodoStatus,
  updateTodoMemo,
  deleteTodoFromNote,
  type TodosByNote,
  type ExtractedTodo,
  type TodoStatus,
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
  const [isCancelledCollapsed, setIsCancelledCollapsed] = useState(true);
  const [editingMemo, setEditingMemo] = useState<{ todoKey: string; memo: string } | null>(null);

  // Extract and group todos
  const todosByNote = useMemo(() => extractAllTodos(notes), [notes]);

  // Separate into pending, completed, and cancelled groups
  const { pendingGroups, completedGroups, cancelledGroups, pendingCount, completedCount, cancelledCount } = useMemo(() => {
    const pending: TodosByNote[] = [];
    const completed: TodosByNote[] = [];
    const cancelled: TodosByNote[] = [];
    let pendingTotal = 0;
    let completedTotal = 0;
    let cancelledTotal = 0;

    for (const group of todosByNote) {
      const pendingTodos = group.todos.filter(t => t.status === 'pending');
      const completedTodos = group.todos.filter(t => t.status === 'completed');
      const cancelledTodos = group.todos.filter(t => t.status === 'cancelled');

      if (pendingTodos.length > 0) {
        pending.push({ ...group, todos: pendingTodos });
        pendingTotal += pendingTodos.length;
      }

      if (completedTodos.length > 0) {
        completed.push({ ...group, todos: completedTodos });
        completedTotal += completedTodos.length;
      }

      if (cancelledTodos.length > 0) {
        cancelled.push({ ...group, todos: cancelledTodos });
        cancelledTotal += cancelledTodos.length;
      }
    }

    return {
      pendingGroups: pending,
      completedGroups: completed,
      cancelledGroups: cancelled,
      pendingCount: pendingTotal,
      completedCount: completedTotal,
      cancelledCount: cancelledTotal,
    };
  }, [todosByNote]);

  // Handle todo toggle (checkbox click)
  const handleToggle = useCallback(
    (todo: ExtractedTodo) => {
      const note = notes.find(n => n.id === todo.noteId);
      if (!note || !note.richContent) return;

      const newStatus: TodoStatus = todo.status === 'completed' ? 'pending' : 'completed';
      const updatedRichContent = updateTodoStatus(note.richContent, todo.path, newStatus);
      onUpdateNote(note.id, { richContent: updatedRichContent });
    },
    [notes, onUpdateNote]
  );

  // Handle status change from menu
  const handleStatusChange = useCallback(
    (todo: ExtractedTodo, status: TodoStatus) => {
      const note = notes.find(n => n.id === todo.noteId);
      if (!note || !note.richContent) return;

      const updatedRichContent = updateTodoStatus(note.richContent, todo.path, status);
      onUpdateNote(note.id, { richContent: updatedRichContent });
    },
    [notes, onUpdateNote]
  );

  // Handle delete todo
  const handleDelete = useCallback(
    (todo: ExtractedTodo) => {
      const note = notes.find(n => n.id === todo.noteId);
      if (!note || !note.richContent) return;

      const updatedRichContent = deleteTodoFromNote(note.richContent, todo.path);
      onUpdateNote(note.id, { richContent: updatedRichContent });
    },
    [notes, onUpdateNote]
  );

  // Handle memo save
  const handleMemoSave = useCallback(
    (todo: ExtractedTodo, memo: string) => {
      const note = notes.find(n => n.id === todo.noteId);
      if (!note || !note.richContent) return;

      const updatedRichContent = updateTodoMemo(note.richContent, todo.path, memo || undefined);
      onUpdateNote(note.id, { richContent: updatedRichContent });
      setEditingMemo(null);
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

  // Get todo key for tracking
  const getTodoKey = (todo: ExtractedTodo) => `${todo.noteId}-${todo.path.join('-')}`;

  // Render a single todo item
  const renderTodoItem = (todo: ExtractedTodo) => {
    const todoKey = getTodoKey(todo);
    const isEditingMemo = editingMemo?.todoKey === todoKey;

    return (
      <div key={todoKey} className="group">
        <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
          <Checkbox
            checked={todo.status === 'completed'}
            onCheckedChange={() => handleToggle(todo)}
            className="mt-0.5 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span
              className={`text-sm cursor-pointer block ${
                todo.status === 'completed' ? 'text-muted-foreground line-through' :
                todo.status === 'cancelled' ? 'text-muted-foreground line-through opacity-60' :
                'text-foreground'
              }`}
              onClick={() => handleNoteClick(todo.noteId)}
            >
              {todo.text}
            </span>
            {todo.memo && !isEditingMemo && (
              <p className="text-xs text-muted-foreground mt-1 pl-0.5">{todo.memo}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-all cursor-pointer border-none bg-transparent"
              >
                <MoreHorizontal size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => handleNoteClick(todo.noteId)}>
                <ExternalLink size={14} />
                <span>定位到原文</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {todo.status !== 'pending' && (
                <DropdownMenuItem onClick={() => handleStatusChange(todo, 'pending')}>
                  <Clock size={14} />
                  <span>标记待处理</span>
                </DropdownMenuItem>
              )}
              {todo.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleStatusChange(todo, 'completed')}>
                  <Check size={14} />
                  <span>标记完成</span>
                </DropdownMenuItem>
              )}
              {todo.status !== 'cancelled' && (
                <DropdownMenuItem onClick={() => handleStatusChange(todo, 'cancelled')}>
                  <X size={14} />
                  <span>标记取消</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEditingMemo({ todoKey, memo: todo.memo || '' })}>
                <MessageSquare size={14} />
                <span>{todo.memo ? '编辑备注' : '添加备注'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(todo)}>
                <Trash2 size={14} />
                <span>删除</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isEditingMemo && (
          <div className="flex gap-2 px-3 pb-2 ml-7">
            <input
              type="text"
              value={editingMemo.memo}
              onChange={(e) => setEditingMemo({ todoKey, memo: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMemoSave(todo, editingMemo.memo);
                if (e.key === 'Escape') setEditingMemo(null);
              }}
              placeholder="添加备注..."
              className="flex-1 text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleMemoSave(todo, editingMemo.memo)}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditingMemo(null)}
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
            >
              取消
            </button>
          </div>
        )}
      </div>
    );
  };

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
      {/* Pending todos */}
      {pendingGroups.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-3">
            <span className="text-sm font-semibold text-foreground">待完成</span>
            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
              {pendingCount}
            </span>
          </div>
          {pendingGroups.map(renderNoteGroup)}
        </div>
      )}

      {/* Completed todos (collapsible) */}
      {completedGroups.length > 0 && (
        <div className="mb-6">
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

      {/* Cancelled todos (collapsible) */}
      {cancelledGroups.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsCancelledCollapsed(!isCancelledCollapsed)}
            className="flex items-center gap-2 mb-3 px-3 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent w-full"
          >
            <span>已取消</span>
            <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
              {cancelledCount}
            </span>
            <span className="flex-1" />
            {isCancelledCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isCancelledCollapsed && cancelledGroups.map(renderNoteGroup)}
        </div>
      )}
    </div>
  );
}
