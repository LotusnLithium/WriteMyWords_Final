-- ==============================================================================
-- WriteMyWords Complete Database Schema & Storage Setup for Supabase
-- ==============================================================================
-- Run this script in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query)
-- Includes Profiles (student, expert, admin), Requests (with Escrow, 10% platform fee & admin approval),
-- Messages, Realtime, and Supabase Storage support.

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'expert', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- If table exists, update check constraint for role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'expert', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- REQUESTS TABLE (With Document Attachment, Word Solution, Escrow & 10% Platform Fee)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name TEXT,
  helper_name TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT,
  academic_level TEXT NOT NULL DEFAULT 'Undergraduate',
  description TEXT,
  deadline TEXT NOT NULL DEFAULT '3 days',
  budget_min NUMERIC NOT NULL DEFAULT 0,
  budget_max NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'delivered', 'pending_approval', 'approved', 'cancelled', 'refunded')),
  
  -- Document Attachments (Work Provider / Student initial brief)
  attachment_url TEXT,
  attachment_name TEXT,
  
  -- Deliverable (Helper guidance & Word document / file)
  delivery_text TEXT,
  delivery_file_url TEXT,
  delivery_file_name TEXT,
  
  -- Payment & Escrow details
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount_paid NUMERIC,
  paid_at TIMESTAMPTZ,
  
  -- Platform fee & Helper payout tracking (10% platform fee, 90% helper payout)
  platform_fee_percent NUMERIC NOT NULL DEFAULT 10.0,
  platform_fee_amount NUMERIC NOT NULL DEFAULT 0,
  helper_payout_amount NUMERIC NOT NULL DEFAULT 0,
  admin_approved_at TIMESTAMPTZ,
  admin_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist for existing deployments
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS helper_name TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS delivery_file_url TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS delivery_file_name TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC NOT NULL DEFAULT 10.0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS helper_payout_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Update status constraint if table exists
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check CHECK (status IN ('open', 'claimed', 'delivered', 'pending_approval', 'approved', 'cancelled', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_helper_id ON public.requests(helper_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON public.requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);

-- ==============================================================================
-- PUBLIC BOARD VIEW
-- ==============================================================================
DROP VIEW IF EXISTS public.requests_public CASCADE;
CREATE OR REPLACE VIEW public.requests_public AS
SELECT
  id,
  user_id,
  requester_name,
  helper_name,
  title,
  category,
  subject,
  academic_level,
  description,
  deadline,
  budget_min,
  budget_max,
  status,
  attachment_url,
  attachment_name,
  created_at
FROM public.requests
WHERE status = 'open';

-- ==============================================================================
-- MESSAGES TABLE (Real-time collaboration between poster & helper)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_request_id ON public.messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, whatsapp, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    whatsapp = CASE WHEN EXCLUDED.whatsapp <> '' THEN EXCLUDED.whatsapp ELSE public.profiles.whatsapp END,
    role = CASE WHEN EXCLUDED.role <> '' THEN EXCLUDED.role ELSE public.profiles.role END,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- REQUEST WORKFLOW TRANSITION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_request_transition()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  user_is_admin BOOLEAN;
BEGIN
  current_user_id := auth.uid();

  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify request identifier or owner';
  END IF;

  IF current_user_id IS NULL THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  SELECT (role = 'admin') INTO user_is_admin FROM public.profiles WHERE id = current_user_id;

  -- Auto calculate 10% platform fee and 90% helper payout if amount_paid is present
  IF NEW.amount_paid IS NOT NULL AND (NEW.amount_paid > 0) THEN
    NEW.platform_fee_percent := 10.0;
    NEW.platform_fee_amount := ROUND((NEW.amount_paid * 0.10), 2);
    NEW.helper_payout_amount := ROUND((NEW.amount_paid * 0.90), 2);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Admin has bypass authority for any status transition
    IF user_is_admin = TRUE THEN
      NEW.updated_at := timezone('utc'::text, now());
      RETURN NEW;
    END IF;

    IF OLD.status = 'open' AND NEW.status = 'claimed' THEN
      IF OLD.helper_id IS NOT NULL THEN
        RAISE EXCEPTION 'Request has already been claimed by another helper';
      END IF;
      IF NEW.helper_id IS NULL THEN
        RAISE EXCEPTION 'A helper must be assigned to claim this request';
      END IF;
      IF NEW.helper_id = OLD.user_id THEN
        RAISE EXCEPTION 'You cannot claim your own request';
      END IF;
      IF current_user_id <> NEW.helper_id THEN
        RAISE EXCEPTION 'You can only claim a request for yourself';
      END IF;

    ELSIF OLD.status = 'claimed' AND NEW.status = 'delivered' THEN
      IF current_user_id <> OLD.helper_id THEN
        RAISE EXCEPTION 'Only the assigned helper can submit deliverable guidance';
      END IF;
      IF (NEW.delivery_text IS NULL OR trim(NEW.delivery_text) = '') AND (NEW.delivery_file_url IS NULL) THEN
        RAISE EXCEPTION 'Please provide delivery guidance text or upload a document';
      END IF;

    ELSIF (OLD.status = 'delivered' OR OLD.status = 'pending_approval') AND NEW.status = 'approved' THEN
      -- Student or admin approved
      IF current_user_id <> OLD.user_id AND user_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only the student poster or an admin can approve and complete this request';
      END IF;

    ELSIF OLD.status = 'delivered' AND NEW.status = 'pending_approval' THEN
      -- Student paid and submitted for admin escrow approval
      IF current_user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Only the student poster can confirm payment';
      END IF;

    ELSIF (OLD.status = 'open' OR OLD.status = 'claimed') AND NEW.status = 'cancelled' THEN
      IF current_user_id <> OLD.user_id AND user_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only the student poster or an admin can cancel this request';
      END IF;

    ELSIF (OLD.status = 'pending_approval' OR OLD.status = 'delivered') AND NEW.status = 'refunded' THEN
      IF user_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only an admin can issue a refund';
      END IF;

    ELSE
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_request_transition ON public.requests;
CREATE TRIGGER tr_check_request_transition
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.check_request_transition();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile or admin can update any" ON public.profiles;
CREATE POLICY "Users can update their own profile or admin can update any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Requests Policies
DROP POLICY IF EXISTS "Public and users can view requests" ON public.requests;
CREATE POLICY "Public and users can view requests"
  ON public.requests FOR SELECT
  USING (
    status = 'open'
    OR (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR auth.uid() = helper_id OR public.is_admin()))
  );

DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.requests;
CREATE POLICY "Authenticated users can create requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants and admins can update requests" ON public.requests;
CREATE POLICY "Participants and admins can update requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = helper_id
    OR public.is_admin()
    OR (status = 'open' AND helper_id IS NULL)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = helper_id
    OR public.is_admin()
    OR (status = 'claimed' AND helper_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can delete open requests" ON public.requests;
CREATE POLICY "Owners and admins can delete open requests"
  ON public.requests FOR DELETE
  TO authenticated
  USING ((auth.uid() = user_id AND status = 'open') OR public.is_admin());

-- Messages Policies
DROP POLICY IF EXISTS "Participants can read request messages" ON public.messages;
CREATE POLICY "Participants can read request messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = messages.request_id
        AND (r.user_id = auth.uid() OR r.helper_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send request messages" ON public.messages;
CREATE POLICY "Participants can send request messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.requests r
        WHERE r.id = messages.request_id
          AND (r.user_id = auth.uid() OR r.helper_id = auth.uid())
      )
    )
  );

-- ==============================================================================
-- SUPABASE STORAGE BUCKET & POLICIES (For Assignment & Word Deliverable Files)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('request_attachments', 'request_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can read request attachments" ON storage.objects;
CREATE POLICY "Anyone can read request attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'request_attachments');

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'request_attachments');

DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
CREATE POLICY "Users can update own attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'request_attachments');

-- ==============================================================================
-- ENABLE SUPABASE REALTIME & RELOAD SCHEMA CACHE
-- ==============================================================================
GRANT SELECT ON public.requests_public TO anon, authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- TIP: TO MAKE A USER AN ADMIN RUN THIS IN SUPABASE SQL EDITOR:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
-- OR:
-- UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'your_admin_email@example.com');
-- ==============================================================================
