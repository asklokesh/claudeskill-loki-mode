import React from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Task, TaskStatus, COLUMN_CONFIG } from './types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  isDragOver: boolean;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  onTaskClick,
  onAddTask,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}) => {
  const config = COLUMN_CONFIG[status];

  const getStatusDot = () => {
    switch (status) {
      case 'backlog':
        return 'bg-gray-400';
      case 'pending':
        return 'bg-amber-400';
      case 'in_progress':
        return 'bg-blue-400';
      case 'review':
        return 'bg-purple-400';
      case 'done':
        return 'bg-green-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div
      className={`flex flex-col min-w-[300px] max-w-[300px] rounded-xl ${config.color} transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-anthropic-orange ring-offset-2 dark:ring-offset-anthropic-charcoal' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot()}`} />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {config.title}
          </h3>
          <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-anthropic-charcoal rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddTask(status)}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-anthropic-charcoal text-gray-500 hover:text-anthropic-orange transition-colors"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-anthropic-charcoal text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Column options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-anthropic-charcoal flex items-center justify-center mb-3">
              <Plus className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tasks yet
            </p>
            <button
              onClick={() => onAddTask(status)}
              className="mt-2 text-sm text-anthropic-orange hover:text-anthropic-orange-hover font-medium"
            >
              Add a task
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>

      {/* Quick Add Button */}
      {tasks.length > 0 && (
        <div className="p-3 pt-0">
          <button
            onClick={() => onAddTask(status)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-anthropic-orange hover:bg-white dark:hover:bg-anthropic-charcoal rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
        </div>
      )}
    </div>
  );
};

export default KanbanColumn;
