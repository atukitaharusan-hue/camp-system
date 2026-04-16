-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE payment_method AS ENUM ('credit_card', 'cash', 'bank_transfer');
CREATE TYPE site_type AS ENUM ('standard', 'premium', 'deluxe', 'tent_only', 'rv_only');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'manager');

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT,
  role user_role DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create campgrounds table
CREATE TABLE public.campgrounds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  operating_hours JSONB, -- {monday: {open: "08:00", close: "18:00"}}
  amenities JSONB, -- ["wifi", "showers", "laundry"]
  rules TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create sites table
CREATE TABLE public.sites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campground_id UUID REFERENCES public.campgrounds(id) ON DELETE CASCADE NOT NULL,
  site_number TEXT NOT NULL,
  type site_type DEFAULT 'standard',
  capacity INTEGER NOT NULL DEFAULT 4, -- max guests
  price_per_night DECIMAL(10,2) NOT NULL,
  description TEXT,
  features JSONB, -- {water: true, electricity: true, sewer: false}
  location_data JSONB, -- {lat: 35.123, lng: 139.456, elevation: 100}
  drainage_rating INTEGER CHECK (drainage_rating >= 1 AND drainage_rating <= 5), -- 1-5 scale
  slope_rating INTEGER CHECK (slope_rating >= 1 AND slope_rating <= 5), -- 1-5 scale
  view_rating INTEGER CHECK (view_rating >= 1 AND view_rating <= 5), -- 1-5 scale
  distance_to_facilities INTEGER, -- meters
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  UNIQUE(campground_id, site_number)
);

-- Create options table (additional services)
CREATE TABLE public.options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  status reservation_status DEFAULT 'pending',
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CHECK (check_out_date > check_in_date),
  CHECK (guests > 0)
);

-- Create reservation_options junction table
CREATE TABLE public.reservation_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.options(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  UNIQUE(reservation_id, option_id)
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'JPY',
  method payment_method DEFAULT 'credit_card',
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create check_ins table
CREATE TABLE public.check_ins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  checked_in_by UUID REFERENCES public.profiles(id),
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  qr_code TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'booking_confirmed', 'reminder', 'check_in_ready'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_via JSONB, -- {email: true, line: false}
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_sites_campground_id ON public.sites(campground_id);
CREATE INDEX idx_sites_active ON public.sites(is_active) WHERE is_active = true;
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_site_id ON public.reservations(site_id);
CREATE INDEX idx_reservations_dates ON public.reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_payments_reservation_id ON public.payments(reservation_id);
CREATE INDEX idx_check_ins_reservation_id ON public.check_ins(reservation_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_campgrounds
  BEFORE UPDATE ON public.campgrounds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_sites
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_options
  BEFORE UPDATE ON public.options
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_reservations
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Campgrounds policies (public read, admin write)
CREATE POLICY "Anyone can view campgrounds" ON public.campgrounds
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage campgrounds" ON public.campgrounds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Sites policies (public read for active sites, admin write)
CREATE POLICY "Anyone can view active sites" ON public.sites
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage sites" ON public.sites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Options policies (public read, admin write)
CREATE POLICY "Anyone can view active options" ON public.options
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage options" ON public.options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Reservations policies
CREATE POLICY "Users can view their own reservations" ON public.reservations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create reservations" ON public.reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending reservations" ON public.reservations
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  );

CREATE POLICY "Admins can view all reservations" ON public.reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage reservations" ON public.reservations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Reservation options policies
CREATE POLICY "Users can view their reservation options" ON public.reservation_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE id = reservation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their reservation options" ON public.reservation_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE id = reservation_id AND user_id = auth.uid()
    )
  );

-- Payments policies
CREATE POLICY "Users can view their payment history" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE id = reservation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Check-ins policies
CREATE POLICY "Users can view their check-ins" ON public.check_ins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE id = reservation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage check-ins" ON public.check_ins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Insert initial data
INSERT INTO public.options (name, description, price) VALUES
('Early Check-in', '午前8時までのチェックイン', 2000),
('Late Check-out', '午後6時までのチェックアウト', 1500),
('Pet Fee', 'ペット同伴料金', 1000),
('Extra Tent', '追加テント設置', 2000),
('Firewood Bundle', '薪セット', 1500);

-- Create function to check site availability
CREATE OR REPLACE FUNCTION public.check_site_availability(
  p_site_id UUID,
  p_check_in DATE,
  p_check_out DATE
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.reservations
    WHERE site_id = p_site_id
      AND status NOT IN ('cancelled')
      AND (
        (check_in_date <= p_check_in AND check_out_date > p_check_in) OR
        (check_in_date < p_check_out AND check_out_date >= p_check_out) OR
        (check_in_date >= p_check_in AND check_out_date <= p_check_out)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate total reservation amount
CREATE OR REPLACE FUNCTION public.calculate_reservation_total(
  p_site_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_option_ids UUID[] DEFAULT ARRAY[]::UUID[]
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  nights_count INTEGER;
  site_price DECIMAL(10,2);
  options_total DECIMAL(10,2) := 0;
  total DECIMAL(10,2);
BEGIN
  -- Calculate number of nights
  nights_count := p_check_out - p_check_in;

  -- Get site price
  SELECT price_per_night INTO site_price
  FROM public.sites
  WHERE id = p_site_id;

  -- Calculate options total
  IF array_length(p_option_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(price), 0) INTO options_total
    FROM public.options
    WHERE id = ANY(p_option_ids);
  END IF;

  -- Calculate total
  total := (site_price * nights_count) + options_total;

  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;