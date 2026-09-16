import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toRecords } from '../scripts/lib/csv.mjs';

test('parses quoted fields containing commas, escaped quotes and newlines', () => {
  const rows = parseCsv('a,b,c\r\n1,"x, y","say ""hi"""\n2,"multi\nline",\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', 'x, y', 'say "hi"'],
    ['2', 'multi\nline', ''],
  ]);
});

test('keeps a last row without trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('maps rows to records and skips blank lines', () => {
  const records = toRecords(parseCsv('name,type\nimpots.gouv.fr,Gouvernement\n\nshort\n'), ['name', 'type']);
  assert.deepEqual(records, [
    { name: 'impots.gouv.fr', type: 'Gouvernement' },
    { name: 'short', type: '' },
  ]);
});

test('throws when a required column is missing', () => {
  assert.throws(() => toRecords(parseCsv('name\nx\n'), ['name', 'type']), /Colonnes manquantes.*type/);
});
