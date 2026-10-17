'use strict';
/** Per-day caps, warmup ramp, per-domain caps, bounce-rate circuit breaker, DNS auth checks. */
const dns = require('dns').promises;

function dayKey(d = new Date(), tz = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function daysBetween(a, b) {
  return Math.floor((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Effective cap for today = min(dailyCap, warmup ramp). */
function effectiveDailyCap(cfg, today) {
  const s = cfg.sending;
  if (!s.warmup || !s.warmup.enabled) return s.dailyCap;
  const start = s.warmup.startDate || today;
  const n = Math.max(0, daysBetween(start, today));
  return Math.min(s.dailyCap, s.warmup.startPerDay + n * s.warmup.incrementPerDay);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayIn(d, tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
}

function allowedDays(cfg) {
  const a = (cfg.sending.allowedDays && cfg.sending.allowedDays.length) ? cfg.sending.allowedDays : ['Tue', 'Wed'];
  return a.map(x => x.slice(0, 1).toUpperCase() + x.slice(1, 3).toLowerCase());
}

/** Is `now` an allowed send day in timezone tz? */
function isAllowedDay(cfg, now, tz) { return allowedDays(cfg).includes(weekdayIn(now, tz)); }

/** Calendar date (YYYY-MM-DD, in tz) of the next allowed send day on or after `now`. */
function nextAllowedDay(cfg, now = new Date(), tz = cfg.sending.timezone) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    if (isAllowedDay(cfg, d, tz)) return dayKey(d, tz);
  }
  throw new Error('sending.allowedDays has no valid weekday');
}

function sendsOn(sendLog, day) { return sendLog.filter(r => r.day === day && r.status === 'sent'); }

function bounceStats(sendLog, bounces) {
  const sent = sendLog.filter(r => r.status === 'sent').length;
  const hard = bounces.filter(b => b.type === 'hard').length;
  return { sent, hardBounces: hard, rate: sent ? hard / sent : 0 };
}

/** Can one more message to `email` go out today? Returns {ok, reasons[], cap, used}. */
function canSend(cfg, { sendLog, bounces, email, now = new Date(), recipientTz }) {
  const reasons = [];
  const tz = recipientTz || cfg.sending.timezone || 'America/Chicago';
  let sendAfter = null;
  if (!isAllowedDay(cfg, now, tz)) {
    sendAfter = nextAllowedDay(cfg, now, tz);
    reasons.push(`not an allowed send day: cold email only goes out on ${allowedDays(cfg).join('/')} (${tz}); queued for ${sendAfter}`);
  }
  const day = dayKey(now, cfg.sending.timezone);
  const cap = effectiveDailyCap(cfg, day);
  const today = sendsOn(sendLog, day);
  if (today.length >= cap) reasons.push(`daily cap reached (${today.length}/${cap}${cfg.sending.warmup.enabled ? ', warmup' : ''})`);
  const domain = String(email).toLowerCase().split('@')[1];
  const perDomain = today.filter(r => (r.to || '').toLowerCase().endsWith('@' + domain)).length;
  if (perDomain >= cfg.sending.perDomainDailyCap) reasons.push(`per-domain cap reached for ${domain} (${perDomain}/${cfg.sending.perDomainDailyCap})`);
  const b = bounceStats(sendLog, bounces);
  if (b.sent >= cfg.sending.minSendsForBounceRate && b.rate > cfg.sending.maxBounceRate) {
    reasons.push(`sending paused: hard-bounce rate ${(b.rate * 100).toFixed(1)}% > ${(cfg.sending.maxBounceRate * 100).toFixed(1)}%`);
  }
  return { ok: reasons.length === 0, reasons, cap, used: today.length, day, sendAfter, dayBlocked: !!sendAfter };
}

/** Classify a bounce from an SMTP status/diagnostic string. */
function classifyBounce(code = '', diagnostic = '') {
  const c = String(code).trim();
  const d = String(diagnostic).toLowerCase();
  if (/^5\.\d\.\d$|^5\d\d$/.test(c) || /user unknown|no such user|does not exist|mailbox unavailable|invalid recipient/.test(d)) return 'hard';
  if (/complain|spam report|abuse/.test(d)) return 'complaint';
  return 'soft';
}

/** SPF / DMARC lookup (DKIM needs a selector). Never throws. */
async function checkDomainAuth(domain, { resolver = dns, dkimSelector } = {}) {
  const out = { domain, spf: null, dmarc: null, dkim: null, problems: [] };
  const txt = async name => { try { return (await resolver.resolveTxt(name)).map(r => r.join('')); } catch { return []; } };
  const root = await txt(domain);
  out.spf = root.find(r => /^v=spf1/i.test(r)) || null;
  if (!out.spf) out.problems.push('no SPF record');
  else if (/\+all\b/.test(out.spf)) out.problems.push('SPF uses +all (anyone can send as you)');
  const dm = await txt(`_dmarc.${domain}`);
  out.dmarc = dm.find(r => /^v=DMARC1/i.test(r)) || null;
  if (!out.dmarc) out.problems.push('no DMARC record');
  if (dkimSelector) {
    const dk = await txt(`${dkimSelector}._domainkey.${domain}`);
    out.dkim = dk.find(r => /p=/.test(r)) || null;
    if (!out.dkim) out.problems.push(`no DKIM key at selector "${dkimSelector}"`);
  }
  return out;
}

module.exports = { WEEKDAYS, weekdayIn, allowedDays, isAllowedDay, nextAllowedDay, dayKey, daysBetween, effectiveDailyCap, canSend, bounceStats, classifyBounce, checkDomainAuth };
