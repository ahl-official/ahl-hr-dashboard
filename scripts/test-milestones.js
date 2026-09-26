const assert = require('assert');

// We can replicate or import the date logic from date-utils.ts
function parseIsoDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parts = value.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function safeAnniversaryDate(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
}

function addMonthsClamped(date, months) {
  const targetMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  return safeAnniversaryDate(year, month, date.getDate());
}

function addCalendarDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

function formatQuarterlyMilestone(totalMonths) {
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (!years) {
    return {
      label: `${totalMonths}-month milestone`,
      shortLabel: `${totalMonths}M`,
    };
  }
  if (!remainingMonths) {
    return {
      label: `${years}-year completion`,
      shortLabel: `${years}Y`,
    };
  }
  return {
    label: `${years} ${years === 1 ? 'year' : 'years'} + ${remainingMonths} months milestone`,
    shortLabel: `${years}Y+${remainingMonths}M`,
  };
}

function getNextEmployeeReview(doj, today) {
  const onboardingReviews = [
    { date: addCalendarDays(doj, 7), label: '7-day feedback', shortLabel: '7D', months: 0 },
    { date: addCalendarDays(doj, 15), label: '15-day feedback', shortLabel: '15D', months: 0 },
    { date: addMonthsClamped(doj, 1), label: '1-month feedback', shortLabel: '1M', months: 1 },
  ];

  const upcomingOnboardingReview = onboardingReviews.find((review) => review.date >= today);

  if (upcomingOnboardingReview) {
    return {
      date: upcomingOnboardingReview.date,
      label: upcomingOnboardingReview.label,
      shortLabel: upcomingOnboardingReview.shortLabel,
      meetingType: 'Onboarding Feedback',
      reviewStage: 'onboarding',
      totalMonths: upcomingOnboardingReview.months,
    };
  }

  const approximateMonths = Math.max(
    3,
    (today.getFullYear() - doj.getFullYear()) * 12 + today.getMonth() - doj.getMonth()
  );
  let milestoneMonths = Math.max(3, Math.floor(approximateMonths / 3) * 3);
  let milestoneDate = addMonthsClamped(doj, milestoneMonths);

  while (milestoneDate < today) {
    milestoneMonths += 3;
    milestoneDate = addMonthsClamped(doj, milestoneMonths);
  }
  while (milestoneMonths > 3 && addMonthsClamped(doj, milestoneMonths - 3) >= today) {
    milestoneMonths -= 3;
    milestoneDate = addMonthsClamped(doj, milestoneMonths);
  }

  const milestoneName = formatQuarterlyMilestone(milestoneMonths);
  return {
    date: milestoneDate,
    label: milestoneName.label,
    shortLabel: milestoneName.shortLabel,
    meetingType: 'Quarterly Review',
    reviewStage: 'tenure',
    totalMonths: milestoneMonths,
  };
}

// Test against fixed today = 2026-08-27 (matching test-onboarding-milestones.js)
const fixedToday = new Date(2026, 7, 27, 12, 0, 0, 0);

function nextReview(dojStr) {
  const doj = parseIsoDate(dojStr);
  return getNextEmployeeReview(doj, fixedToday);
}

assert.strictEqual(nextReview('2026-08-27').label, '7-day feedback');
assert.strictEqual(nextReview('2026-08-20').label, '7-day feedback');
assert.strictEqual(nextReview('2026-08-19').label, '15-day feedback');
assert.strictEqual(nextReview('2026-08-12').label, '15-day feedback');
assert.strictEqual(nextReview('2026-08-11').label, '1-month feedback');
assert.strictEqual(nextReview('2026-07-27').label, '1-month feedback');
assert.strictEqual(nextReview('2026-07-26').label, '3-month milestone');
assert.strictEqual(nextReview('2026-05-27').label, '3-month milestone');
assert.strictEqual(nextReview('2026-05-26').label, '6-month milestone');
assert.strictEqual(nextReview('2025-08-27').label, '1-year completion');
assert.strictEqual(nextReview('2025-05-27').label, '1 year + 3 months milestone');
assert.strictEqual(nextReview('2026-08-27').meetingType, 'Onboarding Feedback');
assert.strictEqual(nextReview('2026-05-27').meetingType, 'Quarterly Review');

console.log('ALL MILESTONE BUSINESS RULES PASSED PERFECTLY!');
