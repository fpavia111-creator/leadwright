'use strict';
/** Writer prompt handed to the host agent (Claude Code / Cursor / Codex) via MCP. */
const { SUBJECT_MAX_EXCLUSIVE, BANNED_PHRASES, BODY_MAX_WORDS_EXCLUSIVE } = require('./compliance');

function writerPrompt({ lead, icp, sender, kind = 'cold' }) {
  return [
    `Write one ${kind === 'cold' ? 'first-touch cold' : 'follow-up'} email from ${sender.name || 'the sender'} at ${sender.company || 'the company'} to ${lead.name || 'the contact'} (${lead.title || 'n/a'}) at ${lead.company || 'their company'}.`,
    'HARD RULES (the send gate rejects violations):',
    `- Subject line MUST be under ${SUBJECT_MAX_EXCLUSIVE} characters (${SUBJECT_MAX_EXCLUSIVE - 1} max), lowercase-casual is fine, no "Re:"/"Fwd:" on first touch, no exclamation marks.`,
    `- Body MUST be under ${BODY_MAX_WORDS_EXCLUSIVE} words (${BODY_MAX_WORDS_EXCLUSIVE - 1} max, not counting the footer). Count them; if over, cut. Plain text, at most one link, no merge tags left unrendered.`,
    '- Reference one specific, true observation about the company. No invented facts.',
    `- Never use: ${BANNED_PHRASES.slice(0, 12).join(', ')}, ...`,
    '- Do NOT write the unsubscribe/address footer; leadwright appends it.',
    `Lead facts: ${JSON.stringify({ industry: lead.industry, signals: lead.signals || [], notes: lead.notes || '' })}`,
    `ICP: ${icp.id}. Return JSON: {"subject": "...", "body": "...", "why": "one sentence on why this lead, citing a signal"}.`,
  ].join('\n');
}

module.exports = { writerPrompt };
