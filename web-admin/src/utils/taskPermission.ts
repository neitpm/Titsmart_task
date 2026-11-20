import { AuthUser, isDirector, isSystemAdmin, hasPermission } from '../services/authStore';
import { Task, Engineer, ProjectMaterialPlan } from '../types';

/**
 * Normalizes a string for comparison (trims, lowercases, NFC)
 */
export const normalizeText = (str?: string | null): string => {
  if (!str) return '';
  return String(str)
    .normalize('NFC')
    .trim()
    .toLowerCase();
};

/**
 * Checks if current user is the Assignee of the task
 */
export const isUserTaskAssignee = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): boolean => {
  if (!user || !task) return false;

  const uId = normalizeText(user.id);
  const uName = normalizeText(user.name);
  const uUsername = normalizeText(user.username);

  // Find linked engineer if exists
  const myEng = engineers?.find(e => {
    const eId = normalizeText(e.id);
    const eName = normalizeText(e.name);
    const eUsername = normalizeText(e.username);
    return (
      (uId && eId === uId) ||
      (uUsername && eUsername === uUsername) ||
      (uName && eName === uName)
    );
  });

  const myEngId = myEng ? normalizeText(myEng.id) : '';
  const myEngName = myEng ? normalizeText(myEng.name) : '';

  const allMyIds = [uId, uUsername, myEngId].filter(Boolean);
  const allMyNames = [uName, uUsername, myEngName].filter(Boolean);

  // 1. Check assignedEngineerId
  if (task.assignedEngineerId) {
    const assignedIds = String(task.assignedEngineerId)
      .split(',')
      .map(s => normalizeText(s));
    if (allMyIds.some(id => assignedIds.includes(id))) {
      return true;
    }
  }

  // 2. Check assignedEngineerName
  if (task.assignedEngineerName) {
    const rawEngName = String(task.assignedEngineerName);
    const parts = rawEngName.split('|');
    const namePart = normalizeText(parts[0]);
    const idPart = parts.length > 1 ? normalizeText(parts[1]) : '';

    // If pipe ID part matches my IDs
    if (idPart) {
      const pipeIds = idPart.split(',').map(s => normalizeText(s));
      if (allMyIds.some(id => pipeIds.includes(id))) {
        return true;
      }
    }

    // Check names (supports comma-separated multi assignees)
    const assignedNames = namePart.split(',').map(s => normalizeText(s));
    for (const aName of assignedNames) {
      if (!aName) continue;
      for (const myName of allMyNames) {
        if (!myName) continue;
        if (aName === myName || aName.includes(myName) || myName.includes(aName)) {
          return true;
        }
      }
    }

    // Direct substring check
    const normWhole = normalizeText(rawEngName);
    if (allMyNames.some(mn => normWhole.includes(mn)) || allMyIds.some(id => normWhole.includes(id))) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if current user is the Assigner or Admin for the task
 */
export const isUserTaskAssigner = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): boolean => {
  if (!user || !task) return false;

  const role = normalizeText(user.role);
  const username = normalizeText(user.username);
  const title = normalizeText((user as any).title);

  // 1. Giám đốc / Ban Lãnh đạo (Cấp 1) hoặc Quản trị viên (Admin) luôn có toàn quyền duyệt / nghiệm thu / điều hành công việc
  if (
    isDirector(user) ||
    isSystemAdmin(user) ||
    role === 'admin' ||
    role === 'quản trị viên' ||
    username === 'admin' ||
    role.includes('giám đốc') ||
    role.includes('ban giám đốc') ||
    role.includes('lãnh đạo') ||
    role === 'director' ||
    title.includes('giám đốc') ||
    title.includes('ban giám đốc') ||
    title.includes('lãnh đạo') ||
    hasPermission(user, 'APPROVE_TASKS') ||
    hasPermission(user, 'ASSIGN_TASKS')
  ) {
    return true;
  }

  const uId = normalizeText(user.id);
  const uName = normalizeText(user.name);
  const uUsername = normalizeText(user.username);

  // Find linked engineer if exists
  const myEng = engineers?.find(e => {
    const eId = normalizeText(e.id);
    const eName = normalizeText(e.name);
    const eUsername = normalizeText(e.username);
    return (
      (uId && eId === uId) ||
      (uUsername && eUsername === uUsername) ||
      (uName && eName === uName)
    );
  });

  const myEngId = myEng ? normalizeText(myEng.id) : '';
  const myEngName = myEng ? normalizeText(myEng.name) : '';

  const allMyIds = [uId, uUsername, myEngId].filter(Boolean);
  const allMyNames = [uName, uUsername, myEngName].filter(Boolean);

  if (task.assignerId) {
    const tAssignerId = normalizeText(task.assignerId);
    if (allMyIds.includes(tAssignerId)) return true;
  }

  if (task.assignerName) {
    const normAssignerName = normalizeText(task.assignerName);
    if (allMyNames.some(mn => normAssignerName === mn || normAssignerName.includes(mn) || mn.includes(normAssignerName))) {
      return true;
    }
  }

  if ((task as any).createdById) {
    const tCreatedById = normalizeText((task as any).createdById);
    if (allMyIds.includes(tCreatedById)) return true;
  }

  if ((task as any).createdByName) {
    const normCreatedByName = normalizeText((task as any).createdByName);
    if (allMyNames.some(mn => normCreatedByName === mn || normCreatedByName.includes(mn) || mn.includes(normCreatedByName))) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if current user is a Follower of the task
 */
export const isUserTaskFollower = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): boolean => {
  if (!user || !task) return false;

  const uId = normalizeText(user.id);
  const uName = normalizeText(user.name);
  const uUsername = normalizeText(user.username);

  const allMyIds = [uId, uUsername].filter(Boolean);
  const allMyNames = [uName, uUsername].filter(Boolean);

  if (Array.isArray(task.followerIds)) {
    const fIds = task.followerIds.map(f => normalizeText(f));
    if (allMyIds.some(id => fIds.includes(id))) return true;
  }

  if (Array.isArray(task.followerNames)) {
    const fNames = task.followerNames.map(f => normalizeText(f).replace(/^[:|]+|[:|]+$/g, '').trim());
    for (const fn of fNames) {
      if (!fn) continue;
      for (const mn of allMyNames) {
        if (!mn) continue;
        if (fn === mn || fn.includes(mn) || mn.includes(fn)) return true;
      }
    }
  }

  return false;
};

/**
 * Kiểm tra xem người dùng có phải là Người trực tiếp giao việc / tạo việc cho task này không
 */
export const isUserDirectAssigner = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): boolean => {
  if (!user || !task) return false;
  const uId = normalizeText(user.id);
  const uName = normalizeText(user.name);
  const uUsername = normalizeText(user.username);

  // Find linked engineer if exists
  const myEng = engineers?.find(e => {
    const eId = normalizeText(e.id);
    const eName = normalizeText(e.name);
    const eUsername = normalizeText(e.username);
    return (
      (uId && eId === uId) ||
      (uUsername && eUsername === uUsername) ||
      (uName && eName === uName)
    );
  });

  const myEngId = myEng ? normalizeText(myEng.id) : '';
  const myEngName = myEng ? normalizeText(myEng.name) : '';

  const allMyIds = [uId, uUsername, myEngId].filter(Boolean);
  const allMyNames = [uName, uUsername, myEngName].filter(Boolean);

  if (task.assignerId && allMyIds.includes(normalizeText(task.assignerId))) return true;
  if (task.assignerName && allMyNames.some(mn => normalizeText(task.assignerName).includes(mn) || mn.includes(normalizeText(task.assignerName)))) return true;
  if ((task as any).createdById && allMyIds.includes(normalizeText((task as any).createdById))) return true;
  if ((task as any).createdByName && allMyNames.some(mn => normalizeText((task as any).createdByName).includes(mn) || mn.includes(normalizeText((task as any).createdByName)))) return true;

  return false;
};

/**
 * Kiểm tra xem tài khoản có phải là tài khoản admin kỹ thuật thuần túy hay không
 */
export const isTechnicalAdminUser = (u: any): boolean => {
  if (!u) return false;
  const username = String(u.username || '').trim().toLowerCase();
  const name = String(u.name || '').trim().toLowerCase();
  const role = String(u.role || '').trim().toLowerCase();
  const title = String((u as any).title || '').trim().toLowerCase();
  return (
    username === 'admin' ||
    name === 'admin' ||
    role === 'admin' ||
    role === 'quản trị hệ thống' ||
    role === 'quản trị viên' ||
    title === 'quản trị viên' ||
    title === 'quản trị hệ thống' ||
    u.id === 'admin'
  );
};

/**
 * Lấy Cấp bậc phân quyền của nhân sự / người dùng (Rank Level):
 * 1 = Cấp 1 (Ban Giám Đốc / Điều hành cao nhất: level1, APPROVE_LEAVE_FINAL, DELETE_PROJECTS, company_admin)
 * 2 = Cấp 2 (Quản lý / Chỉ huy trưởng: level2, APPROVE_LEAVE_STEP1, CHECK_FUND_REQUEST, ASSIGN_TASKS)
 * 3 = Cấp 3 (Kỹ sư / Nhân viên hiện trường: level3)
 * 99 = Tài khoản admin kỹ thuật thuần túy hoặc không xác định
 */
export const getUserRankLevel = (u: any): number => {
  if (!u) return 99;
  if (isTechnicalAdminUser(u)) return 99;

  // 1. Kiểm tra trường roleLevel / role_level trực tiếp nếu có
  const rLevel = String(u.roleLevel || u.role_level || (u as any).level_id || '').toLowerCase();
  if (rLevel === 'level1' || rLevel === '1' || rLevel.includes('cap_1') || rLevel.includes('cấp 1')) return 1;
  if (rLevel === 'level2' || rLevel === '2' || rLevel.includes('cap_2') || rLevel.includes('cấp 2')) return 2;
  if (rLevel === 'level3' || rLevel === '3' || rLevel.includes('cap_3') || rLevel.includes('cấp 3')) return 3;

  // 2. Kiểm tra bộ quyền permissions được cấu hình trong bảng Cấp bậc
  const perms: string[] = Array.isArray(u.permissions) ? u.permissions : [];

  // Quyền đặc thù chỉ có ở Cấp 1: Phê duyệt nghỉ phép Cấp 2 (Ban GĐ), Xóa dự án, Toàn quyền điều hành
  if (perms.includes('APPROVE_LEAVE_FINAL') || (perms.includes('APPROVE_FUND_REQUEST') && perms.includes('DELETE_PROJECTS'))) {
    return 1;
  }
  if (u.companyRole === 'company_admin') {
    return 1;
  }

  // Quyền đặc thù của Cấp 2: Quản lý trực tiếp duyệt đơn phép Cấp 1, Kiểm tra quỹ
  if (perms.includes('APPROVE_LEAVE_STEP1') || perms.includes('CHECK_FUND_REQUEST')) {
    return 2;
  }

  // 3. Quy chiếu theo chức danh / vai trò hệ thống
  const role = String(u.role || '').toLowerCase();
  const title = String((u as any).title || '').toLowerCase();

  // Loại trừ tổ đội / lãnh đạo tổ
  const isTeamLead = role.includes('lãnh đạo to') || title.includes('lãnh đạo to') || 
                     role.includes('tổ đội') || title.includes('tổ đội') || 
                     role.includes('lãnh đạo tổ') || title.includes('lãnh đạo tổ') ||
                     role.includes('tổ trưởng') || title.includes('tổ trưởng');

  if (!isTeamLead) {
    if (
      role.includes('giám đốc') || 
      title.includes('giám đốc') || 
      role.includes('chủ tịch') || 
      title.includes('chủ tịch') || 
      role === 'director' ||
      role.includes('ban giám đốc') ||
      title.includes('ban giám đốc') ||
      isDirector(u)
    ) {
      return 1;
    }
  }

  if (
    isTeamLead ||
    role.includes('quản lý') || 
    title.includes('quản lý') || 
    role.includes('chỉ huy') || 
    title.includes('chỉ huy') || 
    role.includes('pm') || 
    title.includes('pm') ||
    role.includes('trưởng') ||
    title.includes('trưởng')
  ) {
    return 2;
  }

  return 3;
};

/**
 * Kiểm tra xem người dùng có phải là người có cấp bậc cao nhất trong công ty hay không (Cấp 1)
 * (Ban Giám Đốc, Chủ tịch, Cấp 1, Company Admin)
 */
export const isHighestLevelPerson = (u: any): boolean => {
  if (!u) return false;
  if (isTechnicalAdminUser(u)) return false;
  return getUserRankLevel(u) === 1;
};

/**
 * Lấy nhân sự đại diện có cấp bậc cao nhất (Cấp 1) trong công ty theo phân cấp
 */
export const getHighestRankLeader = (engineers: any[]): any | null => {
  if (!Array.isArray(engineers) || engineers.length === 0) return null;

  const candidates = engineers.filter(e => e && !isTechnicalAdminUser(e) && !e.isLocked && !(e as any).is_locked);
  if (candidates.length === 0) return null;

  // Lọc lấy tất cả các nhân sự thuộc Cấp 1
  const level1Members = candidates.filter(e => getUserRankLevel(e) === 1);
  if (level1Members.length > 0) {
    // Nếu có người giữ vai trò Giám đốc thì ưu tiên đại diện
    const director = level1Members.find(e => {
      const r = String(e.role || e.title || '').toLowerCase();
      return r.includes('giám đốc') || r.includes('chủ tịch');
    });
    return director || level1Members[0];
  }

  // Nếu chưa có ai ở Cấp 1, tìm theo cấp bậc nhỏ nhất tiếp theo (Cấp 2...)
  const sorted = [...candidates].sort((a, b) => getUserRankLevel(a) - getUserRankLevel(b));
  return sorted[0] || null;
};

/**
 * Kiểm tra xem người dùng có quyền Nghiệm thu / Phê duyệt hoàn thành công việc hay không
 * 
 * QUY TẮC NGHIỆP VỤ (BẮT BUỘC):
 * 1. Nếu công việc đã Hoàn thành / Đã xong -> Ẩn nghiệm thu (false).
 * 2. Chỉ hiện khi công việc đang ở trạng thái "Chờ nghiệm thu" (status === 'Chờ nghiệm thu' || constrStatus === 'Chờ nghiệm thu').
 * 3. NGƯỜI LÀM VIỆC (Assignee): TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ NGHIỆM THU công việc của chính mình (luôn trả về false).
 *    ("tôi là người làm nhưng tại sao tôi là người nghiệm thu vậy - phải là người giao và người có cấp bậc cao nhất chứ")
 * 4. NGƯỜI CÓ QUYỀN NGHIỆM THU PHẢI LÀ:
 *    a. Người giao việc trực tiếp (Direct Assigner / task.assignerId / task.assignerName / createdById / createdByName)
 *    b. VÀ/HOẶC Người có cấp bậc cao nhất trong công ty (isHighestLevelPerson)
 *    (Cả 2 đối tượng trên đều phải KHÔNG PHẢI là người làm việc của task này).
 */
export const canUserApproveTask = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): boolean => {
  if (!user || !task) return false;

  // 1. Nếu công việc đã Hoàn thành hoặc đã xong thì không thể nghiệm thu tiếp
  if (task.status === 'Hoàn thành' || task.constrStatus === 'Đã hoàn thành' || task.isDone) {
    return false;
  }

  // 2. Chỉ hiện khi công việc đang ở trạng thái Chờ nghiệm thu
  const isWaiting = task.status === 'Chờ nghiệm thu' || task.constrStatus === 'Chờ nghiệm thu';
  if (!isWaiting) return false;

  // 3. Người làm việc (Assignee): TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ NGHIỆM THU công việc của chính mình
  const isAssignee = isUserTaskAssignee(user, task, engineers);
  if (isAssignee) {
    return false;
  }

  // 4. Người có cấp bậc cao nhất luôn có quyền nghiệm thu (nếu không phải là người trực tiếp làm việc)
  if (isHighestLevelPerson(user) || isDirector(user)) {
    return true;
  }

  // 5. Người trực tiếp giao việc có quyền nghiệm thu (nếu không phải là người trực tiếp làm việc)
  if (isUserDirectAssigner(user, task, engineers)) {
    return true;
  }

  return false;
};

