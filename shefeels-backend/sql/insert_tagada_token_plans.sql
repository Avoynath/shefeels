-- Insert TagadaPay token pricing plans
-- These should match the variant IDs from your TagadaPay dashboard

-- Delete existing token plans if they exist (to avoid duplicates)
DELETE FROM pricing_plan WHERE pricing_id LIKE 'honeylove-tokens-%';

-- 300 Tokens - $29.99
INSERT INTO pricing_plan (
    pricing_id,
    plan_name,
    price,
    currency,
    billing_cycle,
    coin_reward,
    status,
    display_order,
    badge,
    created_at
) VALUES (
    'honeylove-tokens-300',
    '300 Tokens',
    29.99,
    'USD',
    'OneTime',
    300,
    'Active',
    1,
    'Popular',
    NOW()
) ON CONFLICT (pricing_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    price = EXCLUDED.price,
    coin_reward = EXCLUDED.coin_reward,
    status = EXCLUDED.status,
    badge = EXCLUDED.badge;

-- 750 Tokens - $69.99
INSERT INTO pricing_plan (
    pricing_id,
    plan_name,
    price,
    currency,
    billing_cycle,
    coin_reward,
    status,
    display_order,
    badge,
    created_at
) VALUES (
    'honeylove-tokens-750',
    '750 Tokens',
    69.99,
    'USD',
    'OneTime',
    750,
    'Active',
    2,
    'Best Value',
    NOW()
) ON CONFLICT (pricing_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    price = EXCLUDED.price,
    coin_reward = EXCLUDED.coin_reward,
    status = EXCLUDED.status,
    badge = EXCLUDED.badge;

-- 1500 Tokens - $129.99
INSERT INTO pricing_plan (
    pricing_id,
    plan_name,
    price,
    currency,
    billing_cycle,
    coin_reward,
    status,
    display_order,
    created_at
) VALUES (
    'honeylove-tokens-1500',
    '1500 Tokens',
    129.99,
    'USD',
    'OneTime',
    1500,
    'Active',
    3,
    NOW()
) ON CONFLICT (pricing_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    price = EXCLUDED.price,
    coin_reward = EXCLUDED.coin_reward,
    status = EXCLUDED.status;

-- 3000 Tokens - $239.99
INSERT INTO pricing_plan (
    pricing_id,
    plan_name,
    price,
    currency,
    billing_cycle,
    coin_reward,
    status,
    display_order,
    created_at
) VALUES (
    'honeylove-tokens-3000',
    '3000 Tokens',
    239.99,
    'USD',
    'OneTime',
    3000,
    'Active',
    4,
    NOW()
) ON CONFLICT (pricing_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    price = EXCLUDED.price,
    coin_reward = EXCLUDED.coin_reward,
    status = EXCLUDED.status;

-- Verify the inserts
SELECT pricing_id, plan_name, coin_reward, price, billing_cycle, status 
FROM pricing_plan 
WHERE billing_cycle = 'OneTime'
ORDER BY display_order;
