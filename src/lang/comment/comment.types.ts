/** Text or backtick-delimited code inside a paragraph or list item. */
export type CommentInline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string };

export type CommentParagraph = {
  kind: "paragraph";
  inlines: CommentInline[];
};

export type CommentList = {
  kind: "list";
  items: { inlines: CommentInline[] }[];
};

/**
 * Fenced code. `language` is the fence tag (empty when absent); `tree` is the
 * value the host grammar's fence parser produced, absent for untagged and
 * `text` fences.
 */
export type CommentFence = {
  kind: "fence";
  language: string;
  code: string;
  tree?: unknown;
};

export type CommentBlock = CommentParagraph | CommentList | CommentFence;

/** One comment block: the parse of consecutive comment lines. */
export type CommentNode = {
  kind: "comment";
  blocks: CommentBlock[];
};
