const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScoreSubmissionPolicy, buildScoreChangeSummary } = require('./scorePolicy');

test('allows first-time grading when no existing score exists', () => {
  const result = validateScoreSubmissionPolicy([], 'admin_view');
  assert.equal(result.allowed, true);
  assert.equal(result.reason, undefined);
});

test('blocks regrading when a score already exists for the team and round', () => {
  const result = validateScoreSubmissionPolicy(
    [{ status: 'submitted', judgeId: 'judge-1' }],
    'admin_view',
    'judge-1',
  );
  assert.equal(result.allowed, false);
  assert.match(result.reason, /đã gửi kết quả/i);
});

test('builds a detailed change summary for each criterion', () => {
  const summary = buildScoreChangeSummary(
    {
      overallComment: 'old',
      details: [{ criterionId: 'c1', scoreValue: 8 }],
    },
    {
      overallComment: 'new',
      details: [{ criterionId: 'c1', scoreValue: 9 }],
    },
    [{ _id: 'c1', name: 'Tính đúng đắn' }],
  );

  assert.equal(summary.length, 1);
  assert.equal(summary[0].criterionName, 'Tính đúng đắn');
  assert.deepEqual(summary[0].change, { from: 8, to: 9 });
});
