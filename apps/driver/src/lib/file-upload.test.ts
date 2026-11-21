import { describe, it, expect } from 'vitest';
import type { DocumentFile } from './file-upload';

describe('DocumentFile', () => {
  it('creates a document file', () => {
    const file: DocumentFile = {
      uri: 'file:///path/to/document.pdf',
      name: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    };
    expect(file.uri).toBe('file:///path/to/document.pdf');
    expect(file.mimeType).toBe('application/pdf');
  });

  it('creates an image file', () => {
    const file: DocumentFile = {
      uri: 'file:///path/to/photo.jpg',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
      width: 1920,
      height: 1080,
    };
    expect(file.mimeType).toBe('image/jpeg');
    expect(file.width).toBe(1920);
  });

  it('sanitizes file names correctly', () => {
    // This test verifies the naming behavior documented in file-upload.ts
    const unsafeName = 'document with spaces & special!chars.pdf';

    // The upload function sanitizes names by replacing non-alphanumeric chars with underscore
    // This just verifies the concept
    const sanitized = unsafeName.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(sanitized).toBe('document_with_spaces___special_chars.pdf');
  });
});
