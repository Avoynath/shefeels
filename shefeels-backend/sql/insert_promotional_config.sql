-- Insert promotional/offer timer configuration settings
-- Run this SQL against your database: hoe

INSERT INTO app_config (category, parameter_name, parameter_value, parameter_description) 
VALUES 
    ('promotional', 'OFFER_TIMER_MINUTES', '360', 'Duration in minutes for the offer countdown timer (default: 6 hours = 360 minutes)'),
    ('promotional', 'OFFER_DISCOUNT_PERCENTAGE', '70', 'Discount percentage shown in promotional banners (e.g., "70% off")'),
    ('promotional', 'OFFER_ENABLED', 'true', 'Enable or disable the promotional offer timer display'),
    ('promotional', 'PREMIUM_BUTTON_TEXT', 'Get Premium', 'Text displayed on the premium button in header'),
    ('promotional', 'OFFER_BADGE_TEXT', '70% off', 'Text displayed in the promotional badge/chip')
ON CONFLICT (parameter_name) DO NOTHING;

-- Verify the inserted values
SELECT * FROM app_config WHERE category = 'promotional';
