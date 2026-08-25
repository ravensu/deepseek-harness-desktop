/** Split outbound WeChat text at ~2000 Unicode code points. */

export function splitText(text, max = 2000) {
  const s = String(text ?? '');
  if (!s) return [];
  if ([...s].length <= max) return [s];

  const chars = [...s];
  const parts = [];
  let i = 0;
  while (i < chars.length) {
    let end = Math.min(i + max, chars.length);
    if (end < chars.length) {
      const slice = chars.slice(i, end);
      const joined = slice.join('');
      const para = joined.lastIndexOf('\n\n');
      const nl = joined.lastIndexOf('\n');
      const sp = joined.lastIndexOf(' ');
      let cut = -1;
      if (para >= max * 0.4) cut = para + 2;
      else if (nl >= max * 0.4) cut = nl + 1;
      else if (sp >= max * 0.4) cut = sp + 1;
      if (cut > 0) end = i + [...joined.slice(0, cut)].length;
    }
    parts.push(chars.slice(i, end).join('').trimEnd());
    i = end;
  }
  return parts.filter((p) => p.length > 0);
}
