import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  User,
  Tag,
  Calendar,
  AlertCircle,
  CheckCircle,
  Edit3,
  Trash2,
  Save,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  COLUMN_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
} from './types';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isNewTask?: boolean;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isNewTask = false,
}) => {
  const [isEditing, setIsEditing] = useState(isNewTask);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task });
    }
    setIsEditing(isNewTask);
  }, [task, isNewTask]);

  if (!isOpen || !editedTask) return null;

  const handleSave = () => {
    if (editedTask) {
      onSave({
        ...editedTask,
        updatedAt: new Date().toISOString(),
      });
      setIsEditing(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...(editedTask.tags || []), tagInput.trim()];
      setEditedTask({ ...editedTask, tags: newTags });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = (editedTask.tags || []).filter((tag) => tag !== tagToRemove);
    setEditedTask({ ...editedTask, tags: newTags });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const priorityConfig = PRIORITY_CONFIG[editedTask.priority];
  const typeConfig = TYPE_CONFIG[editedTask.type];
  const statusConfig = COLUMN_CONFIG[editedTask.status];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-anthropic-charcoal rounded-2xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-400 dark:text-gray-500">
                #{editedTask.id}
              </span>
              <div className="flex gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${typeConfig.bgColor} ${typeConfig.color}`}
                >
                  {typeConfig.label}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}
                >
                  {priorityConfig.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Edit task"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Title */}
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTask.title}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, title: e.target.value })
                  }
                  className="w-full text-xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-anthropic-orange focus:outline-none pb-2"
                  placeholder="Task title"
                />
              ) : (
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {editedTask.title}
                </h2>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={editedTask.description}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:ring-1 focus:ring-anthropic-orange focus:outline-none resize-none"
                  placeholder="Add a description..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {editedTask.description || 'No description provided.'}
                </p>
              )}
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Status
                </label>
                {isEditing ? (
                  <select
                    value={editedTask.status}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                  >
                    {Object.entries(COLUMN_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        editedTask.status === 'done'
                          ? 'bg-green-400'
                          : editedTask.status === 'in_progress'
                          ? 'bg-blue-400'
                          : editedTask.status === 'review'
                          ? 'bg-purple-400'
                          : editedTask.status === 'pending'
                          ? 'bg-amber-400'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {statusConfig.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Priority
                </label>
                {isEditing ? (
                  <select
                    value={editedTask.priority}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`w-4 h-4 ${priorityConfig.color}`} />
                    <span className="text-gray-700 dark:text-gray-300">
                      {priorityConfig.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Type
                </label>
                {isEditing ? (
                  <select
                    value={editedTask.type}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        type: e.target.value as TaskType,
                      })
                    }
                    className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">
                    {typeConfig.label}
                  </span>
                )}
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Estimated Hours
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editedTask.estimatedHours || ''}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        estimatedHours: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                    placeholder="0"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {editedTask.estimatedHours
                        ? `${editedTask.estimatedHours} hours`
                        : 'Not set'}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Assignee
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTask.assignee || ''}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        assignee: e.target.value || undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                    placeholder="Unassigned"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {editedTask.assignee || 'Unassigned'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(editedTask.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-lg border border-gray-200 dark:border-gray-700 focus:border-anthropic-orange focus:outline-none"
                  placeholder="Add tag and press Enter"
                />
              )}
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Created: {formatDate(editedTask.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Updated: {formatDate(editedTask.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-anthropic-charcoal-light rounded-b-2xl">
            <button
              onClick={() => onDelete(editedTask.id)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setEditedTask(task ? { ...task } : null);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-anthropic-orange hover:bg-anthropic-orange-hover text-white rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (editedTask.status !== 'done') {
                      setEditedTask({ ...editedTask, status: 'done', completedAt: new Date().toISOString() });
                    }
                    handleSave();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
