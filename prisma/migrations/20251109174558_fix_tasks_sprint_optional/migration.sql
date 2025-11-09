-- CreateTable
CREATE TABLE "Users" (
    "user_userId" TEXT NOT NULL,
    "user_FirstName" TEXT NOT NULL,
    "user_LastName" TEXT NOT NULL,
    "user_Email" TEXT NOT NULL,
    "user_PasswordHash" TEXT NOT NULL,
    "user_IsActive" BOOLEAN NOT NULL DEFAULT true,
    "user_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_LastLogin" TIMESTAMP(3),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_userId")
);

-- CreateTable
CREATE TABLE "Roles" (
    "role_roleId" TEXT NOT NULL,
    "role_Name" TEXT NOT NULL,
    "role_Description" TEXT,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("role_roleId")
);

-- CreateTable
CREATE TABLE "Projects" (
    "proj_projId" TEXT NOT NULL,
    "proj_Name" TEXT NOT NULL,
    "proj_Description" TEXT,
    "proj_OwnerId" TEXT NOT NULL,
    "proj_StartDate" TIMESTAMP(3),
    "proj_EndDate" TIMESTAMP(3),
    "proj_State" TEXT NOT NULL,
    "proj_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projects_pkey" PRIMARY KEY ("proj_projId")
);

-- CreateTable
CREATE TABLE "ProjectMembers" (
    "prmb_prmbId" TEXT NOT NULL,
    "prmb_ProjectId" TEXT NOT NULL,
    "prmb_UserId" TEXT NOT NULL,
    "prmb_RoleId" TEXT NOT NULL,

    CONSTRAINT "ProjectMembers_pkey" PRIMARY KEY ("prmb_prmbId")
);

-- CreateTable
CREATE TABLE "Boards" (
    "board_boardId" TEXT NOT NULL,
    "board_ProjectId" TEXT NOT NULL,
    "board_Type" TEXT NOT NULL,
    "board_Name" TEXT NOT NULL,
    "board_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boards_pkey" PRIMARY KEY ("board_boardId")
);

-- CreateTable
CREATE TABLE "Sprints" (
    "spr_sprId" TEXT NOT NULL,
    "spr_BoardId" TEXT NOT NULL,
    "spr_Name" TEXT NOT NULL,
    "spr_StartDate" TIMESTAMP(3),
    "spr_EndDate" TIMESTAMP(3),
    "spr_Goal" TEXT,
    "spr_State" TEXT NOT NULL,

    CONSTRAINT "Sprints_pkey" PRIMARY KEY ("spr_sprId")
);

-- CreateTable
CREATE TABLE "Tasks" (
    "task_taskId" TEXT NOT NULL,
    "task_BoardId" TEXT NOT NULL,
    "task_SprintId" TEXT,
    "task_AssignedTo" TEXT,
    "task_CreationBy" TEXT NOT NULL,
    "task_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_Title" TEXT NOT NULL,
    "task_Description" TEXT,
    "task_State" TEXT NOT NULL,
    "task_Priority" TEXT NOT NULL,
    "task_ModificationDate" TIMESTAMP(3) NOT NULL,
    "task_DueDate" TIMESTAMP(3),

    CONSTRAINT "Tasks_pkey" PRIMARY KEY ("task_taskId")
);

-- CreateTable
CREATE TABLE "Comments" (
    "com_comId" TEXT NOT NULL,
    "com_TaskId" TEXT NOT NULL,
    "com_CreationBy" TEXT NOT NULL,
    "com_Content" TEXT NOT NULL,
    "com_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comments_pkey" PRIMARY KEY ("com_comId")
);

