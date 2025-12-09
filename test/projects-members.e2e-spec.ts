import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ProjectsModule } from '../src/projects/projects.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /api/projects/:id/members (e2e)', () => {
  let app: INestApplication;
  let prismaMock: {
    projectMembers: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const projectId = '11111111-1111-1111-1111-111111111111';

  const memberRole = {
    role_roleId: 'role-member',
    role_Name: 'Member',
    role_Description: null,
  };

  const managerRole = {
    role_roleId: 'role-manager',
    role_Name: 'Manager',
    role_Description: 'Project manager',
  };

  const membersFixture = [
    {
      prmb_prmbId: 'm2',
      prmb_ProjectId: projectId,
      prmb_UserId: 'u2',
      prmb_RoleId: managerRole.role_roleId,
      User: {
        user_userId: 'u2',
        user_FirstName: 'Zenon',
        user_LastName: 'Nowak',
        user_Email: 'zenon@example.com',
        user_IsActive: true,
      },
      Role: managerRole,
    },
    {
      prmb_prmbId: 'm1',
      prmb_ProjectId: projectId,
      prmb_UserId: 'u1',
      prmb_RoleId: memberRole.role_roleId,
      User: {
        user_userId: 'u1',
        user_FirstName: 'Anna',
        user_LastName: 'Kowalska',
        user_Email: 'anna@example.com',
        user_IsActive: true,
      },
      Role: memberRole,
    },
    {
      prmb_prmbId: 'm3',
      prmb_ProjectId: projectId,
      prmb_UserId: 'u3',
      prmb_RoleId: memberRole.role_roleId,
      User: {
        user_userId: 'u3',
        user_FirstName: 'Bartosz',
        user_LastName: 'Adamczyk',
        user_Email: 'bartosz@example.com',
        user_IsActive: false,
      },
      Role: memberRole,
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      projectMembers: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProjectsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  const allowAccessFor = (userId: string) => {
    prismaMock.projectMembers.findUnique.mockImplementation(({ where }) => {
      const matches =
        where?.prmb_ProjectId_prmb_UserId?.prmb_ProjectId === projectId &&
        where?.prmb_ProjectId_prmb_UserId?.prmb_UserId === userId;
      return matches
        ? { prmb_prmbId: `membership-${userId}` }
        : null;
    });
  };

  it('zwraca listę członków z rolami (200)', async () => {
    allowAccessFor('u1');
    prismaMock.projectMembers.findMany.mockResolvedValue(membersFixture);

    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/members`)
      .set('x-user-id', 'u1')
      .expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('role.name');
    expect(res.body[0]).toHaveProperty('user.displayName');
    expect(res.body.map((m: any) => m.user.id)).toEqual(
      expect.arrayContaining(['u1', 'u2', 'u3']),
    );
    expect(prismaMock.projectMembers.findMany).toHaveBeenCalledTimes(1);
  });

  it('filtruje tylko aktywnych użytkowników (?active=true)', async () => {
    allowAccessFor('u2');
    prismaMock.projectMembers.findMany.mockResolvedValue(membersFixture);

    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/members`)
      .query({ active: true })
      .set('x-user-id', 'u2')
      .expect(200);

    const users = res.body.map((m: any) => m.user);
    expect(users.every((u: any) => u.isActive)).toBe(true);
    expect(users.map((u: any) => u.id)).toEqual(
      expect.arrayContaining(['u1', 'u2']),
    );
    expect(users.find((u: any) => u.id === 'u3')).toBeUndefined();
  });

  it('sortuje alfabetycznie po display_name', async () => {
    allowAccessFor('u1');
    prismaMock.projectMembers.findMany.mockResolvedValue(membersFixture);

    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/members`)
      .set('x-user-id', 'u1')
      .expect(200);

    const displayNames = res.body.map((m: any) => m.user.displayName);
    expect(displayNames).toEqual([
      'Anna Kowalska',
      'Bartosz Adamczyk',
      'Zenon Nowak',
    ]);
  });

  it('odrzuca żądanie bez dostępu (403)', async () => {
    prismaMock.projectMembers.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/members`)
      .set('x-user-id', 'outsider')
      .expect(403);
  });
});

