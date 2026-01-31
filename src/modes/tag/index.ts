import * as core from "@actions/core";
import { mkdir } from "fs/promises";
import type { Mode, ModeOptions, ModeResult } from "../types";
import { checkContainsTrigger } from "../../github/validation/trigger";
import { checkHumanActor } from "../../github/validation/actor";
import { createInitialComment } from "../../github/operations/comments/create-initial";
import { setupBranch } from "../../github/operations/branch";
import {
  configureGitAuth,
  setupSshSigning,
} from "../../github/operations/git-config";
import { prepareMcpConfig } from "../../mcp/install-mcp-server";
import {
  fetchGitHubData,
  extractTriggerTimestamp,
  extractOriginalTitle,
} from "../../github/data/fetcher";
import { createPrompt, generateDefaultPrompt } from "../../create-prompt";
import {
  isEntityContext,
  isDiscussionEvent,
  isDiscussionCommentEvent,
  type ParsedGitHubContext,
} from "../../github/context";
import type { PreparedContext } from "../../create-prompt/types";
import type { FetchDataResult } from "../../github/data/fetcher";
import { parseAllowedTools } from "../agent/parse-tools";
import { buildDiscussionContext } from "../../github/data/discussion-fetcher";
import {
  buildDiscussionPrompt,
  type DiscussionPromptContext,
} from "../../create-prompt/discussion-prompt";
import type { DiscussionCommentEvent } from "@octokit/webhooks-types";

/**
 * Handles preparation for discussion events.
 * Discussions are conversational and don't require branch setup.
 */
async function prepareDiscussion({
  context,
  octokit,
  githubToken,
}: ModeOptions): Promise<ModeResult> {
  if (!isEntityContext(context)) {
    throw new Error("Discussion mode requires entity context");
  }

  const parsedContext = context as ParsedGitHubContext;

  // Check if actor is human
  await checkHumanActor(octokit.rest, context);

  // Get the trigger comment ID from the payload
  let triggerCommentId: string | undefined;
  if (isDiscussionCommentEvent(context)) {
    const payload = context.payload as DiscussionCommentEvent;
    triggerCommentId = payload.comment.node_id;
  }

  // Fetch discussion context
  const discussionContext = await buildDiscussionContext(
    octokit,
    context.repository.owner,
    context.repository.repo,
    context.entityNumber,
    triggerCommentId || parsedContext.discussionNodeId || "",
    context.inputs.botName,
  );

  if (!discussionContext) {
    throw new Error("Failed to fetch discussion data");
  }

  // Build discussion prompt context
  const { discussion, replyChain } = discussionContext;
  const triggerComment = triggerCommentId
    ? replyChain.find((c) => c.id === triggerCommentId)
    : undefined;

  const promptContext: DiscussionPromptContext = {
    discussion: {
      id: discussion.id,
      number: discussion.number,
      title: discussion.title,
      body: discussion.body || "",
      author: discussion.author,
      category: discussion.category,
      createdAt: discussion.createdAt,
    },
    triggerComment: triggerComment
      ? {
          id: triggerComment.id,
          body: triggerComment.body,
          author: triggerComment.author,
        }
      : triggerCommentId
        ? {
            // Comment exists but wasn't in reply chain (just created)
            // Use the comment ID from payload for threading
            id: triggerCommentId,
            body:
              (context.payload as DiscussionCommentEvent).comment?.body || "",
            author: {
              login:
                (context.payload as DiscussionCommentEvent).comment?.user
                  ?.login || "unknown",
            },
          }
        : {
            // New discussion (no comment trigger)
            id: discussion.id,
            body: discussion.body || "",
            author: discussion.author,
          },
    replyChain: replyChain.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
    })),
    repository: `${context.repository.owner}/${context.repository.repo}`,
    botLogin: context.inputs.botName,
  };

  // Generate discussion-specific prompt
  const prompt = buildDiscussionPrompt(promptContext);

  // Write prompt to file (same location as standard prepare)
  const promptsDir = `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts`;
  await mkdir(promptsDir, { recursive: true });
  const promptFile = `${promptsDir}/claude-prompt.txt`;
  await Bun.write(promptFile, prompt);
  core.setOutput("prompt_file", promptFile);

  const userClaudeArgs = process.env.CLAUDE_ARGS || "";
  const userAllowedMCPTools = parseAllowedTools(userClaudeArgs).filter(
    (tool) => tool.startsWith("mcp__github_"),
  );

  // Discussion mode tools - focused on reading, searching, and replying
  const discussionTools = [
    "Glob",
    "Grep",
    "LS",
    "Read",
    "WebSearch",
    "WebFetch",
    "mcp__github_discussion__reply_to_discussion",
    "mcp__github_discussion__update_discussion_comment",
    ...userAllowedMCPTools,
  ];

  // Discussions use the default branch, no special branch setup needed
  const defaultBranch =
    process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || "main";

  // Get our GitHub MCP servers configuration
  const ourMcpConfig = await prepareMcpConfig({
    githubToken,
    owner: context.repository.owner,
    repo: context.repository.repo,
    branch: defaultBranch,
    baseBranch: defaultBranch,
    allowedTools: Array.from(new Set(discussionTools)),
    mode: "tag",
    context,
    discussionNodeId: parsedContext.discussionNodeId,
    triggerCommentId,
  });

  // Build complete claude_args
  let claudeArgs = "";

  // Add our GitHub servers config
  const escapedOurConfig = ourMcpConfig.replace(/'/g, "'\\''");
  claudeArgs = `--mcp-config '${escapedOurConfig}'`;

  // Add required tools for discussion mode
  claudeArgs += ` --allowedTools "${discussionTools.join(",")}"`;

  // Append user's claude_args
  if (userClaudeArgs) {
    claudeArgs += ` ${userClaudeArgs}`;
  }

  core.setOutput("claude_args", claudeArgs.trim());

  return {
    branchInfo: {
      baseBranch: defaultBranch,
      currentBranch: defaultBranch,
    },
    mcpConfig: ourMcpConfig,
  };
}

