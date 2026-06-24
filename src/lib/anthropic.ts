import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SONNET = "claude-sonnet-4-6";
export const OPUS = "claude-opus-4-8";
