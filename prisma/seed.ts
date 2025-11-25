import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

async function main() {
  // --- USERS ---
  const admin = await prisma.users.upsert({
    where: { user_Email: 'admin@example.com' },
    update: {},
    create: {
      user_FirstName: 'Admin',
      user_LastName: 'User',
      user_Email: 'admin@example.com',
      user_PasswordHash: hashPassword('Admin123!'),
    },
  });

  const member = await prisma.users.upsert({
    where: { user_Email: 'member@example.com' },
    update: {},
    create: {
      user_FirstName: 'Member',
      user_LastName: 'User',
      user_Email: 'member@example.com',
      user_PasswordHash: hashPassword('Member123!'),
    },
  });

  // --- PROJECT ---
  const project = await prisma.projects.create({
    data: {
      proj_Name: 'Demo Project',
      proj_Description: 'Sample project for manual testing',
      proj_OwnerId: admin.user_userId,
      proj_State: 'active',
    },
  });

  const project2 = await prisma.projects.create({
    data: {
      proj_Name: 'Marketing Launch',
      proj_Description: 'Kampania produktowa Q4',
      proj_OwnerId: admin.user_userId,
      proj_State: 'planning',
    },
  });

  const project3 = await prisma.projects.create({
    data: {
      proj_Name: 'Mobile App',
      proj_Description: 'Nowa aplikacja mobilna',
      proj_OwnerId: member.user_userId,
      proj_State: 'active',
    },
  });

  // --- BOARD ---
  const board = await prisma.boards.create({
    data: {
      board_ProjectId: project.proj_projId,
      board_Type: 'kanban',
      board_Name: 'Main Board',
    },
  });

  const board2 = await prisma.boards.create({
    data: {
      board_ProjectId: project2.proj_projId,
      board_Type: 'kanban',
      board_Name: 'Marketing Board',
    },
  });

  const board3 = await prisma.boards.create({
    data: {
      board_ProjectId: project3.proj_projId,
      board_Type: 'scrum',
      board_Name: 'Mobile Board',
    },
  });

  // --- SPRINT ---
  const sprint = await prisma.sprints.create({
    data: {
      spr_BoardId: board.board_boardId,
      spr_Name: 'Sprint 1',
      spr_State: 'planned',
    },
  });

  const sprint2 = await prisma.sprints.create({
    data: {
      spr_BoardId: board2.board_boardId,
      spr_Name: 'Sprint M1',
      spr_State: 'planned',
    },
  });

  const sprint3 = await prisma.sprints.create({
    data: {
      spr_BoardId: board3.board_boardId,
      spr_Name: 'Sprint A1',
      spr_State: 'in_progress',
    },
  });

  // --- TASKS ---
  await prisma.tasks.createMany({
    data: [
      {
        task_BoardId: board.board_boardId,
        task_SprintId: sprint.spr_sprId,
        task_AssignedTo: member.user_userId,
        task_CreationBy: admin.user_userId,
        task_Title: 'Skonfigurować CI',
        task_Description: 'Dodać pipeline build + testy',
        task_State: 'todo',
        task_Priority: 'high',
        task_DueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        task_BoardId: board.board_boardId,
        task_SprintId: sprint.spr_sprId,
        task_AssignedTo: member.user_userId,
        task_CreationBy: admin.user_userId,
        task_Title: 'Przygotować mock Google OAuth',
        task_Description: 'Użyć mocka w serwisie auth',
        task_State: 'in_progress',
        task_Priority: 'medium',
      },
      {
        task_BoardId: board2.board_boardId,
        task_SprintId: sprint2.spr_sprId,
        task_AssignedTo: admin.user_userId,
        task_CreationBy: admin.user_userId,
        task_Title: 'Przygotować landing page',
        task_State: 'todo',
        task_Priority: 'high',
      },
      {
        task_BoardId: board2.board_boardId,
        task_SprintId: sprint2.spr_sprId,
        task_AssignedTo: member.user_userId,
        task_CreationBy: admin.user_userId,
        task_Title: 'Ustawić kampanię reklamową',
        task_State: 'todo',
        task_Priority: 'medium',
      },
      {
        task_BoardId: board3.board_boardId,
        task_SprintId: sprint3.spr_sprId,
        task_AssignedTo: member.user_userId,
        task_CreationBy: member.user_userId,
        task_Title: 'Integracja push notifications',
        task_State: 'in_progress',
        task_Priority: 'critical',
      },
      {
        task_BoardId: board3.board_boardId,
        task_SprintId: sprint3.spr_sprId,
        task_AssignedTo: admin.user_userId,
        task_CreationBy: member.user_userId,
        task_Title: 'Refaktoryzacja ekranu logowania',
        task_State: 'todo',
        task_Priority: 'low',
      },
    ],
  });

  console.log('Seed completed.');
  console.table([
    { key: 'adminEmail', value: admin.user_Email },
    { key: 'memberEmail', value: member.user_Email },
    { key: 'projectId', value: project.proj_projId },
    { key: 'project2Id', value: project2.proj_projId },
    { key: 'project3Id', value: project3.proj_projId },
    { key: 'boardId', value: board.board_boardId },
    { key: 'board2Id', value: board2.board_boardId },
    { key: 'board3Id', value: board3.board_boardId },
    { key: 'sprintId', value: sprint.spr_sprId },
    { key: 'sprint2Id', value: sprint2.spr_sprId },
    { key: 'sprint3Id', value: sprint3.spr_sprId },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
