import * as yaml from "yaml";

export type CategoryCapabilities = {
  web_search: boolean;
  edit_files: boolean;
  can_commit: boolean;
};

export type CategoryConfig = {
  name: string;
  capabilities: CategoryCapabilities;
};

export type DiscussionConfig = {
  session_branch: string;
  categories: CategoryConfig[];
};

const DEFAULT_CONFIG: DiscussionConfig = {
  session_branch: "claude-sessions",
  categories: [],
};

export function parseDiscussionConfig(content: string): DiscussionConfig {
  const parsed = yaml.parse(content);

  if (!parsed) {
    return DEFAULT_CONFIG;
  }

  return {
    session_branch: parsed.session_branch ?? "claude-sessions",
    categories: (parsed.categories ?? []).map((cat: any) => ({
      name: cat.name,
      capabilities: {
        web_search: cat.capabilities?.web_search ?? false,
        edit_files: cat.capabilities?.edit_files ?? false,
        can_commit: cat.capabilities?.can_commit ?? false,
      },
    })),
  };
}

export function isClaudeCategory(
  categoryName: string,
  config: DiscussionConfig,
): boolean {
  return config.categories.some((cat) => cat.name === categoryName);
}

export function getCategoryCapabilities(
  categoryName: string,
  config: DiscussionConfig,
): CategoryCapabilities | undefined {
  const category = config.categories.find((cat) => cat.name === categoryName);
  return category?.capabilities;
}
