SELECT c.log_date,
       c.user_id,
       c.customer_name,
       c.customer_follow_up,
       c.closed_service,
       c.next_follow_required,
       c.coaching_form
FROM daily_coaching_customers c
WHERE c.log_date = '2026-05-26'
  AND c.coaching_form = 'coaching_form_1'
ORDER BY c.user_id, c.created_at;
