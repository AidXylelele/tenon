import type { TaskSettings } from './task-settings.js';

export interface Task {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
}
