import React, { useState } from 'react';
import { Plus, Search, Filter, RefreshCw, Settings } from 'lucide-react';
import { Task, TaskStatus, COLUMN_CONFIG } from './types';
import { KanbanColumn } from './KanbanColumn';
import { TaskModal } from './TaskModal';

// Sample data for demonstration
const SAMPLE_TASKS: Task[] = [
  {
    id: '1',
    title: 'Set up project infrastructure',
    description: 'Initialize the monorepo with Turborepo, configure ESLint, Prettier, and TypeScript across all packages.',
    status: 'done',
    priority: 'high',
    type: 'chore',
    assignee: 'Claude',
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-21T14:30:00Z',
    tags: ['infrastructure', 'setup'],
    estimatedHours: 4,
  },
  {
    id: '2',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication with refresh tokens. Include login, logout, and password reset flows.',
    status: 'in_progress',
    priority: 'critical',
    type: 'feature',
    assignee: 'Claude',
    createdAt: '2025-01-21T09:00:00Z',
    updatedAt: '2025-01-22T16:00:00Z',
    tags: ['auth', 'security', 'backend'],
    estimatedHours: 8,
  },
  {
    id: '3',
    title: 'Design system components',
    description: 'Create reusable UI components: Button, Input, Card, Modal, and Toast notification system.',
    status: 'review',
    priority: 'high',
    type: 'feature',
    createdAt: '2025-01-19T11:00:00Z',
    updatedAt: '2025-01-22T10:00:00Z',
    tags: ['ui', 'components'],
    estimatedHours: 12,
  },
  {
    id: '4',
    title: 'Fix mobile responsive issues',
    description: 'Navigation menu overlaps content on screens smaller than 768px. Fix sidebar behavior on mobile.',
    status: 'pending',
    priority: 'medium',
    type: 'bug',
    createdAt: '2025-01-22T08:00:00Z',
    updatedAt: '2025-01-22T08:00:00Z',
    tags: ['mobile', 'css'],
    estimatedHours: 3,
  },
  {
    id: '5',
    title: 'Add unit tests for API endpoints',
    description: 'Write comprehensive unit tests for all REST API endpoints. Target 80% code coverage.',
    status: 'backlog',
    priority: 'medium',
    type: 'test',
    createdAt: '2025-01-22T07:00:00Z',
    updatedAt: '2025-01-22T07:00:00Z',
    tags: ['testing', 'api'],
    estimatedHours: 6,
  },
  {
    id: '6',
    title: 'Write API documentation',
    description: 'Document all API endpoints using OpenAPI spec. Include request/response examples.',
    status: 'backlog',
    priority: 'low',
    type: 'docs',
    createdAt: '2025-01-22T06:00:00Z',
    updatedAt: '2025-01-22T06:00:00Z',
    tags: ['documentation', 'api'],
    estimatedHours: 4,
  },
  {
    id: '7',
    title: 'Optimize database queries',
    description: 'Profile and optimize slow database queries. Add appropriate indexes and implement query caching.',
    status: 'pending',
    priority: 'high',
    type: 'chore',
    createdAt: '2025-01-21T15:00:00Z',
    updatedAt: '2025-01-21T15:00:00Z',
    tags: ['performance', 'database'],
    estimatedHours: 5,
  },
];

export const KanbanBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewTask, setIsNewTask] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Group tasks by status
  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks
      .filter((task) => task.status === status)
      .filter(
        (task) =>
          searchQuery === '' ||
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
              updatedAt: new Date().toISOString(),
              completedAt: newStatus === 'done' ? new Date().toISOString() : task.completedAt,
            }
          : task
      )
    );
    setDragOverColumn(null);
  };

  const handleDragEnter = (status: TaskStatus) => {
    setDragOverColumn(status);
  };

  // Task handlers
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsNewTask(false);
    setIsModalOpen(true);
  };

  const handleAddTask = (status: TaskStatus) => {
    const newTask: Task = {
      id: `${Date.now()}`,
      title: '',
      description: '',
      status,
      priority: 'medium',
      type: 'feature',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };
    setSelectedTask(newTask);
    setIsNewTask(true);
    setIsModalOpen(true);
  };

  const handleSaveTask = (updatedTask: Task) => {
    if (isNewTask) {
      setTasks((prevTasks) => [...prevTasks, updatedTask]);
    } else {
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      );
    }
    setIsModalOpen(false);
    setSelectedTask(null);
    setIsNewTask(false);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const columns: TaskStatus[] = ['backlog', 'pending', 'in_progress', 'review', 'done'];

  return (
    <div className="min-h-screen bg-anthropic-cream dark:bg-anthropic-charcoal">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-anthropic-charcoal-light border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Loki Mode Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Autonomous task management and execution
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-anthropic-charcoal border border-gray-200 dark:border-gray-700 rounded-lg focus:border-anthropic-orange focus:ring-1 focus:ring-anthropic-orange focus:outline-none"
                />
              </div>
              {/* Filter */}
              <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              {/* Refresh */}
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <RefreshCw className="w-5 h-5" />
              </button>
              {/* Settings */}
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              {/* Add Task */}
              <button
                onClick={() => handleAddTask('backlog')}
                className="flex items-center gap-2 px-4 py-2 bg-anthropic-orange hover:bg-anthropic-orange-hover text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {columns.map((status) => {
              const count = getTasksByStatus(status).length;
              const config = COLUMN_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{config.title}:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm ml-auto">
              <span className="text-gray-500 dark:text-gray-400">Total:</span>
              <span className="font-semibold text-anthropic-orange">{tasks.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="p-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={getTasksByStatus(status)}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              onDragStart={handleDragStart}
              onDragOver={(e) => {
                handleDragOver(e);
                handleDragEnter(status);
              }}
              onDrop={handleDrop}
              isDragOver={dragOverColumn === status}
            />
          ))}
        </div>
      </main>

      {/* Task Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
          setIsNewTask(false);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        isNewTask={isNewTask}
      />
    </div>
  );
};

export default KanbanBoard;
