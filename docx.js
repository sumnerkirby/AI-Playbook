/* Builds a Word document from a template on the page, in the browser, so the
   site stores no .docx files and the download always matches the page.
   site.js loads this on the first click of a Word button. No dependencies:
   a .docx is a zip of a few XML parts, and a stored (uncompressed) zip is
   simple to write. Handles what the templates use: h4, p, br, ul, ol,
   ul.checks, table, strong/b, em/i, and span.fill (the blanks to fill in),
   which becomes highlighted text. With options (the AI use and risk record):
   {levels: true} makes h3 a smaller heading, .page-break starts a new page,
   and {footer: text} prints a line at the foot of every page. */
(function(){
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const letter = /^en-(US|CA)$|^(es-MX|fr-CA)$/i.test(navigator.language || '');
  const PAGE = letter ? {w: 12240, h: 15840} : {w: 11906, h: 16838};   // twips: US Letter or A4
  const MARGIN = 1134;                                                  // 2 cm
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- HTML to WordprocessingML ---------- */
  function convert(root, title, opts){
    opts = opts || {};
    const out = [];
    const nums = [];            // one numbering instance per list, so each ol restarts at 1
    let first = true, wide = false;

    function runs(node, fmt){
      let xml = '';
      node.childNodes.forEach(n => {
        if (n.nodeType === 3){
          const t = n.nodeValue.replace(/[ \t\n\r\f]+/g, ' ');   // collapse as HTML does, keeping &nbsp;
          if (t) xml += run(t, fmt);
        } else if (n.nodeType === 1){
          const tag = n.tagName.toLowerCase();
          if (tag === 'br') xml += '<w:r><w:br/></w:r>';
          else xml += runs(n, {
            b: fmt.b || tag === 'strong' || tag === 'b',
            i: fmt.i || tag === 'em' || tag === 'i',
            fill: fmt.fill || n.classList.contains('fill'),
          });
        }
      });
      return xml;
    }
    function run(text, fmt){
      const pr = (fmt.b ? '<w:b/>' : '') + (fmt.i ? '<w:i/>' : '') + (fmt.fill ? '<w:highlight w:val="yellow"/>' : '');
      return '<w:r>' + (pr ? '<w:rPr>' + pr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
    }
    /* trim the spaces HTML would collapse at the start and end of a block */
    function para(inner, ppr){
      inner = inner.replace(/^(<w:r>(?:<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve">) +/, '$1')
                   .replace(/(<w:br\/><\/w:r><w:r>(?:<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve">) +/g, '$1')
                   .replace(/ +(<\/w:t><\/w:r>)$/, '$1');
      return '<w:p>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + inner + '</w:p>';
    }

    function list(el, level){
      const checks = el.classList.contains('checks');
      let num = 0;
      if (!checks){
        nums.push(el.tagName.toLowerCase() === 'ol' ? 2 : 1);
        num = nums.length;
      }
      [...el.children].forEach(li => {
        const own = document.createElement('div');
        const sub = [];
        li.childNodes.forEach(n => {
          if (n.nodeType === 1 && /^(ul|ol)$/i.test(n.tagName)) sub.push(n);
          else own.appendChild(n.cloneNode(true));
        });
        const ppr = checks
          ? '<w:pStyle w:val="Checklist"/>'
          : '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="' + level + '"/><w:numId w:val="' + num + '"/></w:numPr>';
        out.push(para(runs(own, {}), ppr));
        sub.forEach(s => list(s, level + 1));
      });
    }

    function table(el){
      const rows = [...el.querySelectorAll('tr')];
      const cols = Math.max(...rows.map(r => r.cells.length));
      if (cols > 5) wide = true;
      const cw = Math.floor(((cols > 5 ? PAGE.h : PAGE.w) - 2 * MARGIN) / cols);
      const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="A6AEB6"/>').join('');
      let xml = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + border +
        '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
        ('<w:gridCol w:w="' + cw + '"/>').repeat(cols) + '</w:tblGrid>';
      rows.forEach(tr => {
        const head = tr.parentElement.tagName.toLowerCase() === 'thead';
        const empty = !tr.textContent.trim();
        xml += '<w:tr>' + (head ? '<w:trPr><w:tblHeader/></w:trPr>' : empty ? '<w:trPr><w:trHeight w:val="720"/></w:trPr>' : '');
        [...tr.cells].forEach(td => {
          xml += '<w:tc><w:tcPr><w:tcW w:w="' + cw + '" w:type="dxa"/>' +
            (head ? '<w:shd w:val="clear" w:color="auto" w:fill="E7EBEF"/>' : '') + '</w:tcPr>' +
            para(runs(td, {b: head}), '<w:spacing w:after="0"/>') + '</w:tc>';
        });
        xml += '</w:tr>';
      });
      out.push(xml + '</w:tbl>', para('', ''));
    }

    function block(el){
      const tag = el.tagName.toLowerCase();
      if (el.classList.contains('page-break')){
        out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        return;
      }
      if (/^h[1-6]$/.test(tag)){
        const style = first ? 'Title' : opts.levels && tag === 'h3' ? 'Heading3' : 'Heading2';
        out.push(para(runs(el, {}), '<w:pStyle w:val="' + style + '"/>'));
      } else if (tag === 'p'){
        out.push(para(runs(el, {}), ''));
      } else if (tag === 'ul' || tag === 'ol'){
        list(el, 0);
      } else if (tag === 'table'){
        table(el);
      } else {
        [...el.children].forEach(block);
        return;
      }
      first = false;
    }
    [...root.children].forEach(block);
    if (!/^h[1-6]$/i.test((root.firstElementChild || {}).tagName || '')){
      out.unshift(para(run(title, {}), '<w:pStyle w:val="Title"/>'));
    }
    return {body: out.join(''), nums, wide};
  }

  /* ---------- the package ---------- */
  function parts(title, doc, opts){
    opts = opts || {};
    const {w, h} = PAGE;
    const size = doc.wide ? '<w:pgSz w:w="' + h + '" w:h="' + w + '" w:orient="landscape"/>' : '<w:pgSz w:w="' + w + '" w:h="' + h + '"/>';
    const foot = opts.footer ? '<w:footerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId3"/>' : '';
    const sect = '<w:sectPr>' + foot + size + '<w:pgMar w:top="' + MARGIN + '" w:right="' + MARGIN + '" w:bottom="' + MARGIN + '" w:left="' + MARGIN + '" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';

    const lvl = (i, fmt, text) => '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/><w:lvlText w:val="' + text +
      '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (360 * (i + 1)) + '" w:hanging="360"/></w:pPr>' +
      '<w:rPr><w:highlight w:val="none"/></w:rPr></w:lvl>';
    const bullets = [0, 1, 2].map(i => lvl(i, 'bullet', '•')).join('');
    const numbers = [0, 1, 2].map(i => lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i], '%' + (i + 1) + '.')).join('');
    const numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="' + W + '">' +
      '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + bullets + '</w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>' + numbers + '</w:abstractNum>' +
      doc.nums.map((a, i) => '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + a + '"/>' +
        '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('') +
      '</w:numbering>';

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + W + '">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="111A22"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2D5F8B"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="111A22"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/>' +
        '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:color w:val="4C5A68"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Checklist"><w:name w:val="Checklist"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:spacing w:after="80"/><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>' +
      '</w:styles>';

    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
        (opts.footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      'docProps/core.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + esc(title) + '</dc:title><dc:creator>AI Playbook for small businesses</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created></cp:coreProperties>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
        (opts.footer ? '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '') + '</Relationships>',
      'word/styles.xml': styles,
      'word/numbering.xml': numbering,
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + W + '"><w:body>' + doc.body + sect + '</w:body></w:document>',
    };
    if (opts.footer) files['word/footer1.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="' + W + '">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">' + esc(opts.footer) + '</w:t></w:r></w:p></w:ftr>';
    return files;
  }

  /* ---------- a stored zip ---------- */
  const CRC = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };

  function zip(files){
    const enc = new TextEncoder(), chunks = [], dir = [];
    let offset = 0;
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    Object.entries(files).forEach(([name, text]) => {
      const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const head = (sig, extra) => {
        const h = new DataView(new ArrayBuffer(extra ? 46 : 30));
        let p = 0;
        const u32 = v => { h.setUint32(p, v, true); p += 4; }, u16 = v => { h.setUint16(p, v, true); p += 2; };
        u32(sig); if (extra) u16(20);
        u16(20); u16(0x0800); u16(0); u16(time); u16(date);
        u32(crc); u32(data.length); u32(data.length); u16(n.length); u16(0);
        if (extra){ u16(0); u16(0); u16(0); u32(0); u32(offset); }
        return new Uint8Array(h.buffer);
      };
      const local = head(0x04034b50, false);
      dir.push(head(0x02014b50, true), n);
      chunks.push(local, n, data);
      offset += local.length + n.length + data.length;
    });
    const size = dir.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, Object.keys(files).length, true);
    end.setUint16(10, Object.keys(files).length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    return new Blob([...chunks, ...dir, new Uint8Array(end.buffer)],
      {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }

  window.templateDocx = (el, title, opts) => zip(parts(title, convert(el, title, opts), opts));
})();
