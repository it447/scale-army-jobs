// lib/clients.js
// Fetches client list from published Google Sheet CSV

export async function fetchClients() {
  const url = process.env.GOOGLE_SHEET_URL;
  if (!url) throw new Error('GOOGLE_SHEET_URL not set');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch Google Sheet: ${res.status}`);

  const csv = await res.text();
  const lines = csv.split('\n').filter(l => l.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    return {
      name: cols[0] || '',
      domain: cols[1] || '',
      linkedinUrl: cols[2] || '',
      careersUrl: cols[3] || '', // optional 4th column
    };
  }).filter(c => c.name && c.domain);
}