/**
 * Tag mode implementation.
 *
 * The traditional implementation mode that responds to @claude mentions,
 * issue assignments, or labels. Creates tracking comments showing progress
 * and has full implementation capabilities.
 */
export const tagMode: Mode = {
  name: "tag",
  description: "Traditional implementation mode triggered by @claude mentions",

  shouldTrigger(context) {
    // Tag mode only handles entity events
    if (!isEntityContext(context)) {
      return false;
    }

    // For discussion events, allow through since the workflow's check step
    // already validated the trigger (category, @mention, or reply to Claude)
    if (isDiscussionEvent(context) || isDiscussionCommentEvent(context)) {
      return true;
    }

    return checkContainsTrigger(context);
  },

  prepareContext(context, data) {
    return {
      mode: "tag",
      githubContext: context,
      commentId: data?.commentId,
      baseBranch: data?.baseBranch,
      claudeBranch: data?.claudeBranch,
    };
  },

  getAllowedTools() {
    return [];
  },

  getDisallowedTools() {
    return [];
  },

  shouldCreateTrackingComment() {
    return true;
  },

  async prepare({
    context,
    octokit,
    githubToken,
  }: ModeOptions): Promise<ModeResult> {
    // Tag mode only handles entity-based events
    if (!isEntityContext(context)) {
      throw new Error("Tag mode requires entity context");
    }

    // Check if this is a discussion event
    const isDiscussion =
      isDiscussionEvent(context) || isDiscussionCommentEvent(context);

    if (isDiscussion) {
      return prepareDiscussion({ context, octokit, githubToken });
    }

    // Standard PR/Issue flow follows
    // Check if actor is human
    await checkHumanActor(octokit.rest, context);

    // Create initial tracking comment
    const commentData = await createInitialComment(octokit.rest, context);
    const commentId = commentData.id;

    const triggerTime = extractTriggerTimestamp(context);
    const originalTitle = extractOriginalTitle(context);

    const githubData = await fetchGitHubData({
      octokits: octokit,
      repository: `${context.repository.owner}/${context.repository.repo}`,
      prNumber: context.entityNumber.toString(),
      isPR: context.isPR,
      triggerUsername: context.actor,
      triggerTime,
      originalTitle,
      includeCommentsByActor: context.inputs.includeCommentsByActor,
      excludeCommentsByActor: context.inputs.excludeCommentsByActor,
    });

    // Setup branch
    const branchInfo = await setupBranch(octokit, githubData, context);

    // Configure git authentication
    // SSH signing takes precedence if provided
    const useSshSigning = !!context.inputs.sshSigningKey;
    const useApiCommitSigning =
      context.inputs.useCommitSigning && !useSshSigning;

    if (useSshSigning) {
      // Setup SSH signing for commits
      await setupSshSigning(context.inputs.sshSigningKey);

      // Still configure git auth for push operations (user/email and remote URL)
      const user = {
        login: context.inputs.botName,
        id: parseInt(context.inputs.botId),
      };
      try {
        await configureGitAuth(githubToken, context, user);
      } catch (error) {
        console.error("Failed to configure git authentication:", error);
        throw error;
      }
    } else if (!useApiCommitSigning) {
      // Use bot_id and bot_name from inputs directly
      const user = {
        login: context.inputs.botName,
        id: parseInt(context.inputs.botId),
      };

      try {
        await configureGitAuth(githubToken, context, user);
      } catch (error) {
        console.error("Failed to configure git authentication:", error);
        throw error;
      }
    }

    // Create prompt file
    const modeContext = this.prepareContext(context, {
      commentId,
      baseBranch: branchInfo.baseBranch,
      claudeBranch: branchInfo.claudeBranch,
    });

    await createPrompt(tagMode, modeContext, githubData, context);

    const userClaudeArgs = process.env.CLAUDE_ARGS || "";
    const userAllowedMCPTools = parseAllowedTools(userClaudeArgs).filter(
      (tool) => tool.startsWith("mcp__github_"),
    );

    // Build claude_args for tag mode with required tools
    // Tag mode REQUIRES these tools to function properly
    const tagModeTools = [
      "Edit",
      "MultiEdit",
      "Glob",
      "Grep",
      "LS",
      "Read",
      "Write",
      "mcp__github_comment__update_claude_comment",
      "mcp__github_ci__get_ci_status",
      "mcp__github_ci__get_workflow_run_details",
      "mcp__github_ci__download_job_log",
      ...userAllowedMCPTools,
    ];

    // Add git commands when using git CLI (no API commit signing, or SSH signing)
    // SSH signing still uses git CLI, just with signing enabled
    if (!useApiCommitSigning) {
      tagModeTools.push(
        "Bash(git add:*)",
        "Bash(git commit:*)",
        "Bash(git push:*)",
        "Bash(git status:*)",
        "Bash(git diff:*)",
        "Bash(git log:*)",
        "Bash(git rm:*)",
      );
    } else {
      // When using API commit signing, use MCP file ops tools
      tagModeTools.push(
        "mcp__github_file_ops__commit_files",
        "mcp__github_file_ops__delete_files",
      );
    }

    // Get our GitHub MCP servers configuration
    const ourMcpConfig = await prepareMcpConfig({
      githubToken,
      owner: context.repository.owner,
      repo: context.repository.repo,
      branch: branchInfo.claudeBranch || branchInfo.currentBranch,
      baseBranch: branchInfo.baseBranch,
      claudeCommentId: commentId.toString(),
      allowedTools: Array.from(new Set(tagModeTools)),
      mode: "tag",
      context,
    });

    // Build complete claude_args with multiple --mcp-config flags
    let claudeArgs = "";

    // Add our GitHub servers config
    const escapedOurConfig = ourMcpConfig.replace(/'/g, "'\\''");
    claudeArgs = `--mcp-config '${escapedOurConfig}'`;

    // Add required tools for tag mode
    claudeArgs += ` --allowedTools "${tagModeTools.join(",")}"`;

    // Append user's claude_args (which may have more --mcp-config flags)
    if (userClaudeArgs) {
      claudeArgs += ` ${userClaudeArgs}`;
    }

    core.setOutput("claude_args", claudeArgs.trim());

    return {
      commentId,
      branchInfo,
      mcpConfig: ourMcpConfig,
    };
  },

  generatePrompt(
    context: PreparedContext,
    githubData: FetchDataResult,
    useCommitSigning: boolean,
  ): string {
    const defaultPrompt = generateDefaultPrompt(
      context,
      githubData,
      useCommitSigning,
    );

    // If a custom prompt is provided, inject it into the tag mode prompt
    if (context.githubContext?.inputs?.prompt) {
      return (
        defaultPrompt +
        `

<custom_instructions>
${context.githubContext.inputs.prompt}
</custom_instructions>`
      );
    }

    return defaultPrompt;
  },

  getSystemPrompt() {
    // Tag mode doesn't need additional system prompts
    return undefined;
  },
};
