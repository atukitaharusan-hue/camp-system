-- ============================================================
-- profiles テーブルの RLS ポリシー無限再帰を修正
-- "Admins can view all profiles" が profiles 自身を参照していたため、
-- auth.jwt() を直接使用して再帰を回避する。
-- ============================================================

-- 1. profiles テーブルの問題のあるポリシーを削除して再作成
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
    OR auth.uid() = id
  );

-- 2. 他テーブルの admin ポリシーも profiles サブクエリを使わない安全な形に変更
-- campgrounds
DROP POLICY IF EXISTS "Admins can manage campgrounds" ON public.campgrounds;
CREATE POLICY "Admins can manage campgrounds" ON public.campgrounds
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- sites
DROP POLICY IF EXISTS "Admins can manage sites" ON public.sites;
CREATE POLICY "Admins can manage sites" ON public.sites
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- options
DROP POLICY IF EXISTS "Admins can manage options" ON public.options;
CREATE POLICY "Admins can manage options" ON public.options
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- reservations
DROP POLICY IF EXISTS "Admins can view all reservations" ON public.reservations;
CREATE POLICY "Admins can view all reservations" ON public.reservations
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins can manage reservations" ON public.reservations;
CREATE POLICY "Admins can manage reservations" ON public.reservations
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- payments
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- check_ins
DROP POLICY IF EXISTS "Admins can manage check-ins" ON public.check_ins;
CREATE POLICY "Admins can manage check-ins" ON public.check_ins
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );

-- notifications
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('admin', 'manager')
  );
