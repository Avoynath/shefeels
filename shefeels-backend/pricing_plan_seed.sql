COPY public.pricing_plan
(id, plan_name, pricing_id, coupon, currency, price, discount, billing_cycle, coin_reward, status, created_at, updated_at)
FROM stdin;
hly_monthly	Honey Love Subscription	variant_1e0622a2b5dc	NOPROMO	USD	19.99	0.00	Monthly	200	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_3months	Honey Love Subscription	variant_0f8a57ee1876	NOPROMO	USD	54.99	20.00	Every 3 Months	600	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_12months	Honey Love Subscription	variant_30ca37a7e774	NOPROMO	USD	179.99	35.00	Every 12 Months	2400	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_tokens_300	Honey Love Token Pack	variant_bbfefcab1665	AR10	USD	29.99	15.00	OneTime	300	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_tokens_750	Honey Love Token Pack	variant_462ee68879d0	AR10	USD	69.99	25.00	OneTime	750	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_tokens_1500	Honey Love Token Pack	variant_da105cdcc5a3	AR10	USD	129.99	35.00	OneTime	1500	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
hly_tokens_3000	Honey Love Token Pack	variant_3e7d30da10e5	AR10	USD	239.99	45.00	OneTime	3000	Active	2025-11-24 17:17:35.149816+00	2025-11-24 17:17:35.149816+00
\.
