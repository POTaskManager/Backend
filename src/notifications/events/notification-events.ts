// ============================================
// NOTIFICATION EVENT TYPES
// ============================================

export enum NotificationEvent {
  // Task events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_UPDATED = 'task.updated',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_COMMENTED = 'task.commented',
  TASK_DELETED = 'task.deleted',

  // Sprint events
  SPRINT_CREATED = 'sprint.created',
  SPRINT_STARTED = 'sprint.started',
  SPRINT_COMPLETED = 'sprint.completed',
  SPRINT_TASK_ADDED = 'sprint.task_added',

  // Comment events
  COMMENT_CREATED = 'comment.created',
  COMMENT_MENTIONED = 'comment.mentioned',

  // Chat events
  CHAT_MENTIONED = 'chat.mentioned',
}

// ============================================
// EVENT PAYLOAD INTERFACES
// ============================================

export interface BaseNotificationPayload {
  projectId: string;
  projectName: string;
  actorId: string; // User who triggered the event
  actorName: string;
}

export interface TaskCreatedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  assigneeId?: string;
  assigneeName?: string;
}

export interface TaskAssignedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeName: string;
  previousAssigneeId?: string;
}

export interface TaskUpdatedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  changes: Record<string, { old: any; new: any }>;
  assigneeId?: string;
}

export interface TaskStatusChangedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
  assigneeId?: string;
}

export interface TaskCommentedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  commentId: string;
  commentText: string;
  assigneeId?: string;
  mentionedUserIds?: string[];
}

export interface TaskDeletedPayload extends BaseNotificationPayload {
  taskId: string;
  taskTitle: string;
  assigneeId?: string;
}

export interface SprintCreatedPayload extends BaseNotificationPayload {
  sprintId: string;
  sprintName: string;
  startDate?: string;
  endDate?: string;
}

export interface SprintStartedPayload extends BaseNotificationPayload {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate?: string;
  taskCount: number;
}

export interface SprintCompletedPayload extends BaseNotificationPayload {
  sprintId: string;
  sprintName: string;
  completedTasks: number;
  totalTasks: number;
}

export interface SprintTaskAddedPayload extends BaseNotificationPayload {
  sprintId: string;
  sprintName: string;
  taskId: string;
  taskTitle: string;
}

export interface CommentCreatedPayload extends BaseNotificationPayload {
  commentId: string;
  commentText: string;
  taskId?: string;
  taskTitle?: string;
}

export interface CommentMentionedPayload extends BaseNotificationPayload {
  commentId: string;
  commentText: string;
  mentionedUserId: string;
  taskId?: string;
  taskTitle?: string;
}

export interface ChatMentionedPayload extends BaseNotificationPayload {
  messageId: string;
  messageText: string;
  mentionedUserId: string;
  channelId?: string;
  channelName?: string;
}

// ============================================
// NOTIFICATION PAYLOAD UNION TYPE
// ============================================

export type NotificationPayload =
  | TaskCreatedPayload
  | TaskAssignedPayload
  | TaskUpdatedPayload
  | TaskStatusChangedPayload
  | TaskCommentedPayload
  | TaskDeletedPayload
  | SprintCreatedPayload
  | SprintStartedPayload
  | SprintCompletedPayload
  | SprintTaskAddedPayload
  | CommentCreatedPayload
  | CommentMentionedPayload
  | ChatMentionedPayload;

// ============================================
// NOTIFICATION JOB DATA
// ============================================

export interface NotificationJobData {
  event: NotificationEvent;
  payload: NotificationPayload;
  recipientIds: string[]; // Users to notify
  timestamp: Date;
}
