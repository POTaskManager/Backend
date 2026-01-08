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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private readonly typingUsers = new Map<string, Set<string>>(); // chatId -> Set of userIds

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract and verify JWT token
      const token = this.extractTokenFromHandshake(client);
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided for ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify token and extract payload
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Attach user info to socket
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
      };

      const userId = client.data.user.userId;

      // Track user's socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      this.logger.log(`Client connected: ${client.id}, User: ${userId}`);
    } catch (error) {
      this.logger.error(`Connection rejected for ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  private extractTokenFromHandshake(client: Socket): string | undefined {
    // Extract token from cookies (primary method - matches REST API auth)
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
      if (accessTokenMatch) {
        return accessTokenMatch[1];
      }
    }

    // Fallback: Try to get token from auth header (for non-browser clients)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      return type === 'Bearer' ? token : undefined;
    }

    // Fallback: Try to get token from query params or auth object
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    return token as string | undefined;
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_project')
  async handleJoinProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Verify user has access to this project
      await this.chatService.verifyProjectAccess(data.projectId, userId);

      // Join the project-level room to receive notifications for all chats
      const projectRoom = `project:${data.projectId}`;
      await client.join(projectRoom);
      
      this.logger.log(
        `User ${userId} joined project room ${projectRoom}`,
      );

      client.emit('joined_project', {
        projectId: data.projectId,
        message: 'Successfully joined project room',
      });
    } catch (error) {
      this.logger.error(`Error joining project: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_project')
  async handleLeaveProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.user.userId;

      // Leave the project-level room
      const projectRoom = `project:${data.projectId}`;
      await client.leave(projectRoom);

      this.logger.log(`User ${userId} left project room ${projectRoom}`);

      client.emit('left_project', {
        projectId: data.projectId,
        message: 'Successfully left project room',
      });
    } catch (error) {
      this.logger.error(`Error leaving project: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
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

      // Also broadcast to project room for users not in this specific chat
      // This allows them to see notifications/highlights
      const projectRoom = `project:${data.projectId}`;
      
      // Get all sockets in the project room
      const projectSockets = await this.server.in(projectRoom).fetchSockets();
      // Get all sockets in the chat room
      const chatSockets = await this.server.in(data.sendMessageDto.chatId).fetchSockets();
      const chatSocketIds = new Set(chatSockets.map(s => s.id));
      
      // Send notification only to project room members NOT in the chat room
      for (const socket of projectSockets) {
        if (!chatSocketIds.has(socket.id)) {
          socket.emit('chat_message_notification', {
            type: 'chat_message_notification',
            chatId: data.sendMessageDto.chatId,
            projectId: data.projectId,
            message,
            senderId: userId,
          });
        }
      }

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

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
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
