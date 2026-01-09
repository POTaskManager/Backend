import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@ApiTags('chat')
@ApiCookieAuth()
@Controller('projects/:projectId/chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new chat channel',
    description: 'Creates a new chat channel within the project for team communication. Chat channels can be general project discussions or topic-specific (e.g., "Backend Dev", "Design Review"). The creator is automatically added as a member. Uses WebSocket for real-time message delivery.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID where the chat will be created' })
  @ApiResponse({ status: 201, description: 'Chat channel created successfully with initial metadata' })
  @ApiResponse({ status: 400, description: 'Invalid input - chat name required' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async createChat(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() createChatDto: CreateChatDto,
  ) {
    return this.chatService.createChat(
      projectId,
      req.user.id,
      createChatDto,
    );
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all chat channels for user',
    description: 'Retrieves all chat channels the current user is a member of within the project. Each channel includes unread message count, last message preview, and member list. Use this to populate the chat sidebar or channel selector.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch chats from' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns array of chat channels with unread counts and last messages',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          unreadCount: { type: 'number' },
          lastMessage: { type: 'object' },
          members: { type: 'array' }
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  async getUserChats(@Param('projectId') projectId: string, @Req() req: any) {
    return this.chatService.getUserChats(projectId, req.user.id);
  }

  @Get(':chatId/messages')
  @ApiOperation({ 
    summary: 'Get chat message history',
    description: 'Retrieves paginated message history for a chat channel. Supports infinite scroll with limit and before cursor parameters. Messages include author information, timestamps, read receipts, file attachments, and edit history. Default limit is 50 messages.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'chatId', description: 'Chat channel UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns array of messages with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        messages: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              authorId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              isRead: { type: 'boolean' },
              attachments: { type: 'array' }
            }
          }
        },
        hasMore: { type: 'boolean' },
        cursor: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Access denied - user not a chat member' })
  @ApiResponse({ status: 404, description: 'Chat channel not found' })
  async getChatHistory(
    @Param('projectId') projectId: string,
    @Param('chatId') chatId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.chatService.getChatHistory(
      projectId,
      chatId,
      req.user.id,
      limitNum,
      before,
    );
  }

  @Post('messages')
  @ApiOperation({ 
    summary: 'Send a chat message',
    description: 'Sends a new message to a chat channel. Message is broadcast in real-time to all online channel members via WebSocket. Supports text content, @mentions, and file attachments. Triggers notifications to mentioned users based on their preferences.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully, returns message object with ID and timestamp' })
  @ApiResponse({ status: 400, description: 'Invalid input - message content required' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a chat member' })
  @ApiResponse({ status: 404, description: 'Chat channel not found' })
  async sendMessage(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      projectId,
      req.user.id,
      sendMessageDto,
    );
  }

  @Put('messages/:messageId')
  @ApiOperation({ 
    summary: 'Edit a chat message',
    description: 'Edits the content of a previously sent message. Only the message author can edit their own messages. An "edited" indicator is shown with the edit timestamp. Edit is broadcast in real-time to all channel members via WebSocket.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'messageId', description: 'Message UUID to edit' })
  @ApiResponse({ status: 200, description: 'Message updated successfully with edit timestamp' })
  @ApiResponse({ status: 403, description: 'Access denied - only message author can edit' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.chatService.updateMessage(
      projectId,
      messageId,
      req.user.id,
      updateMessageDto,
    );
  }

  @Delete('messages/:messageId')
  @ApiOperation({ 
    summary: 'Delete a chat message',
    description: 'Deletes a message from the chat channel. Only the message author or project administrators can delete messages. Deletion is broadcast in real-time via WebSocket. Deleted messages are removed permanently and cannot be recovered.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'messageId', description: 'Message UUID to delete' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - only message author or admin can delete' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async deleteMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.chatService.deleteMessage(projectId, messageId, req.user.id);
  }

  @Post(':chatId/read/:messageId')
  @ApiOperation({ 
    summary: 'Mark message as read',
    description: 'Marks a message (and all previous messages in the channel) as read by the current user. Updates the unread count and last read position. Read receipts are visible to other channel members. Essential for tracking which messages users have seen.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'chatId', description: 'Chat channel UUID' })
  @ApiParam({ name: 'messageId', description: 'Message UUID to mark as read (marks this and all previous messages)' })
  @ApiResponse({ status: 200, description: 'Messages marked as read successfully, returns updated unread count' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a chat member' })
  @ApiResponse({ status: 404, description: 'Chat channel or message not found' })
  async markAsRead(
    @Param('projectId') projectId: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.chatService.markAsRead(
      projectId,
      chatId,
      messageId,
      req.user.id,
    );
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Upload file attachment for chat',
    description: 'Uploads a file to be attached to chat messages. Supports images (JPEG, PNG, GIF, WebP), documents (PDF, Word, Excel), archives (ZIP), and text files. Maximum file size is 10MB. Returns a file URL that can be included in message content. In production, files are stored in cloud storage (S3/GCS).'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully, returns file URL and metadata',
    schema: {
      type: 'object',
      properties: {
        fileUrl: { type: 'string', description: 'URL to access the uploaded file' },
        filename: { type: 'string', description: 'Original filename' },
        size: { type: 'number', description: 'File size in bytes' },
        mimeType: { type: 'string', description: 'File MIME type' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or no file provided. Allowed: images, PDF, documents, archives' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 413, description: 'File too large - maximum 10MB' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (req, file, callback) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        // Allow images, documents, and archives
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip',
          'application/x-zip-compressed',
          'text/plain',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Allowed: images, PDF, documents, archives',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // In production, upload to cloud storage (S3, GCS, etc.)
    // For now, use local file path
    const fileUrl = `/uploads/chat/${file.filename}`;

    return this.chatService.uploadFile(
      projectId,
      req.user.id,
      file.originalname,
      fileUrl,
    );
  }
}
