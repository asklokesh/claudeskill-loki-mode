# PRD: Habit Tracker Mobile App

## Overview
A React Native mobile app called "Streaks" that helps users build daily habits through streak tracking, reminders, and progress visualization. Supports both iOS and Android with a clean, motivating interface.

## Target Users
- People trying to build new habits (exercise, reading, meditation, etc.)
- Self-improvement enthusiasts tracking multiple daily routines
- Users who respond well to streak-based motivation

## Features

### MVP Features
1. **Habit Management** - Create, edit, and delete daily habits with custom names and icons
2. **Daily Check-in** - Tap to mark habits as done for today, undo if tapped by mistake
3. **Streak Tracking** - Current streak count, longest streak, total completions per habit
4. **Reminders** - Push notifications at user-specified times for each habit
5. **Calendar View** - Month view showing completion history with color-coded days
6. **Progress Stats** - Weekly and monthly completion rates, charts per habit
7. **Categories** - Group habits by category (Health, Productivity, Learning, etc.)
8. **Theme Support** - Light and dark mode

### User Flow
1. User opens app for the first time -> onboarding with example habits
2. Adds habits: "Exercise 30 min", "Read 20 pages", "Meditate 10 min"
3. Sets reminders: Exercise at 7:00 AM, Read at 9:00 PM
4. Each morning, opens app -> sees today's habits as a checklist
5. Taps each habit when completed -> streak counter increments
6. Views calendar to see monthly consistency
7. Checks stats to see weekly/monthly trends

## Tech Stack
- Framework: React Native (Expo SDK 50+)
- Navigation: React Navigation v6 (bottom tabs + stack)
- State: Zustand for global state
- Storage: AsyncStorage for habit data (local-first)
- Notifications: expo-notifications
- Charts: react-native-chart-kit or Victory Native
- Icons: Expo vector icons (MaterialCommunityIcons)
- Calendar: react-native-calendars
- Animations: react-native-reanimated

### Structure
```
/
├── app/                          # Expo Router file-based routing
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Today view (daily check-in)
│   │   ├── calendar.tsx          # Calendar view
│   │   ├── stats.tsx             # Statistics view
│   │   └── settings.tsx          # Settings
│   ├── habit/
│   │   ├── [id].tsx              # Habit detail view
│   │   └── new.tsx               # Create/edit habit form
│   ├── _layout.tsx               # Root layout
│   └── onboarding.tsx            # First-time onboarding
├── src/
│   ├── components/
│   │   ├── HabitCard.tsx         # Single habit in today list
│   │   ├── StreakBadge.tsx       # Streak count display
│   │   ├── CompletionChart.tsx   # Weekly/monthly chart
│   │   ├── CalendarHeatmap.tsx   # Calendar with color coding
│   │   ├── CategoryPicker.tsx    # Category selection
│   │   ├── IconPicker.tsx        # Habit icon selection
│   │   └── EmptyState.tsx        # No habits yet view
│   ├── stores/
│   │   ├── habitStore.ts         # Zustand habit store
│   │   └── settingsStore.ts      # App settings store
│   ├── services/
│   │   ├── notifications.ts      # Push notification scheduling
│   │   ├── storage.ts            # AsyncStorage persistence layer
│   │   └── streaks.ts            # Streak calculation logic
│   ├── utils/
│   │   ├── dates.ts              # Date helpers (today, week start, etc.)
│   │   ├── colors.ts             # Theme colors
│   │   └── constants.ts          # App constants
│   └── types/
│       └── habit.ts              # Type definitions
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
├── tests/
│   ├── streaks.test.ts
│   ├── habitStore.test.ts
│   ├── dates.test.ts
│   └── notifications.test.ts
├── app.json
├── package.json
├── tsconfig.json
└── README.md
```

## Data Model

### Habit
```typescript
interface Habit {
  id: string;                    // UUID
  name: string;                  // "Exercise 30 min"
  icon: string;                  // MaterialCommunityIcons name
  color: string;                 // Hex color for the habit
  category: Category;            // Health, Productivity, etc.
  reminderTime: string | null;   // "07:00" or null
  reminderDays: number[];        // [0,1,2,3,4,5,6] (Sun-Sat)
  createdAt: string;             // ISO date
  archived: boolean;             // Soft delete
}

interface HabitCompletion {
  habitId: string;
  date: string;                  // "2025-01-15" (YYYY-MM-DD)
  completedAt: string;           // ISO datetime
}

interface HabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate7d: number;      // 0-1
  completionRate30d: number;     // 0-1
}

type Category =
  | "Health"
  | "Productivity"
  | "Learning"
  | "Mindfulness"
  | "Social"
  | "Finance"
  | "Creative"
  | "Custom";
```

### Storage Schema (AsyncStorage)
```
@streaks/habits        -> Habit[]
@streaks/completions   -> HabitCompletion[]
@streaks/settings      -> AppSettings
@streaks/onboarded     -> boolean
```

### App Settings
```typescript
interface AppSettings {
  theme: "light" | "dark" | "system";
  weekStartsOn: 0 | 1;          // Sunday or Monday
  showCompletedHabits: boolean;
  defaultReminderTime: string;
  hapticFeedback: boolean;
}
```

## Screen Specifications

### Today Screen (Home Tab)
- Header: date ("Wednesday, Jan 15") and overall progress ("3 of 5 done")
- List of habits for today as cards
- Each card shows: icon, name, streak count, tap-to-complete button
- Completed habits show checkmark and move to bottom (or stay in place per setting)
- Pull-to-refresh resets daily view

### Calendar Screen
- Month calendar with dots/colors indicating completion level
- Green: all habits done, Yellow: partial, Empty: none
- Tap a day to see which habits were completed
- Swipe left/right to change months

### Stats Screen
- Overall completion rate (this week, this month)
- Per-habit bar chart (last 7 days)
- Best streak across all habits
- Total habits tracked

### Settings Screen
- Theme toggle (Light / Dark / System)
- Week starts on (Sunday / Monday)
- Export data (JSON)
- Reset all data (with confirmation)
- About / version info

## Requirements
- TypeScript throughout
- Expo managed workflow (no native module ejection)
- Offline-first (all data stored locally, no server)
- Smooth animations on check-in (haptic feedback + visual)
- Push notifications work on both iOS and Android
- Calendar respects user's week start preference
- Streak calculation handles timezone correctly (user's local date)
- Handles edge cases: missed days, habit created mid-week, archived habits
- Minimum supported: iOS 15+, Android API 24+

## Testing
- Unit tests: Streak calculation logic, date utilities, store actions (Jest)
- Component tests: HabitCard renders correctly, completion toggle works (React Native Testing Library)
- Store tests: Zustand store state transitions
- Edge case tests: Streak breaks, timezone boundaries, empty state
- Manual testing: Test on iOS Simulator and Android Emulator

## Out of Scope
- Cloud sync or user accounts
- Social features (sharing streaks, friends)
- Widget (iOS/Android home screen)
- Apple Watch / Wear OS companion
- Gamification (badges, levels, points)
- Habit suggestions or AI recommendations
- App Store / Play Store publishing

## Success Criteria
- App runs on both iOS and Android via Expo Go
- User can create, complete, and delete habits
- Streaks calculated correctly (including break handling)
- Notifications fire at configured times
- Calendar shows accurate completion history
- Stats display correct weekly and monthly rates
- Dark mode renders correctly across all screens
- All tests pass
- No crashes or unhandled errors

---

**Purpose:** Tests Loki Mode's ability to build a cross-platform mobile application with local storage, push notifications, animations, and data visualization. Expect ~45-60 minutes for full execution.
