export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  const s = text.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') { inQuotes = false; closedQuote = true; }
      else field += c;
    } else if (c === '"') {
      if (closedQuote || field !== "") throw new Error("Unexpected quote in an unquoted CSV field. Wrap the entire field in quotes and double any quotes inside it.");
      inQuotes = true;
    }
    else if (c === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else if (closedQuote) {
      if (c !== " " && c !== "\t") throw new Error("Unexpected text after a closing CSV quote. Check the quotation marks and separator.");
    } else field += c;
  }
  if (inQuotes) throw new Error("A CSV quoted field is not closed. Add its closing quote and try again.");
  if (field !== "" || row.length > 0 || closedQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Leading =, +, - or @ would run as a formula when opened in Excel.
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(escapeField).join(",")).join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
