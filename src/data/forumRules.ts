import data from "./forumRules.json";

export type ForumRule = {
  id: string;
  title: string;
  body: string;
};

export const FORUM_RULES = data as ForumRule[];

export function forumRuleById(id: string | undefined) {
  return FORUM_RULES.find((rule) => rule.id === id) ?? FORUM_RULES[0];
}
