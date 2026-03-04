import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
    ActiveWork,
    DEFAULT_SETTINGS,
    PluginSettings,
    VIEW_TYPE_DAILY_SUMMARY,
} from "./src/types";
import { TaskSelectModal, TaskDetailModal, MemoInputModal, TaskAddModal, getTaskFilesSorted, startWork, endWork, createTaskFile } from "./src/commands";
import { updateStatusBar, updateTimerBar } from "./src/statusbar";
import { createHistoryPostProcessor } from "./src/history-view";
import { DailySummaryView } from "./src/sidebar-view";
import { KozaneJournalSettingTab } from "./src/settings-tab";

export default class KozaneJournalPlugin extends Plugin {
    settings: PluginSettings = DEFAULT_SETTINGS;
    private statusBarEl: HTMLElement | null = null;
    private timerBarEl: HTMLElement | null = null;
    private activeWork: ActiveWork | null = null;
    private statusBarInterval: number | null = null;
    private timerInterval: number | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        // --- Status Bar ---
        this.statusBarEl = this.addStatusBarItem();
        this.refreshStatusBar();

        // Auto-refresh status bar every 60 seconds
        this.statusBarInterval = window.setInterval(() => {
            this.refreshStatusBar();
        }, 60000);
        this.registerInterval(this.statusBarInterval);

        // --- Active Work Timer Bar ---
        this.timerBarEl = this.addStatusBarItem();
        this.refreshTimerBar();

        // Update timer every 10 seconds for HH:mm accuracy
        this.timerInterval = window.setInterval(() => {
            this.refreshTimerBar();
        }, 10000);
        this.registerInterval(this.timerInterval);

        // --- Commands ---
        this.addCommand({
            id: "start-work",
            name: "作業開始",
            callback: () => this.handleStartWork(),
        });

        this.addCommand({
            id: "end-work",
            name: "作業終了",
            callback: () => this.handleEndWork(),
        });

        this.addCommand({
            id: "add-task",
            name: "タスク追加",
            callback: () => this.handleAddTask(),
        });

        // --- Markdown Post Processor (Task History) ---
        this.registerMarkdownPostProcessor(
            createHistoryPostProcessor(this.app, this.settings)
        );

        // --- Sidebar View ---
        this.registerView(
            VIEW_TYPE_DAILY_SUMMARY,
            (leaf) => new DailySummaryView(leaf, this.settings)
        );

        // Ribbon icon to open sidebar
        this.addRibbonIcon("clock", "Kozane Journal 集計", () => {
            this.activateSidebarView();
        });

        // --- Settings Tab ---
        this.addSettingTab(new KozaneJournalSettingTab(this.app, this));

        // --- File change watcher ---
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile && file.path.startsWith(this.settings.dailyFolder + "/")) {
                    this.refreshStatusBar();
                    this.refreshSidebarView();
                }
            })
        );

        // --- Refresh on file open (auto-switch sidebar for task files) ---
        this.registerEvent(
            this.app.workspace.on("file-open", (file) => {
                this.refreshStatusBar();
                this.updateSidebarForActiveFile(file);
            })
        );
    }

    onunload(): void {
        // Interval cleanup is handled by registerInterval
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.refreshStatusBar();
        this.refreshSidebarView();
    }

    // --- Command Handlers ---

    private async handleStartWork(): Promise<void> {
        const taskFiles = await getTaskFilesSorted(this.app, this.settings);

        if (taskFiles.length === 0) {
            new Notice(`❌ タスクフォルダ「${this.settings.tasksFolder}」にファイルがありません`);
            return;
        }

        new TaskSelectModal(this.app, taskFiles, (file) => {
            new TaskDetailModal(this.app, file.basename, (detail) => {
                const result = startWork(this.app, file, this.activeWork, this.settings, detail);
                if (!result.warning) {
                    this.activeWork = result.activeWork;
                    this.refreshTimerBar();
                }
            }).open();
        }).open();
    }

    private async handleAddTask(): Promise<void> {
        new TaskAddModal(this.app, this.settings, async (title, extraFrontmatter) => {
            const file = await createTaskFile(this.app, title, extraFrontmatter, this.settings);
            if (file) {
                // Open the newly created task file
                const leaf = this.app.workspace.getLeaf(false);
                if (leaf) {
                    await leaf.openFile(file);
                }
            }
        }).open();
    }

    private async handleEndWork(): Promise<void> {
        if (!this.activeWork) {
            new Notice("⚠️ 作業が開始されていません。先に「作業開始」を実行してください。");
            return;
        }

        const activeWork = this.activeWork;

        new MemoInputModal(this.app, async (memo) => {
            await endWork(this.app, activeWork, memo, this.settings);
            this.activeWork = null;
            this.refreshTimerBar();
            this.refreshStatusBar();
            this.refreshSidebarView();
        }).open();
    }

    // --- Status Bar ---

    private refreshTimerBar(): void {
        if (this.timerBarEl) {
            updateTimerBar(this.timerBarEl, this.activeWork);
        }
    }

    private refreshStatusBar(): void {
        if (this.statusBarEl) {
            updateStatusBar(this.statusBarEl, this.app, this.settings);
        }
    }

    // --- Sidebar View ---

    private async activateSidebarView(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_SUMMARY);
        if (existing.length > 0) {
            this.app.workspace.revealLeaf(existing[0]);
            return;
        }

        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_DAILY_SUMMARY,
                active: true,
            });
            this.app.workspace.revealLeaf(leaf);
        }
    }

    private refreshSidebarView(): void {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_SUMMARY);
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view instanceof DailySummaryView) {
                view.updateSettings(this.settings);
                view.refresh();
            }
        }
    }

    private updateSidebarForActiveFile(file: TFile | null): void {
        const isTaskFile = file instanceof TFile
            && file.path.startsWith(this.settings.tasksFolder + "/")
            && file.extension === "md";

        const taskName = isTaskFile ? file!.basename : null;

        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_SUMMARY);
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view instanceof DailySummaryView) {
                view.setActiveTask(taskName);
            }
        }
    }
}
