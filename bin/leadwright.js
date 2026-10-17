#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { Leadwright } = require('../src/engine');
const { DEFAULTS, stateDir, saveConfig, loadConfig, configPath } = require('../src/config');
const { listTemplates } = require('../src/icp');
const { toCsv, parseCsv } = require('../src/export');
const { checkDomainAuth } = require('../src/deliverability');

const HELP = `leadwright - compliance-first outbound sales pipeline for coding agents (MCP)

Usage: leadwright <command> [args]
  init [--icp <template>]        create .leadwright/config.json (draft mode, human approval)
  mcp                            run the MCP server on stdio (Claude Code / Cursor / Codex)
  install-snippets               print MCP config for Claude Code, Cursor and Codex
  status                         caps, warmup, Tue/Wed send window, bounce rate, outbox
  templates                      list industry ICP templates
  import <file.csv>              add leads from CSV (email,name,title,company,industry,...)
  export                         leads as CSV on stdout
  outbox [status]                list queued messages
  show <msgId>                   print a queued message
  approve <msgId> [note]         HUMAN approval of one message
  reject <msgId> [reason]
  send                           deliver approved mail that passes every check
  suppress <email|domain> [why]  add to do-not-contact list
  unsuppress <email|domain>
  bounce <email> [code] [diag]   record a bounce (hard -> auto-suppress)
  why <leadId|email>             why was this lead contacted?
  audit [--verify]               audit log / hash-chain check
  dns <domain> [dkimSelector]    SPF / DMARC / DKIM check`;

const out = x => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

async function main(argv) {
  const [cmd, ...a] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return out(HELP);
  if (cmd === '--version') return out(require('../package.json').version);
  if (cmd === 'mcp') { require('../src/mcp').serve(); return; }
  if (cmd === 'init') {
    const dir = stateDir();
    if (fs.existsSync(configPath(dir))) return out(`already initialized: ${configPath(dir)}`);
    const cfg = JSON.parse(JSON.stringify(DEFAULTS));
    const i = a.indexOf('--icp'); if (i >= 0) cfg.icp.template = a[i + 1];
    cfg.sending.warmup.startDate = new Date().toISOString().slice(0, 10);
    saveConfig(cfg, dir);
    return out(`created ${configPath(dir)}\nSending is OFF (mode "draft"). Fill in sender.*, compliance.unsubscribe, then set sending.mode="send" when ready.\nCold email only goes out Tue/Wed (${cfg.sending.timezone}); subjects must be under 30 chars.`);
  }
  if (cmd === 'install-snippets') {
    const bin = 'npx -y @kurtfrancisco/leadwright mcp';
    return out(`Claude Code:\n  claude mcp add leadwright -- ${bin}\n\nCursor (.cursor/mcp.json):\n  {"mcpServers":{"leadwright":{"command":"npx","args":["-y","@kurtfrancisco/leadwright","mcp"]}}}\n\nCodex (~/.codex/config.toml):\n  [mcp_servers.leadwright]\n  command = "npx"\n  args = ["-y", "@kurtfrancisco/leadwright", "mcp"]`);
  }
  if (cmd === 'templates') return out(listTemplates().map(t => `${t.id.padEnd(22)} ${t.label}`).join('\n'));
  if (cmd === 'dns') return out(await checkDomainAuth(a[0], { dkimSelector: a[1] }));
  const lw = new Leadwright({ cfg: loadConfig() });
  switch (cmd) {
    case 'status': return out(lw.status());
    case 'import': { const r = lw.addLeads(parseCsv(fs.readFileSync(path.resolve(a[0]), 'utf8')), { source: 'csv', reason: `imported from ${path.basename(a[0])}` }); return out({ added: r.added.length, skipped: r.skipped }); }
    case 'export': return process.stdout.write(toCsv(lw.leads()));
    case 'outbox': return out(lw.outbox().filter(m => !a[0] || m.status === a[0]).map(m => `${m.id}  ${m.status.padEnd(16)} ${m.to}  "${m.subject}"${m.sendAfter ? '  after ' + m.sendAfter : ''}${m.status === 'blocked' ? '  ' + m.gate.errors.join('; ') : ''}`).join('\n') || '(empty)');
    case 'show': { const m = lw.outbox().find(x => x.id === a[0]); if (!m) throw new Error('unknown message'); return out(`To: ${m.to}\nSubject: ${m.subject}\nWhy: ${m.why}\nStatus: ${m.status}\nWarnings: ${m.gate.warnings.join('; ') || '-'}\n\n${m.body}`); }
    case 'approve': return out(lw.approve(a[0], { actor: 'human', note: a.slice(1).join(' ') }).status);
    case 'reject': return out(lw.reject(a[0], { actor: 'human', reason: a.slice(1).join(' ') || 'rejected' }).status);
    case 'send': return out(lw.sendApproved({ actor: 'human' }));
    case 'suppress': return out(lw.suppress(a[0], { reason: a.slice(1).join(' ') || 'manual', actor: 'human' }));
    case 'unsuppress': { const n = lw.suppression.remove(a[0]); lw.audit.record({ action: 'unsuppressed', actor: 'human', reason: `removed ${a[0]}` }); return out(`removed ${n}`); }
    case 'bounce': return out(lw.recordBounce({ email: a[0], code: a[1], diagnostic: a.slice(2).join(' '), actor: 'human' }));
    case 'why': return out(lw.why(a[0]) || 'unknown lead');
    case 'audit': return out(a.includes('--verify') ? lw.audit.verify() : lw.audit.all());
    default: out(HELP); process.exitCode = 2;
  }
}

main(process.argv.slice(2)).catch(e => { console.error(`leadwright: ${e.message}`); process.exitCode = 1; });
