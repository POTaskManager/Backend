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
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Verify user has access to project
    const access = await this.prisma.projectaccess.findFirst({
      where: {
        pac_projectid: projectId,
        pac_userid: userId,
      },
    });

    if (!access) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Get project database client
    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Create chat container
    const chat = await projectDb.chatcontainers.create({
      data: {
        chat_name: createChatDto.chatName,
        chat_created_by: userId,
      },
    });

    // Initialize chat_last_reads for creator
    await projectDb.chat_last_reads.create({
      data: {
        chat_id: chat.chat_chatid,
        user_id: userId,
        last_read_at: new Date(),
      },
    });

    // If memberIds provided, create chat_last_reads for them
    if (createChatDto.memberIds && createChatDto.memberIds.length > 0) {
      const uniqueMemberIds = [
        ...new Set(createChatDto.memberIds.filter((id) => id !== userId)),
      ];

      await Promise.all(
        uniqueMemberIds.map((memberId) =>
          projectDb.chat_last_reads.create({
            data: {
              chat_id: chat.chat_chatid,
              user_id: memberId,
              last_read_at: null,
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
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chat_last_reads.findUnique({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Build query
    const whereClause: any = {
      chm_chatid: chatId,
    };

    if (before) {
      whereClause.chm_created_at = {
        lt: new Date(before),
      };
    }

    const messages = await projectDb.chatmessages.findMany({
      where: whereClause,
      orderBy: {
        chm_created_at: 'desc',
      },
      take: limit,
    });

    // Get user info from global database for all messages
    const userIds = [...new Set(messages.map((m) => m.chm_userid))];
    const users = await this.prisma.users.findMany({
      where: {
        user_userid: { in: userIds as string[] },
      },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.user_userid, u]));

    // Get file references for messages
    const messageIds = messages.map((m) => m.chm_messageid);
    const fileRefs = await projectDb.filereferences.findMany({
      where: {
        fr_referencetypeid: 2, // 2 = chat message reference
        fr_referenceid: { in: messageIds },
      },
      include: {
        files: true,
      },
    });

    const filesByMessageId = new Map<string, any[]>();
    fileRefs.forEach((ref) => {
      if (!filesByMessageId.has(ref.fr_referenceid)) {
        filesByMessageId.set(ref.fr_referenceid, []);
      }
      if (ref.files) {
        filesByMessageId.get(ref.fr_referenceid)!.push(ref.files);
      }
    });

    // Combine data
    const enrichedMessages: ChatMessage[] = messages.map((msg) => ({
      ...msg,
      user: userMap.get(msg.chm_userid),
      files: filesByMessageId.get(msg.chm_messageid) || [],
    }));

    return enrichedMessages.reverse(); // Return oldest to newest
  }

  async sendMessage(
    projectId: string,
    userId: string,
    sendMessageDto: SendMessageDto,
  ) {
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chat_last_reads.findUnique({
      where: {
        chat_id_user_id: {
          chat_id: sendMessageDto.chatId,
          user_id: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Create message
    const message = await projectDb.chatmessages.create({
      data: {
        chm_chatid: sendMessageDto.chatId,
        chm_userid: userId,
        chm_message: sendMessageDto.message,
      },
    });

    // If fileIds provided, create file references
    if (sendMessageDto.fileIds && sendMessageDto.fileIds.length > 0) {
      await Promise.all(
        sendMessageDto.fileIds.map((fileId) =>
          projectDb.filereferences.create({
            data: {
              fr_fileid: fileId,
              fr_referencetypeid: 2, // 2 = chat message reference
              fr_referenceid: message.chm_messageid,
            },
          }),
        ),
      );
    }

    // Update user's last_read to this message
    await projectDb.chat_last_reads.update({
      where: {
        chat_id_user_id: {
          chat_id: sendMessageDto.chatId,
          user_id: userId,
        },
      },
      data: {
        last_read_messageid: message.chm_messageid,
        last_read_at: new Date(),
      },
    });

    // Get user info
    const user = await this.prisma.users.findUnique({
      where: { user_userid: userId },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
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
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Get message and verify ownership
    const message = await projectDb.chatmessages.findUnique({
      where: { chm_messageid: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.chm_userid !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Update message
    const updatedMessage = await projectDb.chatmessages.update({
      where: { chm_messageid: messageId },
      data: {
        chm_message: updateMessageDto.message,
      },
    });

    return updatedMessage;
  }

  async deleteMessage(projectId: string, messageId: string, userId: string) {
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Get message and verify ownership
    const message = await projectDb.chatmessages.findUnique({
      where: { chm_messageid: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.chm_userid !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Delete message (cascade will delete file references)
    await projectDb.chatmessages.delete({
      where: { chm_messageid: messageId },
    });

    return { success: true };
  }

  async markAsRead(
    projectId: string,
    chatId: string,
    messageId: string,
    userId: string,
  ) {
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Verify user has access to this chat
    const chatAccess = await projectDb.chat_last_reads.findUnique({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId,
        },
      },
    });

    if (!chatAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Verify message exists and belongs to this chat
    const message = await projectDb.chatmessages.findUnique({
      where: { chm_messageid: messageId },
    });

    if (!message || message.chm_chatid !== chatId) {
      throw new BadRequestException('Invalid message or chat');
    }

    // Update last_read
    await projectDb.chat_last_reads.update({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId,
        },
      },
      data: {
        last_read_messageid: messageId,
        last_read_at: new Date(),
      },
    });

    return { success: true };
  }

  async getUserChats(projectId: string, userId: string) {
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Get all chats user has access to
    const userChats = await projectDb.chat_last_reads.findMany({
      where: {
        user_id: userId,
      },
      include: {
        chatmessages: true,
      },
    });

    const chatIds = userChats.map((uc) => uc.chat_id);

    // Get chat containers
    const chats = await projectDb.chatcontainers.findMany({
      where: {
        chat_chatid: { in: chatIds },
      },
    });

    // Get last message for each chat
    const lastMessages = await Promise.all(
      chatIds.map((chatId) =>
        projectDb.chatmessages.findFirst({
          where: { chm_chatid: chatId },
          orderBy: { chm_created_at: 'desc' },
        }),
      ),
    );

    const lastMessageMap = new Map(
      lastMessages
        .filter((msg) => msg !== null)
        .map((msg) => [msg!.chm_chatid, msg]),
    );

    // Calculate unread count for each chat
    const enrichedChats: ChatContainer[] = await Promise.all(
      chats.map(async (chat) => {
        const userChatAccess = userChats.find(
          (uc) => uc.chat_id === chat.chat_chatid,
        );
        const lastReadMessageId = userChatAccess?.last_read_messageid;

        let unreadCount = 0;
        if (lastReadMessageId) {
          const lastReadMessage = await projectDb.chatmessages.findUnique({
            where: { chm_messageid: lastReadMessageId },
          });

          if (lastReadMessage && lastReadMessage.chm_created_at) {
            unreadCount = await projectDb.chatmessages.count({
              where: {
                chm_chatid: chat.chat_chatid,
                chm_created_at: {
                  gt: lastReadMessage.chm_created_at,
                },
              },
            });
          }
        } else {
          // No messages read yet, count all messages
          unreadCount = await projectDb.chatmessages.count({
            where: {
              chm_chatid: chat.chat_chatid,
            },
          });
        }

        return {
          ...chat,
          lastMessage: lastMessageMap.get(chat.chat_chatid),
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
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const projectDb = await this.projectDatabaseService.getProjectClient(
      project.proj_db_namespace,
    );

    // Create file record
    const file = await projectDb.files.create({
      data: {
        fil_name: fileName,
        fil_url: fileUrl,
        fil_uploaded_by: userId,
      },
    });

    return file;
  }
}
