// Corrected URL-based imports for Deno
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.29.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  query: string;
}

const gemini = new OpenAI({
  apiKey: Deno.env.get('GEMINI_API_KEY')!,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

console.log('Hybrid search function initialized.');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query }: RequestBody = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!, 
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const embeddingResponse = await gemini.embeddings.create({
      model: 'text-embedding-004',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { data: documents, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: 10,
    });

    // --- CHANGE #1: Throw a proper Error instance ---
    if (error) {
      console.error('Supabase RPC error:', error);
      // This ensures the catch block receives a standard Error
      throw new Error(error.message);
    }

    return new Response(JSON.stringify(documents), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // --- CHANGE #2: Improved logging in the catch block ---
    console.error('A critical error occurred:', e); // Log the raw error
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred. Check the function logs for more details.';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
