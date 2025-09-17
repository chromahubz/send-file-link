import { put, head, del } from '@vercel/blob';

export default async function handler(req, res) {
  const { id: boardId } = req.query;

  if (!boardId) {
    return res.status(400).json({ error: 'Board ID is required' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured' });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get board data from blob storage
        try {
          const response = await fetch(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/boards/${boardId}.json`);
          if (!response.ok) {
            return res.status(404).json({ error: 'Board not found' });
          }
          const boardData = await response.json();
          return res.status(200).json(boardData);
        } catch (error) {
          return res.status(404).json({ error: 'Board not found' });
        }

      case 'PUT':
        // Save board data to blob storage
        const boardData = {
          id: boardId,
          text: req.body.text || '',
          media: req.body.media || [],
          createdAt: req.body.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const { url } = await put(`boards/${boardId}.json`, JSON.stringify(boardData), {
          access: 'public',
          contentType: 'application/json'
        });

        return res.status(200).json(boardData);

      case 'DELETE':
        // For deleting specific media by index
        const { mediaIndex } = req.query;

        if (mediaIndex !== undefined) {
          // Get current board data, remove media item, and save back
          try {
            const response = await fetch(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/boards/${boardId}.json`);
            if (response.ok) {
              const boardData = await response.json();
              boardData.media.splice(parseInt(mediaIndex), 1);
              boardData.updatedAt = new Date().toISOString();

              await put(`boards/${boardId}.json`, JSON.stringify(boardData), {
                access: 'public',
                contentType: 'application/json'
              });

              return res.status(200).json(boardData);
            }
          } catch (error) {
            return res.status(404).json({ error: 'Board not found' });
          }
        }

        // Delete entire board
        try {
          await del(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/boards/${boardId}.json`);
          return res.status(200).json({ message: 'Board deleted' });
        } catch (error) {
          return res.status(404).json({ error: 'Board not found' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Board API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}