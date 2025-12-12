import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
@UseGuards(WsJwtGuard)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private readonly typingUsers = new Map<string, Set<string>>(); // chatId -> Set of userIds

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Track user's socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.log(`Client connected: ${client.id}, User: ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }

      // Remove from all typing indicators
      this.typingUsers.forEach((users, chatId) => {
        if (users.has(userId)) {
          users.delete(userId);
          this.server.to(chatId).emit('user_stopped_typing', {
            chatId,
            userId,
          });
        }
      });
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @MessageBody() data: { projectId: string; chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Verify user has access to this chat through ChatService
      const chats = await this.chatService.getUserChats(data.projectId, userId);
      const hasAccess = chats.some((chat) => chat.id === data.chatId);

      if (!hasAccess) {
        throw new WsException('You do not have access to this chat');
      }

      // Join the chat room
      await client.join(data.chatId);
      this.logger.log(
        `User ${userId} joined chat ${data.chatId} in project ${data.projectId}`,
      );

      client.emit('joined_chat', {
        chatId: data.chatId,
        message: 'Successfully joined chat',
      });
    } catch (error) {
      this.logger.error(`Error joining chat: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Leave the chat room
      await client.leave(data.chatId);

      // Remove from typing indicator
      const typingSet = this.typingUsers.get(data.chatId);
      if (typingSet && typingSet.has(userId)) {
        typingSet.delete(userId);
        this.server.to(data.chatId).emit('user_stopped_typing', {
          chatId: data.chatId,
          userId,
        });
      }

      this.logger.log(`User ${userId} left chat ${data.chatId}`);

      client.emit('left_chat', {
        chatId: data.chatId,
        message: 'Successfully left chat',
      });
    } catch (error) {
      this.logger.error(`Error leaving chat: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    data: { projectId: string; sendMessageDto: SendMessageDto },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Send message through service
      const message = await this.chatService.sendMessage(
        data.projectId,
        userId,
        data.sendMessageDto,
      );

      // Broadcast to all users in the chat room
      this.server.to(data.sendMessageDto.chatId).emit('new_message', {
        type: 'new_message',
        message,
        chatId: data.sendMessageDto.chatId,
      });

      // Remove sender from typing indicator if they were typing
      const typingSet = this.typingUsers.get(data.sendMessageDto.chatId);
      if (typingSet && typingSet.has(userId)) {
        typingSet.delete(userId);
        this.server.to(data.sendMessageDto.chatId).emit('user_stopped_typing', {
          chatId: data.sendMessageDto.chatId,
          userId,
        });
      }

      this.logger.log(
        `Message sent in chat ${data.sendMessageDto.chatId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('update_message')
  async handleUpdateMessage(
    @MessageBody()
    data: {
      projectId: string;
      messageId: string;
      updateMessageDto: UpdateMessageDto;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Update message through service
      const message = await this.chatService.updateMessage(
        data.projectId,
        data.messageId,
        userId,
        data.updateMessageDto,
      );

      // Broadcast to all users in the chat room
      this.server.to(message.chatId!).emit('message_updated', {
        type: 'message_updated',
        message,
        chatId: message.chatId,
      });

      this.logger.log(`Message ${data.messageId} updated by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating message: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @MessageBody() data: { projectId: string; messageId: string; chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Delete message through service
      await this.chatService.deleteMessage(data.projectId, data.messageId, userId);

      // Broadcast to all users in the chat room
      this.server.to(data.chatId).emit('message_deleted', {
        type: 'message_deleted',
        messageId: data.messageId,
        chatId: data.chatId,
      });

      this.logger.log(`Message ${data.messageId} deleted by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() data: { chatId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;

    // Add user to typing set
    if (!this.typingUsers.has(data.chatId)) {
      this.typingUsers.set(data.chatId, new Set());
    }
    this.typingUsers.get(data.chatId)!.add(userId);

    // Broadcast to others in the chat (not to sender)
    client.to(data.chatId).emit('user_typing', {
      chatId: data.chatId,
      userId,
      userName: data.userName,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;

    // Remove user from typing set
    const typingSet = this.typingUsers.get(data.chatId);
    if (typingSet) {
      typingSet.delete(userId);
    }

    // Broadcast to others in the chat (not to sender)
    client.to(data.chatId).emit('user_stopped_typing', {
      chatId: data.chatId,
      userId,
      isTyping: false,
    });
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody()
    data: { projectId: string; chatId: string; messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      await this.chatService.markAsRead(
        data.projectId,
        data.chatId,
        data.messageId,
        userId,
      );

      // Broadcast read receipt to chat
      this.server.to(data.chatId).emit('message_read', {
        chatId: data.chatId,
        messageId: data.messageId,
        userId,
        readAt: new Date(),
      });

      this.logger.log(
        `User ${userId} marked message ${data.messageId} as read in chat ${data.chatId}`,
      );
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }
}
