-- Update pricing_plan table with TagadaPay variant IDs
-- Retrieved from: https://app.tagadapay.com/products

-- Subscription Plans (match by billing_cycle)
UPDATE pricing_plan SET pricing_id = 'variant_1e0622a2b5dc' WHERE billing_cycle = 'Monthly' AND status = 'Active';
UPDATE pricing_plan SET pricing_id = 'variant_0f8a57ee1876' WHERE billing_cycle = 'Every 3 Months' AND status = 'Active';
UPDATE pricing_plan SET pricing_id = 'variant_30ca37a7e774' WHERE billing_cycle = 'Every 12 Months' AND status = 'Active';

-- Token Packs (match by coin_reward since billing_cycle is the same for all)
UPDATE pricing_plan SET pricing_id = 'variant_bbfefcab1665' WHERE coin_reward = 300 AND billing_cycle = 'OneTime' AND status = 'Active';
UPDATE pricing_plan SET pricing_id = 'variant_462ee68879d0' WHERE coin_reward = 750 AND billing_cycle = 'OneTime' AND status = 'Active';
UPDATE pricing_plan SET pricing_id = 'variant_da105cdcc5a3' WHERE coin_reward = 1500 AND billing_cycle = 'OneTime' AND status = 'Active';
UPDATE pricing_plan SET pricing_id = 'variant_3e7d30da10e5' WHERE coin_reward = 3000 AND billing_cycle = 'OneTime' AND status = 'Active';

-- Verify updates
SELECT id, plan_name, pricing_id, price, coin_reward, billing_cycle, status 
FROM pricing_plan 
WHERE status = 'Active' 
ORDER BY billing_cycle, price;