/**
 * Xác định chính xác vai trò hiển thị trong luồng trao đổi (Discussion Sender Role)
 * Thứ tự ưu tiên:
 * 1. Nếu là người được giao việc (Assignee) -> Luôn là "Nhân sự đảm nhiệm"
 * 2. Nếu là người trực tiếp giao việc / tạo việc (Direct Assigner) -> "Người giao việc"
 * 3. Nếu là người theo dõi (Follower) -> "Người theo dõi"
 * 4. Nếu có quyền quản lý / duyệt việc (Manager/Admin/Director) -> "Người giao việc"
 * 5. Mặc định: "Người theo dõi"
 */
export const getTaskDiscussionSenderRole = (
  user: AuthUser | null | undefined,
  task: Task | null | undefined,
  engineers?: Engineer[]
): string => {
  if (!user || !task) return 'Nhân sự đảm nhiệm';

  // 1. ƯU TIÊN SỐ 1: Người được giao việc trực tiếp
  if (isUserTaskAssignee(user, task, engineers)) {
    return 'Nhân sự đảm nhiệm';
  }

  // 2. Người trực tiếp giao việc
  if (isUserDirectAssigner(user, task)) {
    return 'Người giao việc';
  }

  // 3. Người theo dõi
  if (isUserTaskFollower(user, task, engineers)) {
    return 'Người theo dõi';
  }

  // 4. Ban Lãnh đạo hoặc Người có quyền quản lý / giao việc
  if (isDirector(user) || isSystemAdmin(user)) {
    return 'Người giao việc';
  }

  if (isUserTaskAssigner(user, task, engineers)) {
    return 'Người giao việc';
  }

  return 'Người theo dõi';
};

