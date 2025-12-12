export interface ChatMessage {
  id: string;
  chatId: string | null;
  userId: string;
  message: string;
  createdAt: Date | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  files?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

export interface ChatContainer {
  id: string;
  name: string | null;
  createdBy: string;
  createdAt: Date | null;
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
