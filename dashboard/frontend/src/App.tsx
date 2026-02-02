import { useState } from 'react'
import {
  LayoutDashboard,
  ListTodo,
  Settings,
  Moon,
  Sun,
  Activity,
  FolderKanban,
  ChevronRight,
} from 'lucide-react'
import { KanbanBoard } from './components'

type ViewType = 'dashboard' | 'kanban' | 'tasks' | 'activity' | 'settings'

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<ViewType>('kanban')

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const renderView = () => {
    switch (activeView) {
      case 'kanban':
        return <KanbanBoard />
      case 'dashboard':
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Dashboard view coming soon</p>
          </div>
        )
      case 'tasks':
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Tasks list view coming soon</p>
          </div>
        )
      case 'activity':
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Activity feed coming soon</p>
          </div>
        )
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Settings coming soon</p>
          </div>
        )
      default:
        return <KanbanBoard />
    }
  }

  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } flex-shrink-0 border-r transition-all duration-300 bg-white dark:bg-anthropic-charcoal-light`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b flex items-center justify-between">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-anthropic-orange">Loki Mode</h1>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-anthropic-charcoal/5 dark:hover:bg-anthropic-cream/10"
            >
              <ChevronRight
                className={`w-5 h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2">
            <ul className="space-y-1">
              <NavItem
                icon={<LayoutDashboard className="w-5 h-5" />}
                label="Dashboard"
                active={activeView === 'dashboard'}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveView('dashboard')}
              />
              <NavItem
                icon={<FolderKanban className="w-5 h-5" />}
                label="Kanban"
                active={activeView === 'kanban'}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveView('kanban')}
              />
              <NavItem
                icon={<ListTodo className="w-5 h-5" />}
                label="Tasks"
                active={activeView === 'tasks'}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveView('tasks')}
              />
              <NavItem
                icon={<Activity className="w-5 h-5" />}
                label="Activity"
                active={activeView === 'activity'}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveView('activity')}
              />
              <NavItem
                icon={<Settings className="w-5 h-5" />}
                label="Settings"
                active={activeView === 'settings'}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveView('settings')}
              />
            </ul>
          </nav>

          {/* Dark mode toggle */}
          <div className="p-4 border-t">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-anthropic-charcoal/5 dark:hover:bg-anthropic-cream/10"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {!sidebarCollapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-anthropic-cream dark:bg-anthropic-charcoal">
        {renderView()}
      </main>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  collapsed?: boolean
  onClick?: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          active
            ? 'bg-anthropic-orange/10 text-anthropic-orange'
            : 'hover:bg-anthropic-charcoal/5 dark:hover:bg-anthropic-cream/10'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && <span className="font-medium">{label}</span>}
      </button>
    </li>
  )
}

export default App