/**
 * Kiểm tra xem một tin nhắn trao đổi (bằng senderName hoặc senderId) có phải do người được giao việc (Assignee) gửi không
 */
export const isDiscussionSenderAssignee = (
  senderId: string | undefined,
  senderName: string | undefined,
  task: Task | null | undefined
): boolean => {
  if (!task) return false;
  const sId = normalizeText(senderId);
  const sName = normalizeText(senderName);

  if (task.assignedEngineerId) {
    const assignedIds = String(task.assignedEngineerId).split(',').map(s => normalizeText(s));
    if (sId && assignedIds.includes(sId)) return true;
  }

  if (task.assignedEngineerName) {
    const raw = String(task.assignedEngineerName);
    const parts = raw.split('|');
    const namePart = normalizeText(parts[0]);
    const idPart = parts.length > 1 ? normalizeText(parts[1]) : '';

    if (sId && idPart && idPart.split(',').map(s => normalizeText(s)).includes(sId)) return true;

    if (sName) {
      const assignedNames = namePart.split(',').map(s => normalizeText(s));
      for (const an of assignedNames) {
        if (!an) continue;
        if (an === sName || an.includes(sName) || sName.includes(an)) return true;
      }
    }
  }

  return false;
};

/**
 * Resolves full follower display names from followerNames, followerIds, or raw tags
 */
