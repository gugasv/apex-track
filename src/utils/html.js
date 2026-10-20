/**
 * HTML escaping for user- and file-supplied text placed in markup strings
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;'
};

export function escapeHtml(unsafe) {
  return String(unsafe).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
