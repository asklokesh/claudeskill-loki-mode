// Kanban board types

export type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskType = 'feature' | 'bug' | 'chore' | 'docs' | 'test';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  estimatedHours?: number;
  completedAt?: string;
}

export interface Column {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

export const COLUMN_CONFIG: Record<TaskStatus, { title: string; color: string }> = {
  backlog: { title: 'Backlog', color: 'bg-gray-100 dark:bg-gray-800' },
  pending: { title: 'Pending', color: 'bg-amber-50 dark:bg-amber-900/20' },
  in_progress: { title: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/20' },
  review: { title: 'Review', color: 'bg-purple-50 dark:bg-purple-900/20' },
  done: { title: 'Done', color: 'bg-green-50 dark:bg-green-900/20' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/40' },
  high: { label: 'High', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/40' },
  medium: { label: 'Medium', color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/40' },
  low: { label: 'Low', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/40' },
};

export const TYPE_CONFIG: Record<TaskType, { label: string; color: string; bgColor: string }> = {
  feature: { label: 'Feature', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
  bug: { label: 'Bug', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/40' },
  chore: { label: 'Chore', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  docs: { label: 'Docs', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/40' },
  test: { label: 'Test', color: 'text-teal-700 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/40' },
};