export const getTaskFollowerNames = (task: Task | null | undefined, engineers?: Engineer[]): string[] => {
  if (!task) return [];

  // 1. Direct followerNames
  if (Array.isArray(task.followerNames) && task.followerNames.length > 0) {
    const cleanNames = task.followerNames
      .map(f => String(f).replace(/^[:|]+|[:|]+$/g, '').trim())
      .filter(Boolean);
    if (cleanNames.length > 0) return cleanNames;
  }

  // 2. Resolve from followerIds using engineers list
  if (Array.isArray(task.followerIds) && task.followerIds.length > 0) {
    const resolved = task.followerIds.map(fid => {
      const sId = String(fid).trim().toLowerCase();
      const found = engineers?.find(e => 
        String(e.id).trim().toLowerCase() === sId || 
        String(e.username || '').trim().toLowerCase() === sId ||
        String(e.code || '').trim().toLowerCase() === sId
      );
      return found ? found.name : fid;
    }).filter(Boolean);
    if (resolved.length > 0) return resolved;
  }

  // 3. Fallback: Parse directly from notes if tag exists
  if (task.notes && typeof task.notes === 'string' && task.notes.includes('[FOLLOWERS:')) {
    const match = task.notes.match(/\[FOLLOWERS:([^\]]+)\]/i);
    if (match) {
      const raw = match[1];
      let idPart = '';
      let namePart = '';
      if (raw.includes(':::')) {
        const parts = raw.split(':::');
        idPart = parts[0] || '';
        namePart = parts[1] || '';
      } else if (raw.includes('|||')) {
        const parts = raw.split('|||');
        idPart = parts[0] || '';
        namePart = parts[1] || '';
      } else if (raw.includes('|')) {
        const parts = raw.split('|');
        idPart = parts[0] || '';
        namePart = parts[1] || '';
      } else {
        idPart = raw;
      }

      if (namePart) {
        const names = namePart.split(',').map(s => s.replace(/^[:|]+|[:|]+$/g, '').trim()).filter(Boolean);
        if (names.length > 0) return names;
      }
      if (idPart && engineers && engineers.length > 0) {
        const ids = idPart.split(',').map(s => s.replace(/^[:|]+|[:|]+$/g, '').trim()).filter(Boolean);
        const resolved = ids.map(fid => {
          const sId = String(fid).trim().toLowerCase();
          const found = engineers.find(e => 
            String(e.id).trim().toLowerCase() === sId || 
            String(e.username || '').trim().toLowerCase() === sId
          );
          return found ? found.name : fid;
        }).filter(Boolean);
        if (resolved.length > 0) return resolved;
      }
    }
  }

  return [];
};

