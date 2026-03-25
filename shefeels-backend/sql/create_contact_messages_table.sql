-- Create contact_messages table with status tracking
-- Run this SQL against your database: hoe

CREATE TABLE IF NOT EXISTS contact_messages (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    interest VARCHAR(128),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'pending' NOT NULL,
    admin_notes TEXT,
    resolved_by VARCHAR(32),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- Add comment
COMMENT ON TABLE contact_messages IS 'Contact form submissions from users';
COMMENT ON COLUMN contact_messages.status IS 'Status: pending, in_progress, resolved, closed';
