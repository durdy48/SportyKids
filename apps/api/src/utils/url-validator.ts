/**
 * Validate that a URL is safe to fetch (not pointing to internal/private networks).
 * Rejects localhost, private IP ranges, and non-HTTP(S) schemes.
 */
export function isPublicUrl(urlString: string): { valid: boolean; reason?: string } {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const scheme = parsedUrl.protocol;

  // Only allow http and https schemes.
  // NOTE: HTTP is intentionally allowed because many legitimate RSS feeds still use HTTP.
  if (scheme !== 'http:' && scheme !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
  }

  // Block localhost and loopback (IPv4)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    return { valid: false, reason: 'Internal URLs are not allowed' };
  }

  // Block IPv6 loopback — URL.hostname wraps IPv6 in brackets, so strip them
  const strippedHostname = hostname.replace(/^\[|\]$/g, '');
  if (['::1', '0:0:0:0:0:0:0:1'].includes(strippedHostname)) {
    return { valid: false, reason: 'Internal URLs are not allowed' };
  }

  // Block IPv6-mapped IPv4 addresses (e.g., ::ffff:127.0.0.1, ::ffff:10.0.0.1)
  const ipv6MappedMatch = strippedHostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv6MappedMatch) {
    // Recursively validate the embedded IPv4 address
    return isPublicUrl(`http://${ipv6MappedMatch[1]}/`);
  }

  // Block private IP ranges
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      (a === 10) ||                              // 10.x.x.x
      (a === 172 && b >= 16 && b <= 31) ||       // 172.16-31.x.x
      (a === 192 && b === 168) ||                // 192.168.x.x
      (a === 169 && b === 254)                   // 169.254.x.x (link-local)
    ) {
      return { valid: false, reason: 'Internal URLs are not allowed' };
    }
  }

  return { valid: true };
}