/**
 * Resolves the technical/material status (Tình trạng) for a task
 */
export const getTaskTechSpecStatus = (task: Task | null | undefined, materialPlans?: ProjectMaterialPlan[]): string => {
  if (!task) return '';
  if (task.techSpecStatus) return task.techSpecStatus;

  // Check from task notes tag [tech-status:...]
  const m = String(task.notes || '').match(/\[tech-status:([^\]]+)\]/i);
  if (m && m[1]) return m[1].trim();

  // Check from matching MaterialPlan
  if (materialPlans && materialPlans.length > 0 && task.projectCode) {
    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const matched = materialPlans.find(mp => 
      mp.id === task.id ||
      (
        (mp.projectCode === task.projectCode || !mp.projectCode || !task.projectCode) &&
        (
          (norm(mp.stt) === norm(task.stt) && norm(mp.jobContent || (mp as any).name) === norm(task.name)) ||
          (task.stt && norm(mp.stt) === norm(task.stt)) ||
          (task.name && norm(mp.jobContent || (mp as any).name) === norm(task.name))
        )
      )
    );
    if (matched) {
      if (matched.techSpecStatus) return matched.techSpecStatus;
      const mpTag = String(matched.notes || '').match(/\[tech-status:([^\]]+)\]/i);
      if (mpTag && mpTag[1]) return mpTag[1].trim();
    }
  }

  return '';
};

