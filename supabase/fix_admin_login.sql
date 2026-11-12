CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_admin_uid uuid := '1fba88d0-ee08-4136-9038-ad927850262e'::uuid;
  v_encrypted_pw text := crypt('admin123', gen_salt('bf'));
BEGIN
  -- 1. Cap nhat email trong public.engineers
  UPDATE public.engineers
  SET email = 'admin@titsmart.vn', auth_user_id = v_admin_uid
  WHERE username = 'admin' OR id = '1fba88d0-ee08-4136-9038-ad927850262e';

  -- 2. Tao hoac cap nhat trong auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@titsmart.vn' OR id = v_admin_uid) THEN
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        email_confirmed_at = now(),
        updated_at = now(),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        raw_user_meta_data = '{"name":"Quản trị viên","username":"admin"}'
    WHERE email = 'admin@titsmart.vn' OR id = v_admin_uid;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_uid,
      'authenticated',
      'authenticated',
      'admin@titsmart.vn',
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Quản trị viên","username":"admin"}',
      now(),
      now()
    );
  END IF;

  -- 3. Dong bo vao auth.identities
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_admin_uid) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_uid,
      v_admin_uid::text,
      format('{"sub":"%s","email":"%s"}', v_admin_uid, 'admin@titsmart.vn')::jsonb,
      'email',
      now(),
      now(),
      now()
    );
  END IF;
END $$;
