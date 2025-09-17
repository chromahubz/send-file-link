import { createShareLink } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
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

    const shareLink = await createShareLink(boardId, customSlug, expirySeconds);

    return res.status(200).json({
      message: 'Share link created successfully',
      slug: shareLink.slug,
      expiresAt: shareLink.expires_at,
      boardId: shareLink.board_id
    });

  } catch (error) {
    console.error('Share link creation error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({
      error: error.message || 'Failed to create share link'
    });
  }
}