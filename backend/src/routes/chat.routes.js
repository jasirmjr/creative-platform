const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All chat routes are protected
router.use(verifyToken);

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.get('/conversations/:id/messages', chatController.getMessages);
router.post('/conversations/:id/messages', chatController.chatUploadMiddleware, chatController.sendMessage);
router.patch('/conversations/:id/read', chatController.markConversationRead);
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router;
