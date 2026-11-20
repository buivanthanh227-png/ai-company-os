const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(view: number[], value: number) {
  view.push(value & 0xff, (value >>> 8) & 0xff);
}

function u32(view: number[], value: number) {
  view.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;")
    .replaceAll("'", "\u0026apos;");
}

function colName(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetXml(rows: string[][]) {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          // eslint-disable-next-line no-control-regex -- XML 1.0 forbids these control characters.
          const text = xmlEscape(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
          return `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function pushChunk(target: number[], bytes: Uint8Array) {
  const step = 8192;
  for (let index = 0; index < bytes.length; index += step) {
    target.push(...bytes.subarray(index, index + step));
  }
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const locals: number[] = [];
  const centrals: number[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localStart = offset;
    u32(locals, 0x04034b50);
    u16(locals, 20);
    u16(locals, 0);
    u16(locals, 0);
    u16(locals, 0);
    u16(locals, 0);
    u32(locals, crc);
    u32(locals, file.data.length);
    u32(locals, file.data.length);
    u16(locals, name.length);
    u16(locals, 0);
    pushChunk(locals, name);
    pushChunk(locals, file.data);
    offset = locals.length;
    u32(centrals, 0x02014b50);
    u16(centrals, 20);
    u16(centrals, 20);
    u16(centrals, 0);
    u16(centrals, 0);
    u16(centrals, 0);
    u16(centrals, 0);
    u32(centrals, crc);
    u32(centrals, file.data.length);
    u32(centrals, file.data.length);
    u16(centrals, name.length);
    u16(centrals, 0);
    u16(centrals, 0);
    u16(centrals, 0);
    u16(centrals, 0);
    u32(centrals, 0);
    u32(centrals, localStart);
    pushChunk(centrals, name);
  }
  const centralStart = locals.length;
  const end: number[] = [];
  u32(end, 0x06054b50);
  u16(end, 0);
  u16(end, 0);
  u16(end, files.length);
  u16(end, files.length);
  u32(end, centrals.length);
  u32(end, centralStart);
  u16(end, 0);
  const out = new Uint8Array(locals.length + centrals.length + end.length);
  out.set(locals, 0);
  out.set(centrals, locals.length);
  out.set(end, locals.length + centrals.length);
  return out;
}

export function buildXlsx(rows: string[][]) {
  const encoder = new TextEncoder();
  const files = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Nhan su AI" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
      ),
    },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml(rows)) },
  ];
  return new Blob([zipStore(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: string[][]) {
  const lines = rows.map((row) =>
    row
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(","),
  );
  return `\uFEFF${lines.join("\r\n")}`;
}
