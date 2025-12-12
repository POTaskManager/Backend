import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ChatMessage, ChatContainer } from './interfaces/chat.interface';

@Injectable()
export class ChatService {
  constructor(
    private readonly projectDatabaseService: ProjectDatabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async createChat(
    projectId: string,
    userId: string,
    createChatDto: CreateChatDto,
  ) {
    // Get project namespace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Verify user has access to project
    const access = await this.prisma.projectAccess.findFirst({
      where: {
        projectId: projectId,
        userId: userId,
      },
    });

    if (!access) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Get project database client
    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Create chat container
    const chat = await projectDb.chatContainer.create({
      data: {
        name: createChatDto.chatName,
        createdBy: userId,
      },
    });

    // Initialize chat_last_reads for creator
    await projectDb.chatLastRead.create({
      data: {
        chatId: chat.id,
        userId: userId,
        lastReadAt: new Date(),
      },
    });

    // If memberIds provided, create chat_last_reads for them
    if (createChatDto.memberIds && createChatDto.memberIds.length > 0) {
      const uniqueMemberIds = [
        ...new Set(createChatDto.memberIds.filter((id) => id !== userId)),
      ];

      await Promise.all(
        uniqueMemberIds.map((memberId) =>
          projectDb.chatLastRead.create({
            data: {
              chatId: chat.id,
              userId: memberId,
              lastReadAt: null,
            },
          }),
        ),
      );
    }

    return chat;
  }

  async getChatHistory(
    projectId: string,
    chatId: string,
    userId: string,
    limit: number = 50,
    before?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chatLastRead.findUnique({
      where: {
        chatId_userId: {
          chatId: chatId,
          userId: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Build query
    const whereClause: any = {
      chatId: chatId,
    };

    if (before) {
      whereClause.createdAt = {
        lt: new Date(before),
      };
    }

    const messages = await projectDb.chatMessage.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Get user info from global database for all messages
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds as string[] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get file references for messages
    const messageIds = messages.map((m) => m.id);
    const fileRefs = await projectDb.fileReference.findMany({
      where: {
        referenceTypeId: 2, // 2 = chat message reference
        referenceId: { in: messageIds },
      },
      include: {
        file: true,
      },
    });

    const filesByMessageId = new Map<string, any[]>();
    fileRefs.forEach((ref) => {
      if (!filesByMessageId.has(ref.referenceId)) {
        filesByMessageId.set(ref.referenceId, []);
      }
      if (ref.file) {
        filesByMessageId.get(ref.referenceId)!.push(ref.file);
      }
    });

    // Combine data
    const enrichedMessages: ChatMessage[] = messages.map((msg) => ({
      ...msg,
      user: userMap.get(msg.userId),
      files: filesByMessageId.get(msg.id) || [],
    }));

    return enrichedMessages.reverse(); // Return oldest to newest
  }

  async sendMessage(
    projectId: string,
    userId: string,
    sendMessageDto: SendMessageDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chatLastRead.findUnique({
      where: {
        chatId_userId: {
          chatId: sendMessageDto.chatId,
          userId: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Create message
    const message = await projectDb.chatMessage.create({
      data: {
        chatId: sendMessageDto.chatId,
        userId: userId,
        message: sendMessageDto.message,
      },
    });

    // If fileIds provided, create file references
    if (sendMessageDto.fileIds && sendMessageDto.fileIds.length > 0) {
      await Promise.all(
        sendMessageDto.fileIds.map((fileId) =>
          projectDb.fileReference.create({
            data: {
              fileId: fileId,
              referenceTypeId: 2, // 2 = chat message reference
              referenceId: message.id,
            },
          }),
        ),
      );
    }

    // Update user's last_read to this message
    await projectDb.chatLastRead.update({
      where: {
        chatId_userId: {
          chatId: sendMessageDto.chatId,
          userId: userId,
        },
      },
      data: {
        lastReadMsgId: message.id,
        lastReadAt: new Date(),
      },
    });

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return {
      ...message,
      user,
    };
  }

  async updateMessage(
    projectId: string,
    messageId: string,
    userId: string,
    updateMessageDto: UpdateMessageDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Get message and verify ownership
    const message = await projectDb.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Update message
    const updatedMessage = await projectDb.chatMessage.update({
      where: { id: messageId },
      data: {
        message: updateMessageDto.message,
      },
    });

    return updatedMessage;
  }

  async deleteMessage(projectId: string, messageId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Get message and verify ownership
    const message = await projectDb.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Delete message (cascade will delete file references)
    await projectDb.chatMessage.delete({
      where: { id: messageId },
    });

    return { success: true };
  }

  async markAsRead(
    projectId: string,
    chatId: string,
    messageId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chatLastRead.findUnique({
      where: {
        chatId_userId: {
          chatId: chatId,
          userId: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Verify message exists and belongs to this chat
    const message = await projectDb.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.chatId !== chatId) {
      throw new BadRequestException('Invalid message or chat');
    }

    // Update last_read
    await projectDb.chatLastRead.update({
      where: {
        chatId_userId: {
          chatId: chatId,
          userId: userId,
        },
      },
      data: {
        lastReadMsgId: messageId,
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  }

  async getUserChats(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Get all chats user has access to
    const userChats = await projectDb.chatLastRead.findMany({
      where: {
        userId: userId,
      },
    });

    const chatIds = userChats.map((uc) => uc.chatId);

    // Get chat containers
    const chats = await projectDb.chatContainer.findMany({
      where: {
        id: { in: chatIds },
      },
    });

    // Get last message for each chat
    const lastMessages = await Promise.all(
      chatIds.map((chatId) =>
        projectDb.chatMessage.findFirst({
          where: { chatId: chatId },
          orderBy: { createdAt: 'desc' },
        }),
      ),
    );

    const lastMessageMap = new Map(
      lastMessages
        .filter((msg) => msg !== null)
        .map((msg) => [msg!.chatId, msg]),
    );

    // Calculate unread count for each chat
    const enrichedChats: ChatContainer[] = await Promise.all(
      chats.map(async (chat) => {
        const userChatAccess = userChats.find(
          (uc) => uc.chatId === chat.id,
        );
        const lastReadMessageId = userChatAccess?.lastReadMsgId;

        let unreadCount = 0;
        if (lastReadMessageId) {
          const lastReadMessage = await projectDb.chatMessage.findUnique({
            where: { id: lastReadMessageId },
          });

          if (lastReadMessage && lastReadMessage.createdAt) {
            unreadCount = await projectDb.chatMessage.count({
              where: {
                chatId: chat.id,
                createdAt: {
                  gt: lastReadMessage.createdAt,
                },
              },
            });
          }
        } else {
          // No messages read yet, count all messages
          unreadCount = await projectDb.chatMessage.count({
            where: {
              chatId: chat.id,
            },
          });
        }

        return {
          ...chat,
          lastMessage: lastMessageMap.get(chat.id),
          unreadCount,
        };
      }),
    );

    return enrichedChats;
  }

  async uploadFile(
    projectId: string,
    userId: string,
    fileName: string,
    fileUrl: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.dbNamespace,
    );

    // Create file record
    const file = await projectDb.file.create({
      data: {
        name: fileName,
        url: fileUrl,
        uploadedBy: userId,
      },
    });

    return file;
  }
}
