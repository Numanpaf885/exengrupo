/**
 * .html / .htm reference files → plain text for the AI (no dependency): drops
 * scripts, styles and other non-text parts, keeps line breaks at block
 * elements (navigation menus are left out), "- " for list items, " | " between table cells, and decodes
 * entities. Uses the page's declared charset when it is a known one.
 */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  agrave: 'à', egrave: 'è', ograve: 'ò', ccedil: 'ç', Ccedil: 'Ç',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°', middot: '·', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•',
  times: '×', divide: '÷', plusmn: '±', minus: '−', le: '≤', ge: '≥', ne: '≠', asymp: '≈', infin: '∞',
  radic: '√', sup2: '²', sup3: '³', frac12: '½', frac14: '¼', frac34: '¾', micro: 'µ', pi: 'π',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ',
  Sigma: 'Σ', omega: 'ω', Omega: 'Ω', euro: '€', copy: '©', reg: '®', shy: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body] ?? whole;
  });
}

const DROP = ['title', 'script', 'style', 'noscript', 'template', 'svg', 'math', 'iframe', 'object', 'canvas', 'select', 'head', 'nav'];
const BLOCK =
  'p|div|section|article|header|footer|main|aside|nav|h[1-6]|ul|ol|dl|dt|dd|table|thead|tbody|tfoot|tr|blockquote|pre|figure|figcaption|form|fieldset|address|hr|details|summary|caption';

export function htmlToText(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ');
  for (const tag of DROP) s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/t[dh]\s*>\s*(?=<t[dh]\b)/gi, ' | ')
    .replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`, 'gi'), '\n')
    .replace(/<img\b[^>]*\balt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi, (_m, _q, a?: string, b?: string) => ` ${a ?? b ?? ''} `)
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const t = title ? decodeEntities(title).replace(/\s+/g, ' ') : '';
  return t && !s.startsWith(t) ? `${t}\n${s}` : s;
}

/** Decodes the bytes with the charset the page declares (meta charset / http-equiv), UTF-8 otherwise. */
export function decodeHtml(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  const declared = /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/i.exec(head)?.[1]?.toLowerCase();
  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // unknown label: fall back to UTF-8
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}
