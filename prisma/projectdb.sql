--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- Name: columns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.columns (
    col_columnid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    col_name character varying(100) NOT NULL,
    col_order integer NOT NULL,
    col_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.columns OWNER TO postgres;

--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    fil_fileid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    fil_name character varying(255) NOT NULL,
    fil_url text NOT NULL,
    fil_uploaded_by uuid NOT NULL,
    fil_created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labels (
    lab_labelid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    lab_name character varying(100) NOT NULL,
    lab_color character varying(20),
    lab_created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.labels OWNER TO postgres;

--
-- Name: referencetypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referencetypes (
    rt_rtid integer PRIMARY KEY,
    rt_name character varying(100) NOT NULL
);


ALTER TABLE public.referencetypes OWNER TO postgres;

--
-- Name: chatcontainers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatcontainers (
    chat_chatid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_name character varying(255),
    chat_created_by uuid NOT NULL,
    chat_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.chatcontainers OWNER TO postgres;

-- First-level dependent tables

--
-- Name: statustypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statustypes (
    stattype_typeid integer PRIMARY KEY NOT NULL,
    stattype_description character varying(255),
    stattype_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.statustypes OWNER TO postgres;

--
-- Name: statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses (
    stat_statusid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_name character varying(100) NOT NULL,
    stat_typeid integer NOT NULL REFERENCES public.statustypes(stattype_typeid) ON DELETE CASCADE,
    stat_columnid uuid REFERENCES public.columns(col_columnid) ON DELETE SET NULL,
    stat_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.statuses OWNER TO postgres;

--
-- Name: chatmessages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatmessages (
    chm_messageid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chm_chatid uuid REFERENCES public.chatcontainers(chat_chatid) ON DELETE CASCADE,
    chm_userid uuid NOT NULL,
    chm_message text NOT NULL,
    chm_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.chatmessages OWNER TO postgres;

-- Second-level dependent tables

--
-- Name: sprints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprints (
    spr_sprintid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    spr_name character varying(255) NOT NULL,
    spr_start_date date,
    spr_end_date date,
    spr_statusid uuid REFERENCES public.statuses(stat_statusid) ON DELETE SET NULL,
    spr_created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.sprints OWNER TO postgres;

-- Third-level dependent tables

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    task_taskid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_title character varying(255) NOT NULL,
    task_description text,
    task_created_at timestamp without time zone DEFAULT now(),
    task_updated_at timestamp without time zone DEFAULT now(),
    task_statusid uuid REFERENCES public.statuses(stat_statusid) ON DELETE SET NULL,
    
    task_sprintid uuid REFERENCES public.sprints(spr_sprintid) ON DELETE SET NULL,
    task_created_by uuid NOT NULL,
    task_priority integer,
    task_due_at timestamptz,
    task_assigned_to uuid,
    task_estimate integer,
    task_archived boolean DEFAULT false
);

ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: taskcontributors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taskcontributors (
  tuc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tuc_taskid uuid REFERENCES public.tasks(task_taskid) ON DELETE CASCADE,
  tuc_userid uuid NOT NULL,
  tuc_role character varying(50),
  tuc_created_at timestamptz DEFAULT now()
);


ALTER TABLE public.taskcontributors OWNER TO postgres;

--
-- Name: tasklabels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasklabels (
  tl_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tl_taskid uuid REFERENCES public.tasks(task_taskid) ON DELETE CASCADE,
  tl_labelid uuid REFERENCES public.labels(lab_labelid) ON DELETE CASCADE
);


ALTER TABLE public.tasklabels OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    com_commentid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    com_taskid uuid REFERENCES public.tasks(task_taskid) ON DELETE CASCADE,
    com_userid uuid NOT NULL,
    com_content text NOT NULL,
    com_created_at timestamp without time zone DEFAULT now(),
    com_edited_at timestamp without time zone
);

ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: filereferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.filereferences (
    fr_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    fr_fileid uuid REFERENCES public.files(fil_fileid) ON DELETE CASCADE,
    fr_referencetypeid integer REFERENCES public.referencetypes(rt_rtid),
    fr_referenceid uuid NOT NULL,
    fr_created_at timestamp without time zone DEFAULT now(),
    fr_edited_at timestamp without time zone,
    fr_note text
);

ALTER TABLE public.filereferences OWNER TO postgres;


--
-- Name: chat_last_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_last_reads (
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_messageid uuid REFERENCES public.chatmessages(chm_messageid) ON DELETE SET NULL,
  last_read_at timestamptz,
  PRIMARY KEY (chat_id, user_id)
);


ALTER TABLE public.chat_last_reads OWNER TO postgres;

--
-- Name: task_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(task_taskid) ON DELETE SET NULL,
  operation character varying(20),
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  changed_fields jsonb,
  old jsonb,
  new jsonb
);


ALTER TABLE public.task_audit OWNER TO postgres;


CREATE INDEX idx_task_audit_taskid ON public.task_audit (task_id);

CREATE TABLE public.task_audit_archive (LIKE public.task_audit INCLUDING ALL);
CREATE INDEX idx_task_audit_archive_taskid ON public.task_audit_archive (task_id);

-- Name: status_transitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.status_transitions (
    st_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    st_from_statusid uuid REFERENCES public.statuses(stat_statusid) ON DELETE CASCADE,
    st_to_statusid uuid REFERENCES public.statuses(stat_statusid) ON DELETE CASCADE
);

ALTER TABLE public.status_transitions OWNER TO postgres;

-- Indexes (helpful)
CREATE UNIQUE INDEX idx_columns_col_order ON public.columns (col_order);
CREATE INDEX idx_tasks_assigned_to ON public.tasks (task_assigned_to);
CREATE INDEX idx_tasks_due_at ON public.tasks (task_due_at);
CREATE INDEX idx_tasklabels_taskid ON public.tasklabels (tl_taskid);
CREATE INDEX idx_taskcontributors_taskid ON public.taskcontributors (tuc_taskid);
CREATE INDEX idx_comments_taskid ON public.comments (com_taskid);
CREATE INDEX idx_clr_user ON public.chat_last_reads (user_id);
CREATE INDEX idx_clr_chat ON public.chat_last_reads (chat_id);

-- End of fresh-first-install projectdb initializer
-- Reminder: intended for empty project DBs. For upgrades, use the canonical/idempotent initializer.
