import type { Locator, Page } from "playwright";
import type { Root } from "../form.js";
import type { ApplyTask, UploadFiles } from "../types.js";

export interface Adapter {
  name: string;
  matches(url: URL): boolean;
  /** Navigates to the application form and returns where it lives. */
  open(page: Page, url: string): Promise<Root>;
  /** Fills what it can; returns the names of filled fields. */
  fill(root: Root, task: ApplyTask, files: UploadFiles): Promise<string[]>;
  /** Null means this adapter never submits automatically. */
  submitButton(root: Root): Locator | null;
  isConfirmation(page: Page): Promise<boolean>;
}
