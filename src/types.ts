export interface PluginSettings {
    tasksFolder: string;
    dailyFolder: string;
    planSectionName: string;
    logSectionName: string;
    dailyNoteFormat: string;
    timeRoundingMinutes: number;
    showStatusBar: boolean;
    autoShowHistory: boolean;
    lunchStartTime: string;
    lunchEndTime: string;
    defaultTaskFrontmatter: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    tasksFolder: "5-tasks",
    dailyFolder: "2-daily",
    planSectionName: "PLAN",
    logSectionName: "LOG",
    dailyNoteFormat: "YYYY-MM-DD",
    timeRoundingMinutes: 5,
    showStatusBar: true,
    autoShowHistory: true,
    lunchStartTime: "12:00",
    lunchEndTime: "13:00",
    defaultTaskFrontmatter: "status: not-started\ncreated: {{date}}\nreview_date: {{date+1w}}\ndue_date:\ntags: []",
};

export interface WorkLogEntry {
    date: string;
    startTime: string;
    endTime: string;
    taskName: string;
    note: string;
    durationMinutes: number;
}

export interface PlanEntry {
    taskName: string;
    subTask: string;
    plannedMinutes: number;
}

export interface ActiveWork {
    taskName: string;
    taskPath: string;
    startTime: Date;
}

export interface TaskSummary {
    taskName: string;
    totalMinutes: number;
    sessionCount: number;
    workDays: Set<string>;
}

export interface TimeSlot {
    name: string;
    startTime: string;
    endTime: string;
    entries: PlanEntry[];
}

export type SummaryPeriod = "today" | "this-week" | "last-week" | "this-month" | "last-month";

export type SummaryTab = "date-select" | "period-select" | "task-history";

export const VIEW_TYPE_DAILY_SUMMARY = "kozane-journal-daily-summary";
