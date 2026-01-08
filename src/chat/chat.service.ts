import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, inArray, gt } from 'drizzle-orm';
import { DrizzleService } from '../drizzle/drizzle.service';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ChatMessage, ChatContainer } from './interfaces/chat.interface';

@Injectable()
export class ChatService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
  ) {}

  private async verifyProjectAccess(
    projectId: string,
    userId: string,
  ) {
    // Get project - now requires userId for access control
    const project = await this.projects.findOne(projectId, userId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found or access denied`);
    }

    // User access is already verified in findOne()
    return project;
  }

  async createChat(
    projectId: string,
    userId: string,
    createChatDto: CreateChatDto,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    // Get project database connection
    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Create chat container
    const chat = await projectDb
      .insert(projectSchema.chatContainers)
      .values({
        name: createChatDto.chatName,
        createdBy: userId,
      })
      .returning();

    // Initialize chat_last_reads for creator
    await projectDb
      .insert(projectSchema.chatLastReads)
      .values({
        chatId: chat[0].id,
        userId: userId,
        lastReadAt: new Date(),
      });

    // If memberIds provided, create chat_last_reads for them
    if (createChatDto.memberIds && createChatDto.memberIds.length > 0) {
      const uniqueMemberIds = [
        ...new Set(createChatDto.memberIds.filter((id) => id !== userId)),
      ];

      await projectDb
        .insert(projectSchema.chatLastReads)
        .values(
          uniqueMemberIds.map((memberId) => ({
            chatId: chat[0].id,
            userId: memberId,
            lastReadAt: null,
          }))
        );
    }

    return chat[0];
  }

  async getChatHistory(
    projectId: string,
    chatId: string,
    userId: string,
    limit: number = 50,
    before?: string,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Verify user has access to this chat
    const chatAccess = await projectDb
      .select()
      .from(projectSchema.chatLastReads)
      .where(
        and(
          eq(projectSchema.chatLastReads.chatId, chatId),
          eq(projectSchema.chatLastReads.userId, userId)
        )
      );

    if (!chatAccess || chatAccess.length === 0) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Build query
    const whereConditions = [eq(projectSchema.chatMessages.chatId, chatId)];
    if (before) {
      whereConditions.push(gt(projectSchema.chatMessages.createdAt, new Date(before)));
    }

    const messages = await projectDb
      .select()
      .from(projectSchema.chatMessages)
      .where(and(...whereConditions))
      .orderBy(projectSchema.chatMessages.createdAt)
      .limit(limit);

    // Get user info from global database for all messages
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users =
      userIds.length > 0
        ? await this.drizzle
            .getGlobalDb()
            .select({
              id: globalSchema.users.id,
              name: globalSchema.users.name,
              email: globalSchema.users.email,
            })
            .from(globalSchema.users)
            .where(inArray(globalSchema.users.id, userIds))
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get file references for messages
    const messageIds = messages.map((m) => m.id);
    const fileRefs =
      messageIds.length > 0
        ? await projectDb
            .select()
            .from(projectSchema.fileReferences)
            .where(
              and(
                eq(projectSchema.fileReferences.referenceTypeId, 2),
                inArray(projectSchema.fileReferences.referenceId, messageIds)
              )
            )
        : [];

    // Get files
    const fileIds = fileRefs.map((ref) => ref.fileId).filter((id) => id !== null);
    const files =
      fileIds.length > 0
        ? await projectDb
            .select()
            .from(projectSchema.files)
            .where(inArray(projectSchema.files.id, fileIds))
        : [];

    const filesByMessageId = new Map<string, any[]>();
    fileRefs.forEach((ref) => {
      const file = files.find((f) => f.id === ref.fileId);
      if (file) {
        if (!filesByMessageId.has(ref.referenceId)) {
          filesByMessageId.set(ref.referenceId, []);
        }
        filesByMessageId.get(ref.referenceId)!.push(file);
      }
    });

    // Combine data
    const enrichedMessages: ChatMessage[] = messages.map((msg) => ({
      ...msg,
      user: userMap.get(msg.userId),
      files: filesByMessageId.get(msg.id) || [],
    }));

    return enrichedMessages;
  }

  async sendMessage(
    projectId: string,
    userId: string,
    sendMessageDto: SendMessageDto,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Verify user has access to this chat
    const chatAccess = await projectDb
      .select()
      .from(projectSchema.chatLastReads)
      .where(
        and(
          eq(projectSchema.chatLastReads.chatId, sendMessageDto.chatId),
          eq(projectSchema.chatLastReads.userId, userId)
        )
      );

    if (!chatAccess || chatAccess.length === 0) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Create message
    const message = await projectDb
      .insert(projectSchema.chatMessages)
      .values({
        chatId: sendMessageDto.chatId,
        userId: userId,
        message: sendMessageDto.message,
      })
      .returning();

    // If fileIds provided, create file references
    if (sendMessageDto.fileIds && sendMessageDto.fileIds.length > 0) {
      await projectDb
        .insert(projectSchema.fileReferences)
        .values(
          sendMessageDto.fileIds.map((fileId) => ({
            fileId: fileId,
            referenceTypeId: 2, // 2 = chat message reference
            referenceId: message[0].id,
          }))
        );
    }

    // Update user's last_read to this message
    await projectDb
      .update(projectSchema.chatLastReads)
      .set({
        lastReadMessageId: message[0].id,
        lastReadAt: new Date(),
      })
      .where(
        and(
          eq(projectSchema.chatLastReads.chatId, sendMessageDto.chatId),
          eq(projectSchema.chatLastReads.userId, userId)
        )
      );

    // Get user info
    const user = await this.drizzle
      .getGlobalDb()
      .select({
        id: globalSchema.users.id,
        name: globalSchema.users.name,
        email: globalSchema.users.email,
      })
      .from(globalSchema.users)
      .where(eq(globalSchema.users.id, userId));

    return {
      ...message[0],
      user: user[0],
    };
  }

  async updateMessage(
    projectId: string,
    messageId: string,
    userId: string,
    updateMessageDto: UpdateMessageDto,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Get message and verify ownership
    const message = await projectDb
      .select()
      .from(projectSchema.chatMessages)
      .where(eq(projectSchema.chatMessages.id, messageId));

    if (!message || message.length === 0) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message[0].userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Update message
    const updated = await projectDb
      .update(projectSchema.chatMessages)
      .set({
        message: updateMessageDto.message,
      })
      .where(eq(projectSchema.chatMessages.id, messageId))
      .returning();

    return updated[0];
  }

  async deleteMessage(projectId: string, messageId: string, userId: string) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Get message and verify ownership
    const message = await projectDb
      .select()
      .from(projectSchema.chatMessages)
      .where(eq(projectSchema.chatMessages.id, messageId));

    if (!message || message.length === 0) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message[0].userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Delete message (cascade will delete file references)
    await projectDb
      .delete(projectSchema.chatMessages)
      .where(eq(projectSchema.chatMessages.id, messageId));

    return { success: true };
  }

  async markAsRead(
    projectId: string,
    chatId: string,
    messageId: string,
    userId: string,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Verify user has access to this chat
    const chatAccess = await projectDb
      .select()
      .from(projectSchema.chatLastReads)
      .where(
        and(
          eq(projectSchema.chatLastReads.chatId, chatId),
          eq(projectSchema.chatLastReads.userId, userId)
        )
      );

    if (!chatAccess || chatAccess.length === 0) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // Verify message exists and belongs to this chat
    const message = await projectDb
      .select()
      .from(projectSchema.chatMessages)
      .where(eq(projectSchema.chatMessages.id, messageId));

    if (!message || message.length === 0 || message[0].chatId !== chatId) {
      throw new BadRequestException('Invalid message or chat');
    }

    // Update last_read
    await projectDb
      .update(projectSchema.chatLastReads)
      .set({
        lastReadMessageId: messageId,
        lastReadAt: new Date(),
      })
      .where(
        and(
          eq(projectSchema.chatLastReads.chatId, chatId),
          eq(projectSchema.chatLastReads.userId, userId)
        )
      );

    return { success: true };
  }

  async getUserChats(projectId: string, userId: string) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Get all chats user has access to
    const userChats = await projectDb
      .select()
      .from(projectSchema.chatLastReads)
      .where(eq(projectSchema.chatLastReads.userId, userId));

    if (userChats.length === 0) {
      return [];
    }

    const chatIds = userChats.map((uc) => uc.chatId);

    // Get chat containers
    const chats =
      chatIds.length > 0
        ? await projectDb
            .select()
            .from(projectSchema.chatContainers)
            .where(inArray(projectSchema.chatContainers.id, chatIds))
        : [];

    // Get last message for each chat
    const lastMessages =
      chatIds.length > 0
        ? await projectDb
            .select()
            .from(projectSchema.chatMessages)
            .where(inArray(projectSchema.chatMessages.chatId, chatIds))
            .orderBy(projectSchema.chatMessages.createdAt)
        : [];

    const lastMessageMap = new Map<string, any>();
    lastMessages.forEach((msg) => {
      if (msg.chatId && !lastMessageMap.has(msg.chatId)) {
        lastMessageMap.set(msg.chatId, msg);
      }
    });

    // Build enriched chats
    const enrichedChats: ChatContainer[] = chats.map((chat) => {
      const userChatAccess = userChats.find((uc) => uc.chatId === chat.id);
      const lastReadMessageId = userChatAccess?.lastReadMessageId;

      let unreadCount = 0;
      if (lastReadMessageId) {
        const lastReadMessage = lastMessages.find(
          (m) => m.id === lastReadMessageId
        );
        if (lastReadMessage?.createdAt) {
          unreadCount = lastMessages.filter(
            (m) =>
              m.chatId === chat.id &&
              m.createdAt &&
              m.createdAt > lastReadMessage.createdAt!
          ).length;
        }
      } else {
        // No messages read yet, count all messages
        unreadCount = lastMessages.filter((m) => m.chatId === chat.id).length;
      }

      return {
        ...chat,
        lastMessage: lastMessageMap.get(chat.id),
        unreadCount,
      };
    });

    return enrichedChats;
  }

  async uploadFile(
    projectId: string,
    userId: string,
    fileName: string,
    fileUrl: string,
  ) {
    // Verify project access
    const project = await this.verifyProjectAccess(projectId, userId);

    const projectDb = await this.drizzle.getProjectDb(project.dbNamespace);

    // Create file record
    const file = await projectDb
      .insert(projectSchema.files)
      .values({
        name: fileName,
        url: fileUrl,
        uploadedBy: userId,
      })
      .returning();

    return file[0];
  }
}
