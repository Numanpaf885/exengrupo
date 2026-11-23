import { describe, expect, it } from 'vitest';
import { extractStep } from './extract';
import { decodeEntities, decodeHtml, htmlToText } from './html';
import { fileType } from './types';

describe('fileType', () => {
  it('accepts .html/.htm and .md/.markdown', () => {
    expect(fileType('Tema 3.HTML')).toEqual({ ext: 'html', kind: 'html', mime: 'text/html' });
    expect(fileType('pagina.htm')).toEqual({ ext: 'html', kind: 'html', mime: 'text/html' });
    expect(fileType('apuntes.md')).toEqual({ ext: 'md', kind: 'text', mime: 'text/markdown' });
    expect(fileType('apuntes.markdown')).toEqual({ ext: 'md', kind: 'text', mime: 'text/markdown' });
    expect(fileType('a.jpeg')?.ext).toBe('jpg');
    expect(fileType('a.zip')).toBeNull();
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones', () => {
    expect(decodeEntities('a &lt; b &amp;&amp; &aacute;rbol &#241; &#x00e9; &nbsp;&foo;')).toBe('a < b && árbol ñ é  &foo;');
  });
});

describe('htmlToText', () => {
  it('keeps the readable text with line breaks, lists and table cells', () => {
    const html = `<!doctype html><html><head><title>Tema 3 &ndash; Fuerzas</title>
      <style>p { color: red }</style><script>alert("x")</script></head>
      <body><!-- menú --><nav>Inicio</nav>
      <h1>Tema 3 &ndash; Fuerzas</h1><p>La <b>presión</b> es fuerza<br>por superficie.</p>
      <ul><li>Newton</li><li>Pascal</li></ul>
      <table><tr><th>Magnitud</th><th>Unidad</th></tr><tr><td>Fuerza</td><td>N</td></tr></table>
      <img src="a.png" alt="Diagrama de fuerzas"><noscript>Activa JS</noscript></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Tema 3 – Fuerzas');
    expect(text).toContain('La presión es fuerza\npor superficie.');
    expect(text).toContain('- Newton\n- Pascal');
    expect(text).toContain('Magnitud | Unidad');
    expect(text).toContain('Fuerza | N');
    expect(text).toContain('Diagrama de fuerzas');
    expect(text).not.toMatch(/alert|color: red|menú|Inicio|Activa JS|</);
    expect(text.indexOf('Tema 3')).toBe(text.lastIndexOf('Tema 3')); // title not repeated
  });

  it('adds the <title> when the body does not start with it', () => {
    expect(htmlToText('<title>Examen</title><p>Pregunta 1</p>')).toBe('Examen\nPregunta 1');
  });
});

describe('decodeHtml', () => {
  it('uses the declared charset, UTF-8 otherwise', () => {
    const latin1 = Uint8Array.from([...'<meta charset="iso-8859-1"><p>'].map((c) => c.charCodeAt(0)).concat([0xe1, 0xf1]));
    expect(decodeHtml(latin1)).toContain('áñ');
    expect(decodeHtml(new TextEncoder().encode('<p>árbol</p>'))).toBe('<p>árbol</p>');
  });
});

describe('extractStep for html', () => {
  it('turns an HTML file into one text block without pages, with no AI call', async () => {
    const clients = async () => {
      throw new Error('no AI for html');
    };
    const out = await extractStep('html', 'text/html', new TextEncoder().encode('<h2>Ley de Ohm</h2><p>V = I·R</p>'), 0, clients);
    expect(out).toEqual({ done: true, pages: 1, texts: [{ page: null, text: 'Ley de Ohm\nV = I·R' }] });
  });
});
