CREATE TABLE IF NOT EXISTS public.visitor_counter (
  id integer PRIMARY KEY CHECK (id = 1),
  total bigint NOT NULL CHECK (total >= 108)
);
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  session_id uuid PRIMARY KEY
);
-- Historical baseline: never overwrite an existing total on deployment.
INSERT INTO public.visitor_counter (id, total) VALUES (1, 108)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_visitor(visit_session uuid)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  current_total bigint;
  added integer;
BEGIN
  -- Serialize visits before checking the session. The lock, insert and update
  -- belong to the same transaction, including when the HTTP response is lost.
  SELECT total INTO STRICT current_total FROM public.visitor_counter
    WHERE id = 1 FOR UPDATE;
  INSERT INTO public.visitor_sessions (session_id) VALUES (visit_session)
    ON CONFLICT (session_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  IF added = 1 THEN
    UPDATE public.visitor_counter SET total = total + 1 WHERE id = 1
      RETURNING total INTO current_total;
  END IF;
  RETURN current_total;
END;
$$;
