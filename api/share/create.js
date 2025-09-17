import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured' });
  }

  try {
    const { boardId, customSlug, expirySeconds = 86400 } = req.body;

    if (!boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }

    // Validate custom slug if provided
    if (customSlug) {
      if (!/^[a-z0-9-]+$/.test(customSlug)) {
        return res.status(400).json({
          error: 'Custom slug can only contain lowercase letters, numbers, and hyphens'
        });
      }

      if (customSlug.length < 3 || customSlug.length > 50) {
        return res.status(400).json({
          error: 'Custom slug must be between 3 and 50 characters'
        });
      }
    }

    // Validate expiry
    const maxExpiry = 30 * 24 * 60 * 60; // 30 days
    if (expirySeconds > maxExpiry) {
      return res.status(400).json({
        error: 'Maximum expiry time is 30 days'
      });
    }

    // Generate slug (use custom or boardId)
    const slug = customSlug || boardId;

    // Check if slug already exists
    try {
      const existingResponse = await fetch(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/shares/${slug}.json`);
      if (existingResponse.ok) {
        return res.status(409).json({ error: 'Custom slug already exists' });
      }
    } catch (error) {
      // Slug doesn't exist, continue
    }

    // Create share mapping
    const shareMapping = {
      slug,
      boardId,
      createdAt: new Date().toISOString(),
      expirySeconds,
      expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString()
    };

    // Save share mapping to blob storage
    await put(`shares/${slug}.json`, JSON.stringify(shareMapping), {
      access: 'public',
      contentType: 'application/json'
    });

    return res.status(200).json({
      message: 'Share link created successfully',
      slug,
      expiresAt: shareMapping.expiresAt,
      boardId: shareMapping.boardId
    });

  } catch (error) {
    console.error('Share create error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create share link'
    });
  }
}