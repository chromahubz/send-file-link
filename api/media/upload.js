import { put } from '@vercel/blob';
import formidable from 'formidable';
import { readFileSync } from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured' });
  }

  try {
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const boardId = Array.isArray(fields.boardId) ? fields.boardId[0] : fields.boardId;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read file data
    const fileBuffer = readFileSync(uploadedFile.filepath);
    const originalName = uploadedFile.originalFilename || 'unknown';
    const mimeType = uploadedFile.mimetype || 'application/octet-stream';

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `media/${timestamp}-${originalName}`;

    // Upload to Vercel Blob
    const blob = await put(uniqueFileName, fileBuffer, {
      contentType: mimeType,
      access: 'public',
    });

    // Create media item
    const mediaItem = {
      id: `media_${timestamp}`,
      url: blob.url,
      name: originalName,
      type: mimeType,
      size: uploadedFile.size,
      uploadedAt: new Date().toISOString(),
    };

    // Get current board data and add media item
    try {
      const response = await fetch(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/boards/${boardId}.json`);
      let boardData;

      if (response.ok) {
        boardData = await response.json();
      } else {
        // Create new board if it doesn't exist
        boardData = {
          id: boardId,
          text: '',
          media: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Add media item to board
      boardData.media.push(mediaItem);
      boardData.updatedAt = new Date().toISOString();

      // Save updated board data
      await put(`boards/${boardId}.json`, JSON.stringify(boardData), {
        access: 'public',
        contentType: 'application/json'
      });

      return res.status(200).json({
        message: 'File uploaded successfully',
        mediaItem,
        board: boardData,
      });

    } catch (error) {
      console.error('Board update error:', error);
      return res.status(500).json({ error: 'Failed to update board with media item' });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to upload file'
    });
  }
}