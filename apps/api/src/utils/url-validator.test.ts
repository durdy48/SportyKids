import { describe, it, expect } from 'vitest';
import { isPublicUrl } from './url-validator';

describe('isPublicUrl', () => {
  it('accepts a public HTTPS URL', () => {
    const result = isPublicUrl('https://www.marca.com/rss/futbol.xml');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a public HTTP URL', () => {
    const result = isPublicUrl('http://feeds.bbci.co.uk/sport/rss.xml');
    expect(result).toEqual({ valid: true });
  });

  it('rejects localhost', () => {
    const result = isPublicUrl('http://localhost:3000/api');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects 127.0.0.1 (loopback)', () => {
    const result = isPublicUrl('http://127.0.0.1:8080/feed');
    expect(result.valid).toBe(false);
  });

  it('rejects [::1] IPv6 loopback', () => {
    const result = isPublicUrl('http://[::1]:3000/');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects 0.0.0.0', () => {
    const result = isPublicUrl('http://0.0.0.0/feed');
    expect(result.valid).toBe(false);
  });

  it('rejects private IP 10.x.x.x', () => {
    const result = isPublicUrl('http://10.0.0.1/internal');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects private IP 172.16.x.x', () => {
    const result = isPublicUrl('http://172.16.0.1/feed');
    expect(result.valid).toBe(false);
  });

  it('rejects private IP 172.31.x.x (upper bound)', () => {
    const result = isPublicUrl('http://172.31.255.255/feed');
    expect(result.valid).toBe(false);
  });

  it('allows 172.32.x.x (not private)', () => {
    const result = isPublicUrl('http://172.32.0.1/feed');
    expect(result).toEqual({ valid: true });
  });

  it('rejects private IP 192.168.x.x', () => {
    const result = isPublicUrl('http://192.168.1.1/rss');
    expect(result.valid).toBe(false);
  });

  it('rejects link-local 169.254.x.x', () => {
    const result = isPublicUrl('http://169.254.0.1/feed');
    expect(result.valid).toBe(false);
  });

  it('rejects non-HTTP scheme (ftp)', () => {
    const result = isPublicUrl('ftp://files.example.com/feed.xml');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HTTP');
  });

  it('rejects file:// scheme', () => {
    const result = isPublicUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
  });

  it('rejects malformed URL', () => {
    const result = isPublicUrl('not a url at all');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid');
  });

  it('rejects empty string', () => {
    const result = isPublicUrl('');
    expect(result.valid).toBe(false);
  });
});
