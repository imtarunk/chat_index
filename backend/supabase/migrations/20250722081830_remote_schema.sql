-- Set standard client encoding and string conforming
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Create the vector extension if it doesn't already exist, as it's required for the 'vector' type
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- Define the hybrid_search function for combining semantic and keyword search results
CREATE OR REPLACE FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer) RETURNS TABLE("id" bigint, "message" "text", "similarity" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(semantic.id, keyword.id) AS id,
        COALESCE(semantic.message, keyword.message) AS message,
        -- Calculate the average similarity and explicitly cast to REAL
        ((COALESCE(semantic.similarity, 0) + COALESCE(keyword.similarity, 0)) / 2)::REAL AS similarity
    FROM match_documents(query_embedding, match_count) AS semantic
    FULL OUTER JOIN kw_match_documents(query_text, match_count) AS keyword ON semantic.id = keyword.id
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Define the kw_match_documents function for keyword-based full-text search
CREATE OR REPLACE FUNCTION "public"."kw_match_documents"("query_text" "text", "match_count" integer) RETURNS TABLE("id" bigint, "message" "text", "similarity" real)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN QUERY EXECUTE
  -- Use 'english' configuration for text search to match the index
  format('SELECT id, message, ts_rank(to_tsvector(''english'', message), plainto_tsquery(''english'', $1)) AS similarity
          FROM chat_sessions
          WHERE to_tsvector(''english'', message) @@ plainto_tsquery(''english'', $1)
          ORDER BY similarity DESC
          LIMIT $2')
  USING query_text, match_count;
END;
$_$;

-- Define the match_documents function for semantic similarity search using vector embeddings
CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "message" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.message,
    1 - (cs.embedding <=> query_embedding) AS similarity -- Calculate cosine similarity
  FROM chat_sessions AS cs
  WHERE cs.metadata @> filter -- Apply JSONB filter if provided
  ORDER BY cs.embedding <=> query_embedding -- Order by vector distance (closest first)
  LIMIT match_count;
END;
$$;

-- Set default table access method
SET default_table_access_method = "heap";

-- Create the chat_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" bigint NOT NULL,
    "session_id" character varying,
    "sender" character varying,
    "message" "text",
    "metadata" "jsonb",
    "embedding" "public"."vector"(768) -- Vector embedding column
);

-- Create a sequence for the chat_sessions table's ID column
CREATE SEQUENCE IF NOT EXISTS "public"."chat_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Link the sequence to the chat_sessions.id column
ALTER SEQUENCE "public"."chat_sessions_id_seq" OWNED BY "public"."chat_sessions"."id";

-- Set the default value for chat_sessions.id to use the sequence
ALTER TABLE ONLY "public"."chat_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."chat_sessions_id_seq"'::"regclass");

-- Add a primary key constraint to the chat_sessions table
ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");

-- Create an HNSW index on the embedding column for efficient similarity search
CREATE INDEX "chat_sessions_embedding_idx" ON "public"."chat_sessions" USING "hnsw" ("embedding" "public"."vector_ip_ops");

-- Create a GIN index on the message column for full-text search
CREATE INDEX "chat_sessions_message_fts_idx" ON "public"."chat_sessions" USING "gin" ("to_tsvector"('"english"'::"regconfig", "message"));
