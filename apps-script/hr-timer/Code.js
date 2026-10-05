// AHL HR Dashboard timer. Every 5 minutes it asks the dashboard "is any reminder due?". All the logic
// (who, what, when) lives in the dashboard; this script is only the clock.
const TICK_URL = 'https://ahl-hr-dashboard.vercel.app/api/reminders/tick';
const SECRET = '__SECRET__'; // same value as CRON_SECRET in Vercel (filled in when pushed; never committed)

function tick() {
  const res = UrlFetchApp.fetch(TICK_URL, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + SECRET },
    muteHttpExceptions: true,
    followRedirects: true,
  });
  console.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 400));
}

// Run this ONCE by hand: it creates the 5-minute timer (and replaces any older one).
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  tick();
  console.log('Timer created: tick() runs every 5 minutes.');
}
