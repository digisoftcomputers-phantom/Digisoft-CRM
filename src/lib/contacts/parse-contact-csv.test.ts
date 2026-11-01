import { describe, expect, it } from 'vitest';
import { parseContactCsv, parseTagCell } from './parse-contact-csv';

describe('parseTagCell', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTagCell(' VIP , Lead ,  ')).toEqual(['VIP', 'Lead']);
  });

  it('splits semicolon-separated tags', () => {
    expect(parseTagCell('VIP; Lead; Customer')).toEqual([
      'VIP',
      'Lead',
      'Customer',
    ]);
  });

  it('de-dupes case-insensitively', () => {
    expect(parseTagCell('vip, VIP, Lead')).toEqual(['vip', 'Lead']);
  });

  it('returns empty for blank values', () => {
    expect(parseTagCell('')).toEqual([]);
    expect(parseTagCell(undefined)).toEqual([]);
  });
});

describe('parseContactCsv', () => {
  it('parses optional tags column', () => {
    const csv = `phone,name,tags
+15551234567,Alice,"VIP, Lead"
+15559876543,Bob,Customer`;

    expect(parseContactCsv(csv)).toEqual({
      hasPhoneColumn: true,
      hasTagsColumn: true,
      hasCompanyColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          email: undefined,
          company: undefined,
          tagNames: ['VIP', 'Lead'],
        },
        {
          phone: '+15559876543',
          name: 'Bob',
          email: undefined,
          company: undefined,
          tagNames: ['Customer'],
        },
      ],
    });
  });

  it('keeps a row with an empty phone cell instead of dropping it silently', () => {
    const csv = `phone,name
+15551234567,Alice
,Bob`;

    const { rows } = parseContactCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      phone: '',
      name: 'Bob',
      email: undefined,
      company: undefined,
      tagNames: [],
    });
  });

  it('returns empty tagNames when tags column is absent', () => {
    const csv = `phone,name
+15551234567,Alice`;

    expect(parseContactCsv(csv)).toEqual({
      hasPhoneColumn: true,
      hasTagsColumn: false,
      hasCompanyColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          email: undefined,
          company: undefined,
          tagNames: [],
        },
      ],
    });
  });
it('supports "Mobile No." and auto-normalizes 10-digit Indian numbers with +91', () => {
    const csv = `A/c Head,Mobile No.,,Regd.with Whatsapp,DND Number,Code
2025-01-01,9123460566,,Registered With Whatsapp,No,4
2025-01-01,8917278920,,Registered With Whatsapp,No,4`;

    const result = parseContactCsv(csv);
    expect(result.hasPhoneColumn).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].phone).toBe('+919123460566');
    expect(result.rows[1].phone).toBe('+918917278920');
  });
});
