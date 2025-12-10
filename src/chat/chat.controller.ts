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
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/projects/:projectId/chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createChat(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() createChatDto: CreateChatDto,
  ) {
    return this.chatService.createChat(
      projectId,
      req.user.userId,
      createChatDto,
    );
  }

  @Get()
  async getUserChats(@Param('projectId') projectId: string, @Req() req: any) {
    return this.chatService.getUserChats(projectId, req.user.userId);
  }

  @Get(':chatId/messages')
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
      req.user.userId,
      limitNum,
      before,
    );
  }

  @Post('messages')
  async sendMessage(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      projectId,
      req.user.userId,
      sendMessageDto,
    );
  }

  @Put('messages/:messageId')
  async updateMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.chatService.updateMessage(
      projectId,
      messageId,
      req.user.userId,
      updateMessageDto,
    );
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.chatService.deleteMessage(projectId, messageId, req.user.userId);
  }

  @Post(':chatId/read/:messageId')
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
      req.user.userId,
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
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
      req.user.userId,
      file.originalname,
      fileUrl,
    );
  }
}
