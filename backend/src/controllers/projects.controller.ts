import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { Prisma } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanUuid = (value: unknown) => (typeof value === 'string' && UUID_RE.test(value) ? value : null);

const mapToPrisma = (data: any) => {
  const mapped: any = {};
  const allowedScalarFields = ['code', 'name', 'location', 'status', 'notes'];

  allowedScalarFields.forEach((field) => {
    if (data[field] !== undefined) mapped[field] = data[field];
  });

  if (data.managerId !== undefined) mapped.manager_id = cleanUuid(data.managerId);
  if (data.managerName !== undefined) mapped.manager_name = data.managerName;
  if (data.startDate !== undefined) mapped.start_date = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) mapped.end_date = data.endDate ? new Date(data.endDate) : null;
  if (data.activeTeams !== undefined) mapped.active_teams = data.activeTeams;
  if (data.progressPercent !== undefined) mapped.progress_percent = data.progressPercent;
  if (data.totalTasks !== undefined) mapped.total_tasks = data.totalTasks;
  if (data.completedTasks !== undefined) mapped.completed_tasks = data.completedTasks;
  if (data.issueTasksCount !== undefined) mapped.issue_tasks_count = data.issueTasksCount;

  const extraNotes = [
    data.client ? `Chủ đầu tư: ${data.client}` : '',
    data.contractValue ? `Giá trị hợp đồng: ${data.contractValue}` : '',
  ].filter(Boolean).join(' | ');
  if (extraNotes) mapped.notes = [mapped.notes, extraNotes].filter(Boolean).join(' | ');

  if (data.priority !== undefined) {
    const raw = String(mapped.notes || '');
    const clean = raw.replace(/\[PRIORITY:[^\]]*\]/gi, '').trim();
    mapped.notes = data.priority ? (clean ? `${clean} [PRIORITY:${data.priority}]` : `[PRIORITY:${data.priority}]`) : clean;
  }

  return mapped;
};

const mapToFrontend = (project: any) => {
  if (!project) return project;
  const rawNotes = String(project.notes || '');
  const prioMatch = rawNotes.match(/\[PRIORITY:([^\]]*)\]/i);
  const priority = prioMatch ? prioMatch[1].trim() : (project.priority || 'normal');
  return {
    ...project,
    priority,
    managerId: project.manager_id,
    managerName: project.manager_name,
    startDate: project.start_date,
    endDate: project.end_date,
    activeTeams: project.active_teams,
    progressPercent: project.progress_percent,
    totalTasks: project.total_tasks,
    completedTasks: project.completed_tasks,
    issueTasksCount: project.issue_tasks_count,
  };
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        // Loại bỏ project nội bộ dùng cho kho công ty
        NOT: { code: 'COMPANY' },
      },
      orderBy: { created_at: 'desc' },
    });
    const mapped = projects.map(mapToFrontend);
    const getWeight = (prio?: string) => {
      const p = String(prio || '').toLowerCase().trim();
      if (p === 'urgent' || p === 'cấp 1' || p === 'cap 1' || p === '1') return 1;
      if (p === 'high' || p === 'cấp 2' || p === 'cap 2' || p === '2') return 2;
      if (p === 'low' || p === 'cấp 4' || p === 'cap 4' || p === '4') return 4;
      return 3;
    };
    mapped.sort((a, b) => {
      const wA = getWeight(a.priority);
      const wB = getWeight(b.priority);
      if (wA !== wB) return wA - wB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    res.json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
    });
    if (project) {
      res.json(mapToFrontend(project));
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const data = mapToPrisma(req.body);
    const memberIds = req.body.memberIds;

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data,
      });

      if (Array.isArray(memberIds) && memberIds.length > 0) {
        const validMemberIds = memberIds.map(cleanUuid).filter(Boolean) as string[];
        if (validMemberIds.length > 0) {
          await tx.projectMember.createMany({
            data: validMemberIds.map((id) => ({
              user_id: id,
              project_id: proj.id,
              role: 'manager',
            })),
            skipDuplicates: true,
          });
        }
      }

      return proj;
    });

    res.status(201).json(mapToFrontend(project));
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Mã hoặc dữ liệu bạn nhập đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = mapToPrisma(req.body);
    const memberIds = req.body.memberIds;

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id },
        data,
      });

      if (Array.isArray(memberIds)) {
        await tx.projectMember.deleteMany({
          where: { project_id: id, role: 'manager' }, // only replace managers to not affect workers
        });
        
        const validMemberIds = memberIds.map(cleanUuid).filter(Boolean) as string[];
        if (validMemberIds.length > 0) {
          await tx.projectMember.createMany({
            data: validMemberIds.map((memberId) => ({
              user_id: memberId,
              project_id: id,
              role: 'manager',
            })),
            skipDuplicates: true,
          });
        }
      }

      return proj;
    });

    res.json(mapToFrontend(project));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