/**
 * Resolves the purchasing / order status (TT Đặt hàng) for a task
 */
export const getTaskPurchaseStatus = (task: Task | null | undefined, materialPlans?: ProjectMaterialPlan[]): string => {
  if (!task) return '';

  // Luôn kiểm tra materialPlan trước — đây là nguồn chính xác nhất cho TT Đặt hàng
  if (materialPlans && materialPlans.length > 0 && task.projectCode) {
    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const matched = materialPlans.find(mp => 
      mp.id === task.id ||
      (
        (mp.projectCode === task.projectCode || !mp.projectCode || !task.projectCode) &&
        (
          (norm(mp.stt) === norm(task.stt) && norm(mp.jobContent || (mp as any).name) === norm(task.name)) ||
          (task.stt && norm(mp.stt) === norm(task.stt)) ||
          (task.name && norm(mp.jobContent || (mp as any).name) === norm(task.name))
        )
      )
    );
    if (matched && matched.orderedStatus) return matched.orderedStatus;
  }

  // Fallback: giá trị lưu trên task
  if (task.purchaseStatus) return task.purchaseStatus;

  return '';
};

/**
 * Checks whether a task can be assigned.
 * TT Đặt hàng and Tình trạng are informational fields, not prerequisites.
 */
export const isTaskReadyForAssignment = (
  task: Task | null | undefined,
  materialPlans?: ProjectMaterialPlan[]
): { ready: boolean; reason?: string } => {
  if (!task) return { ready: false, reason: 'Công việc không tồn tại' };

  if (task.isSectionHeader) return { ready: false, reason: 'Không thể giao đầu mục nhóm' };

  // Có thể giao việc ngay cả khi vật tư chưa đặt hoặc chưa về kho.
  // TT Đặt hàng chỉ còn là thông tin theo dõi, không phải điều kiện phân công.
  return { ready: true };
};
