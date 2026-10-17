'use strict';
/**
 * leadwright configuration. Safe by default:
 *  - sending.mode = "draft": nothing ever leaves the machine.
 *  - approval.required = true and approval.allowAgentApproval = false: only a human
 *    (CLI `leadwright approve`) can approve a message; the MCP agent cannot.
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  sender: { name: '', company: '', email: '', physicalAddress: '' },
  compliance: {
    unsubscribe: { url: '', mailto: '' },
    footerTemplate: '\n\n--\n{company} · {physicalAddress}\nNot interested? Reply "unsubscribe" or opt out: {unsubscribe}',
    maxLinks: 1,
    maxBodyWords: 99,              // bodies must be UNDER 100 words excl. footer (hard error; may only tighten)
    maxSubjectLength: 29,          // subjects must be UNDER 30 chars (hard error)
    allowHtml: false,
    blockRoleAddresses: true,
  },
  sending: {
    mode: 'draft',            // draft | send   ("send" must be set explicitly)
    transport: 'file',        // file | command
    command: '',              // e.g. "msmtp -t" when transport=command
    dailyCap: 30,
    perDomainDailyCap: 3,
    warmup: { enabled: true, startDate: '', startPerDay: 5, incrementPerDay: 3 },
    maxBounceRate: 0.05,
    minSendsForBounceRate: 20,
    timezone: 'America/Chicago', // used when a lead has no timezone of its own
    allowedDays: ['Tue', 'Wed'],  // cold email goes out ONLY on these weekdays (recipient tz)
  },
  approval: { required: true, allowAgentApproval: false },
  icp: { template: '', industries: [], titles: [], companySize: '', geography: [], minScore: 50 },
};

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (k in base) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

function stateDir(cwd = process.cwd()) {
  return process.env.LEADWRIGHT_HOME || path.join(cwd, '.leadwright');
}

function configPath(dir = stateDir()) { return path.join(dir, 'config.json'); }

function loadConfig(dir = stateDir()) {
  const p = configPath(dir);
  let user = {};
  if (fs.existsSync(p)) user = JSON.parse(fs.readFileSync(p, 'utf8'));
  return deepMerge(DEFAULTS, user);
}

function saveConfig(cfg, dir = stateDir()) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(dir), JSON.stringify(cfg, null, 2) + '\n');
}

/** Problems that block *sending* (drafting is always allowed). */
function sendReadiness(cfg) {
  const p = [];
  if (cfg.sending.mode !== 'send') p.push('sending.mode is "draft" (set it to "send" explicitly to allow delivery)');
  if (!cfg.sender.email) p.push('sender.email is not set');
  if (!cfg.sender.physicalAddress) p.push('sender.physicalAddress is not set (CAN-SPAM requires a valid postal address)');
  if (!cfg.compliance.unsubscribe.url && !cfg.compliance.unsubscribe.mailto) p.push('no unsubscribe url or mailto configured');
  if (cfg.sending.transport === 'command' && !cfg.sending.command) p.push('sending.transport is "command" but sending.command is empty');
  return p;
}

module.exports = { DEFAULTS, deepMerge, stateDir, configPath, loadConfig, saveConfig, sendReadiness };
