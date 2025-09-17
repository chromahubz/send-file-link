import { kv } from '@vercel/kv';
import { sql } from '@vercel/postgres';

// Board management
export async function getBoardData(boardId) {
  try {
    const boardData = await kv.get(`board:${boardId}`);
    return boardData;
  } catch (error) {
    console.error('Error getting board data:', error);
    return null;
  }
}

export async function setBoardData(boardId, data) {
  try {
    const boardData = {
      id: boardId,
      text: data.text || '',
      media: data.media || [],
      createdAt: data.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      ...data
    };

    await kv.set(`board:${boardId}`, boardData);

    // Set expiration (7 days for inactive boards)
    await kv.expire(`board:${boardId}`, 60 * 60 * 24 * 7);

    return boardData;
  } catch (error) {
    console.error('Error setting board data:', error);
    throw error;
  }
}

export async function addMediaToBoard(boardId, mediaItem) {
  try {
    const boardData = await getBoardData(boardId);
    if (!boardData) {
      throw new Error('Board not found');
    }

    if (!boardData.media) {
      boardData.media = [];
    }

    boardData.media.push(mediaItem);
    boardData.lastModified = new Date().toISOString();

    await setBoardData(boardId, boardData);
    return boardData;
  } catch (error) {
    console.error('Error adding media to board:', error);
    throw error;
  }
}

export async function deleteMediaFromBoard(boardId, mediaIndex) {
  try {
    const boardData = await getBoardData(boardId);
    if (!boardData || !boardData.media) {
      throw new Error('Board or media not found');
    }

    if (mediaIndex < 0 || mediaIndex >= boardData.media.length) {
      throw new Error('Invalid media index');
    }

    boardData.media.splice(mediaIndex, 1);
    boardData.lastModified = new Date().toISOString();

    await setBoardData(boardId, boardData);
    return boardData;
  } catch (error) {
    console.error('Error deleting media from board:', error);
    throw error;
  }
}

// Share links management using Postgres
export async function createShareLink(boardId, customSlug = null, expirySeconds = 86400) {
  try {
    // Initialize tables if they don't exist
    await initializeDatabase();

    const slug = customSlug || generateSlug();
    const expiresAt = new Date(Date.now() + (expirySeconds * 1000)).toISOString();

    // Check if custom slug already exists
    if (customSlug) {
      const existing = await sql`
        SELECT id FROM shared_links WHERE slug = ${slug} AND expires_at > NOW()
      `;

      if (existing.rows.length > 0) {
        throw new Error('Custom slug already exists');
      }
    }

    const result = await sql`
      INSERT INTO shared_links (slug, board_id, created_at, expires_at, access_count)
      VALUES (${slug}, ${boardId}, NOW(), ${expiresAt}, 0)
      RETURNING *
    `;

    return result.rows[0];
  } catch (error) {
    console.error('Error creating share link:', error);
    throw error;
  }
}

export async function getShareLink(slug) {
  try {
    const result = await sql`
      SELECT * FROM shared_links
      WHERE slug = ${slug} AND expires_at > NOW()
    `;

    if (result.rows.length === 0) {
      return null;
    }

    // Increment access count
    await sql`
      UPDATE shared_links
      SET access_count = access_count + 1
      WHERE slug = ${slug}
    `;

    return result.rows[0];
  } catch (error) {
    console.error('Error getting share link:', error);
    return null;
  }
}

async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS shared_links (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        board_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        access_count INTEGER DEFAULT 0
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_shared_links_slug ON shared_links(slug)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_shared_links_expires ON shared_links(expires_at)
    `;
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

function generateSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Cleanup expired links (can be called periodically)
export async function cleanupExpiredLinks() {
  try {
    const result = await sql`
      DELETE FROM shared_links WHERE expires_at < NOW()
    `;
    console.log(`Cleaned up ${result.rowCount} expired links`);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up expired links:', error);
    return 0;
  }
}