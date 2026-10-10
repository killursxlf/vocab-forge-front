export function getCardValue(card: Record<string, unknown> | null | undefined, key: string | null | undefined): string {
  if (!card || !key || key === 'none') return '—';
  const fields = card.customFields;
  const custom = fields && typeof fields === 'object' ? fields as Record<string, unknown> : {};
  const actualKey = Object.keys(card).find(k => k.toLowerCase() === key.toLowerCase());
  const customKey = Object.keys(custom).find(k => k.toLowerCase() === key.toLowerCase());
  const value = actualKey ? card[actualKey] : customKey ? custom[customKey] : null;
  return value === undefined || value === null ? '—' : String(value);
}
