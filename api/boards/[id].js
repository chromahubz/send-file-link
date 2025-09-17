import { getBoardData, setBoardData, deleteMediaFromBoard } from '../../lib/db.js';

export default async function handler(req, res) {
  const { id: boardId } = req.query;

  if (!boardId) {
    return res.status(400).json({ error: 'Board ID is required' });
  }

  try {
    switch (req.method) {
      case 'GET':
        const boardData = await getBoardData(boardId);

        if (!boardData) {
          return res.status(404).json({ error: 'Board not found' });
        }

        return res.status(200).json(boardData);

      case 'PUT':
        const updatedBoard = await setBoardData(boardId, req.body);
        return res.status(200).json(updatedBoard);

      case 'DELETE':
        // For deleting specific media by index
        const { mediaIndex } = req.query;

        if (mediaIndex !== undefined) {
          const updatedBoardData = await deleteMediaFromBoard(boardId, parseInt(mediaIndex));
          return res.status(200).json(updatedBoardData);
        }

        // Delete entire board
        await kv.del(`board:${boardId}`);
        return res.status(200).json({ message: 'Board deleted' });

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Board API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}