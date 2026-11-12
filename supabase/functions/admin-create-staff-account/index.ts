import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    console.log("[admin-create-staff-account] Invoked with method:", req.method);

    if (!supabaseServiceKey) {
      console.error("[admin-create-staff-account] Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY environment variable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Xác thực người gọi qua Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized caller token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1.2 Kiểm tra quyền Quản trị viên chặt chẽ: BẮT BUỘC auth_user_id === callerUser.id
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const callerId = String(callerUser.id || '').trim();

    // Tra cứu bản ghi nhân sự duy nhất ứng với auth_user_id của caller (Không auto-heal ngầm)
    const { data: callerEng } = await adminClient
      .from("engineers")
      .select("id, role, permissions, auth_user_id, is_active, email")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    if (!callerEng) {
      return new Response(
        JSON.stringify({ 
          error: "Forbidden: Caller account is not mapped to an active personnel record (auth_user_id unlinked). Please contact system administrator." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (callerEng.is_active === false) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Caller account has been deactivated." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tiêu chuẩn phân quyền: Phải có quyền MANAGE_USERS hoặc là System Admin (admin/Quản trị viên) trong database
    const permissions: string[] = Array.isArray(callerEng.permissions) ? callerEng.permissions : [];
    const roleStr = String(callerEng.role || '').toLowerCase();
    const isSystemAdminRole = roleStr === "admin" || roleStr === "quản trị viên";
    const hasManageUsers = isSystemAdminRole || permissions.includes("MANAGE_USERS");

    if (!hasManageUsers) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Caller does not have MANAGE_USERS permission." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Phân tích payload đầu vào
    const body = await req.json();
    const {
      action = "create", // 'create' | 'sync'
      engineer_id,
      username,
      email,
      password,
      name,
      role = "Nhân viên",
      title = "Nhân viên",
      permissions = [],
      project_codes = [],
      phone = "",
      address = "",
      identity_number = "",
      emergency_phone = "",
      emergency_contact_name = "",
      must_change_password = true,
    } = body;

    const cleanUsername = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return new Response(
        JSON.stringify({ error: "Email is required for staff account provisioning" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. IDEMPOTENCY & RECONCILIATION: Kiểm tra bản ghi engineer hiện có
    let targetEngineer: any = null;
    if (engineer_id) {
      const { data } = await adminClient.from("engineers").select("*").eq("id", engineer_id).maybeSingle();
      targetEngineer = data;
    } else if (cleanUsername) {
      const { data } = await adminClient.from("engineers").select("*").ilike("username", cleanUsername).maybeSingle();
      targetEngineer = data;
    }

    // Nếu đã có auth_user_id và user đó tồn tại hợp lệ trong auth.users -> Trả về kết quả ngay (Idempotent)
    if (targetEngineer && targetEngineer.auth_user_id) {
      const { data: existingAuth } = await adminClient.auth.admin.getUserById(targetEngineer.auth_user_id);
      if (existingAuth?.user) {
        // Cập nhật trạng thái ACTIVE nếu cần
        await adminClient
          .from("engineers")
          .update({
            account_status: "ACTIVE",
            is_active: true,
            sync_error: null,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", targetEngineer.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Account already provisioned and active",
            engineer_id: targetEngineer.id,
            auth_user_id: existingAuth.user.id,
            account_status: "ACTIVE",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. KIỂM TRA TRÙNG LẶP / RECONCILIATION AUTH USER THEO EMAIL
    let authUserId: string | null = null;
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (existingUser) {
      // Reconcile: User đã tồn tại trong Auth -> Tái sử dụng ID này
      authUserId = existingUser.id;
    } else {
      // Tạo user mới trong Auth với Admin API
      const tempPassword = password || `Tit@${Math.random().toString(36).slice(-8)}A1!`;
      const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          username: cleanUsername,
          name: name || targetEngineer?.name || cleanUsername,
          role,
        },
      });

      if (createAuthError || !newAuthData?.user) {
        return new Response(
          JSON.stringify({
            error: "Failed to create Supabase Auth user: " + (createAuthError?.message || "Unknown error"),
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authUserId = newAuthData.user.id;
    }

    // 5. CẬP NHẬT HOẶC TẠO MỚI BẢNG ENGINEERS (DUAL-WRITE WITH SYNC_ERROR RESILIENCE)
    try {
      if (targetEngineer) {
        const { error: updateError } = await adminClient
          .from("engineers")
          .update({
            email: cleanEmail,
            auth_user_id: authUserId,
            account_status: "ACTIVE",
            is_active: true,
            must_change_password: must_change_password,
            sync_error: null,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", targetEngineer.id);

        if (updateError) throw updateError;
      } else {
        const { data: newEng, error: insertError } = await adminClient
          .from("engineers")
          .insert({
            name: name || cleanUsername,
            username: cleanUsername,
            email: cleanEmail,
            role,
            title: title || role,
            phone,
            address,
            identity_number,
            emergency_phone,
            emergency_contact_name,
            permissions,
            project_codes,
            auth_user_id: authUserId,
            account_status: "ACTIVE",
            is_active: true,
            must_change_password: must_change_password,
            sync_error: null,
            last_synced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        targetEngineer = newEng;
      }
    } catch (dbErr: any) {
      // XỬ LÝ LỖI DUAL-WRITE: Đánh dấu SYNC_ERROR, không để treo trạng thái
      if (targetEngineer?.id) {
        await adminClient
          .from("engineers")
          .update({
            account_status: "SYNC_ERROR",
            sync_error: dbErr?.message || "Failed to link auth_user_id in engineers table",
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", targetEngineer.id);
      }

      return new Response(
        JSON.stringify({
          error: "Auth user created but database mapping encountered an error. Status marked as SYNC_ERROR.",
          details: dbErr?.message,
          auth_user_id: authUserId,
          account_status: "SYNC_ERROR",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Staff account successfully provisioned and linked.",
        engineer_id: targetEngineer.id,
        auth_user_id: authUserId,
        email: cleanEmail,
        username: cleanUsername,
        account_status: "ACTIVE",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[admin-create-staff-account] Unhandled exception:", err);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error: " + (err?.message || "Unknown exception"),
        stack: err?.stack || undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
