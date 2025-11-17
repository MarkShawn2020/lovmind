import { Archive, Trash2, FolderPlus, Tag, X, CheckSquare } from 'lucide-react';
import { memo } from 'react';

interface MultiSelectToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchDelete: () => void;
  onBatchArchive: () => void;
  onBatchMoveToFolder?: () => void;
  onBatchAddTag?: () => void;
  onExitMultiSelect: () => void;
  showArchived: boolean;
}

/**
 * Bottom toolbar for batch operations in multi-select mode
 * Replaces the "New Note" button when multi-select is active
 */
const MultiSelectToolbarComponent = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBatchDelete,
  onBatchArchive,
  onBatchMoveToFolder,
  onBatchAddTag,
  onExitMultiSelect,
  showArchived,
}: MultiSelectToolbarProps) => {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex-shrink-0 p-[var(--spacing-s)] pt-2 border-t border-border/40 bg-muted">
      {/* Top row: selection controls */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            已选 {selectedCount} / {totalCount}
          </span>
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-xs px-2 py-1 rounded border border-border bg-background hover:bg-accent transition-colors cursor-pointer"
            type="button"
          >
            <CheckSquare size={14} className="inline mr-1" />
            {allSelected ? '取消全选' : '全选'}
          </button>
        </div>
        <button
          onClick={onExitMultiSelect}
          className="text-xs px-2 py-1 rounded border border-border bg-background hover:bg-accent transition-colors cursor-pointer"
          type="button"
          title="退出多选模式"
        >
          <X size={14} className="inline mr-1" />
          退出
        </button>
      </div>

      {/* Bottom row: action buttons grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBatchArchive}
          disabled={selectedCount === 0}
          className="h-9 px-3 rounded-lg border-none flex items-center justify-center gap-2 font-medium text-xs transition-all duration-200 ease-out shadow-sm touch-manipulation bg-background text-foreground cursor-pointer hover:shadow-md hover:bg-accent active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          title={showArchived ? '批量取消归档' : '批量归档'}
        >
          <Archive size={14} />
          <span>{showArchived ? '取消归档' : '归档'}</span>
        </button>

        {onBatchAddTag && (
          <button
            onClick={onBatchAddTag}
            disabled={selectedCount === 0}
            className="h-9 px-3 rounded-lg border-none flex items-center justify-center gap-2 font-medium text-xs transition-all duration-200 ease-out shadow-sm touch-manipulation bg-background text-foreground cursor-pointer hover:shadow-md hover:bg-accent active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            title="批量添加标签"
          >
            <Tag size={14} />
            <span>标签</span>
          </button>
        )}

        {onBatchMoveToFolder && (
          <button
            onClick={onBatchMoveToFolder}
            disabled={selectedCount === 0}
            className="h-9 px-3 rounded-lg border-none flex items-center justify-center gap-2 font-medium text-xs transition-all duration-200 ease-out shadow-sm touch-manipulation bg-background text-foreground cursor-pointer hover:shadow-md hover:bg-accent active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            title="移动到文件夹"
          >
            <FolderPlus size={14} />
            <span>文件夹</span>
          </button>
        )}

        <button
          onClick={onBatchDelete}
          disabled={selectedCount === 0}
          className="h-9 px-3 rounded-lg border-none flex items-center justify-center gap-2 font-medium text-xs transition-all duration-200 ease-out shadow-sm touch-manipulation bg-destructive text-destructive-foreground cursor-pointer hover:shadow-md hover:bg-destructive/90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          title="批量删除"
        >
          <Trash2 size={14} />
          <span>删除</span>
        </button>
      </div>
    </div>
  );
};

export const MultiSelectToolbar = memo(MultiSelectToolbarComponent);
