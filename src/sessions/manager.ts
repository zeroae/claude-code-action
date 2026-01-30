import { mkdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import {
  formatSessionPath,
  formatSummaryPath,
  serializeSession,
  parseSessionFile,
  serializeSummary,
  parseSummaryFile,
  type SessionData,
  type DiscussionSummary,
} from "./storage";

export type SessionManagerOptions = {
  workDir: string;
  sessionBranch: string;
  skipGit?: boolean;
};

export class SessionManager {
  private workDir: string;
  private sessionBranch: string;
  private skipGit: boolean;

  constructor(options: SessionManagerOptions) {
    this.workDir = options.workDir;
    this.sessionBranch = options.sessionBranch;
    this.skipGit = options.skipGit ?? false;
  }

  private getSessionFilePath(
    discussionNumber: number,
    commentId: string,
  ): string {
    return join(this.workDir, formatSessionPath(discussionNumber, commentId));
  }

  private getSummaryFilePath(discussionNumber: number): string {
    return join(this.workDir, formatSummaryPath(discussionNumber));
  }

  async saveSession(
    discussionNumber: number,
    session: SessionData,
  ): Promise<void> {
    const filePath = this.getSessionFilePath(
      discussionNumber,
      session.comment_id,
    );
    const dir = dirname(filePath);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, serializeSession(session));
  }

  async loadSession(
    discussionNumber: number,
    commentId: string,
  ): Promise<SessionData | null> {
    const filePath = this.getSessionFilePath(discussionNumber, commentId);

    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");
    return parseSessionFile(content);
  }

  async findSessionInChain(
    discussionNumber: number,
    commentIds: string[],
  ): Promise<SessionData | null> {
    for (const commentId of commentIds) {
      const session = await this.loadSession(discussionNumber, commentId);
      if (session) {
        return session;
      }
    }
    return null;
  }

  async saveSummary(
    discussionNumber: number,
    summary: DiscussionSummary,
  ): Promise<void> {
    const filePath = this.getSummaryFilePath(discussionNumber);
    const dir = dirname(filePath);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, serializeSummary(summary));
  }

  async loadSummary(discussionNumber: number): Promise<DiscussionSummary | null> {
    const filePath = this.getSummaryFilePath(discussionNumber);

    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");
    return parseSummaryFile(content);
  }

  getSessionBranch(): string {
    return this.sessionBranch;
  }

  isGitEnabled(): boolean {
    return !this.skipGit;
  }
}
