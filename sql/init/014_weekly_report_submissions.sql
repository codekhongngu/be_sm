CREATE TABLE IF NOT EXISTS weekly_report_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_id UUID NOT NULL REFERENCES weekly_configs(id),
    user_id UUID NOT NULL REFERENCES users(id),
    manager_id UUID NOT NULL REFERENCES users(id),
    customer_met_count INTEGER DEFAULT 0,
    deep_inquiry_rate NUMERIC(5,2) DEFAULT 0,
    full_consultation_rate NUMERIC(5,2) DEFAULT 0,
    followed_through_rate NUMERIC(5,2) DEFAULT 0,
    manager_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week_id, user_id)
);