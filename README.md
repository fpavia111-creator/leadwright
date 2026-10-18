> **This project has moved and been renamed to Leonidas of the Web: https://github.com/fpavia111-creator/leonidas**
> npm: `@kurtfrancisco/leonidas` (this package, `@kurtfrancisco/leadwright`, is deprecated). Run `npx -y @kurtfrancisco/leonidas`.

# leadwright

**A compliance-first outbound sales pipeline that runs as an MCP server for Claude Code, Cursor and Codex.**

Your coding agent researches leads, scores them against an industry ICP, and drafts cold email. leadwright checks every draft against CAN-SPAM and deliverability rules, logs *why* each lead was contacted, and holds everything for a human to approve. By default nothing is ever sent.

> Based on [Harvey](https://github.com/ethanplusai/harvey) by Ethan Rogers (MIT). leadwright is an independent project. It is not affiliated with or endorsed by Ethan Rogers. The skills library and the content rules (banned phrases, merge-tag, link and plain-text checks) come from Harvey. The MCP server, compliance gate, send window, caps, audit log and ICP templates are new.

## Why
Autonomous SDR agents fail in the same ways: a fake "Re:" subject, a missing unsubscribe line, a burned domain, an email to someone who already opted out, and no record of why that person was emailed. leadwright puts deterministic code between the model and the outbox.

## Features
- **MCP server (stdio, zero dependencies)** with 17 tools: `lw_add_leads`, `lw_writer_prompt`, `lw_check_email`, `lw_queue_email`, `lw_why`, `lw_send_approved`, `lw_dns_check`, and more.
- **Never auto-sends.** `sending.mode` defaults to `"draft"`. Only a human approves (`leadwright approve <id>`). Agents can approve only if you set `approval.allowAgentApproval: true` yourself.
- **CAN-SPAM gate.** Every message gets a footer with your physical postal address and an opt-out line. `List-Unsubscribe` headers are added (one-click when you set a URL). Deceptive `Re:`/`Fwd:` subjects on a first touch are blocked.
- **Cold email bodies under 100 words** (footer excluded). Hard error at queue and send time. Config can tighten it but can't loosen it.
- **Subject lines under 30 characters.** This is a hard error. Config can tighten the limit but can't loosen it.
- **Tuesday/Wednesday sending only** (the default). The day is checked in the lead's `timezone`, falling back to `sending.timezone` (default `America/Chicago`). Approved mail that comes up on another day is marked `scheduled` for the next Tuesday or Wednesday and goes out on the next `leadwright send` run on or after that date.
- **Deliverability.** Daily cap, per-domain cap, a warmup ramp (5/day, +3/day), a bounce-rate circuit breaker (pauses above 5% hard bounces), and SPF/DMARC/DKIM checks.
- **Do-not-contact list.** Blocks exact emails (case and `+tag` normalized) and whole domains. Hard bounces and complaints are added automatically, and adding an entry pulls any pending mail to that address.
- **Audit log of decisions.** Each step records who acted and why, the evidence and the score reasons. The log is append-only JSONL with a SHA-256 hash chain, so tampering shows up. `leadwright why <email>` shows the full trail.
- **Eight industry ICP templates:** SaaS, agencies, home services, dental/clinics, e-commerce, real estate, professional services and manufacturing. Each lead is scored with readable reasons.
- **Content gate** from Harvey: banned spam and AI-tell phrases, unrendered merge tags, a one-link budget, plain text only, and a word ceiling. Also blocks role addresses and header injection.
- **CSV import and export.** Exports are protected against formula injection.

## Quick start
```bash
npx -y @kurtfrancisco/leadwright init --icp home_services
# edit .leadwright/config.json: sender.name/company/email/physicalAddress, compliance.unsubscribe
npx -y @kurtfrancisco/leadwright install-snippets   # prints configs for all three hosts
```
**Claude Code:** `claude mcp add leadwright -- npx -y @kurtfrancisco/leadwright mcp`
**Cursor** (`.cursor/mcp.json`): `{"mcpServers":{"leadwright":{"command":"npx","args":["-y","@kurtfrancisco/leadwright","mcp"]}}}`
**Codex** (`~/.codex/config.toml`):
```toml
[mcp_servers.leadwright]
command = "npx"
args = ["-y", "@kurtfrancisco/leadwright", "mcp"]
```
Then ask your agent, for example: *"Find 20 HVAC companies in Austin, add them to leadwright, and draft first-touch emails for the qualified ones."*

Review and send:
```bash
leadwright outbox pending_approval
leadwright show <id>
leadwright approve <id> "looks right"
leadwright send          # only works with sending.mode="send"; only Tue/Wed
leadwright why owner@example.com
```

## Configuration (`.leadwright/config.json`)
| Key | Default | Meaning |
|---|---|---|
| `sending.mode` | `"draft"` | Must be set to `"send"` explicitly before anything is delivered |
| `sending.allowedDays` | `["Tue","Wed"]` | Weekdays when cold email may go out |
| `sending.timezone` | `"America/Chicago"` | Used when a lead has no `timezone` |
| `sending.dailyCap` / `perDomainDailyCap` | 30 / 3 | Hard caps per day |
| `sending.warmup` | 5/day +3/day | Ramp for a new mailbox |
| `sending.maxBounceRate` | 0.05 | Hard-bounce rate that pauses sending (after 20 sends) |
| `sending.transport` | `"file"` | `file` writes `.eml` files to `.leadwright/sent/`. `command` pipes the message to e.g. `msmtp -t` |
| `approval.allowAgentApproval` | `false` | Lets the MCP agent approve its own drafts. Leave this off |
| `compliance.maxBodyWords` | 99 | Can only go lower. Bodies must be under 100 words, excluding the footer |
| `compliance.maxSubjectLength` | 29 | Can only go lower. Subjects must be under 30 characters |
| `icp.template` | `""` | One of the 8 templates (`leadwright templates`) |

## Pro ($11 launch price)
leadwright Pro adds:
- Sequence and playbook packs for 8 industries
- A deeper compliance and deliverability checker: CASL/GDPR/PECR region rules, list hygiene, spam scoring, a full DNS audit and pack validation
- A one-command installer that registers the server with Claude Code, Cursor and Codex

Pro is sold separately. The core in this repo is MIT and fully usable without it.

**[Buy leadwright Pro: $11 one-time →](https://buy.stripe.com/3cI8wR5LzbZw0lR0md5AQ04)**

## Legal
leadwright helps you follow the rules, but it isn't legal advice. You're responsible for complying with CAN-SPAM, CASL, GDPR/PECR and your mail provider's terms.

## License
MIT. Copyright (c) 2026 Ethan Rogers (original Harvey) and Copyright (c) 2026 Kurt Francisco (modifications). See [LICENSE](LICENSE).
