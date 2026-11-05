const test = require('node:test');
const assert = require('node:assert/strict');

// UTC-parsed dates only shift to the previous day west of UTC.
process.env.TZ = 'America/New_York';

const DateHelper = require('../date-helper');

test('date-only created value is read as the local calendar day', () => {
  const created = DateHelper.parseCreatedDate({ created: '2024-01-01' });

  assert.equal(DateHelper.buildDateTag('date', created), 'date/2024/01/01');
});

test('plugin timestamp format keeps its local calendar day', () => {
  const created = DateHelper.parseCreatedDate({ created: '2024-01-01 00:30:00' });

  assert.equal(DateHelper.buildDateTag('date', created), 'date/2024/01/01');
});

test('invalid created values are ignored', () => {
  assert.equal(DateHelper.parseCreatedDate({ created: '2024-02-30' }), null);
  assert.equal(DateHelper.parseCreatedDate({ created: 'not a date' }), null);
  assert.equal(DateHelper.parseCreatedDate({}), null);
});
