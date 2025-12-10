export interface ChatMessage {
  chm_messageid: string;
  chm_chatid: string | null;
  chm_userid: string;
  chm_message: string;
  chm_created_at: Date | null;
  user?: {
    user_userid: string;
    user_name: string | null;
    user_email: string;
  };
  files?: Array<{
    fil_fileid: string;
    fil_name: string;
    fil_url: string;
  }>;
}

export interface ChatContainer {
  chat_chatid: string;
  chat_name: string | null;
  chat_created_by: string;
  chat_created_at: Date | null;
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface TypingEvent {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface MessageEvent {
  type: 'new_message' | 'message_updated' | 'message_deleted';
  message: ChatMessage;
  chatId: string;
}