-- CreateTable
CREATE TABLE "Messages" (
    "msg_msgId" TEXT NOT NULL,
    "msg_ProjectId" TEXT NOT NULL,
    "msg_SenderId" TEXT NOT NULL,
    "msg_Content" TEXT NOT NULL,
    "msg_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Messages_pkey" PRIMARY KEY ("msg_msgId")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "not_notId" TEXT NOT NULL,
    "not_UserId" TEXT NOT NULL,
    "not_Type" TEXT NOT NULL,
    "not_Content" TEXT NOT NULL,
    "not_IsRead" BOOLEAN NOT NULL DEFAULT false,
    "not_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("not_notId")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "actlog_actlogId" TEXT NOT NULL,
    "actlog_UserId" TEXT NOT NULL,
    "actlog_EntityType" TEXT NOT NULL,
    "actlog_EntityId" TEXT NOT NULL,
    "actlog_Action" TEXT NOT NULL,
    "actlog_Description" TEXT,
    "actlog_CreationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("actlog_actlogId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_user_Email_key" ON "Users"("user_Email");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_role_Name_key" ON "Roles"("role_Name");

-- CreateIndex
CREATE INDEX "Projects_proj_OwnerId_idx" ON "Projects"("proj_OwnerId");

-- CreateIndex
CREATE INDEX "ProjectMembers_prmb_ProjectId_idx" ON "ProjectMembers"("prmb_ProjectId");

-- CreateIndex
CREATE INDEX "ProjectMembers_prmb_UserId_idx" ON "ProjectMembers"("prmb_UserId");

-- CreateIndex
CREATE INDEX "ProjectMembers_prmb_RoleId_idx" ON "ProjectMembers"("prmb_RoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembers_prmb_ProjectId_prmb_UserId_key" ON "ProjectMembers"("prmb_ProjectId", "prmb_UserId");

-- CreateIndex
CREATE INDEX "Boards_board_ProjectId_idx" ON "Boards"("board_ProjectId");

-- CreateIndex
CREATE INDEX "Sprints_spr_BoardId_idx" ON "Sprints"("spr_BoardId");

-- CreateIndex
CREATE INDEX "Tasks_task_BoardId_idx" ON "Tasks"("task_BoardId");

-- CreateIndex
CREATE INDEX "Tasks_task_SprintId_idx" ON "Tasks"("task_SprintId");

-- CreateIndex
CREATE INDEX "Tasks_task_AssignedTo_idx" ON "Tasks"("task_AssignedTo");

-- CreateIndex
CREATE INDEX "Tasks_task_CreationBy_idx" ON "Tasks"("task_CreationBy");

-- CreateIndex
CREATE INDEX "Comments_com_TaskId_idx" ON "Comments"("com_TaskId");

-- CreateIndex
CREATE INDEX "Comments_com_CreationBy_idx" ON "Comments"("com_CreationBy");

-- CreateIndex
CREATE INDEX "Messages_msg_ProjectId_idx" ON "Messages"("msg_ProjectId");

-- CreateIndex
CREATE INDEX "Messages_msg_SenderId_idx" ON "Messages"("msg_SenderId");

-- CreateIndex
CREATE INDEX "Notifications_not_UserId_idx" ON "Notifications"("not_UserId");

-- CreateIndex
CREATE INDEX "ActivityLog_actlog_UserId_idx" ON "ActivityLog"("actlog_UserId");

-- CreateIndex
CREATE INDEX "ActivityLog_actlog_EntityType_actlog_EntityId_idx" ON "ActivityLog"("actlog_EntityType", "actlog_EntityId");

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_proj_OwnerId_fkey" FOREIGN KEY ("proj_OwnerId") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembers" ADD CONSTRAINT "ProjectMembers_prmb_ProjectId_fkey" FOREIGN KEY ("prmb_ProjectId") REFERENCES "Projects"("proj_projId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembers" ADD CONSTRAINT "ProjectMembers_prmb_UserId_fkey" FOREIGN KEY ("prmb_UserId") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembers" ADD CONSTRAINT "ProjectMembers_prmb_RoleId_fkey" FOREIGN KEY ("prmb_RoleId") REFERENCES "Roles"("role_roleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boards" ADD CONSTRAINT "Boards_board_ProjectId_fkey" FOREIGN KEY ("board_ProjectId") REFERENCES "Projects"("proj_projId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprints" ADD CONSTRAINT "Sprints_spr_BoardId_fkey" FOREIGN KEY ("spr_BoardId") REFERENCES "Boards"("board_boardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_task_BoardId_fkey" FOREIGN KEY ("task_BoardId") REFERENCES "Boards"("board_boardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_task_SprintId_fkey" FOREIGN KEY ("task_SprintId") REFERENCES "Sprints"("spr_sprId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_task_AssignedTo_fkey" FOREIGN KEY ("task_AssignedTo") REFERENCES "Users"("user_userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_task_CreationBy_fkey" FOREIGN KEY ("task_CreationBy") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_com_TaskId_fkey" FOREIGN KEY ("com_TaskId") REFERENCES "Tasks"("task_taskId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_com_CreationBy_fkey" FOREIGN KEY ("com_CreationBy") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_msg_ProjectId_fkey" FOREIGN KEY ("msg_ProjectId") REFERENCES "Projects"("proj_projId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_msg_SenderId_fkey" FOREIGN KEY ("msg_SenderId") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_not_UserId_fkey" FOREIGN KEY ("not_UserId") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actlog_UserId_fkey" FOREIGN KEY ("actlog_UserId") REFERENCES "Users"("user_userId") ON DELETE RESTRICT ON UPDATE CASCADE;
