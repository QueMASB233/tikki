-- Create billing_intents table to track payment intents
CREATE TABLE IF NOT EXISTS public.billing_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_customer_email TEXT,
    paid BOOLEAN DEFAULT FALSE NOT NULL,
    consumed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_billing_intents_stripe_session_id ON public.billing_intents(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_billing_intents_paid ON public.billing_intents(paid);
CREATE INDEX IF NOT EXISTS idx_billing_intents_consumed ON public.billing_intents(consumed);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_billing_intents_updated_at BEFORE UPDATE ON public.billing_intents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.billing_intents TO authenticated;
GRANT ALL ON public.billing_intents TO service_role;



